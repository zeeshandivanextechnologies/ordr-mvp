// Module 17 / 30: which order items (and how much of each) go in a shipment.
// product/unit are kept as a snapshot so allocations survive an order edit
// (order items are re-created on edit and re-linked by product name).
export const up = `
  CREATE TABLE IF NOT EXISTS shipment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
    product VARCHAR(255),
    unit VARCHAR(50),
    quantity DECIMAL(15,2) NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment_id ON shipment_items(shipment_id);
  CREATE INDEX IF NOT EXISTS idx_shipment_items_order_item_id ON shipment_items(order_item_id);
`;

export const down = `
  DROP TABLE IF EXISTS shipment_items;
`;
