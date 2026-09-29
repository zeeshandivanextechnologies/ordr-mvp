import { getClient, query } from '../config/database.js';
import { logAudit } from '../utils/audit.js';
import { trackEvent } from '../utils/analytics.js';
import { notifyCompany } from '../services/notificationService.js';
import { refreshCompanyAlerts } from '../services/alertService.js';
import { getPlanContext, historyCondition } from '../services/planGuard.js';
import { SHIPMENT_STATUSES, STATUS_LABELS, escapeLike, normalizeStatus, readPaging, recalculateOrder, statusSlugSql } from '../utils/orderStatus.js';

export const listShipments = async (req, res, next) => {
  try {
    const { company_id: companyId } = req.user;
    const planCtx = await getPlanContext(companyId);

    // Optional filters and paging (Tracking page). No parameters = the full list, as before.
    const paging = readPaging(req.query);
    const base = `s.company_id = $1 AND o.deleted_at IS NULL AND ${historyCondition(planCtx)}`;
    const params = [companyId];
    const filters = [];
    const status = normalizeStatus(req.query.status);
    if (status && status !== 'all') {
      params.push(status);
      filters.push(`${statusSlugSql('s.status')} = $${params.length}`);
    }
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (q) {
      params.push(`%${escapeLike(q)}%`);
      const p = `$${params.length}`;
      filters.push(`(o.party_name ILIKE ${p} OR o.po_number ILIKE ${p} OR s.lr_number ILIKE ${p}
        OR s.awb_number ILIKE ${p} OR s.gr_number ILIKE ${p} OR s.shipment_number ILIKE ${p})`);
    }
    const where = `${base}${filters.map((f) => ` AND ${f}`).join('')}`;

    const result = await query(
      `SELECT s.id, s.order_id, s.shipment_number, s.quantity, s.transporter, s.lr_number, s.awb_number,
              s.gr_number, s.origin, s.destination, s.dispatch_date, s.expected_delivery_date,
              s.status, s.created_at, s.updated_at,
              o.party_name, o.po_number, o.order_type
       FROM shipments s
       JOIN orders o ON o.id = s.order_id
       WHERE ${where}
       ORDER BY s.updated_at DESC${paging ? ` LIMIT ${paging.limit} OFFSET ${paging.offset}` : ''}`,
      params
    );

    const shipments = result.rows.map((s) => ({ ...s, status: normalizeStatus(s.status) }));
    if (!paging) return res.json({ shipments });

    // Totals for paging and the status tab counts (all shipments, like before)
    const [total, byStatus] = await Promise.all([
      query(`SELECT COUNT(*)::int AS count FROM shipments s JOIN orders o ON o.id = s.order_id WHERE ${where}`, params),
      query(
        `SELECT ${statusSlugSql('s.status')} AS status, COUNT(*)::int AS count
         FROM shipments s JOIN orders o ON o.id = s.order_id WHERE ${base} GROUP BY 1`,
        [companyId]
      ),
    ]);
    const counts = { all: 0 };
    for (const r of byStatus.rows) {
      counts[r.status] = (counts[r.status] || 0) + r.count;
      counts.all += r.count;
    }
    res.json({ shipments, total: total.rows[0].count, counts, limit: paging.limit, offset: paging.offset });
  } catch (error) {
    next(error);
  }
};

export const getShipment = async (req, res, next) => {
  try {
    const { company_id: companyId } = req.user;
    const planCtx = await getPlanContext(companyId);
    const { id } = req.params;

    const result = await query(
      `SELECT s.*, o.party_name, o.po_number, o.order_type, o.status AS order_status,
              to_char(s.dispatch_date, 'YYYY-MM-DD') AS dispatch_date_value,
              to_char(s.expected_delivery_date, 'YYYY-MM-DD') AS expected_delivery_date_value,
              (SELECT unit FROM order_items oi WHERE oi.order_id = o.id ORDER BY oi.created_at, oi.id LIMIT 1) AS unit
       FROM shipments s
       JOIN orders o ON o.id = s.order_id
       WHERE s.id = $1 AND s.company_id = $2 AND o.deleted_at IS NULL AND ${historyCondition(planCtx)}`,
      [id, companyId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Shipment not found' });
    }
    const shipment = { ...result.rows[0], status: normalizeStatus(result.rows[0].status) };

    // Per-item quantities in this shipment
    const itemsResult = await query(
      'SELECT product, unit, quantity FROM shipment_items WHERE shipment_id = $1 ORDER BY created_at, id',
      [id]
    );
    shipment.shipment_items = itemsResult.rows;

    // Shipment events are stored on the order with a "Shipment <number> ..." description
    const eventsResult = await query(
      `SELECT id, status, description, created_at FROM tracking_events
       WHERE order_id = $1 AND description LIKE $2
       ORDER BY created_at ASC`,
      [shipment.order_id, `Shipment ${shipment.shipment_number} %`]
    );

    res.json({ shipment, trackingEvents: eventsResult.rows });
  } catch (error) {
    next(error);
  }
};

// Module 17: editable shipment details (body key -> column, max length).
// Shipment number and quantities stay fixed: events are matched by number and
// quantities drive the order's dispatched/delivered totals.
const EDITABLE_TEXT_FIELDS = {
  items: ['items', null],
  transporter: ['transporter', 255],
  lrNumber: ['lr_number', 100],
  awbNumber: ['awb_number', 100],
  grNumber: ['gr_number', 100],
  vehicleNumber: ['vehicle_number', 100],
  origin: ['origin', 255],
  destination: ['destination', 255],
};
const EDITABLE_DATE_FIELDS = {
  dispatchDate: 'dispatch_date',
  expectedDeliveryDate: 'expected_delivery_date',
};
const FIELD_LABELS = {
  items: 'Items', transporter: 'Transporter', lrNumber: 'LR number', awbNumber: 'AWB number',
  grNumber: 'GR number', vehicleNumber: 'Vehicle number', origin: 'Origin', destination: 'Destination',
  dispatchDate: 'Dispatch date', expectedDeliveryDate: 'Expected delivery date',
};

const isValidDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());

export const updateShipment = async (req, res, next) => {
  const client = await getClient();
  try {
    const { company_id: companyId, id: userId } = req.user;
    const { id } = req.params;
    const body = req.body || {};

    // Only fields sent in the request change; an empty value clears the field
    const sets = [];
    const values = [];
    const changed = [];
    for (const [key, [column, maxLength]] of Object.entries(EDITABLE_TEXT_FIELDS)) {
      if (body[key] === undefined) continue;
      const value = body[key] === null ? '' : String(body[key]).trim();
      if (maxLength && value.length > maxLength) {
        return res.status(400).json({ message: `${FIELD_LABELS[key]} must be at most ${maxLength} characters` });
      }
      values.push(value || null);
      sets.push(`${column} = $${values.length}`);
      changed.push(key);
    }
    for (const [key, column] of Object.entries(EDITABLE_DATE_FIELDS)) {
      if (body[key] === undefined) continue;
      const value = body[key] === null ? '' : String(body[key]).trim();
      if (value && !isValidDate(value)) {
        return res.status(400).json({ message: `${FIELD_LABELS[key]} must be a valid date` });
      }
      values.push(value || null);
      sets.push(`${column} = $${values.length}`);
      changed.push(key);
    }
    if (sets.length === 0) {
      return res.status(400).json({ message: 'No shipment details to update' });
    }

    await client.query('BEGIN');

    const shipmentResult = await client.query(
      `SELECT s.*, o.status AS order_status,
              to_char(s.dispatch_date, 'YYYY-MM-DD') AS dispatch_date_value,
              to_char(s.expected_delivery_date, 'YYYY-MM-DD') AS expected_delivery_date_value
       FROM shipments s JOIN orders o ON o.id = s.order_id
       WHERE s.id = $1 AND s.company_id = $2 AND o.deleted_at IS NULL
       FOR UPDATE OF s`,
      [id, companyId]
    );
    if (shipmentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Shipment not found' });
    }

    const shipment = shipmentResult.rows[0];
    if (normalizeStatus(shipment.order_status) === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Order is cancelled; shipment details cannot be changed' });
    }
    if (normalizeStatus(shipment.status) === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Cancelled shipments cannot be updated' });
    }

    // Keep only the fields whose value really changes
    const currentValue = (key) => {
      if (EDITABLE_DATE_FIELDS[key]) return shipment[`${EDITABLE_DATE_FIELDS[key]}_value`] || null;
      return shipment[EDITABLE_TEXT_FIELDS[key][0]] || null;
    };
    const actuallyChanged = changed.filter((key, idx) => currentValue(key) !== values[idx]);
    if (actuallyChanged.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'No changes to save' });
    }

    values.push(id);
    const updated = await client.query(
      `UPDATE shipments SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    await client.query(
      `INSERT INTO tracking_events (order_id, company_id, status, description, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, clock_timestamp())`,
      [
        shipment.order_id,
        companyId,
        'updated',
        `Shipment ${shipment.shipment_number} details updated (${actuallyChanged.map((k) => FIELD_LABELS[k]).join(', ')})`,
        userId,
      ]
    );

    await client.query('COMMIT');

    // Added tracking numbers / details can close "Missing Tracking" alerts right away
    refreshCompanyAlerts(companyId).catch((err) => console.error('Alert refresh failed:', err.message));

    await logAudit(req, 'shipment.edited', {
      entityType: 'shipment',
      entityId: id,
      details: { shipment_number: shipment.shipment_number, fields: actuallyChanged },
    });
    res.json({ message: 'Shipment updated', shipment: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
};

export const updateShipmentStatus = async (req, res, next) => {
  const client = await getClient();
  try {
    const { company_id: companyId, id: userId } = req.user;
    const { id } = req.params;
    const status = normalizeStatus(req.body?.status);

    if (!SHIPMENT_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid shipment status' });
    }

    await client.query('BEGIN');

    const shipmentResult = await client.query(
      `SELECT s.id, s.order_id, s.shipment_number, s.status, o.status AS order_status, o.po_number, o.party_name
       FROM shipments s JOIN orders o ON o.id = s.order_id
       WHERE s.id = $1 AND s.company_id = $2 AND o.deleted_at IS NULL
       FOR UPDATE OF s`,
      [id, companyId]
    );
    if (shipmentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Shipment not found' });
    }

    const shipment = shipmentResult.rows[0];
    const currentStatus = normalizeStatus(shipment.status);

    if (normalizeStatus(shipment.order_status) === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Order is cancelled; shipment status cannot be changed' });
    }
    if (currentStatus === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Cancelled shipments cannot be updated' });
    }
    if (currentStatus === status) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Shipment is already ${STATUS_LABELS[status]}` });
    }

    await client.query(
      'UPDATE shipments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, id]
    );

    await client.query(
      `INSERT INTO tracking_events (order_id, company_id, status, description, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, clock_timestamp())`,
      [
        shipment.order_id,
        companyId,
        status,
        status === 'cancelled'
          ? `Shipment ${shipment.shipment_number} cancelled`
          : `Shipment ${shipment.shipment_number} marked ${STATUS_LABELS[status]}`,
        userId,
      ]
    );

    const orderStatus = await recalculateOrder(client, shipment.order_id, companyId, userId);

    await client.query('COMMIT');

    // Module 24: tell the team when a shipment is delivered or delayed (not the person who changed it)
    if (status === 'delivered' || status === 'delayed') {
      const po = shipment.po_number ? `PO ${shipment.po_number}` : 'the order';
      await notifyCompany(companyId, {
        type: status === 'delivered' ? 'shipment_delivered' : 'order_delayed',
        title: status === 'delivered' ? 'Shipment delivered' : 'Shipment delayed',
        message: status === 'delivered'
          ? `Shipment ${shipment.shipment_number} for ${po} (${shipment.party_name || '—'}) has been delivered.`
          : `Shipment ${shipment.shipment_number} for ${po} (${shipment.party_name || '—'}) is delayed.`,
        link: `/app/orders/${shipment.order_id}`,
        entityType: 'shipment',
        entityId: id,
        dedupeKey: `shipment-${status}:${id}`,
      }, { excludeUserId: req.user.id });
    }

    await logAudit(req, 'shipment.status_changed', { entityType: 'shipment', entityId: id, details: { shipment_number: shipment.shipment_number, from: currentStatus, to: status, order_status: orderStatus } });
    if (status === 'delivered') {
      trackEvent({ event: 'shipment_delivered', companyId, userId, properties: { source: 'manual', orderId: shipment.order_id, shipmentId: id } });
    }
    res.json({ message: 'Shipment status updated', status, orderStatus });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
};
