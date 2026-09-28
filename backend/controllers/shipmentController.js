import { getClient, query } from '../config/database.js';
import { logAudit } from '../utils/audit.js';
import { notifyCompany } from '../services/notificationService.js';
import { getPlanContext, historyCondition } from '../services/planGuard.js';
import { SHIPMENT_STATUSES, STATUS_LABELS, normalizeStatus, recalculateOrder } from '../utils/orderStatus.js';

export const listShipments = async (req, res, next) => {
  try {
    const { company_id: companyId } = req.user;
    const planCtx = await getPlanContext(companyId);

    const result = await query(
      `SELECT s.id, s.order_id, s.shipment_number, s.quantity, s.transporter, s.lr_number, s.awb_number,
              s.gr_number, s.origin, s.destination, s.dispatch_date, s.expected_delivery_date,
              s.status, s.created_at, s.updated_at,
              o.party_name, o.po_number, o.order_type
       FROM shipments s
       JOIN orders o ON o.id = s.order_id
       WHERE s.company_id = $1 AND o.deleted_at IS NULL AND ${historyCondition(planCtx)}
       ORDER BY s.updated_at DESC`,
      [companyId]
    );

    const shipments = result.rows.map((s) => ({ ...s, status: normalizeStatus(s.status) }));
    res.json({ shipments });
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
    res.json({ message: 'Shipment status updated', status, orderStatus });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
};
