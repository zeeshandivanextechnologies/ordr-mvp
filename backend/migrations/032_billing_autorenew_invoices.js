// Billing (Module 28): auto-renew via Razorpay Subscriptions, invoice numbers, cancel.
export const up = `
  CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

  ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(30) UNIQUE,
    ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'one_time';

  ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS provider_subscription_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS provider_subscription_plan VARCHAR(20),
    -- Subscription created at checkout but not paid yet (the current one stays until then)
    ADD COLUMN IF NOT EXISTS pending_subscription_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS pending_subscription_plan VARCHAR(20);

  -- Razorpay plan ids created on demand for each ORDR plan / price
  CREATE TABLE IF NOT EXISTS razorpay_plans (
    plan VARCHAR(20) NOT NULL,
    amount INTEGER NOT NULL,
    provider_plan_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (plan, amount)
  );
`;

export const down = `
  DROP TABLE IF EXISTS razorpay_plans;
  ALTER TABLE subscriptions
    DROP COLUMN IF EXISTS pending_subscription_plan,
    DROP COLUMN IF EXISTS pending_subscription_id,
    DROP COLUMN IF EXISTS provider_subscription_plan,
    DROP COLUMN IF EXISTS provider_subscription_id,
    DROP COLUMN IF EXISTS auto_renew;
  ALTER TABLE payments
    DROP COLUMN IF EXISTS kind,
    DROP COLUMN IF EXISTS invoice_number;
  DROP SEQUENCE IF EXISTS invoice_number_seq;
`;
