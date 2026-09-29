// Module 36: product analytics events (signup_completed, gmail_connected, order_detected, ...).
// Append-only. dedupe_key stops the same event being counted twice when two paths
// report it (e.g. Razorpay webhook and checkout verification for one payment).
export const up = `
  CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event VARCHAR(60) NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    dedupe_key VARCHAR(200) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_analytics_events_company_event
    ON analytics_events (company_id, event, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_analytics_events_event_created
    ON analytics_events (event, created_at DESC);
`;

export const down = `
  DROP TABLE IF EXISTS analytics_events;
`;
