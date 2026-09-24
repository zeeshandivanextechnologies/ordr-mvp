import { getClient, query } from '../config/database.js';

const EXTRACT_STATUSES = ['New', 'Needs Review', 'Confirmed', 'Ignored'];
const EXTRACT_COLUMNS = ['order_type', 'customer_name', 'po_number', 'items', 'approx_value', 'confidence'];

const getExtractRow = async (id, companyId) => {
  const { rows } = await query('SELECT * FROM ai_order_extracts WHERE id = $1 AND company_id = $2', [id, companyId]);
  return rows[0] || null;
};

const buildOrderItems = (extract) => {
  const itemsText = (extract.items && extract.items.trim() && extract.items.trim() !== 'Unknown') ? extract.items.trim() : (extract.po_number || 'Material');
  const value = Number.isFinite(parseFloat(extract.approx_value)) && parseFloat(extract.approx_value) > 0 ? parseFloat(extract.approx_value) : 0;
  return [{
    product: itemsText,
    qty: 1,
    unit: 'PCS',
    unitPrice: value,
  }];
};

export const listAiExtracts = async (req, res, next) => {
  try {
    const { company_id: companyId } = req.user;
    const { rows } = await query(
      `SELECT id, order_type, customer_name, po_number, items, approx_value,
              email_date, confidence, status, source_email, source_subject,
              source_body, attachment_name, created_at
       FROM ai_order_extracts
       WHERE company_id = $1
       ORDER BY created_at DESC`,
      [companyId]
    );

    const counts = { New: 0, 'Needs Review': 0, Confirmed: 0, Ignored: 0 };
    for (const row of rows) {
      if (Object.prototype.hasOwnProperty.call(counts, row.status)) {
        counts[row.status] += 1;
      }
    }

    res.json({ extracts: rows, counts });
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
    if (Object.prototype.hasOwnProperty.call(req.body, 'status') && req.body.status !== extract.status) {
      if (!EXTRACT_STATUSES.includes(req.body.status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      updates.status = req.body.status;
    }

    if (updates.approx_value !== undefined) {
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

    res.json({ message: 'Entry updated successfully', extract: rows[0] });
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

    const orderType = extract.order_type === 'Purchase' ? 'purchase' : 'sales';
    const items = buildOrderItems(extract);
    const totalValue = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);

    await client.query('BEGIN');

    const orderResult = await client.query(
      `INSERT INTO orders (
         company_id, created_by, order_type, party_name, po_number,
         order_date, currency, total_value, status, source
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Received', 'AI Extract')
       RETURNING *`,
      [
        companyId,
        userId,
        orderType,
        partyName,
        poNumber,
        extract.email_date || new Date().toISOString(),
        'INR',
        Math.round(totalValue * 100) / 100,
      ]
    );

    const newOrder = orderResult.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (
           order_id, company_id, product, quantity, unit, unit_price, total
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [newOrder.id, companyId, item.product, item.qty, item.unit, item.unitPrice, item.qty * item.unitPrice]
      );
    }

    await client.query(
      `INSERT INTO tracking_events (
         order_id, company_id, status, description, created_by
       ) VALUES ($1, $2, $3, $4, $5)`,
      [newOrder.id, companyId, 'Received', 'Order created from AI extract', userId]
    );

    await client.query(`UPDATE ai_order_extracts SET status = 'Confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);

    await client.query('COMMIT');

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

    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    next(error);
  }
};