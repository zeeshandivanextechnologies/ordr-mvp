export const up = `
  ALTER TABLE order_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_order_items_company_id ON order_items(company_id);
  CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
`;

export const down = `
  DROP INDEX IF EXISTS idx_order_items_order_id;
  DROP INDEX IF EXISTS idx_order_items_company_id;
  ALTER TABLE order_items DROP COLUMN IF EXISTS company_id;
`;