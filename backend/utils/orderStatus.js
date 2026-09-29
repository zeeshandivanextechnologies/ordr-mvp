import { trackEventInTx } from './analytics.js';

// Order/shipment status helpers. Statuses are stored as lowercase slugs
// (e.g. 'in-transit') so the frontend can use them directly as badge classes.

const EPS = 0.000001;

export const SHIPMENT_STATUSES = ['ready-dispatch', 'dispatched', 'in-transit', 'delivered', 'delayed', 'cancelled'];

// Statuses a user can set on the order itself; the rest are derived from shipments
export const MANUAL_ORDER_STATUSES = ['received', 'confirmed', 'processing', 'ready-dispatch', 'cancelled'];

const DERIVED_ORDER_STATUSES = ['partially-dispatched', 'dispatched', 'in-transit', 'partially-delivered', 'delivered', 'delayed'];

export const STATUS_LABELS = {
  received: 'Received',
  confirmed: 'Confirmed',
  processing: 'Processing',
  'ready-dispatch': 'Ready for Dispatch',
  'partially-dispatched': 'Partially Dispatched',
  dispatched: 'Dispatched',
  'in-transit': 'In Transit',
  'partially-delivered': 'Partially Delivered',
  delivered: 'Delivered',
  delayed: 'Delayed',
  cancelled: 'Cancelled',
};

// Accepts legacy values like 'Dispatched' or 'In Transit' and returns the slug
export const normalizeStatus = (value) => {
  const slug = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (slug === 'ready' || slug === 'ready-for-dispatch') return 'ready-dispatch';
  if (slug === 'canceled') return 'cancelled';
  return slug;
};

// The same normalization in SQL, for filtering by status (e.g. "In Transit" = 'in-transit')
export const statusSlugSql = (column) => `(CASE
  WHEN regexp_replace(lower(trim(COALESCE(${column}, ''))), '[\\s_]+', '-', 'g') IN ('ready', 'ready-for-dispatch') THEN 'ready-dispatch'
  WHEN regexp_replace(lower(trim(COALESCE(${column}, ''))), '[\\s_]+', '-', 'g') = 'canceled' THEN 'cancelled'
  ELSE regexp_replace(lower(trim(COALESCE(${column}, ''))), '[\\s_]+', '-', 'g')
END)`;

// List pages: ?limit=50&offset=100. Without a limit the full list is returned (older callers).
export const readPaging = (queryParams, { max = 200 } = {}) => {
  if (queryParams.limit === undefined) return null;
  const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 50, 1), max);
  const offset = Math.max(parseInt(queryParams.offset, 10) || 0, 0);
  return { limit, offset };
};

export const escapeLike = (value) => String(value).replace(/[\\%_]/g, (c) => `\\${c}`);

const deriveStatus = (currentStatus, items, activeShipments) => {
  if (currentStatus === 'cancelled') return currentStatus;

  if (activeShipments.length === 0) {
    // All shipments cancelled: fall back from a shipment-derived status
    return DERIVED_ORDER_STATUSES.includes(currentStatus) ? 'processing' : currentStatus;
  }

  const statuses = activeShipments.map((s) => s.status);
  const lines = items.filter((i) => i.quantity > EPS);
  const hasQty = lines.length > 0;
  // Judged per item, so e.g. 10 MT + 40 Nos is only "delivered" when both are
  const fullyDelivered = hasQty ? lines.every((i) => i.delivered >= i.quantity - EPS) : statuses.every((s) => s === 'delivered');
  const fullyAllocated = hasQty ? lines.every((i) => i.dispatched >= i.quantity - EPS) : true;
  const anyDelivered = lines.some((i) => i.delivered > EPS);

  if (fullyDelivered) return 'delivered';
  if (statuses.includes('delayed')) return 'delayed';
  if (anyDelivered || statuses.includes('delivered')) return 'partially-delivered';
  if (statuses.every((s) => s === 'ready-dispatch')) return 'ready-dispatch';
  if (!fullyAllocated) return 'partially-dispatched';
  if (statuses.includes('in-transit')) return 'in-transit';
  return 'dispatched';
};

// Recalculates dispatched/delivered quantities per order item from its shipments
// and derives the order status. Must run inside the caller's transaction.
//
// Shipments with shipment_items count exactly against those items. Older shipments
// (a single total quantity) fill the remaining quantity item by item, in order.
export const recalculateOrder = async (client, orderId, companyId, userId) => {
  const orderResult = await client.query(
    'SELECT id, status FROM orders WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL FOR UPDATE',
    [orderId, companyId]
  );
  if (orderResult.rows.length === 0) return null;
  const currentStatus = normalizeStatus(orderResult.rows[0].status);

  const itemsResult = await client.query(
    'SELECT id, product, quantity, dispatched, delivered FROM order_items WHERE order_id = $1 ORDER BY created_at, id',
    [orderId]
  );
  const shipmentsResult = await client.query(
    'SELECT id, quantity, status FROM shipments WHERE order_id = $1 ORDER BY created_at, id',
    [orderId]
  );
  const allocResult = await client.query(
    `SELECT si.id, si.shipment_id, si.order_item_id, si.product, si.quantity
     FROM shipment_items si JOIN shipments s ON s.id = si.shipment_id
     WHERE s.order_id = $1`,
    [orderId]
  );

  const items = itemsResult.rows.map((i) => ({
    id: i.id,
    product: String(i.product || '').trim().toLowerCase(),
    quantity: parseFloat(i.quantity) || 0,
    storedDispatched: parseFloat(i.dispatched) || 0,
    storedDelivered: parseFloat(i.delivered) || 0,
    dispatched: 0,
    delivered: 0,
  }));
  const itemById = new Map(items.map((i) => [i.id, i]));

  // Allocations whose order item was re-created by an order edit: re-link by product name
  for (const row of allocResult.rows) {
    if (row.order_item_id && itemById.has(row.order_item_id)) continue;
    const match = items.find((i) => i.product && i.product === String(row.product || '').trim().toLowerCase());
    if (match) {
      row.order_item_id = match.id;
      await client.query('UPDATE shipment_items SET order_item_id = $1 WHERE id = $2', [match.id, row.id]);
    } else {
      row.order_item_id = null;
    }
  }

  const allocsByShipment = new Map();
  for (const row of allocResult.rows) {
    if (!allocsByShipment.has(row.shipment_id)) allocsByShipment.set(row.shipment_id, []);
    allocsByShipment.get(row.shipment_id).push(row);
  }

  const activeShipments = shipmentsResult.rows
    .map((s) => ({ id: s.id, quantity: parseFloat(s.quantity) || 0, status: normalizeStatus(s.status) }))
    .filter((s) => s.status !== 'cancelled');

  // 1. Exact per-item allocations; quantities that match no item are handled like older shipments
  const unallocated = [];
  for (const shipment of activeShipments) {
    const rows = allocsByShipment.get(shipment.id);
    if (!rows || rows.length === 0) {
      if (shipment.quantity > EPS) unallocated.push({ quantity: shipment.quantity, delivered: shipment.status === 'delivered' });
      continue;
    }
    for (const row of rows) {
      const qty = parseFloat(row.quantity) || 0;
      const item = row.order_item_id ? itemById.get(row.order_item_id) : null;
      if (!item) {
        unallocated.push({ quantity: qty, delivered: shipment.status === 'delivered' });
        continue;
      }
      item.dispatched += qty;
      if (shipment.status === 'delivered') item.delivered += qty;
    }
  }

  // 2. Older shipments fill the remaining quantity item by item
  for (const entry of unallocated) {
    let remaining = entry.quantity;
    for (const item of items) {
      if (remaining <= EPS) break;
      const available = Math.max(item.quantity - item.dispatched, 0);
      if (available <= EPS) continue;
      const take = Math.min(remaining, available);
      item.dispatched += take;
      if (entry.delivered) item.delivered += take;
      remaining -= take;
    }
  }

  // Never more than ordered, and never more delivered than dispatched
  for (const item of items) {
    item.dispatched = Math.min(item.dispatched, item.quantity);
    item.delivered = Math.min(item.delivered, item.dispatched);
    if (Math.abs(item.storedDispatched - item.dispatched) > EPS || Math.abs(item.storedDelivered - item.delivered) > EPS) {
      await client.query(
        'UPDATE order_items SET dispatched = $1, delivered = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [item.dispatched, item.delivered, item.id]
      );
    }
  }

  const newStatus = deriveStatus(currentStatus, items, activeShipments);

  if (newStatus !== currentStatus) {
    await client.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newStatus, orderId]
    );
    await client.query(
      `INSERT INTO tracking_events (order_id, company_id, status, description, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, clock_timestamp())`,
      [orderId, companyId, newStatus, `Order status changed to ${STATUS_LABELS[newStatus] || newStatus}`, userId]
    );
    // Module 36: kept only if the caller's transaction commits
    if (newStatus === 'delivered') {
      await trackEventInTx(client, { event: 'order_delivered', companyId, userId, properties: { orderId } });
    }
  }

  return newStatus;
};
