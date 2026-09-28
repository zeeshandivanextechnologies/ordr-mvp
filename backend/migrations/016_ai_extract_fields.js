// Full AI extraction fields (Module 9): order dates, delivery location, currency,
// structured line items, per-field confidence, and links to the source document
// and the order created on confirm.
export const up = `
  ALTER TABLE ai_order_extracts
    ADD COLUMN IF NOT EXISTS order_date DATE,
    ADD COLUMN IF NOT EXISTS required_delivery_date DATE,
    ADD COLUMN IF NOT EXISTS delivery_location TEXT,
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10),
    ADD COLUMN IF NOT EXISTS line_items JSONB,
    ADD COLUMN IF NOT EXISTS field_confidence JSONB,
    ADD COLUMN IF NOT EXISTS po_document_id UUID REFERENCES po_documents(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
`;

export const down = `
  ALTER TABLE ai_order_extracts
    DROP COLUMN IF EXISTS order_date,
    DROP COLUMN IF EXISTS required_delivery_date,
    DROP COLUMN IF EXISTS delivery_location,
    DROP COLUMN IF EXISTS currency,
    DROP COLUMN IF EXISTS line_items,
    DROP COLUMN IF EXISTS field_confidence,
    DROP COLUMN IF EXISTS po_document_id,
    DROP COLUMN IF EXISTS order_id;
`;
