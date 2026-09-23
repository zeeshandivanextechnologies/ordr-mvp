export const up = `
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  shipment_alerts BOOLEAN NOT NULL DEFAULT true,
  ai_order_detection BOOLEAN NOT NULL DEFAULT false,
  delivery_reminders BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const down = `
DROP TABLE IF EXISTS user_notification_preferences;
`;