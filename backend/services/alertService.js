// Module 22 / 23: rules engine that turns order and shipment conditions into alerts.
// - New problems create an "open" alert (never twice for the same occurrence: dedupe_key)
// - Open alerts keep their text up to date (e.g. "3 days overdue" -> "4 days overdue")
// - When a problem goes away (order delivered, LR added, ...) its open alert is auto-resolved
// - Dismissed / resolved alerts are never reopened for the same occurrence
import { query } from '../config/database.js';

export const ALERT_RULES = {
  DUE_SOON_DAYS: 1,
  STALE_DAYS: 5,
  AI_REVIEW_HOURS: 24,
};

const OPEN_ORDER = `o.deleted_at IS NULL AND LOWER(o.status) NOT IN ('delivered', 'cancelled')`;
const LAST_ACTIVITY_SQL = `GREATEST(
  o.updated_at,
  COALESCE((SELECT MAX(s.updated_at) FROM shipments s WHERE s.order_id = o.id), o.updated_at),
  COALESCE((SELECT MAX(te.created_at) FROM tracking_events te WHERE te.order_id = o.id), o.updated_at)
)`;
// Pending quantity per order (ordered - delivered) and the first item's unit for display
const QTY_SQL = `
  LEFT JOIN (
    SELECT order_id, SUM(quantity) AS qty, SUM(delivered) AS delivered, MIN(unit) AS unit
    FROM order_items GROUP BY order_id
  ) q ON q.order_id = o.id`;

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Builds the list of alerts that should currently exist for a company
const collectAlerts = async (companyId, tz, thresholds = {}) => {
  const dueSoonDays = thresholds.dueSoonDays ?? ALERT_RULES.DUE_SOON_DAYS;
  const staleDays = thresholds.staleDays ?? ALERT_RULES.STALE_DAYS;
  const today = `(NOW() AT TIME ZONE $2)::date`;
  const alerts = [];

  const orders = await query(
    `SELECT o.id, o.po_number, o.party_name, o.required_delivery_date::text AS due,
            (${today} - o.required_delivery_date) AS days_overdue,
            (o.required_delivery_date - ${today}) AS days_left,
            EXTRACT(DAY FROM NOW() - ${LAST_ACTIVITY_SQL})::int AS idle_days,
            (${LAST_ACTIVITY_SQL})::date::text AS last_activity,
            LOWER(o.status) AS status, q.qty, q.delivered, q.unit
     FROM orders o ${QTY_SQL}
     WHERE o.company_id = $1 AND o.deleted_at IS NULL AND LOWER(o.status) <> 'cancelled'`,
    [companyId, tz]
  );

  for (const o of orders.rows) {
    const base = { order_id: o.id, po_number: o.po_number, party_name: o.party_name, link: `/app/orders/${o.id}` };
    const open = o.status !== 'delivered';
    const qty = Number(o.qty) || 0;
    const delivered = Number(o.delivered) || 0;
    const pending = Math.max(qty - delivered, 0);
    const unit = o.unit ? ` ${o.unit}` : '';

    if (open && o.due && Number(o.days_overdue) > 0) {
      alerts.push({
        ...base,
        type: 'overdue',
        severity: 'critical',
        title: 'Overdue Order',
        description: `PO ${o.po_number || '—'} is ${plural(Number(o.days_overdue), 'day')} overdue.${pending > 0 ? ` ${fmt(pending)}${unit} still pending.` : ''}`,
        key: `overdue:${o.id}:${o.due}`,
      });
    } else if (open && o.due && Number(o.days_left) >= 0 && Number(o.days_left) <= dueSoonDays) {
      alerts.push({
        ...base,
        type: 'due-soon',
        severity: 'info',
        title: 'Delivery Due Soon',
        description: `PO ${o.po_number || '—'} is due ${Number(o.days_left) === 0 ? 'today' : Number(o.days_left) === 1 ? 'tomorrow' : `in ${o.days_left} days`}.${pending > 0 ? ` ${fmt(pending)}${unit} still to be delivered.` : ''}`,
        key: `due-soon:${o.id}:${o.due}`,
      });
    }

    if (open && Number(o.idle_days) >= staleDays) {
      alerts.push({
        ...base,
        type: 'stale',
        severity: 'warning',
        title: 'Stale Order - No Update',
        description: `PO ${o.po_number || '—'} has had no update for ${plural(Number(o.idle_days), 'day')}.`,
        key: `stale:${o.id}:${o.last_activity}`,
      });
    }

    if (delivered > 0 && delivered < qty) {
      alerts.push({
        ...base,
        type: 'partial',
        severity: 'warning',
        title: 'Partial Fulfilment',
        description: `${fmt(delivered)}${unit} of ${fmt(qty)}${unit} delivered, ${fmt(pending)}${unit} still pending for PO ${o.po_number || '—'}.`,
        key: `partial:${o.id}:${delivered}`,
      });
    }
  }

  // Shipments on the way without tracking / key details
  const shipments = await query(
    `SELECT s.id, s.shipment_number, s.order_id, o.po_number, o.party_name,
            COALESCE(TRIM(s.lr_number), '') = '' AND COALESCE(TRIM(s.awb_number), '') = '' AND COALESCE(TRIM(s.gr_number), '') = '' AS no_tracking,
            COALESCE(TRIM(s.transporter), '') = '' AS no_transporter,
            s.expected_delivery_date IS NULL AS no_eta
     FROM shipments s JOIN orders o ON o.id = s.order_id
     WHERE s.company_id = $1 AND o.deleted_at IS NULL
       AND LOWER(s.status) IN ('dispatched', 'in-transit', 'delayed')`,
    [companyId]
  );
  for (const s of shipments.rows) {
    const base = { order_id: s.order_id, shipment_id: s.id, po_number: s.po_number, party_name: s.party_name, link: `/app/shipments/${s.id}` };
    if (s.no_tracking) {
      alerts.push({
        ...base,
        type: 'missing-tracking',
        severity: 'warning',
        title: 'Missing Tracking Number',
        description: `${s.shipment_number} is dispatched but has no LR / AWB / GR number.`,
        key: `missing-tracking:${s.id}`,
      });
    }
    if (s.no_transporter || s.no_eta) {
      const missing = [s.no_transporter && 'transporter', s.no_eta && 'expected delivery date'].filter(Boolean).join(' and ');
      alerts.push({
        ...base,
        type: 'missing-details',
        severity: 'info',
        title: 'Missing Shipment Details',
        description: `${s.shipment_number} has no ${missing}.`,
        key: `missing-details:${s.id}`,
      });
    }
  }

  // AI detections waiting for review
  const pending = await query(
    `SELECT id, po_number, customer_name, EXTRACT(EPOCH FROM NOW() - created_at)::int / 3600 AS hours
     FROM ai_order_extracts
     WHERE company_id = $1 AND status IN ('New', 'Needs Review')
       AND created_at < NOW() - ($2 || ' hours')::interval`,
    [companyId, String(ALERT_RULES.AI_REVIEW_HOURS)]
  );
  for (const e of pending.rows) {
    const days = Math.floor(Number(e.hours) / 24);
    alerts.push({
      po_number: e.po_number,
      party_name: e.customer_name,
      link: `/app/ai-inbox/${e.id}/review`,
      type: 'ai-pending',
      severity: 'info',
      title: 'AI Review Pending',
      description: `AI detection${e.po_number ? ` for PO ${e.po_number}` : ''} has been waiting for review for ${days >= 1 ? plural(days, 'day') : plural(Number(e.hours), 'hour')}.`,
      key: `ai-pending:${e.id}`,
    });
  }

  return alerts;
};

// Brings the company's alerts in line with the current situation
export const refreshCompanyAlerts = async (companyId) => {
  const company = await query('SELECT timezone, due_soon_days, stale_days FROM companies WHERE id = $1', [companyId]);
  const tz = company.rows[0]?.timezone || 'Asia/Kolkata';
  const current = await collectAlerts(companyId, tz, {
    dueSoonDays: company.rows[0]?.due_soon_days,
    staleDays: company.rows[0]?.stale_days,
  });

  // One statement for all alerts (fast even with thousands of orders)
  if (current.length > 0) {
    const col = (fn) => current.map(fn);
    await query(
      `INSERT INTO alerts (company_id, type, severity, title, description, order_id, shipment_id, po_number, party_name, link, dedupe_key)
       SELECT $1, t.type, t.severity, t.title, t.description, t.order_id, t.shipment_id, t.po_number, t.party_name, t.link, t.dedupe_key
       FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::uuid[], $7::uuid[], $8::text[], $9::text[], $10::text[], $11::text[])
         AS t(type, severity, title, description, order_id, shipment_id, po_number, party_name, link, dedupe_key)
       ON CONFLICT (company_id, dedupe_key) DO UPDATE
         SET description = EXCLUDED.description, updated_at = NOW()
         WHERE alerts.status = 'open' AND alerts.description IS DISTINCT FROM EXCLUDED.description`,
      [
        companyId,
        col((a) => a.type),
        col((a) => a.severity),
        col((a) => a.title),
        col((a) => a.description),
        col((a) => a.order_id || null),
        col((a) => a.shipment_id || null),
        col((a) => (a.po_number ? String(a.po_number).slice(0, 100) : null)),
        col((a) => (a.party_name ? String(a.party_name).slice(0, 255) : null)),
        col((a) => a.link || null),
        col((a) => a.key),
      ]
    );
  }

  // Problems that no longer exist: their open alerts resolve themselves
  const keys = current.map((a) => a.key);
  await query(
    `UPDATE alerts SET status = 'resolved', auto_resolved = true, resolved_at = NOW(), updated_at = NOW()
     WHERE company_id = $1 AND status = 'open' AND NOT (dedupe_key = ANY($2::text[]))`,
    [companyId, keys]
  );
};

// Refreshes at most every few minutes per company (used when someone opens the Alerts page)
const lastRefresh = new Map();
const REFRESH_EVERY_MS = 2 * 60 * 1000;
export const refreshAlertsIfStale = async (companyId) => {
  const last = lastRefresh.get(companyId) || 0;
  if (Date.now() - last < REFRESH_EVERY_MS) return;
  lastRefresh.set(companyId, Date.now());
  try {
    await refreshCompanyAlerts(companyId);
  } catch (error) {
    lastRefresh.delete(companyId);
    console.error('Alert refresh failed:', error.message);
  }
};
