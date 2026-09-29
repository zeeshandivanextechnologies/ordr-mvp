// Module 25: global header search across orders and shipments of the user's company.
// Matches PO / order number, customer / supplier, material / SKU, shipment number
// and LR / AWB / GR tracking numbers. Results say whether they are an order or a shipment.
import { query } from '../config/database.js';
import { trackEvent } from '../utils/analytics.js';
import { getPlanContext, historyCondition } from '../services/planGuard.js';
import { normalizeStatus } from '../utils/orderStatus.js';

const MIN_QUERY = 2;
const MAX_QUERY = 100;
const LIMIT = 8;

const escapeLike = (value) => String(value).replace(/[\\%_]/g, (c) => `\\${c}`);

export const globalSearch = async (req, res, next) => {
  try {
    const { company_id: companyId } = req.user;
    const q = String(req.query.q || '').trim().slice(0, MAX_QUERY);
    if (q.length < MIN_QUERY) {
      return res.json({ query: q, orders: [], shipments: [] });
    }

    const planCtx = await getPlanContext(companyId);
    const pattern = `%${escapeLike(q)}%`;

    const orders = await query(
      `SELECT o.id, o.party_name, o.po_number, o.order_type, o.total_value, o.currency, o.status,
              (SELECT product FROM order_items oi WHERE oi.order_id = o.id ORDER BY oi.created_at, oi.id LIMIT 1) AS material
       FROM orders o
       WHERE o.company_id = $1 AND o.deleted_at IS NULL AND ${historyCondition(planCtx)}
         AND (
           o.po_number ILIKE $2
           OR o.party_name ILIKE $2
           OR EXISTS (
             SELECT 1 FROM order_items oi
             WHERE oi.order_id = o.id AND (oi.product ILIKE $2 OR oi.sku ILIKE $2)
           )
         )
       ORDER BY o.updated_at DESC
       LIMIT ${LIMIT}`,
      [companyId, pattern]
    );

    const shipments = await query(
      `SELECT s.id, s.order_id, s.shipment_number, s.lr_number, s.awb_number, s.gr_number,
              s.origin, s.destination, s.status, o.po_number, o.party_name
       FROM shipments s
       JOIN orders o ON o.id = s.order_id
       WHERE s.company_id = $1 AND o.deleted_at IS NULL AND ${historyCondition(planCtx)}
         AND (
           s.shipment_number ILIKE $2
           OR s.lr_number ILIKE $2
           OR s.awb_number ILIKE $2
           OR s.gr_number ILIKE $2
           OR o.po_number ILIKE $2
           OR o.party_name ILIKE $2
         )
       ORDER BY s.updated_at DESC
       LIMIT ${LIMIT}`,
      [companyId, pattern]
    );

    trackEvent({
      event: 'search_used',
      companyId,
      userId: req.user.id,
      properties: { queryLength: q.length, orders: orders.rows.length, shipments: shipments.rows.length },
    });

    res.json({
      query: q,
      orders: orders.rows.map((o) => ({ ...o, status: normalizeStatus(o.status) })),
      shipments: shipments.rows.map((s) => ({ ...s, status: normalizeStatus(s.status) })),
    });
  } catch (error) {
    next(error);
  }
};
