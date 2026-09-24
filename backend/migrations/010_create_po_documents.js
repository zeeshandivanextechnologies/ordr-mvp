export const up = `
  CREATE TABLE IF NOT EXISTS po_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_type VARCHAR(20) NOT NULL,
    file_size BIGINT NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_po_documents_company_id ON po_documents(company_id);
  CREATE INDEX IF NOT EXISTS idx_po_documents_order_id ON po_documents(order_id);
`;

export const down = `
  DROP TABLE IF EXISTS po_documents;
`;