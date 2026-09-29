// Module 2: remember whether the company finished onboarding, so an admin who
// leaves half-way is sent back to it. Companies that already exist when the
// column is first added are marked complete (they are already using the app).
// The backfill runs only once, because the runner re-applies every migration.
export const up = `
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'companies' AND column_name = 'onboarding_completed'
    ) THEN
      ALTER TABLE companies ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT false;
      UPDATE companies SET onboarding_completed = true;
    END IF;
  END $$;
`;

export const down = `
  ALTER TABLE companies DROP COLUMN IF EXISTS onboarding_completed;
`;
