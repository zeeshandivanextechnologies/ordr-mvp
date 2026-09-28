// Module 24: in-app notifications, one row per user (so each user has their own read state).
// dedupe_key prevents the same reminder being created twice for the same user.
export const up = `
  CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(40) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    link VARCHAR(500),
    entity_type VARCHAR(40),
    entity_id VARCHAR(100),
    dedupe_key VARCHAR(200),
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_user_dedupe
    ON notifications(user_id, dedupe_key)
    WHERE dedupe_key IS NOT NULL;
`;

export const down = `
  DROP TABLE IF EXISTS notifications;
`;
