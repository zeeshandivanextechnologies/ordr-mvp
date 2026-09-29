// Module 11: turns a saved order document (uploaded file) into AI detections.
// Shared by the PO upload and the "try again" (reprocess) action.
import fs from 'fs';
import crypto from 'crypto';
import { getClient, query } from '../config/database.js';
import { trackEvents } from '../utils/analytics.js';
import { extractOrder, normalizeExtraction, readDocumentContent } from '../utils/orderExtraction.js';
import { notifyNewDetection } from './notificationService.js';

// ---------- file validation ----------

const startsWith = (buf, bytes) => bytes.every((b, i) => buf[i] === b);

// Checks the file's real content, not just its extension (a renamed .exe is rejected)
export const hasValidSignature = (filePath, ext) => {
  let head;
  try {
    const fd = fs.openSync(filePath, 'r');
    head = Buffer.alloc(4096);
    const read = fs.readSync(fd, head, 0, 4096, 0);
    fs.closeSync(fd);
    head = head.subarray(0, read);
  } catch {
    return false;
  }
  if (head.length === 0) return false;

  switch (ext) {
    case 'pdf':
      return head.subarray(0, 1024).includes(Buffer.from('%PDF'));
    case 'png':
      return startsWith(head, [0x89, 0x50, 0x4e, 0x47]);
    case 'jpg':
    case 'jpeg':
      return startsWith(head, [0xff, 0xd8, 0xff]);
    case 'xlsx':
      return startsWith(head, [0x50, 0x4b, 0x03, 0x04]); // ZIP container
    case 'csv':
      // Plain text: no NUL bytes and not a known binary format
      return !head.includes(0x00) && !startsWith(head, [0x50, 0x4b, 0x03, 0x04]) && !startsWith(head, [0x4d, 0x5a]);
    default:
      return false;
  }
};

export const hashFile = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

// ---------- duplicate PO check ----------

const formatDay = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

// Returns a warning text when this PO number already exists as an order or an open AI detection
export const findDuplicateWarning = async (companyId, poNumber, excludeDocumentId = null) => {
  if (!poNumber) return null;
  const order = await query(
    `SELECT created_at FROM orders WHERE company_id = $1 AND deleted_at IS NULL AND LOWER(TRIM(po_number)) = LOWER(TRIM($2))
     ORDER BY created_at DESC LIMIT 1`,
    [companyId, poNumber]
  );
  if (order.rows[0]) {
    return `An order with PO number "${poNumber}" already exists (created ${formatDay(order.rows[0].created_at)}). Check it is not a duplicate before confirming.`;
  }
  const detection = await query(
    `SELECT created_at, status FROM ai_order_extracts
     WHERE company_id = $1 AND LOWER(TRIM(po_number)) = LOWER(TRIM($2)) AND status <> 'Ignored'
       AND ($3::uuid IS NULL OR po_document_id IS DISTINCT FROM $3::uuid)
     ORDER BY created_at DESC LIMIT 1`,
    [companyId, poNumber, excludeDocumentId]
  );
  if (detection.rows[0]) {
    return `Another AI Inbox entry with PO number "${poNumber}" already exists (${detection.rows[0].status}, ${formatDay(detection.rows[0].created_at)}). Check it is not a duplicate before confirming.`;
  }
  return null;
};

// ---------- processing ----------

// Reads the document and creates one AI detection per order found in it.
// Returns { created, aiBusy, error }.
export const processDocument = async ({ document, companyId, userId, maxExtracts = Infinity }) => {
  const ext = String(document.file_type || '').toLowerCase();
  const content = await readDocumentContent(document.file_path, ext);

  let raws = [];
  let aiBusy = false;
  let lastError = null;

  const orderList = content.structured?.orderList;
  if (orderList && orderList.length > 1) {
    // A sheet listing several orders: parsed directly, one detection per order
    raws = orderList;
  } else {
    const companyResult = await query('SELECT name FROM companies WHERE id = $1', [companyId]);
    // AI runs outside any DB transaction so a slow response does not hold a connection
    const { raw, error, busy } = await extractOrder({ companyName: companyResult.rows[0]?.name || null, content });
    if (raw && typeof raw === 'object') raws = [raw];
    aiBusy = !!busy;
    lastError = error;
  }

  if (raws.length === 0) {
    console.warn('Order extraction failed; document stays Pending. Last error:', lastError);
    return { created: 0, aiBusy, error: lastError };
  }

  // Plan limit: never create more detections than the AI extraction quota allows
  let skippedByPlanLimit = 0;
  if (raws.length > maxExtracts) {
    skippedByPlanLimit = raws.length - Math.max(maxExtracts, 0);
    raws = raws.slice(0, Math.max(maxExtracts, 0));
    if (raws.length === 0) return { created: 0, aiBusy: false, error: null, skippedByPlanLimit };
  }

  const prepared = [];
  for (const raw of raws) {
    const values = normalizeExtraction(raw, document.file_name);
    const duplicateWarning = await findDuplicateWarning(companyId, values.po_number, document.id);
    // Missing key fields or a possible duplicate always need a human look
    const status = values.confidence >= 70 && values.customer_name && values.po_number && !duplicateWarning
      ? 'New'
      : 'Needs Review';
    prepared.push({ values, status, duplicateWarning });
  }

  const createdDetections = [];
  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (const { values, status, duplicateWarning } of prepared) {
      const inserted = await client.query(
        `INSERT INTO ai_order_extracts (
           company_id, created_by, order_type, customer_name, po_number, items, approx_value,
           email_date, confidence, status, attachment_name,
           order_date, required_delivery_date, delivery_location, currency,
           line_items, field_confidence, po_document_id, duplicate_warning
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         RETURNING id`,
        [
          companyId,
          userId,
          values.order_type,
          values.customer_name,
          values.po_number,
          values.items,
          values.approx_value,
          values.confidence,
          status,
          document.file_name,
          values.order_date,
          values.required_delivery_date,
          values.delivery_location,
          values.currency,
          JSON.stringify(values.line_items),
          JSON.stringify(values.field_confidence),
          document.id,
          duplicateWarning,
        ]
      );
      createdDetections.push({ id: inserted.rows[0].id, status, values });
    }
    await client.query(
      `UPDATE po_documents SET status = 'Processed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [document.id]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  trackEvents(createdDetections.map((d) => ({
    event: 'order_detected',
    companyId,
    userId,
    properties: { source: 'upload', status: d.status, detectionId: d.id },
    dedupeKey: `order_detected:${d.id}`,
  })));

  // Tell the rest of the team (the uploader already knows)
  for (const d of createdDetections) {
    await notifyNewDetection(companyId, {
      extractId: d.id,
      status: d.status,
      customerName: d.values.customer_name,
      poNumber: d.values.po_number,
      source: `upload "${document.file_name}"`,
    }, { excludeUserId: userId });
  }

  return { created: prepared.length, aiBusy: false, error: null, skippedByPlanLimit };
};
