import { query } from '../config/database.js';

// Settings -> Notifications (Module 27). In-app notifications are always shown;
// these switches decide which ones are also emailed ("Email Notifications" is the master switch).
const PREF_FIELDS = ['email_notifications', 'shipment_alerts', 'ai_order_detection', 'delivery_reminders', 'delay_alerts', 'stale_alerts'];

const DEFAULT_PREFS = {
  email_notifications: true,
  shipment_alerts: true,
  ai_order_detection: false,
  delivery_reminders: false,
  delay_alerts: true,
  stale_alerts: true,
};

const SELECT_FIELDS = `user_id, ${PREF_FIELDS.join(', ')}`;

export const getNotificationPreferences = async (req, res) => {
  try {
    const result = await query(
      `SELECT ${SELECT_FIELDS} FROM user_notification_preferences WHERE user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      await query(
        `INSERT INTO user_notification_preferences (user_id, ${PREF_FIELDS.join(', ')})
         VALUES ($1, ${PREF_FIELDS.map((_, i) => `$${i + 2}`).join(', ')})
         ON CONFLICT (user_id) DO NOTHING`,
        [req.user.id, ...PREF_FIELDS.map((f) => DEFAULT_PREFS[f])]
      );
      return res.json({ preferences: { user_id: req.user.id, ...DEFAULT_PREFS } });
    }

    res.json({ preferences: result.rows[0] });
  } catch (error) {
    throw error;
  }
};

export const updateNotificationPreferences = async (req, res) => {
  try {
    // Only fields that were sent are changed; the others keep their saved value
    const values = PREF_FIELDS.map((f) => (typeof req.body[f] === 'boolean' ? req.body[f] : null));

    const result = await query(
      `INSERT INTO user_notification_preferences (user_id, ${PREF_FIELDS.join(', ')})
       VALUES ($1, ${PREF_FIELDS.map((f, i) => `COALESCE($${i + 2}::boolean, ${DEFAULT_PREFS[f]})`).join(', ')})
       ON CONFLICT (user_id) DO UPDATE SET
         ${PREF_FIELDS.map((f, i) => `${f} = COALESCE($${i + 2}::boolean, user_notification_preferences.${f})`).join(',\n         ')},
         updated_at = NOW()
       RETURNING ${SELECT_FIELDS}`,
      [req.user.id, ...values]
    );

    res.json({
      message: 'Notification preferences updated successfully',
      preferences: result.rows[0],
    });
  } catch (error) {
    throw error;
  }
};

// ---------- Module 24: in-app notification inbox (the current user's own notifications) ----------

// GET /notifications/inbox?limit=50
export const listMyNotifications = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const { rows } = await query(
      `SELECT id, type, title, message, link, entity_type, entity_id, read_at, created_at
       FROM notifications
       WHERE user_id = $1 AND cleared_at IS NULL
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    );
    const unread = await query(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL AND cleared_at IS NULL',
      [req.user.id]
    );
    res.json({ notifications: rows, unreadCount: unread.rows[0].count });
  } catch (error) {
    next(error);
  }
};

// PATCH /notifications/inbox/:id/read
export const markNotificationRead = async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE notifications SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Marked as read' });
  } catch (error) {
    next(error);
  }
};

// POST /notifications/inbox/read-all
export const markAllNotificationsRead = async (req, res, next) => {
  try {
    // Marks everything read and clears it from the list (rows stay, see migration 035)
    const result = await query(
      `UPDATE notifications SET read_at = COALESCE(read_at, NOW()), cleared_at = NOW()
       WHERE user_id = $1 AND cleared_at IS NULL`,
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read', updated: result.rowCount });
  } catch (error) {
    next(error);
  }
};
