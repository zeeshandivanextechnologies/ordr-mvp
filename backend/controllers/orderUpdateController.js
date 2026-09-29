// Module 21: order update suggestions from emails (AI Order Inbox -> "Order Updates").
// A suggestion only changes an order when a user applies it; the same rules as the
// manual screens apply (no over-allocation, no changes to cancelled orders/shipments).
import { getClient, query } from '../config/database.js';
import { logAudit } from '../utils/audit.js';
import { trackEvent } from '../utils/analytics.js';
import { notifyCompany } from '../services/notificationService.js';
import { refreshCompanyAlerts } from '../services/alertService.js';
import { SHIPMENT_UPDATE_TYPES, ORDER_UPDATE_TYPES } from '../services/orderUpdateService.js';
import { STATUS_LABELS, normalizeStatus, recalculateOrder } from '../utils/orderStatus.js';
import { isUuid } from '../middleware/validate.js';

const EPS = 0.000001;

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

// Tracking details a user may apply from the email (body key -> column, max length)
const TRACKING_FIELDS = {
  lrNumber: ['lr_number', 100, 'LR number'],
  awbNumber: ['awb_number', 100, 'AWB number'],
  grNumber: ['gr_number', 100, 'GR number'],
  transporter: ['transporter', 255, 'Transporter'],
  vehicleNumber: ['vehicle_number', 100, 'Vehicle number'],
};

const isValidDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());

const readTrackingValues = (body) => {
  const values = {};
  for (const [key, [column, maxLength, label]] of Object.entries(TRACKING_FIELDS)) {
    const value = body[key] === undefined || body[key] === null ? '' : String(body[key]).trim();
    if (value.length > maxLength) throw badRequest(`${label} must be at most ${maxLength} characters`);
    // Empty values never clear what the shipment already has
    if (value) values[column] = { value, label };
  }
  const eta = body.expectedDeliveryDate === undefined || body.expectedDeliveryDate === null ? '' : String(body.expectedDeliveryDate).trim();
  if (eta && !isValidDate(eta)) throw badRequest('Expected delivery date must be a valid date');
  if (eta) values.expected_delivery_date = { value: eta, label: 'Expected delivery date' };
  return values;
};

const addEvent = (client, orderId, companyId, status, description, userId) =>
  client.query(
    `INSERT INTO tracking_events (order_id, company_id, status, description, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5, clock_timestamp())`,
    [orderId, companyId, status, description, userId]
  );

export const listOrderUpdates = async (req, res, next) => {
  try {
    const { company_id: companyId } = req.user;
    const result = await query(
      `SELECT u.id, u.source_email, u.source_name, u.source_subject, u.email_date, u.classification,
              u.update_type, u.extracted, u.confidence, u.match_method, u.match_confidence, u.status,
              u.order_id, u.shipment_id, u.applied_summary, u.created_at,
              o.po_number AS order_po_number, o.party_name AS order_party_name,
              s.shipment_number
       FROM order_update_suggestions u
       LEFT JOIN orders o ON o.id = u.order_id AND o.deleted_at IS NULL
       LEFT JOIN shipments s ON s.id = u.shipment_id
       WHERE u.company_id = $1
       ORDER BY u.email_date DESC NULLS LAST, u.created_at DESC
       LIMIT 500`,
      [companyId]
    );
    const counts = { Pending: 0, Applied: 0, Ignored: 0 };
    const countResult = await query(
      'SELECT status, COUNT(*)::int AS count FROM order_update_suggestions WHERE company_id = $1 GROUP BY status',
      [companyId]
    );
    for (const row of countResult.rows) counts[row.status] = row.count;
    res.json({ updates: result.rows, counts });
  } catch (error) {
    next(error);
  }
};

export const getOrderUpdate = async (req, res, next) => {
  try {
    const { company_id: companyId } = req.user;
    const result = await query(
      `SELECT u.*, o.po_number AS order_po_number, o.party_name AS order_party_name,
              o.status AS order_status, o.order_type, (o.id IS NULL) AS order_missing
       FROM order_update_suggestions u
       LEFT JOIN orders o ON o.id = u.order_id AND o.deleted_at IS NULL
       WHERE u.id = $1 AND u.company_id = $2`,
      [req.params.updateId, companyId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Order update not found' });
    }
    const update = result.rows[0];
    if (update.order_status) update.order_status = normalizeStatus(update.order_status);
    res.json({ update });
  } catch (error) {
    next(error);
  }
};

// Shipments and remaining quantity of an order, for choosing where to apply an update
export const getOrderUpdateTarget = async (req, res, next) => {
  try {
    const { company_id: companyId } = req.user;
    const order = await query(
      'SELECT id, po_number, party_name, status, order_type FROM orders WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [req.params.orderId, companyId]
    );
    if (order.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }
    const shipments = await query(
      `SELECT id, shipment_number, status, lr_number, awb_number, gr_number, quantity
       FROM shipments WHERE order_id = $1 ORDER BY created_at DESC`,
      [req.params.orderId]
    );
    const items = await query(
      'SELECT product, unit, quantity, dispatched FROM order_items WHERE order_id = $1 ORDER BY created_at, id',
      [req.params.orderId]
    );
    const remaining = items.rows.reduce(
      (sum, i) => sum + Math.max((parseFloat(i.quantity) || 0) - (parseFloat(i.dispatched) || 0), 0),
      0
    );
    res.json({
      order: { ...order.rows[0], status: normalizeStatus(order.rows[0].status) },
      shipments: shipments.rows.map((s) => ({ ...s, status: normalizeStatus(s.status) })),
      remaining,
      unit: items.rows[0]?.unit || null,
      hasItems: items.rows.length > 0,
    });
  } catch (error) {
    next(error);
  }
};

// Shipment creation from an update email: same allocation rules as "Add Shipment"
const createShipmentFromUpdate = async (client, { companyId, userId, orderId, body, tracking, eventDate }) => {
  const shipmentNumber = String(body.shipmentNumber || '').trim();
  if (!shipmentNumber) throw badRequest('Shipment number is required for a new shipment');
  if (shipmentNumber.length > 100) throw badRequest('Shipment number must be at most 100 characters');

  const duplicate = await client.query(
    'SELECT 1 FROM shipments WHERE order_id = $1 AND LOWER(TRIM(shipment_number)) = LOWER($2) LIMIT 1',
    [orderId, shipmentNumber]
  );
  if (duplicate.rows.length > 0) throw badRequest(`Shipment number ${shipmentNumber} already exists for this order`);

  const items = await client.query(
    'SELECT id, product, unit, quantity, dispatched FROM order_items WHERE order_id = $1 ORDER BY created_at, id',
    [orderId]
  );
  const quantity = parseFloat(body.quantity);
  if (items.rows.length > 0 && !(quantity > 0)) throw badRequest('Quantity must be greater than 0');

  const allocations = [];
  if (quantity > 0) {
    let remaining = quantity;
    for (const item of items.rows) {
      if (remaining <= EPS) break;
      const available = Math.max((parseFloat(item.quantity) || 0) - (parseFloat(item.dispatched) || 0), 0);
      if (available <= 0) continue;
      const take = Math.min(remaining, available);
      allocations.push({ item, quantity: take });
      remaining -= take;
    }
    if (items.rows.length > 0 && remaining > EPS) {
      throw badRequest('Shipment quantity exceeds remaining order quantity');
    }
  }

  const inserted = await client.query(
    `INSERT INTO shipments (
       company_id, order_id, created_by, shipment_number, quantity,
       transporter, lr_number, awb_number, gr_number, vehicle_number,
       dispatch_date, expected_delivery_date, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Dispatched')
     RETURNING *`,
    [
      companyId, orderId, userId, shipmentNumber, quantity > 0 ? quantity : null,
      tracking.transporter?.value || null,
      tracking.lr_number?.value || null,
      tracking.awb_number?.value || null,
      tracking.gr_number?.value || null,
      tracking.vehicle_number?.value || null,
      eventDate || null,
      tracking.expected_delivery_date?.value || null,
    ]
  );
  const shipment = inserted.rows[0];
  for (const { item, quantity: qty } of allocations) {
    await client.query(
      `INSERT INTO shipment_items (company_id, shipment_id, order_item_id, product, unit, quantity, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, clock_timestamp())`,
      [companyId, shipment.id, item.id, item.product, item.unit, qty]
    );
  }
  await addEvent(client, orderId, companyId, 'Dispatched', `Shipment ${shipmentNumber} created from an email update`, userId);
  return shipment;
};

export const applyOrderUpdate = async (req, res, next) => {
  const client = await getClient();
  try {
    const { company_id: companyId, id: userId } = req.user;
    const body = req.body || {};

    await client.query('BEGIN');

    const suggestionResult = await client.query(
      'SELECT * FROM order_update_suggestions WHERE id = $1 AND company_id = $2 FOR UPDATE',
      [req.params.updateId, companyId]
    );
    if (suggestionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Order update not found' });
    }
    const suggestion = suggestionResult.rows[0];
    if (suggestion.status !== 'Pending') {
      throw badRequest(`This update was already ${suggestion.status.toLowerCase()}`);
    }

    const orderId = body.orderId || suggestion.order_id;
    if (!orderId) throw badRequest('Choose the order this update belongs to');
    if (!isUuid(orderId)) throw badRequest('The selected order was not found');
    const orderResult = await client.query(
      'SELECT id, status, po_number, party_name FROM orders WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL FOR UPDATE',
      [orderId, companyId]
    );
    if (orderResult.rows.length === 0) throw badRequest('The selected order was not found');
    const order = orderResult.rows[0];
    const orderStatus = normalizeStatus(order.status);
    if (orderStatus === 'cancelled') throw badRequest('Cancelled orders cannot be updated');

    const updateType = normalizeStatus(body.updateType || suggestion.update_type);
    const summary = [];
    let shipment = null;
    let shipmentStatusChangedTo = null;

    if (SHIPMENT_UPDATE_TYPES.includes(updateType)) {
      const tracking = readTrackingValues(body);
      const target = body.shipmentId || suggestion.shipment_id || 'new';
      if (target !== 'new' && !isUuid(target)) throw badRequest('The selected shipment does not belong to this order');

      if (target === 'new') {
        shipment = await createShipmentFromUpdate(client, {
          companyId, userId, orderId, body, tracking,
          eventDate: suggestion.extracted?.event_date || null,
        });
        summary.push(`Shipment ${shipment.shipment_number} created`);
        if (updateType !== 'dispatched') {
          await client.query('UPDATE shipments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [updateType, shipment.id]);
          await addEvent(client, orderId, companyId, updateType, `Shipment ${shipment.shipment_number} marked ${STATUS_LABELS[updateType]}`, userId);
          shipmentStatusChangedTo = updateType;
        }
        summary.push(`marked ${STATUS_LABELS[updateType]}`);
      } else {
        const shipmentResult = await client.query(
          `SELECT *, to_char(expected_delivery_date, 'YYYY-MM-DD') AS expected_delivery_date_value
           FROM shipments WHERE id = $1 AND order_id = $2 AND company_id = $3 FOR UPDATE`,
          [target, orderId, companyId]
        );
        if (shipmentResult.rows.length === 0) throw badRequest('The selected shipment does not belong to this order');
        shipment = shipmentResult.rows[0];
        if (normalizeStatus(shipment.status) === 'cancelled') throw badRequest('Cancelled shipments cannot be updated');

        // Tracking details from the email, only where they differ from what is saved
        const changed = Object.entries(tracking).filter(([column, { value }]) => {
          const current = column === 'expected_delivery_date' ? shipment.expected_delivery_date_value : shipment[column];
          return String(current || '') !== value;
        });
        if (changed.length > 0) {
          const sets = changed.map(([column], idx) => `${column} = $${idx + 1}`);
          await client.query(
            `UPDATE shipments SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${changed.length + 1}`,
            [...changed.map(([, { value }]) => value), shipment.id]
          );
          const labels = changed.map(([, { label }]) => label).join(', ');
          await addEvent(client, orderId, companyId, 'updated', `Shipment ${shipment.shipment_number} details updated from an email (${labels})`, userId);
          summary.push(`${labels} saved`);
        }

        if (normalizeStatus(shipment.status) !== updateType) {
          await client.query('UPDATE shipments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [updateType, shipment.id]);
          await addEvent(client, orderId, companyId, updateType, `Shipment ${shipment.shipment_number} marked ${STATUS_LABELS[updateType]}`, userId);
          shipmentStatusChangedTo = updateType;
          summary.unshift(`Shipment ${shipment.shipment_number} marked ${STATUS_LABELS[updateType]}`);
        }

        if (summary.length === 0) {
          throw badRequest(`Shipment ${shipment.shipment_number} already has this status and details. Ignore this update instead.`);
        }
      }

      await recalculateOrder(client, orderId, companyId, userId);
    } else if (ORDER_UPDATE_TYPES.includes(updateType)) {
      if (orderStatus === updateType) throw badRequest(`Order is already ${STATUS_LABELS[updateType]}`);
      const activeShipments = await client.query(
        `SELECT COUNT(*)::int AS count FROM shipments
         WHERE order_id = $1 AND LOWER(COALESCE(status, '')) <> 'cancelled'`,
        [orderId]
      );
      if (activeShipments.rows[0].count > 0) {
        throw badRequest('This order has shipments, so its status is updated from shipment status. Choose a shipment update instead.');
      }
      await client.query('UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [updateType, orderId]);
      await addEvent(client, orderId, companyId, updateType, `Order status changed to ${STATUS_LABELS[updateType]} (from an email update)`, userId);
      summary.push(`Order marked ${STATUS_LABELS[updateType]}`);
    } else {
      throw badRequest('This update does not change an order automatically. Open the order to update it, or ignore this update.');
    }

    const appliedSummary = summary.join(', ');
    await client.query(
      `UPDATE order_update_suggestions
       SET status = 'Applied', applied_by = $1, applied_at = NOW(), applied_summary = $2,
           order_id = $3, shipment_id = $4, update_type = $5, updated_at = NOW()
       WHERE id = $6`,
      [userId, appliedSummary, orderId, shipment?.id || null, updateType, suggestion.id]
    );

    await client.query('COMMIT');

    // Same team notification as a manual shipment status change
    if (shipment && (shipmentStatusChangedTo === 'delivered' || shipmentStatusChangedTo === 'delayed')) {
      const po = order.po_number ? `PO ${order.po_number}` : 'the order';
      await notifyCompany(companyId, {
        type: shipmentStatusChangedTo === 'delivered' ? 'shipment_delivered' : 'order_delayed',
        title: shipmentStatusChangedTo === 'delivered' ? 'Shipment delivered' : 'Shipment delayed',
        message: shipmentStatusChangedTo === 'delivered'
          ? `Shipment ${shipment.shipment_number} for ${po} (${order.party_name || '—'}) has been delivered.`
          : `Shipment ${shipment.shipment_number} for ${po} (${order.party_name || '—'}) is delayed.`,
        link: `/app/orders/${orderId}`,
        entityType: 'shipment',
        entityId: shipment.id,
        dedupeKey: `shipment-${shipmentStatusChangedTo}:${shipment.id}`,
      }, { excludeUserId: userId });
    }
    refreshCompanyAlerts(companyId).catch((err) => console.error('Alert refresh failed:', err.message));

    if (shipment && summary.some((part) => part.endsWith(' created'))) {
      trackEvent({ event: 'shipment_created', companyId, userId, properties: { source: 'email_update', orderId, shipmentId: shipment.id } });
    }
    if (shipment && shipmentStatusChangedTo === 'delivered') {
      trackEvent({ event: 'shipment_delivered', companyId, userId, properties: { source: 'email_update', orderId, shipmentId: shipment.id } });
    }

    await logAudit(req, 'ai.update_applied', {
      entityType: 'order_update',
      entityId: suggestion.id,
      details: { order_id: orderId, shipment_id: shipment?.id || null, update_type: updateType, summary: appliedSummary },
    });
    res.json({ message: 'Update applied', summary: appliedSummary, orderId, shipmentId: shipment?.id || null });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.status === 400) return res.status(400).json({ message: error.message });
    next(error);
  } finally {
    client.release();
  }
};

// Ignore (Pending -> Ignored) or restore (Ignored -> Pending)
const setSuggestionStatus = (from, to, action) => async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE order_update_suggestions SET status = $1, updated_at = NOW()
       WHERE id = $2 AND company_id = $3 AND status = $4
       RETURNING id`,
      [to, req.params.updateId, req.user.company_id, from]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ message: `Only ${from.toLowerCase()} updates can be ${action}` });
    }
    await logAudit(req, `ai.update_${action}`, { entityType: 'order_update', entityId: req.params.updateId });
    res.json({ message: `Update ${action}`, status: to });
  } catch (error) {
    next(error);
  }
};

export const ignoreOrderUpdate = setSuggestionStatus('Pending', 'Ignored', 'ignored');
export const restoreOrderUpdate = setSuggestionStatus('Ignored', 'Pending', 'restored');
