// Module 11: detect re-uploads of the same file (content hash) and flag AI
// detections whose PO number already exists.
export const up = `
  ALTER TABLE po_documents
    ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);

  CREATE INDEX IF NOT EXISTS idx_po_documents_company_hash
    ON po_documents(company_id, file_hash)
    WHERE file_hash IS NOT NULL;

  ALTER TABLE ai_order_extracts
    ADD COLUMN IF NOT EXISTS duplicate_warning TEXT;
`;

export const down = `
  ALTER TABLE ai_order_extracts DROP COLUMN IF EXISTS duplicate_warning;
  DROP INDEX IF EXISTS idx_po_documents_company_hash;
  ALTER TABLE po_documents DROP COLUMN IF EXISTS file_hash;
`;
