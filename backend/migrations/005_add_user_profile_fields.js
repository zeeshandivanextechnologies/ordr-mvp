export const up = `
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS designation VARCHAR(100),
  ADD COLUMN IF NOT EXISTS gst_number VARCHAR(50);
`;

export const down = `
ALTER TABLE users
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS designation,
  DROP COLUMN IF EXISTS gst_number;
`;