import { query } from '../config/database.js';
import { getPlanContext, historyCondition } from '../services/planGuard.js';

// Needs Attention thresholds (Module 22 defaults)
// Defaults; each company can change them in Settings -> Company
const DEFAULT_DUE_SOON_DAYS = 1;
const DEFAULT_STALE_DAYS = 5;
const AI_REVIEW_HOURS = 24;
// How many Needs Attention entries the dashboard shows (the rest are on the Alerts page)
const MAX_ATTENTION_ITEMS = 5;

const CLOSED = `('delivered', 'cancelled')`;

// Latest activity on an order (edit, status change, shipment update, timeline event)
const LAST_ACTIVITY_SQL = `GREATEST(
  o.updated_at,
  COALESCE((SELECT MAX(s.updated_at) FROM shipments s WHERE s.order_id = o.id), o.updated_at),
  COALESCE((SELECT MAX(te.created_at) FROM tracking_events te WHERE te.order_id = o.id), o.updated_at)
)`;

// Per-order quantities and main material for the Needs Attention rows.
// unit is only set when every line uses the same unit (otherwise quantities are shown without one)
const ITEMS_SQL = `
  LEFT JOIN (
    SELECT order_id,
           SUM(quantity) AS qty, SUM(dispatched) AS dispatched, SUM(delivered) AS delivered,
           COUNT(*)::int AS item_count,
           CASE WHEN COUNT(DISTINCT LOWER(TRIM(unit))) = 1 THEN MIN(unit) END AS unit,
           (ARRAY_AGG(product ORDER BY created_at, id))[1] AS product
    FROM order_items GROUP BY order_id
  ) q ON q.order_id = o.id`;
const ORDER_FIELDS = `o.id, o.party_name, o.po_number, o.order_type,
  q.qty, q.dispatched, q.delivered, q.item_count, q.unit, q.product`;

const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const qtyText = (n, unit) => `${fmtNum(n)}${unit ? ` ${unit}` : ''}`;
const days = (n) => `${n} day${n === 1 ? '' : 's'}`;
const poText = (r) => `PO ${r.po_number || '—'}`;

// "5 MT Chemical A" / "Chemical A +2 more"
// withQty = false when the detail text already shows the quantities
const materialText = (r, withQty = true) => {
  if (!r.product) return null;
  const count = Number(r.item_count) || 0;
  if (count > 1) return `${r.product} +${count - 1} more`;
  return withQty && r.qty != null ? `${qtyText(r.qty, r.unit)} ${r.product}` : r.product;
};

const orderEntry = (type, label, r, detail, withQty = true) => ({
  type,
  orderId: r.id,
  link: `/app/orders/${r.id}`,
  party: r.party_name || null,
  po: r.po_number || null,
  title: `${label} – ${r.party_name || 'Unknown party'}`,
  desc: [poText(r), materialText(r, withQty), detail].filter(Boolean).join(' · '),
});

// Takes entries from each rule in turn so every kind of problem gets a place on the dashboard
const pickEntries = (groups, max) => {
  const picked = groups.map(() => []);
  let taken = 0;
  for (let round = 0; taken < max; round += 1) {
    let added = false;
    groups.forEach((g, i) => {
      if (taken < max && g[round]) {
        picked[i].push(g[round]);
        taken += 1;
        added = true;
      }
    });
    if (!added) break;
  }
  return picked.flat();
};

// GET /dashboard?order_type=all|sales|purchase
// KPI counts, order value, recent orders and needs-attention records (Module 4 / 22)
export const getDashboard = async (req, res, next) => {
  try {
    const { company_id: companyId } = req.user;
    const orderType = ['sales', 'purchase'].includes(req.query.order_type) ? req.query.order_type : null;

    // "Today" and "this month" follow the company's time zone
    const company = await query('SELECT timezone, due_soon_days, stale_days FROM companies WHERE id = $1', [companyId]);
    const tz = company.rows[0]?.timezone || 'Asia/Kolkata';
    const DUE_SOON_DAYS = company.rows[0]?.due_soon_days ?? DEFAULT_DUE_SOON_DAYS;
    const STALE_DAYS = company.rows[0]?.stale_days ?? DEFAULT_STALE_DAYS;

    // $1 company, $2 order type (null = all), $3 time zone
    // Plan history window: older completed orders are left out
    const planCtx = await getPlanContext(companyId);
    const base = `o.company_id = $1 AND o.deleted_at IS NULL AND ($2::text IS NULL OR o.order_type = $2) AND ${historyCondition(planCtx)}`;
    const today = `(NOW() AT TIME ZONE $3)::date`;
    const monthStart = `date_trunc('month', NOW() AT TIME ZONE $3)`;
    const params = [companyId, orderType, tz];
    // For queries that do not use the time zone ($3)
    const params2 = [companyId, orderType];

    const kpiResult = await query(
      `SELECT
         COUNT(*) FILTER (WHERE LOWER(o.status) NOT IN ${CLOSED})::int AS open_orders,
         COUNT(*) FILTER (WHERE LOWER(o.status) NOT IN ${CLOSED} AND (o.created_at AT TIME ZONE $3)::date = ${today})::int AS new_today,
         COALESCE(SUM(o.total_value) FILTER (WHERE (o.created_at AT TIME ZONE $3) >= ${monthStart} AND LOWER(o.status) <> 'cancelled'), 0) AS value_this_month,
         COUNT(*) FILTER (WHERE LOWER(o.status) NOT IN ${CLOSED} AND o.required_delivery_date BETWEEN ${today} AND ${today} + 7)::int AS due_this_week,
         COUNT(*) FILTER (WHERE LOWER(o.status) NOT IN ${CLOSED} AND o.required_delivery_date < ${today})::int AS overdue,
         COUNT(*) FILTER (WHERE LOWER(o.status) = 'in-transit')::int AS in_transit,
         COUNT(*) FILTER (WHERE LOWER(o.status) = 'delayed')::int AS delayed,
         ROUND(AVG(${today} - o.required_delivery_date) FILTER (WHERE LOWER(o.status) = 'delayed' AND o.required_delivery_date < ${today}))::int AS delayed_avg_days
       FROM orders o
       WHERE ${base}`,
      params
    );

    // Deliveries are counted from the timeline: when the order reached "Delivered"
    const deliveredResult = await query(
      `SELECT
         COUNT(DISTINCT te.order_id) FILTER (WHERE (te.created_at AT TIME ZONE $3) >= ${monthStart})::int AS this_month,
         COUNT(DISTINCT te.order_id) FILTER (WHERE (te.created_at AT TIME ZONE $3) >= ${monthStart} - INTERVAL '1 month'
                                          AND (te.created_at AT TIME ZONE $3) < ${monthStart})::int AS last_month
       FROM tracking_events te
       JOIN orders o ON o.id = te.order_id
       WHERE ${base} AND LOWER(te.status) = 'delivered' AND LOWER(o.status) = 'delivered'`,
      params
    );

    const shipmentsInTransit = await query(
      `SELECT COUNT(*)::int AS count FROM shipments s JOIN orders o ON o.id = s.order_id
       WHERE ${base} AND LOWER(s.status) = 'in-transit'`,
      params2
    );

    const recentResult = await query(
      `SELECT o.id, o.party_name, o.po_number, o.total_value, o.currency, o.required_delivery_date, o.status, o.order_type
       FROM orders o
       WHERE ${base}
       ORDER BY ${LAST_ACTIVITY_SQL} DESC NULLS LAST, o.created_at DESC
       LIMIT 5`,
      params2
    );

    // ---------- Needs Attention (Module 22 rules) ----------
    const overdueRows = (await query(
      `SELECT ${ORDER_FIELDS}, (${today} - o.required_delivery_date)::int AS days_overdue
       FROM orders o ${ITEMS_SQL}
       WHERE ${base} AND LOWER(o.status) NOT IN ${CLOSED} AND o.required_delivery_date < ${today}
       ORDER BY o.required_delivery_date`,
      params
    )).rows;

    const dueSoonRows = (await query(
      `SELECT ${ORDER_FIELDS}, (o.required_delivery_date - ${today})::int AS days_left
       FROM orders o ${ITEMS_SQL}
       WHERE ${base} AND LOWER(o.status) NOT IN ${CLOSED}
         AND o.required_delivery_date BETWEEN ${today} AND ${today} + ${DUE_SOON_DAYS}
       ORDER BY o.required_delivery_date`,
      params
    )).rows;

    // Partly dispatched or partly delivered: something has moved but not everything is delivered yet
    const partialRows = (await query(
      `SELECT ${ORDER_FIELDS}
       FROM orders o ${ITEMS_SQL}
       WHERE ${base} AND LOWER(o.status) NOT IN ${CLOSED}
         AND (q.dispatched > 0 OR q.delivered > 0) AND q.delivered < q.qty
       ORDER BY o.updated_at DESC`,
      params2
    )).rows;

    const staleRows = (await query(
      `SELECT ${ORDER_FIELDS}, EXTRACT(DAY FROM NOW() - ${LAST_ACTIVITY_SQL})::int AS idle_days
       FROM orders o ${ITEMS_SQL}
       WHERE ${base} AND LOWER(o.status) NOT IN ${CLOSED}
         AND ${LAST_ACTIVITY_SQL} < NOW() - INTERVAL '${STALE_DAYS} days'
       ORDER BY ${LAST_ACTIVITY_SQL}`,
      params2
    )).rows;

    const missingTrackingRows = (await query(
      `SELECT s.id AS shipment_id, s.shipment_number, o.id, o.party_name, o.po_number
       FROM shipments s JOIN orders o ON o.id = s.order_id
       WHERE ${base} AND LOWER(s.status) IN ('dispatched', 'in-transit', 'delayed')
         AND COALESCE(TRIM(s.lr_number), '') = '' AND COALESCE(TRIM(s.awb_number), '') = ''
         AND COALESCE(TRIM(s.gr_number), '') = ''
       ORDER BY s.updated_at DESC`,
      params2
    )).rows;

    const aiPending = await query(
      `SELECT COUNT(*)::int AS count FROM ai_order_extracts e
       WHERE e.company_id = $1 AND e.status IN ('New', 'Needs Review')
         AND e.created_at < NOW() - INTERVAL '${AI_REVIEW_HOURS} hours'
         AND ($2::text IS NULL OR LOWER(e.order_type) = $2)`,
      [companyId, orderType]
    );

    const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

    // One entry per order, e.g. "Overdue – ABC Industries" / "PO ABC/1092 · 5 MT Chemical A · 2 days overdue"
    const overdue = overdueRows.map((r) =>
      orderEntry('overdue', 'Overdue', r, `${days(Number(r.days_overdue))} overdue`));

    // "10 MT ordered · 6 MT dispatched · 4 MT pending"
    const partial = partialRows.map((r) => {
      const qty = Number(r.qty) || 0;
      const dispatched = Math.min(Number(r.dispatched) || 0, qty);
      const delivered = Number(r.delivered) || 0;
      const pending = qty - dispatched;
      const detail = pending > 0
        ? `${qtyText(qty, r.unit)} ordered · ${qtyText(dispatched, r.unit)} dispatched · ${qtyText(pending, r.unit)} pending`
        : `${qtyText(qty, r.unit)} ordered · ${qtyText(delivered, r.unit)} delivered · ${qtyText(qty - delivered, r.unit)} on the way`;
      return orderEntry('partial', 'Partial Fulfilment', r, detail, false);
    });

    const stale = staleRows.map((r) =>
      orderEntry('no-update', 'No Update', r, `No update for ${days(Number(r.idle_days))}`));

    const dueSoon = dueSoonRows.map((r) => {
      const left = Number(r.days_left);
      return orderEntry('due-soon', 'Due Soon', r, left === 0 ? 'Due today' : left === 1 ? 'Due tomorrow' : `Due in ${days(left)}`);
    });

    const missingTracking = missingTrackingRows.map((r) => ({
      type: 'missing-tracking',
      orderId: r.id,
      link: `/app/shipments/${r.shipment_id}`,
      party: r.party_name || null,
      po: r.po_number || null,
      title: `Missing Tracking – ${r.party_name || 'Unknown party'}`,
      desc: `${poText(r)} · ${r.shipment_number || 'Shipment'} has no LR / AWB / GR number`,
    }));

    const aiReview = [];
    if (aiPending.rows[0].count > 0) {
      const n = aiPending.rows[0].count;
      aiReview.push({ type: 'ai-review', link: '/app/ai-inbox', title: `${plural(n, 'AI detection', 'AI detections')} pending review`, desc: `Waiting in the AI Order Inbox for more than ${AI_REVIEW_HOURS} hours` });
    }

    // Most urgent first; the full list is on the Alerts page
    const attentionGroups = [overdue, partial, stale, dueSoon, missingTracking, aiReview];
    const needsAttention = pickEntries(attentionGroups, MAX_ATTENTION_ITEMS);
    const needsAttentionTotal = attentionGroups.reduce((sum, g) => sum + g.length, 0);

    const k = kpiResult.rows[0];
    const delivered = deliveredResult.rows[0];
    res.json({
      kpis: {
        openOrders: k.open_orders,
        newToday: k.new_today,
        valueThisMonth: Number(k.value_this_month) || 0,
        dueThisWeek: k.due_this_week,
        overdue: k.overdue,
        inTransit: k.in_transit,
        shipmentsInTransit: shipmentsInTransit.rows[0].count,
        delayed: k.delayed,
        delayedAvgDays: k.delayed_avg_days,
        deliveredThisMonth: delivered.this_month,
        deliveredLastMonth: delivered.last_month,
      },
      recentOrders: recentResult.rows,
      needsAttention,
      needsAttentionTotal,
    });
  } catch (error) {
    next(error);
  }
};
