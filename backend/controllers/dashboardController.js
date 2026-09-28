import { query } from '../config/database.js';
import { getPlanContext, historyCondition } from '../services/planGuard.js';

// Needs Attention thresholds (Module 22 defaults)
// Defaults; each company can change them in Settings -> Company
const DEFAULT_DUE_SOON_DAYS = 1;
const DEFAULT_STALE_DAYS = 5;
const AI_REVIEW_HOURS = 24;
const MAX_REFERENCES = 3;

const CLOSED = `('delivered', 'cancelled')`;

// Latest activity on an order (edit, status change, shipment update, timeline event)
const LAST_ACTIVITY_SQL = `GREATEST(
  o.updated_at,
  COALESCE((SELECT MAX(s.updated_at) FROM shipments s WHERE s.order_id = o.id), o.updated_at),
  COALESCE((SELECT MAX(te.created_at) FROM tracking_events te WHERE te.order_id = o.id), o.updated_at)
)`;

const refs = (rows) => {
  const list = rows.slice(0, MAX_REFERENCES).map((r) => r.po_number || 'Unnamed');
  return rows.length > MAX_REFERENCES ? `${list.join(', ')} +${rows.length - MAX_REFERENCES} more` : list.join(', ');
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
      `SELECT o.po_number FROM orders o
       WHERE ${base} AND LOWER(o.status) NOT IN ${CLOSED} AND o.required_delivery_date < ${today}
       ORDER BY o.required_delivery_date`,
      params
    )).rows;

    const dueSoonRows = (await query(
      `SELECT o.po_number FROM orders o
       WHERE ${base} AND LOWER(o.status) NOT IN ${CLOSED}
         AND o.required_delivery_date BETWEEN ${today} AND ${today} + ${DUE_SOON_DAYS}
       ORDER BY o.required_delivery_date`,
      params
    )).rows;

    const partialRows = (await query(
      `SELECT o.po_number FROM orders o
       JOIN (SELECT order_id, SUM(quantity) AS qty, SUM(delivered) AS delivered FROM order_items GROUP BY order_id) q
         ON q.order_id = o.id
       WHERE ${base} AND LOWER(o.status) <> 'cancelled' AND q.delivered > 0 AND q.delivered < q.qty
       ORDER BY o.updated_at DESC`,
      params2
    )).rows;

    const staleRows = (await query(
      `SELECT o.po_number FROM orders o
       WHERE ${base} AND LOWER(o.status) NOT IN ${CLOSED}
         AND ${LAST_ACTIVITY_SQL} < NOW() - INTERVAL '${STALE_DAYS} days'
       ORDER BY ${LAST_ACTIVITY_SQL}`,
      params2
    )).rows;

    const missingTrackingRows = (await query(
      `SELECT DISTINCT o.po_number FROM shipments s JOIN orders o ON o.id = s.order_id
       WHERE ${base} AND LOWER(s.status) IN ('dispatched', 'in-transit', 'delayed')
         AND COALESCE(TRIM(s.lr_number), '') = '' AND COALESCE(TRIM(s.awb_number), '') = ''
         AND COALESCE(TRIM(s.gr_number), '') = ''`,
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
    const needsAttention = [];
    if (overdueRows.length) {
      needsAttention.push({ type: 'overdue', title: `${plural(overdueRows.length, 'order', 'orders')} overdue`, desc: `${refs(overdueRows)} past due date` });
    }
    if (dueSoonRows.length) {
      needsAttention.push({ type: 'due-soon', title: `${plural(dueSoonRows.length, 'order', 'orders')} due soon`, desc: `${refs(dueSoonRows)} due within ${DUE_SOON_DAYS} day${DUE_SOON_DAYS > 1 ? 's' : ''}` });
    }
    if (partialRows.length) {
      needsAttention.push({ type: 'partial', title: `${plural(partialRows.length, 'partial fulfilment', 'partial fulfilments')}`, desc: `${refs(partialRows)} awaiting balance quantity` });
    }
    if (staleRows.length) {
      needsAttention.push({ type: 'no-update', title: `${plural(staleRows.length, 'order', 'orders')} no update`, desc: `No status change in last ${STALE_DAYS} days: ${refs(staleRows)}` });
    }
    if (missingTrackingRows.length) {
      needsAttention.push({ type: 'missing-tracking', title: `${plural(missingTrackingRows.length, 'order', 'orders')} missing tracking number`, desc: `${refs(missingTrackingRows)} shipped without LR / AWB / GR number` });
    }
    if (aiPending.rows[0].count > 0) {
      const n = aiPending.rows[0].count;
      needsAttention.push({ type: 'ai-review', title: `${plural(n, 'AI detection', 'AI detections')} pending review`, desc: `Waiting in the AI Order Inbox for more than ${AI_REVIEW_HOURS} hours` });
    }

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
    });
  } catch (error) {
    next(error);
  }
};
