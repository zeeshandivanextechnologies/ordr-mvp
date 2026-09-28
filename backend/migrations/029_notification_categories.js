// Settings -> Notifications as listed in the spec (Module 27):
// New order detection, Delivery alerts, Delay alerts, Stale order alerts.
// (ai_order_detection and delivery_reminders already exist; these two are new.)
export const up = `
  ALTER TABLE user_notification_preferences
    ADD COLUMN IF NOT EXISTS delay_alerts BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS stale_alerts BOOLEAN NOT NULL DEFAULT true;
`;

export const down = `
  ALTER TABLE user_notification_preferences
    DROP COLUMN IF EXISTS delay_alerts,
    DROP COLUMN IF EXISTS stale_alerts;
`;
