// Module 24: "Mark All Read" clears the notification list. Rows are kept (with
// cleared_at) instead of deleted, so their dedupe keys still stop the same
// reminder from being created again.
export const up = `
  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMP WITH TIME ZONE;
`;

export const down = `
  ALTER TABLE notifications DROP COLUMN IF EXISTS cleared_at;
`;
