import { query } from '../config/database.js';

const DEFAULT_PREFS = {
  email_notifications: true,
  shipment_alerts: true,
  ai_order_detection: false,
  delivery_reminders: false,
};

export const getNotificationPreferences = async (req, res) => {
  try {
    const result = await query(
      `SELECT user_id, email_notifications, shipment_alerts,
              ai_order_detection, delivery_reminders
       FROM user_notification_preferences
       WHERE user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      await query(
        `INSERT INTO user_notification_preferences
         (user_id, email_notifications, shipment_alerts, ai_order_detection, delivery_reminders)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO NOTHING`,
        [req.user.id, DEFAULT_PREFS.email_notifications, DEFAULT_PREFS.shipment_alerts, DEFAULT_PREFS.ai_order_detection, DEFAULT_PREFS.delivery_reminders]
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
    const { email_notifications, shipment_alerts, ai_order_detection, delivery_reminders } = req.body;

    const result = await query(
      `INSERT INTO user_notification_preferences
       (user_id, email_notifications, shipment_alerts, ai_order_detection, delivery_reminders)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         email_notifications = EXCLUDED.email_notifications,
         shipment_alerts = EXCLUDED.shipment_alerts,
         ai_order_detection = EXCLUDED.ai_order_detection,
         delivery_reminders = EXCLUDED.delivery_reminders,
         updated_at = NOW()
       RETURNING user_id, email_notifications, shipment_alerts,
                 ai_order_detection, delivery_reminders`,
      [
        req.user.id,
        email_notifications ?? true,
        shipment_alerts ?? true,
        ai_order_detection ?? false,
        delivery_reminders ?? false,
      ]
    );

    res.json({
      message: 'Notification preferences updated successfully',
      preferences: result.rows[0],
    });
  } catch (error) {
    throw error;
  }
};