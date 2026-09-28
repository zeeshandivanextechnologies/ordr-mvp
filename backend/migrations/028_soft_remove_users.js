// Removing a team member hides and disables the account instead of deleting it, so the
// orders, shipments, history and documents they created stay intact (Module 20 / 35).
export const up = `
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES users(id) ON DELETE SET NULL;
`;

export const down = `
  ALTER TABLE users
    DROP COLUMN IF EXISTS removed_by,
    DROP COLUMN IF EXISTS removed_at;
`;
