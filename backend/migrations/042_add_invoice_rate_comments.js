export const up = `
ALTER TABLE order_items ADD COLUMN invoice_rate NUMERIC(15, 2);
ALTER TABLE orders ADD COLUMN comments TEXT;
`;

export const down = `
ALTER TABLE order_items DROP COLUMN invoice_rate;
ALTER TABLE orders DROP COLUMN comments;
`;
