export const up = `
  CREATE TABLE IF NOT EXISTS ai_order_extracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    source_email VARCHAR(255),
    source_subject VARCHAR(255),
    source_body TEXT,
    attachment_name VARCHAR(255),
    order_type VARCHAR(50),
    customer_name VARCHAR(255),
    po_number VARCHAR(100),
    items TEXT,
    approx_value DECIMAL(15,2),
    email_date TIMESTAMP WITH TIME ZONE,
    confidence INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'New',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_ai_order_extracts_company_id ON ai_order_extracts(company_id);
`;

export const down = `
  DROP TABLE IF EXISTS ai_order_extracts;
`;