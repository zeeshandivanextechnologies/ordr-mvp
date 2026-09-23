export const up = `
ALTER TABLE users 
DROP COLUMN IF EXISTS phone,
DROP COLUMN IF EXISTS designation,
DROP COLUMN IF EXISTS gst_number;
`;

export const down = `
ALTER TABLE users 
ADD COLUMN IF EXISTS phone VARCHAR(20),
ADD COLUMN IF EXISTS designation VARCHAR(100),
ADD COLUMN IF EXISTS gst_number VARCHAR(50);
`;
