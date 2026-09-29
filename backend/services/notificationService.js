// Module 24: in-app notifications (+ optional email).
// In-app notifications always reach every active user of the company. An email copy is sent
// only when the user enabled "Email Notifications" and the matching category in Settings.
import { query } from '../config/database.js';
import config from '../config/environment.js';
import { sendNotificationEmail } from '../utils/emailService.js';

// Each type belongs to one of the Settings categories (Module 27):
// New order detection, Delivery alerts, Delay alerts, Stale order alerts
export const NOTIFICATION_TYPES = {
  new_order_detected: { pref: 'ai_order_detection' },
  ai_review_required: { pref: 'ai_order_detection' },
  order_update_detected: { pref: 'ai_order_detection' },
  delivery_due_soon: { pref: 'delivery_reminders' },
  shipment_delivered: { pref: 'delivery_reminders' },
  partial_balance_pending: { pref: 'delivery_reminders' },
  order_delayed: { pref: 'delay_alerts' },
  order_stale: { pref: 'stale_alerts' },
};

// Same defaults as the notification settings screen
const DEFAULT_PREFS = {
  email_notifications: true,
  shipment_alerts: true,
  ai_order_detection: false,
  delivery_reminders: false,
  delay_alerts: true,
  stale_alerts: true,
};

/**
 * Creates a notification for every active user of the company.
 * @param {string} companyId
 * @param {object} n { type, title, message, link, entityType, entityId, dedupeKey }
 * @param {object} [opts] { excludeUserId } e.g. the user who performed the action
 * Returns how many users were notified. Never throws (notifications must not break the action).
 */
export const notifyCompany = async (companyId, n, opts = {}) => {
  try {
    if (!NOTIFICATION_TYPES[n.type]) throw new Error(`Unknown notification type ${n.type}`);
    const inserted = await query(
      `INSERT INTO notifications (company_id, user_id, type, title, message, link, entity_type, entity_id, dedupe_key)
       SELECT $1, u.id, $2, $3, $4, $5, $6, $7, $8
       FROM users u
       WHERE u.company_id = $1 AND u.is_active = true AND ($9::uuid IS NULL OR u.id <> $9::uuid)
       ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
       RETURNING user_id`,
      [
        companyId,
        n.type,
        String(n.title).slice(0, 255),
        n.message || null,
        n.link || null,
        n.entityType || null,
        n.entityId ? String(n.entityId) : null,
        n.dedupeKey || null,
        opts.excludeUserId || null,
      ]
    );

    // Optional email copies (only for users who were actually notified now)
    const userIds = inserted.rows.map((r) => r.user_id);
    if (userIds.length > 0) {
      const pref = NOTIFICATION_TYPES[n.type].pref;
      const recipients = await query(
        `SELECT u.email,
                COALESCE(p.email_notifications, $2) AS email_on,
                COALESCE(p.${pref}, $3) AS category_on
         FROM users u LEFT JOIN user_notification_preferences p ON p.user_id = u.id
         WHERE u.id = ANY($1::uuid[])`,
        [userIds, DEFAULT_PREFS.email_notifications, DEFAULT_PREFS[pref]]
      );
      const link = n.link ? `${config.frontendUrl}${n.link}` : null;
      for (const r of recipients.rows) {
        if (r.email_on && r.category_on && r.email) {
          // Fire and forget: email delivery must not slow the user's action down
          sendNotificationEmail(r.email, n.title, n.message || '', link).catch(() => {});
        }
      }
    }
    return userIds.length;
  } catch (error) {
    console.error(`Notification failed (${n?.type}):`, error.message);
    return 0;
  }
};

// New AI detection (from Gmail or an upload): "New order detected" or, when it needs a
// closer look, "AI review required"
export const notifyNewDetection = (companyId, { extractId, status, customerName, poNumber, source }, opts = {}) =>
  notifyCompany(
    companyId,
    {
      type: status === 'Needs Review' ? 'ai_review_required' : 'new_order_detected',
      title: status === 'Needs Review' ? 'AI review required' : 'New order detected',
      message: `${customerName || 'Unknown party'} - PO ${poNumber || 'not found'} (from ${source}). Review it in the AI Order Inbox.`,
      link: `/app/ai-inbox/${extractId}/review`,
      entityType: 'ai_detection',
      entityId: extractId,
      dedupeKey: `detection:${extractId}`,
    },
    opts
  );
