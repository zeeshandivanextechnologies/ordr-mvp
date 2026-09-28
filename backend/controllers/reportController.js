// Advanced reporting (Business / Pro plans, Module 28).
import { query } from '../config/database.js';
import { getPlanContext, hasFeature } from '../services/planGuard.js';

// GET /reports?months=6
export const getReports = async (req, res, next) => {
  try {
    const { company_id: companyId } = req.user;
    const ctx = await getPlanContext(companyId);
    if (!hasFeature(ctx, 'advancedReporting')) {
      return res.status(402).json({
        code: 'PLAN_FEATURE',
        message: 'Advanced reporting is available on the Business and Pro plans. Upgrade your plan in Billing.',
        error: 'Advanced reporting is available on the Business and Pro plans.',
      });
    }

    const months = Math.min(Math.max(parseInt(req.query.months, 10) || 6, 1), 24);
    const params = [companyId, months];
    const window = `o.company_id = $1 AND o.deleted_at IS NULL AND o.created_at >= date_trunc('month', NOW()) - (($2::int - 1) || ' months')::interval`;

    const byMonth = await query(
      `SELECT to_char(date_trunc('month', o.created_at), 'YYYY-MM') AS month,
              COUNT(*) FILTER (WHERE o.order_type = 'sales')::int AS sales_orders,
              COUNT(*) FILTER (WHERE o.order_type = 'purchase')::int AS purchase_orders,
              COALESCE(SUM(o.total_value) FILTER (WHERE o.order_type = 'sales' AND LOWER(o.status) <> 'cancelled'), 0) AS sales_value,
              COALESCE(SUM(o.total_value) FILTER (WHERE o.order_type = 'purchase' AND LOWER(o.status) <> 'cancelled'), 0) AS purchase_value
       FROM orders o WHERE ${window}
       GROUP BY 1 ORDER BY 1`,
      params
    );

    const byStatus = await query(
      `SELECT LOWER(o.status) AS status, COUNT(*)::int AS count
       FROM orders o WHERE ${window}
       GROUP BY 1 ORDER BY 2 DESC`,
      params
    );

    const topParties = await query(
      `SELECT o.order_type, o.party_name, COUNT(*)::int AS orders, COALESCE(SUM(o.total_value), 0) AS value
       FROM orders o WHERE ${window} AND LOWER(o.status) <> 'cancelled'
       GROUP BY o.order_type, o.party_name
       ORDER BY value DESC`,
      params
    );

    // Delivery performance: when did each delivered order reach "delivered" (first time)?
    const delivery = await query(
      `WITH delivered AS (
         SELECT o.id, o.required_delivery_date, o.created_at,
                (SELECT MIN(te.created_at) FROM tracking_events te
                  WHERE te.order_id = o.id AND LOWER(te.status) = 'delivered') AS delivered_at
         FROM orders o WHERE ${window} AND LOWER(o.status) = 'delivered'
       )
       SELECT COUNT(*)::int AS delivered_orders,
              COUNT(*) FILTER (WHERE required_delivery_date IS NOT NULL AND delivered_at IS NOT NULL)::int AS with_due_date,
              COUNT(*) FILTER (WHERE required_delivery_date IS NOT NULL AND delivered_at IS NOT NULL
                                 AND delivered_at::date <= required_delivery_date)::int AS on_time,
              ROUND(AVG(EXTRACT(EPOCH FROM (delivered_at - created_at)) / 86400) FILTER (WHERE delivered_at IS NOT NULL)::numeric, 1) AS avg_days
       FROM delivered`,
      params
    );

    const shipments = await query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE LOWER(s.status) = 'delayed')::int AS delayed,
              COUNT(*) FILTER (WHERE LOWER(s.status) = 'delivered')::int AS delivered
       FROM shipments s JOIN orders o ON o.id = s.order_id
       WHERE ${window.replace(/o\.created_at/g, 's.created_at')}`,
      params
    );

    const ai = await query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'Confirmed')::int AS confirmed,
              COUNT(*) FILTER (WHERE status = 'Ignored')::int AS ignored,
              COUNT(*) FILTER (WHERE status IN ('New', 'Needs Review'))::int AS pending,
              COUNT(*) FILTER (WHERE gmail_message_id IS NOT NULL)::int AS from_email
       FROM ai_order_extracts
       WHERE company_id = $1 AND created_at >= date_trunc('month', NOW()) - (($2::int - 1) || ' months')::interval`,
      params
    );

    const d = delivery.rows[0];
    const top = (type) =>
      topParties.rows
        .filter((r) => r.order_type === type)
        .slice(0, 5)
        .map((r) => ({ name: r.party_name, orders: r.orders, value: Number(r.value) }));

    res.json({
      months,
      byMonth: byMonth.rows.map((r) => ({
        month: r.month,
        salesOrders: r.sales_orders,
        purchaseOrders: r.purchase_orders,
        salesValue: Number(r.sales_value),
        purchaseValue: Number(r.purchase_value),
      })),
      byStatus: byStatus.rows,
      topCustomers: top('sales'),
      topSuppliers: top('purchase'),
      delivery: {
        deliveredOrders: d.delivered_orders,
        onTimeRate: d.with_due_date > 0 ? Math.round((d.on_time / d.with_due_date) * 100) : null,
        avgDeliveryDays: d.avg_days !== null ? Number(d.avg_days) : null,
      },
      shipments: shipments.rows[0],
      ai: ai.rows[0],
    });
  } catch (error) {
    next(error);
  }
};
