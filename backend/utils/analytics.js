// Module 36 analytics helper. Like the audit log, recording is best-effort:
// a problem is reported in the server log but never breaks the user's action.
import { query } from '../config/database.js';

export const ANALYTICS_EVENTS = [
  'signup_completed',
  'company_created',
  'gmail_connected',
  'inbox_scan_started',
  'inbox_scan_completed',
  'order_detected',
  'order_detection_confirmed',
  'order_detection_ignored',
  'manual_order_created',
  'shipment_created',
  'shipment_delivered',
  'order_delivered',
  'alert_created',
  'search_used',
  'trial_started',
  'plan_selected',
  'subscription_started',
  'subscription_cancelled',
];

const INSERT_SQL = `INSERT INTO analytics_events (company_id, user_id, event, properties, dedupe_key)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (dedupe_key) DO NOTHING`;

const params = ({ companyId = null, userId = null, event, properties = {}, dedupeKey = null }) => [
  companyId,
  userId,
  event,
  JSON.stringify(properties || {}),
  dedupeKey,
];

/**
 * Records one event. Never throws; callers may await it or not.
 * @param {object} e { event, companyId, userId, properties, dedupeKey }
 */
export const trackEvent = async (e) => {
  try {
    if (!ANALYTICS_EVENTS.includes(e.event)) throw new Error(`Unknown analytics event ${e.event}`);
    await query(INSERT_SQL, params(e));
  } catch (error) {
    console.error(`Analytics event failed (${e.event}):`, error.message);
  }
};

/** Records several events of one kind in a single statement (e.g. new alerts). Never throws. */
export const trackEvents = async (events) => {
  if (!Array.isArray(events) || events.length === 0) return;
  try {
    await query(
      `INSERT INTO analytics_events (company_id, user_id, event, properties, dedupe_key)
       SELECT t.company_id, t.user_id, t.event, t.properties, t.dedupe_key
       FROM unnest($1::uuid[], $2::uuid[], $3::text[], $4::jsonb[], $5::text[])
         AS t(company_id, user_id, event, properties, dedupe_key)
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [
        events.map((e) => e.companyId || null),
        events.map((e) => e.userId || null),
        events.map((e) => e.event),
        events.map((e) => JSON.stringify(e.properties || {})),
        events.map((e) => e.dedupeKey || null),
      ]
    );
  } catch (error) {
    console.error('Analytics events failed:', error.message);
  }
};

/**
 * Records an event inside an open transaction, so it is kept only if the transaction
 * commits. A savepoint makes sure a failure here never aborts the caller's transaction.
 */
export const trackEventInTx = async (client, e) => {
  try {
    await client.query('SAVEPOINT analytics_event');
    try {
      await client.query(INSERT_SQL, params(e));
      await client.query('RELEASE SAVEPOINT analytics_event');
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT analytics_event');
      console.error(`Analytics event failed (${e.event}):`, error.message);
    }
  } catch (error) {
    console.error(`Analytics event failed (${e.event}):`, error.message);
  }
};
