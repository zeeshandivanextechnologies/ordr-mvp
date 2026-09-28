// Background job for time-based notifications (Module 24):
// delivery due soon, partial balance pending and AI detections waiting for review.
// Runs every hour; dedupe keys make sure each reminder is sent only once.
import { query } from '../config/database.js';
import { notifyCompany } from '../services/notificationService.js';
import { companyHasActiveAccess } from '../services/planGuard.js';
import { refreshCompanyAlerts } from '../services/alertService.js';

const INTERVAL_MS = 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 2 * 60 * 1000;
const DUE_SOON_DAYS = 1;
const STALE_DAYS_DEFAULT = 5;
const AI_REVIEW_HOURS = 24;

let running = false;

const notifyCompanyReminders = async (companyId, timezone, thresholds = {}) => {
  const tz = timezone || 'Asia/Kolkata';
  const dueSoonDays = thresholds.dueSoonDays ?? DUE_SOON_DAYS;
  const staleDays = thresholds.staleDays ?? STALE_DAYS_DEFAULT;

  // Delivery due today / tomorrow (open orders only)
  const dueSoon = await query(
    `SELECT o.id, o.po_number, o.party_name, o.required_delivery_date::text AS due
     FROM orders o
     WHERE o.company_id = $1 AND o.deleted_at IS NULL
       AND LOWER(o.status) NOT IN ('delivered', 'cancelled')
       AND o.required_delivery_date BETWEEN (NOW() AT TIME ZONE $2)::date AND (NOW() AT TIME ZONE $2)::date + $3::int`,
    [companyId, tz, dueSoonDays]
  );
  for (const o of dueSoon.rows) {
    await notifyCompany(companyId, {
      type: 'delivery_due_soon',
      title: 'Delivery due soon',
      message: `PO ${o.po_number || '—'} (${o.party_name || '—'}) is due on ${o.due}.`,
      link: `/app/orders/${o.id}`,
      entityType: 'order',
      entityId: o.id,
      dedupeKey: `due-soon:${o.id}:${o.due}`,
    });
  }

  // Partly delivered, balance still pending (re-notified only when the delivered quantity changes)
  const partial = await query(
    `SELECT o.id, o.po_number, o.party_name, q.qty, q.delivered
     FROM orders o
     JOIN (SELECT order_id, SUM(quantity) AS qty, SUM(delivered) AS delivered FROM order_items GROUP BY order_id) q
       ON q.order_id = o.id
     WHERE o.company_id = $1 AND o.deleted_at IS NULL AND LOWER(o.status) <> 'cancelled'
       AND q.delivered > 0 AND q.delivered < q.qty`,
    [companyId]
  );
  for (const o of partial.rows) {
    const balance = Number(o.qty) - Number(o.delivered);
    await notifyCompany(companyId, {
      type: 'partial_balance_pending',
      title: 'Partial balance pending',
      message: `PO ${o.po_number || '—'} (${o.party_name || '—'}): ${Number(o.delivered).toLocaleString('en-IN')} of ${Number(o.qty).toLocaleString('en-IN')} delivered, ${balance.toLocaleString('en-IN')} still pending.`,
      link: `/app/orders/${o.id}`,
      entityType: 'order',
      entityId: o.id,
      dedupeKey: `partial:${o.id}:${Number(o.delivered)}`,
    });
  }

  // Overdue open orders (Delay alerts)
  const overdue = await query(
    `SELECT o.id, o.po_number, o.party_name, o.required_delivery_date::text AS due,
            ((NOW() AT TIME ZONE $2)::date - o.required_delivery_date) AS days
     FROM orders o
     WHERE o.company_id = $1 AND o.deleted_at IS NULL
       AND LOWER(o.status) NOT IN ('delivered', 'cancelled')
       AND o.required_delivery_date < (NOW() AT TIME ZONE $2)::date`,
    [companyId, tz]
  );
  for (const o of overdue.rows) {
    await notifyCompany(companyId, {
      type: 'order_delayed',
      title: 'Order overdue',
      message: `PO ${o.po_number || '—'} (${o.party_name || '—'}) was due on ${o.due} and is ${o.days} day${Number(o.days) === 1 ? '' : 's'} overdue.`,
      link: `/app/orders/${o.id}`,
      entityType: 'order',
      entityId: o.id,
      dedupeKey: `overdue:${o.id}:${o.due}`,
    });
  }

  // Stale open orders: no update for the company's stale threshold (Stale order alerts)
  const stale = await query(
    `SELECT o.id, o.po_number, o.party_name, last_activity::date::text AS since,
            EXTRACT(DAY FROM NOW() - last_activity)::int AS days
     FROM (
       SELECT o.*, GREATEST(
         o.updated_at,
         COALESCE((SELECT MAX(s.updated_at) FROM shipments s WHERE s.order_id = o.id), o.updated_at),
         COALESCE((SELECT MAX(te.created_at) FROM tracking_events te WHERE te.order_id = o.id), o.updated_at)
       ) AS last_activity
       FROM orders o
       WHERE o.company_id = $1 AND o.deleted_at IS NULL AND LOWER(o.status) NOT IN ('delivered', 'cancelled')
     ) o
     WHERE last_activity < NOW() - ($2 || ' days')::interval`,
    [companyId, String(staleDays)]
  );
  for (const o of stale.rows) {
    await notifyCompany(companyId, {
      type: 'order_stale',
      title: 'No update on order',
      message: `PO ${o.po_number || '—'} (${o.party_name || '—'}) has had no update for ${o.days} days.`,
      link: `/app/orders/${o.id}`,
      entityType: 'order',
      entityId: o.id,
      dedupeKey: `stale:${o.id}:${o.since}`,
    });
  }

  // AI detections waiting for review for more than 24 hours: one summary per day
  const pending = await query(
    `SELECT COUNT(*)::int AS count FROM ai_order_extracts
     WHERE company_id = $1 AND status IN ('New', 'Needs Review')
       AND created_at < NOW() - ($2 || ' hours')::interval`,
    [companyId, String(AI_REVIEW_HOURS)]
  );
  const count = pending.rows[0].count;
  if (count > 0) {
    const today = new Date().toISOString().slice(0, 10);
    await notifyCompany(companyId, {
      type: 'ai_review_required',
      title: 'AI review required',
      message: `${count} AI detection${count === 1 ? ' is' : 's are'} waiting for review for more than ${AI_REVIEW_HOURS} hours.`,
      link: '/app/ai-inbox',
      entityType: 'ai_detection',
      dedupeKey: `ai-pending:${today}`,
    });
  }
};

export const runNotificationJob = async () => {
  if (running) return;
  running = true;
  try {
    const companies = await query('SELECT id, timezone, due_soon_days, stale_days FROM companies');
    for (const c of companies.rows) {
      try {
        // No reminders for companies whose trial / plan has ended
        if (!(await companyHasActiveAccess(c.id))) continue;
        await notifyCompanyReminders(c.id, c.timezone, { dueSoonDays: c.due_soon_days, staleDays: c.stale_days });
        // Module 23: re-evaluate the alert rules (daily job in the spec; hourly keeps them fresh)
        await refreshCompanyAlerts(c.id);
      } catch (err) {
        console.error(`[notification-job] company ${c.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[notification-job] failed:', err.message);
  } finally {
    running = false;
  }
};

export const startNotificationJob = () => {
  setTimeout(runNotificationJob, FIRST_RUN_DELAY_MS);
  setInterval(runNotificationJob, INTERVAL_MS);
  console.log('Notification reminders job started (hourly)');
};
