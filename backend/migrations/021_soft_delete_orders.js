// Module 20 / 35: deleting an order hides it instead of removing it, so its
// tracking history, items, shipments and documents are never lost.
export const up = `
  ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;

  CREATE INDEX IF NOT EXISTS idx_orders_company_active
    ON orders(company_id)
    WHERE deleted_at IS NULL;
`;

export const down = `
  DROP INDEX IF EXISTS idx_orders_company_active;
  ALTER TABLE orders
    DROP COLUMN IF EXISTS deleted_by,
    DROP COLUMN IF EXISTS deleted_at;
`;
