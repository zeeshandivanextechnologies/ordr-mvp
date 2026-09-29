// Security: sessions (JWTs) issued before a password change or reset stop working.
export const up = `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE;
`;

export const down = `
  ALTER TABLE users DROP COLUMN IF EXISTS password_changed_at;
`;
