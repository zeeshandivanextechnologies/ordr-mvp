// Module 22: Needs Attention thresholds are configurable per company
// ("Due Soon" default 1 day, "Stale Order" default 5 days).
export const up = `
  ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS due_soon_days INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS stale_days INTEGER NOT NULL DEFAULT 5;
`;

export const down = `
  ALTER TABLE companies
    DROP COLUMN IF EXISTS due_soon_days,
    DROP COLUMN IF EXISTS stale_days;
`;
