// Module 21: email update matching.
// An email classified as an Order / Dispatch / Delivery Update is read by the cheap AI
// model, matched to an existing order (and shipment), and saved as a suggestion such as
// "Update PO #8192 -> Dispatched, LR 928721". Nothing changes until a user applies it.
//
// Matching priority (spec): 1. exact PO number  2. exact LR / AWB / GR number
// 3. same Gmail thread as the email the order came from  4. customer/supplier + product.
import { getClient, query } from '../config/database.js';
import { extractOrderUpdate } from '../utils/orderExtraction.js';
import { notifyCompany } from './notificationService.js';

// Update types that move a shipment; the others change the order's own status
export const SHIPMENT_UPDATE_TYPES = ['ready-dispatch', 'dispatched', 'in-transit', 'delivered', 'delayed'];
export const ORDER_UPDATE_TYPES = ['confirmed', 'processing', 'cancelled'];

const DEFAULT_UPDATE_TYPE = {
  'Dispatch Update': 'dispatched',
  'Delivery Update': 'delivered',
  'Order Update': 'other',
};

// "PO #8192", "po-8192" and "8192" all compare equal; tracking numbers ignore spaces/dashes
const normalizePo = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^po/, '');
const normalizeRef = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const SQL_NORMALIZE_PO = (column) => `regexp_replace(regexp_replace(lower(COALESCE(${column}, '')), '[^a-z0-9]', '', 'g'), '^po', '')`;
const SQL_NORMALIZE_REF = (column) => `regexp_replace(lower(COALESCE(${column}, '')), '[^a-z0-9]', '', 'g')`;
const escapeLike = (value) => String(value).replace(/[\\%_]/g, (c) => `\\${c}`);

// The one shipment an update most likely refers to, when the email did not name it
const pickActiveShipment = async (orderId, updateType) => {
  if (!SHIPMENT_UPDATE_TYPES.includes(updateType)) return null;
  const result = await query(
    `SELECT id FROM shipments
     WHERE order_id = $1 AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'delivered')
     ORDER BY created_at DESC LIMIT 2`,
    [orderId]
  );
  return result.rows.length === 1 ? result.rows[0].id : null;
};

/**
 * Finds the order (and shipment) an update refers to.
 * Returns { orderId, shipmentId, method, confidence } or null.
 * confidence: 'high' (exact PO / tracking number), 'medium' (same thread), 'low' (ambiguous or party match).
 */
export const matchOrderUpdate = async (companyId, values, { threadId, gmailMessageId } = {}) => {
  let match = null;

  // 1. Exact PO number
  const po = normalizePo(values.po_number);
  if (po) {
    const orders = await query(
      `SELECT id FROM orders
       WHERE company_id = $1 AND deleted_at IS NULL AND ${SQL_NORMALIZE_PO('po_number')} = $2
       ORDER BY updated_at DESC LIMIT 5`,
      [companyId, po]
    );
    if (orders.rows.length > 0) {
      match = { orderId: orders.rows[0].id, shipmentId: null, method: 'po', confidence: orders.rows.length === 1 ? 'high' : 'low' };
    }
  }

  // 2. Exact LR / AWB / GR number (also pins the shipment when the PO matched)
  const refs = [values.lr_number, values.awb_number, values.gr_number].map(normalizeRef).filter((r) => r.length >= 3);
  if (refs.length > 0) {
    const shipments = await query(
      `SELECT s.id, s.order_id FROM shipments s
       JOIN orders o ON o.id = s.order_id
       WHERE s.company_id = $1 AND o.deleted_at IS NULL
         AND (${SQL_NORMALIZE_REF('s.lr_number')} = ANY($2)
           OR ${SQL_NORMALIZE_REF('s.awb_number')} = ANY($2)
           OR ${SQL_NORMALIZE_REF('s.gr_number')} = ANY($2))
       ORDER BY s.updated_at DESC LIMIT 5`,
      [companyId, refs]
    );
    if (match) {
      const sameOrder = shipments.rows.find((s) => s.order_id === match.orderId);
      if (sameOrder) match.shipmentId = sameOrder.id;
    } else if (shipments.rows.length > 0) {
      const orderIds = new Set(shipments.rows.map((s) => s.order_id));
      match = {
        orderId: shipments.rows[0].order_id,
        shipmentId: shipments.rows[0].id,
        method: 'tracking',
        confidence: orderIds.size === 1 && shipments.rows.length === 1 ? 'high' : 'low',
      };
    }
  }

  // 3. Same Gmail thread as the email the order was created from (or an applied update)
  if (!match && threadId) {
    const threadOrders = await query(
      `SELECT DISTINCT order_id FROM (
         SELECT e.order_id FROM gmail_messages gm
         JOIN ai_order_extracts e ON e.company_id = gm.company_id AND e.gmail_message_id = gm.message_id
         WHERE gm.company_id = $1 AND gm.thread_id = $2 AND gm.message_id <> $3 AND e.order_id IS NOT NULL
         UNION
         SELECT u.order_id FROM order_update_suggestions u
         WHERE u.company_id = $1 AND u.thread_id = $2 AND u.gmail_message_id <> $3
           AND u.status = 'Applied' AND u.order_id IS NOT NULL
       ) t
       JOIN orders o ON o.id = t.order_id AND o.deleted_at IS NULL`,
      [companyId, threadId, gmailMessageId || '']
    );
    if (threadOrders.rows.length === 1) {
      match = { orderId: threadOrders.rows[0].order_id, shipmentId: null, method: 'thread', confidence: 'medium' };
    }
  }

  // 4. Customer/supplier (+ product) among open orders: only a single clear hit counts
  const party = values.party_name && values.party_name.trim().length >= 3 ? values.party_name.trim() : null;
  if (!match && party) {
    const product = values.product && values.product.trim().length >= 2 ? values.product.trim() : null;
    const orders = await query(
      `SELECT o.id FROM orders o
       WHERE o.company_id = $1 AND o.deleted_at IS NULL
         AND LOWER(COALESCE(o.status, '')) NOT IN ('delivered', 'cancelled')
         AND (o.party_name ILIKE '%' || $2 || '%' OR $3 ILIKE '%' || o.party_name || '%')
         AND ($4::text IS NULL OR EXISTS (
           SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.product ILIKE '%' || $4 || '%'))
       ORDER BY o.updated_at DESC LIMIT 2`,
      [companyId, escapeLike(party), party, product ? escapeLike(product) : null]
    );
    if (orders.rows.length === 1) {
      match = { orderId: orders.rows[0].id, shipmentId: null, method: 'party', confidence: 'low' };
    }
  }

  if (match && !match.shipmentId) {
    match.shipmentId = await pickActiveShipment(match.orderId, values.update_type);
  }
  return match;
};

/**
 * Called by the Gmail processor for an email classified as an update.
 * Returns 'classified' (suggestion saved or already there), 'busy' or 'failed'.
 */
export const createUpdateSuggestion = async (message, companyName, classified, { recordFailure }) => {
  const from = message.sender_name ? `${message.sender_name} <${message.sender_email}>` : message.sender_email;
  const extracted = await extractOrderUpdate({
    companyName,
    from,
    subject: message.subject,
    body: message.body || message.snippet,
    classification: classified.classification,
  });
  if (extracted.error) {
    await recordFailure(message, extracted.error);
    return extracted.busy ? 'busy' : 'failed';
  }

  const values = extracted.values;
  if (!values.update_type) values.update_type = DEFAULT_UPDATE_TYPE[classified.classification] || 'other';

  const match = await matchOrderUpdate(message.company_id, values, {
    threadId: message.thread_id,
    gmailMessageId: message.message_id,
  });

  let suggestionId = null;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO order_update_suggestions (
         company_id, gmail_message_id, thread_id, source_email, source_name, source_subject, source_body,
         email_date, classification, update_type, extracted, confidence, reason,
         order_id, shipment_id, match_method, match_confidence
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (company_id, gmail_message_id) DO NOTHING
       RETURNING id`,
      [
        message.company_id,
        message.message_id,
        message.thread_id || null,
        message.sender_email ? String(message.sender_email).slice(0, 255) : null,
        message.sender_name ? String(message.sender_name).slice(0, 255) : null,
        message.subject || null,
        message.body || message.snippet || null,
        message.received_at || new Date(),
        classified.classification,
        values.update_type,
        JSON.stringify(values),
        extracted.confidence,
        classified.reason || null,
        match?.orderId || null,
        match?.shipmentId || null,
        match?.method || null,
        match?.confidence || null,
      ]
    );
    suggestionId = inserted.rows[0]?.id || null;
    await client.query(
      'UPDATE gmail_messages SET processed = true, processed_at = NOW(), ai_error = NULL WHERE id = $1',
      [message.id]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  if (suggestionId) {
    const ref = values.po_number ? `PO ${values.po_number}` : values.lr_number ? `LR ${values.lr_number}` : 'an order';
    await notifyCompany(message.company_id, {
      type: 'order_update_detected',
      title: 'Order update detected',
      message: `An email about ${ref}${values.party_name ? ` (${values.party_name})` : ''} may update an order. Review it in the AI Order Inbox.`,
      link: `/app/ai-inbox/updates/${suggestionId}`,
      entityType: 'order_update',
      entityId: suggestionId,
      dedupeKey: `order-update:${suggestionId}`,
    });
  }
  return 'classified';
};
