export const up = `
ALTER TABLE orders
ADD COLUMN billing_address TEXT,
ADD COLUMN shipping_address TEXT;
`;

export const down = `
ALTER TABLE orders
DROP COLUMN billing_address,
DROP COLUMN shipping_address;
`;
