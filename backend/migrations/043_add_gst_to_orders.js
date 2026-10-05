export const up = `
ALTER TABLE orders ADD COLUMN gst_percentage NUMERIC(5, 2);
ALTER TABLE orders ADD COLUMN gst_amount NUMERIC(15, 2);
`;

export const down = `
ALTER TABLE orders DROP COLUMN gst_percentage;
ALTER TABLE orders DROP COLUMN gst_amount;
`;
