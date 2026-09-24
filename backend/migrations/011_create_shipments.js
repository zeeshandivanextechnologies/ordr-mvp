export const up = `
  CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    shipment_number VARCHAR(100) NOT NULL,
    quantity DECIMAL(15,2) DEFAULT 0.00,
    items TEXT,
    transporter VARCHAR(255),
    lr_number VARCHAR(100),
    awb_number VARCHAR(100),
    gr_number VARCHAR(100),
    vehicle_number VARCHAR(100),
    origin VARCHAR(255),
    destination VARCHAR(255),
    dispatch_date DATE,
    expected_delivery_date DATE,
    status VARCHAR(50) DEFAULT 'Dispatched',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_shipments_company_id ON shipments(company_id);
  CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments(order_id);
`;

export const down = `
  DROP TABLE IF EXISTS shipments;
`;