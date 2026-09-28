// Module 28 / 29: one subscription per company (14-day trial, then a paid plan).
// A company's row is created on first use, with the trial starting when the company was created.
export const up = `
  CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
    plan VARCHAR(20) NOT NULL DEFAULT 'trial',
    status VARCHAR(20) NOT NULL DEFAULT 'trialing',
    trial_started_at TIMESTAMP WITH TIME ZONE,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    requested_plan VARCHAR(20),
    requested_at TIMESTAMP WITH TIME ZONE,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`;

export const down = `
  DROP TABLE IF EXISTS subscriptions;
`;
