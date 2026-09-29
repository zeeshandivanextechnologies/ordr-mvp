// Module 8: turns pre-filtered Gmail messages into AI detections.
//
// For every scanned email marked as a potential order (and not yet processed):
//   1. Classify it with a cheap AI model (New Sales/Purchase Order, Order/Dispatch/Delivery Update, Not an Order)
//   2. Only for new orders: download the order attachment (PDF/Excel/CSV/image) and extract the order
//   3. Save an AI detection in ai_order_extracts (status New / Needs Review) for human review
// Updates to existing orders become suggestions instead (Module 21, services/orderUpdateService.js).
// Nothing here creates or changes an official order; that only happens when a user confirms in the AI Order Inbox.
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getClient, query } from '../config/database.js';
import { trackEvent } from '../utils/analytics.js';
import {
  DOCUMENT_EXTENSIONS,
  UPDATE_CLASSIFICATIONS,
  classifyEmail,
  extractOrder,
  normalizeExtraction,
  readDocumentContent,
} from '../utils/orderExtraction.js';
import { getGmailAccessToken, downloadGmailAttachment } from '../controllers/integrationController.js';
import { findDuplicateWarning, hasValidSignature } from './documentProcessor.js';
import { getPlanContext, isReadOnly, remainingQuota } from './planGuard.js';
import { notifyNewDetection } from './notificationService.js';
import { createUpdateSuggestion } from './orderUpdateService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads', 'po');

const BATCH_SIZE = 20;
// A message is given up after this many failed AI attempts (e.g. AI service down for long)
const MAX_ATTEMPTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const NEW_ORDER_TYPES = { 'New Sales Order': 'sales', 'New Purchase Order': 'purchase' };
const GENERIC_IMAGE = /^image\d*\.(png|jpe?g|gif)$/i;

const processingCompanies = new Set();

const extOf = (name) => path.extname(String(name || '')).toLowerCase().replace('.', '');

// Picks the attachment most likely to be the order document: PDF/Excel/CSV first, then images
const pickOrderAttachment = (attachments) => {
  const candidates = (Array.isArray(attachments) ? attachments : []).filter(
    (a) =>
      a && a.attachmentId && a.filename &&
      DOCUMENT_EXTENSIONS.includes(extOf(a.filename)) &&
      !GENERIC_IMAGE.test(a.filename) &&
      (!a.size || a.size <= MAX_ATTACHMENT_BYTES)
  );
  return (
    candidates.find((a) => ['pdf', 'xlsx', 'csv'].includes(extOf(a.filename))) ||
    candidates[0] ||
    null
  );
};

const recordFailure = async (message, error) => {
  const attempts = (message.ai_attempts || 0) + 1;
  const giveUp = attempts >= MAX_ATTEMPTS;
  await query(
    `UPDATE gmail_messages
     SET ai_attempts = $1, ai_error = $2,
         processed = $3, processed_at = CASE WHEN $3 THEN NOW() ELSE processed_at END
     WHERE id = $4`,
    [attempts, String(error || 'AI processing failed').slice(0, 1000), giveUp, message.id]
  );
};

const markProcessed = (messageId) =>
  query('UPDATE gmail_messages SET processed = true, processed_at = NOW(), ai_error = NULL WHERE id = $1', [messageId]);

// Returns 'created' | 'classified' | 'busy' | 'failed'
const processMessage = async (message, companyName, tokenCache) => {
  const from = message.sender_name ? `${message.sender_name} <${message.sender_email}>` : message.sender_email;

  // Step 1: classification (cheap model). An update email that was already classified
  // (e.g. queued again for update matching) keeps its classification.
  let classified;
  if (UPDATE_CLASSIFICATIONS.includes(message.ai_classification)) {
    classified = { classification: message.ai_classification, confidence: message.ai_confidence, reason: message.ai_reason };
  } else {
    classified = await classifyEmail({
      companyName,
      from,
      subject: message.subject,
      body: message.body || message.snippet,
      attachmentNames: message.attachment_names,
    });
    if (classified.error) {
      await recordFailure(message, classified.error);
      return classified.busy ? 'busy' : 'failed';
    }

    await query(
      'UPDATE gmail_messages SET ai_classification = $1, ai_confidence = $2, ai_reason = $3 WHERE id = $4',
      [classified.classification, classified.confidence, classified.reason, message.id]
    );
  }

  // Module 21: an update to an existing order becomes a suggestion for the user to apply
  if (UPDATE_CLASSIFICATIONS.includes(classified.classification)) {
    return createUpdateSuggestion(message, companyName, classified, { recordFailure });
  }

  const orderType = NEW_ORDER_TYPES[classified.classification];
  if (!orderType) {
    // Not an order: no detection is created
    await markProcessed(message.id);
    return 'classified';
  }

  // Step 2: download the order attachment, if any
  let savedFile = null;
  let content = null;
  const attachment = pickOrderAttachment(message.attachments);
  if (attachment && message.connection_active) {
    try {
      if (!tokenCache.has(message.email_connection_id)) {
        tokenCache.set(message.email_connection_id, await getGmailAccessToken(message.email_connection_id));
      }
      const token = tokenCache.get(message.email_connection_id);
      if (token) {
        const bytes = await downloadGmailAttachment(token, message.message_id, attachment.attachmentId);
        const ext = extOf(attachment.filename);
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        const filePath = path.join(UPLOAD_DIR, `${Date.now()}-${crypto.randomInt(1e9)}.${ext}`);
        fs.writeFileSync(filePath, bytes);
        if (hasValidSignature(filePath, ext)) {
          savedFile = { filePath, ext, name: attachment.filename, size: bytes.length };
          content = await readDocumentContent(filePath, ext);
        } else {
          // Attachment content does not match its extension: do not keep or read it
          fs.unlink(filePath, () => {});
        }
      }
    } catch (err) {
      // Attachment problems should not block extraction from the email text
      console.error(`Gmail attachment download failed (${message.message_id}):`, err.message);
    }
  }

  // Step 3: extraction (strong model only for real new orders)
  const emailText = [`From: ${from || ''}`, `Subject: ${message.subject || ''}`, '', message.body || message.snippet || ''].join('\n');
  const { raw, error, busy } = await extractOrder({
    companyName,
    content,
    extraText: emailText,
    context: `This order was received by email${savedFile ? ` with the attachment "${savedFile.name}"` : ''}. The email was classified as "${classified.classification}".`,
  });

  if (!raw) {
    if (savedFile) fs.unlink(savedFile.filePath, () => {});
    await recordFailure(message, error);
    return busy ? 'busy' : 'failed';
  }
  if (!raw.order_type) raw.order_type = orderType;

  const values = normalizeExtraction(raw, savedFile?.name || message.subject || '');
  const duplicateWarning = await findDuplicateWarning(message.company_id, values.po_number);
  const status = values.confidence >= 70 && values.customer_name && values.po_number && !duplicateWarning ? 'New' : 'Needs Review';

  let newExtractId = null;
  const client = await getClient();
  try {
    await client.query('BEGIN');

    let documentId = null;
    if (savedFile) {
      const doc = await client.query(
        `INSERT INTO po_documents (company_id, uploaded_by, file_name, file_path, file_type, file_size, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'Processed') RETURNING id`,
        [
          message.company_id,
          message.connection_user_id,
          String(savedFile.name).slice(0, 255),
          savedFile.filePath,
          savedFile.ext === 'jpeg' ? 'jpg' : savedFile.ext,
          savedFile.size,
        ]
      );
      documentId = doc.rows[0].id;
    }

    const extractInsert = await client.query(
      `INSERT INTO ai_order_extracts (
         company_id, source_email, source_subject, source_body, attachment_name,
         order_type, customer_name, po_number, items, approx_value, email_date, confidence, status,
         order_date, required_delivery_date, delivery_location, currency, line_items, field_confidence,
         po_document_id, gmail_message_id, classification, classification_reason, duplicate_warning
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
       ON CONFLICT (company_id, gmail_message_id) WHERE gmail_message_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [
        message.company_id,
        message.sender_email ? String(message.sender_email).slice(0, 255) : null,
        message.subject ? String(message.subject).slice(0, 255) : null,
        message.body || message.snippet || null,
        savedFile ? String(savedFile.name).slice(0, 255) : message.attachment_names ? String(message.attachment_names).slice(0, 255) : null,
        values.order_type,
        values.customer_name,
        values.po_number,
        values.items,
        values.approx_value,
        message.received_at || new Date(),
        values.confidence,
        status,
        values.order_date,
        values.required_delivery_date,
        values.delivery_location,
        values.currency,
        JSON.stringify(values.line_items),
        JSON.stringify(values.field_confidence),
        documentId,
        message.message_id,
        classified.classification,
        classified.reason,
        duplicateWarning,
      ]
    );
    newExtractId = extractInsert.rows[0]?.id || null;

    await client.query(
      'UPDATE gmail_messages SET processed = true, processed_at = NOW(), ai_error = NULL WHERE id = $1',
      [message.id]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (savedFile) fs.unlink(savedFile.filePath, () => {});
    throw err;
  } finally {
    client.release();
  }

  if (newExtractId) {
    trackEvent({
      event: 'order_detected',
      companyId: message.company_id,
      properties: { source: 'email', status, detectionId: newExtractId, classification: classified.classification },
      dedupeKey: `order_detected:${newExtractId}`,
    });
    await notifyNewDetection(message.company_id, {
      extractId: newExtractId,
      status,
      customerName: values.customer_name,
      poNumber: values.po_number,
      source: 'email',
    });
  }

  return 'created';
};

// Processes up to BATCH_SIZE pending potential-order emails for one company.
export const processPendingGmailMessages = async (companyId) => {
  if (processingCompanies.has(companyId)) return { skipped: true };
  processingCompanies.add(companyId);

  const summary = { created: 0, classified: 0, busy: 0, failed: 0 };
  try {
    // Plan: nothing is processed once the trial / plan has ended, and AI extractions
    // stop at the plan limit. Emails stay pending and are processed after an upgrade.
    const planCtx = await getPlanContext(companyId);
    if (isReadOnly(planCtx)) return { ...summary, skipped: 'plan-expired' };
    let aiQuota = await remainingQuota(companyId, 'aiExtractions', planCtx);
    if (aiQuota <= 0) return { ...summary, skipped: 'plan-limit' };
    const pending = await query(
      `SELECT gm.*, ec.user_id AS connection_user_id, ec.is_active AS connection_active
       FROM gmail_messages gm
       JOIN email_connections ec ON ec.id = gm.email_connection_id
       WHERE gm.company_id = $1 AND gm.is_potential_order = true AND gm.processed = false
       ORDER BY gm.received_at ASC NULLS LAST
       LIMIT $2`,
      [companyId, BATCH_SIZE]
    );
    if (pending.rows.length === 0) return summary;

    const company = await query('SELECT name FROM companies WHERE id = $1', [companyId]);
    const companyName = company.rows[0]?.name || null;
    const tokenCache = new Map();

    for (const message of pending.rows) {
      let result;
      try {
        result = await processMessage(message, companyName, tokenCache);
      } catch (err) {
        console.error(`Gmail AI processing error (${message.message_id}):`, err.message);
        await recordFailure(message, err.message).catch(() => {});
        result = 'failed';
      }
      summary[result] += 1;
      // If the AI service is overloaded, stop and try the rest on the next run
      if (result === 'busy') break;
      if (result === 'created') {
        aiQuota -= 1;
        if (aiQuota <= 0) break;
      }
    }

    if (summary.created > 0 || summary.busy > 0) {
      console.log(`[gmail-ai] company ${companyId}:`, summary);
    }
    return summary;
  } finally {
    processingCompanies.delete(companyId);
  }
};
