import { getClient, query } from '../config/database.js';
import { logAudit } from '../utils/audit.js';
import { cleanCurrency, cleanDate, cleanLineItems, summarizeItems } from '../utils/orderExtraction.js';
import { assertWithinLimit, sendPlanError } from '../services/planGuard.js';

const EXTRACT_STATUSES = ['New', 'Needs Review', 'Confirmed', 'Ignored'];
const EXTRACT_COLUMNS = [
  'order_type', 'customer_name', 'po_number', 'items', 'approx_value', 'confidence',
  'order_date', 'required_delivery_date', 'delivery_location', 'currency', 'line_items',
];

// DATE columns come back as local-midnight Date objects; send them as plain YYYY-MM-DD
const toDateString = (d) =>
  d instanceof Date
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : d;

const formatExtract = (row) =>
  row && {
    ...row,
    order_date: toDateString(row.order_date),
    required_delivery_date: toDateString(row.required_delivery_date),
  };

const getExtractRow = async (id, companyId) => {
  const { rows } = await query('SELECT * FROM ai_order_extracts WHERE id = $1 AND company_id = $2', [id, companyId]);
  return formatExtract(rows[0]) || null;
};

const round2 = (n) => Math.round(n * 100) / 100;

// Builds order lines from the extracted line items. Returns { items } or { error }.
// Falls back to a single summary line for older extracts without line items.
const buildOrderItems = (extract) => {
  const lineItems = Array.isArray(extract.line_items) ? extract.line_items : [];
  if (lineItems.length > 0) {
    const items = [];
    for (let i = 0; i < lineItems.length; i += 1) {
      const line = lineItems[i];
      const label = line.product || `Item ${i + 1}`;
      if (!line.product) return { error: `Product name is missing for item ${i + 1}. Edit the entry before confirming.` };
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        return { error: `Quantity is missing for "${label}". Edit the entry before confirming.` };
      }
      let unitPrice = Number(line.unit_price);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        const total = Number(line.total);
        unitPrice = Number.isFinite(total) && total >= 0 ? total / qty : 0;
      }
      items.push({
        product: line.product,
        sku: line.sku || null,
        qty,
        unit: line.unit || 'PCS',
        unitPrice: round2(unitPrice),
      });
    }
    return { items };
  }

  const itemsText = (extract.items && extract.items.trim() && extract.items.trim() !== 'Unknown') ? extract.items.trim() : (extract.po_number || 'Material');
  const value = Number.isFinite(parseFloat(extract.approx_value)) && parseFloat(extract.approx_value) > 0 ? parseFloat(extract.approx_value) : 0;
  return {
    items: [{
      product: itemsText,
      sku: null,
      qty: 1,
      unit: 'PCS',
      unitPrice: value,
    }],
  };
};

const estimateItemCount = (itemsText) => {
  if (!itemsText || !String(itemsText).trim() || String(itemsText).trim().toLowerCase() === 'unknown') {
    return 0;
  }
  const parts = String(itemsText).split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).length;
  return Math.max(1, parts);
};

export const listAiExtracts = async (req, res, next) => {
  try {
    const { company_id: companyId } = req.user;
    const { rows } = await query(
      `SELECT id, order_type, customer_name, po_number, items, approx_value,
              email_date, confidence, status, source_email, source_subject,
              source_body, attachment_name, created_at, currency,
              COALESCE(jsonb_array_length(line_items), 0) AS line_item_count
       FROM ai_order_extracts
       WHERE company_id = $1
       ORDER BY created_at DESC`,
      [companyId]
    );

    const extracts = rows.map(({ line_item_count: lineItemCount, ...row }) => ({
      ...row,
      item_count: lineItemCount > 0 ? lineItemCount : estimateItemCount(row.items),
    }));

    const counts = { New: 0, 'Needs Review': 0, Confirmed: 0, Ignored: 0 };
    for (const row of extracts) {
      if (Object.prototype.hasOwnProperty.call(counts, row.status)) {
        counts[row.status] += 1;
      }
    }

    res.json({ extracts, counts });
  } catch (error) {
    next(error);
  }
};

export const getAiExtract = async (req, res, next) => {
  try {
    const { company_id: companyId } = req.user;
    const { id } = req.params;
    const extract = await getExtractRow(id, companyId);
    if (!extract) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    res.json({ extract });
  } catch (error) {
    next(error);
  }
};

export const updateAiExtract = async (req, res, next) => {
  try {
    const { company_id: companyId } = req.user;
    const { id } = req.params;

    const extract = await getExtractRow(id, companyId);
    if (!extract) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    const updates = {};
    for (const field of EXTRACT_COLUMNS) {
      if (Object.prototype.hasOwnProperty.call(req.body, field) && req.body[field] !== extract[field]) {
        updates[field] = req.body[field];
      }
    }

    // Extended fields: blank values are stored as null (never a placeholder)
    for (const field of ['order_date', 'required_delivery_date']) {
      if (updates[field] === undefined) continue;
      if (updates[field] === null || updates[field] === '') {
        updates[field] = null;
      } else {
        const date = cleanDate(updates[field]);
        if (!date) return res.status(400).json({ message: 'Dates must be valid (YYYY-MM-DD)' });
        updates[field] = date;
      }
    }
    if (updates.delivery_location !== undefined) {
      updates.delivery_location = String(updates.delivery_location ?? '').trim().slice(0, 1000) || null;
    }
    if (updates.currency !== undefined) {
      if (updates.currency === null || updates.currency === '') {
        updates.currency = null;
      } else {
        const currency = cleanCurrency(updates.currency);
        if (!currency) return res.status(400).json({ message: 'Currency must be a 3-letter code like INR or USD' });
        updates.currency = currency;
      }
    }
    if (updates.line_items !== undefined) {
      if (!Array.isArray(updates.line_items)) {
        return res.status(400).json({ message: 'Items must be a list' });
      }
      const lineItems = cleanLineItems(updates.line_items);
      updates.line_items = JSON.stringify(lineItems);
      // Keep the text summary used by the inbox list in sync
      updates.items = summarizeItems(lineItems);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'status') && req.body.status !== extract.status) {
      if (extract.status === 'Confirmed') {
        return res.status(400).json({ message: 'This detection is already confirmed and cannot be changed' });
      }
      if (!EXTRACT_STATUSES.includes(req.body.status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      if (req.body.status === 'Confirmed') {
        return res.status(400).json({ message: 'Use the Confirm Order action to mark a detection as confirmed' });
      }
      updates.status = req.body.status;
    }

    if (updates.approx_value === '' || updates.approx_value === null) {
      updates.approx_value = null;
    } else if (updates.approx_value !== undefined) {
      const value = parseFloat(updates.approx_value);
      if (!Number.isFinite(value) || value < 0) {
        return res.status(400).json({ message: 'Approx value must be a valid non-negative number' });
      }
      updates.approx_value = value;
    }
    if (updates.confidence !== undefined) {
      const conf = Number(updates.confidence);
      if (!Number.isFinite(conf) || conf < 0 || conf > 100) {
        return res.status(400).json({ message: 'Confidence must be between 0 and 100' });
      }
      updates.confidence = conf;
    }
    if (updates.order_type !== undefined && !['Purchase', 'Sales'].includes(updates.order_type)) {
      return res.status(400).json({ message: 'Order type must be Purchase or Sales' });
    }

    if (Object.keys(updates).length === 0) {
      return res.json({ message: 'No changes', extract });
    }

    const setClause = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`).join(', ');
    const values = Object.values(updates);
    const { rows } = await query(
      `UPDATE ai_order_extracts SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    await logAudit(req, updates.status === 'Ignored' ? 'ai.ignored' : extract.status === 'Ignored' && updates.status ? 'ai.restored' : 'ai.edited', {
      entityType: 'ai_detection',
      entityId: id,
      details: { fields: Object.keys(updates) },
    });
    res.json({ message: 'Entry updated successfully', extract: formatExtract(rows[0]) });
  } catch (error) {
    next(error);
  }
};

export const confirmAiExtract = async (req, res, next) => {
  const client = await getClient();
  try {
    const { company_id: companyId, id: userId } = req.user;
    const { id } = req.params;

    const extract = await getExtractRow(id, companyId);
    if (!extract) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    if (extract.status === 'Confirmed') {
      return res.status(400).json({ message: 'Order already confirmed' });
    }
    if (extract.status === 'Ignored') {
      return res.status(400).json({ message: 'This detection was ignored and cannot be confirmed' });
    }

    const partyName = extract.customer_name && extract.customer_name.trim() && extract.customer_name.trim() !== 'Unknown'
      ? extract.customer_name.trim()
      : null;
    const poNumber = extract.po_number && extract.po_number.trim() && extract.po_number.trim() !== 'Unknown'
      ? extract.po_number.trim()
      : null;

    if (!partyName) {
      return res.status(400).json({ message: 'Customer/Supplier name is required to confirm' });
    }
    if (!poNumber) {
      return res.status(400).json({ message: 'PO / Order number is required to confirm' });
    }

    // Plan limit: confirming creates an order, so it counts towards the monthly order limit
    try {
      await assertWithinLimit(companyId, 'ordersPerMonth');
    } catch (planErr) {
      if (sendPlanError(res, planErr)) return;
      throw planErr;
    }

    const orderType = extract.order_type === 'Purchase' ? 'purchase' : 'sales';
    const built = buildOrderItems(extract);
    if (built.error) {
      return res.status(400).json({ message: built.error });
    }
    const { items } = built;
    const itemsTotal = round2(items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0));
    // Prefer the document's stated total (may include tax); otherwise the sum of lines
    const statedTotal = parseFloat(extract.approx_value);
    const totalValue = extract.line_items?.length > 0 && Number.isFinite(statedTotal) && statedTotal > 0 ? statedTotal : itemsTotal;

    await client.query('BEGIN');

    // Claim the detection first so two simultaneous confirms cannot create two orders
    const claim = await client.query(
      `UPDATE ai_order_extracts SET status = 'Confirmed', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND company_id = $2 AND status IN ('New', 'Needs Review')
       RETURNING id`,
      [id, companyId]
    );
    if (claim.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Order already confirmed' });
    }

    const orderResult = await client.query(
      `INSERT INTO orders (
         company_id, created_by, order_type, party_name, po_number,
         order_date, required_delivery_date, delivery_address, currency, total_value, status, source
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Received', 'AI Extract')
       RETURNING *`,
      [
        companyId,
        userId,
        orderType,
        partyName,
        poNumber,
        extract.order_date || extract.email_date || new Date().toISOString(),
        extract.required_delivery_date || null,
        extract.delivery_location || null,
        extract.currency || 'INR',
        round2(totalValue),
      ]
    );

    const newOrder = orderResult.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (
           order_id, company_id, product, sku, quantity, unit, unit_price, total, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, clock_timestamp())`,
        [newOrder.id, companyId, item.product, item.sku, item.qty, item.unit, item.unitPrice, round2(item.qty * item.unitPrice)]
      );
    }

    await client.query(
      `INSERT INTO tracking_events (
         order_id, company_id, status, description, created_by
       ) VALUES ($1, $2, $3, $4, $5)`,
      [newOrder.id, companyId, 'Received', 'Order created from AI extract', userId]
    );

    // Link the AI detection and its source document to the new order
    await client.query('UPDATE ai_order_extracts SET order_id = $1 WHERE id = $2', [newOrder.id, id]);
    if (extract.po_document_id) {
      await client.query(
        `UPDATE po_documents SET order_id = $1, status = 'Confirmed', updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND company_id = $3`,
        [newOrder.id, extract.po_document_id, companyId]
      );
    }

    await client.query('COMMIT');

    await logAudit(req, 'ai.confirmed', { entityType: 'ai_detection', entityId: id, details: { order_id: newOrder.id, po_number: newOrder.po_number } });
    res.status(201).json({ message: 'Order confirmed and created successfully', order: newOrder });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  } finally {
    client.release();
  }
};

export const deleteAiExtract = async (req, res, next) => {
  try {
    const { company_id: companyId } = req.user;
    const { id } = req.params;

    const result = await query(
      'DELETE FROM ai_order_extracts WHERE id = $1 AND company_id = $2 RETURNING id',
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    await logAudit(req, 'ai.deleted', { entityType: 'ai_detection', entityId: id });
    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    next(error);
  }
};