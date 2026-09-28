// Security: counts wrong OTP attempts so a reset code is locked after a few guesses.
// (OTPs are now stored as a hash, never in plain text.)
export const up = `
  ALTER TABLE password_resets
    ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
`;

export const down = `
  ALTER TABLE password_resets DROP COLUMN IF EXISTS attempts;
`;
