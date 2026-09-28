// Links AI detections created before po_document_id existed to the document
// uploaded with them (same company, same file name, uploaded within 2 minutes),
// so older entries also get the document preview/download. Safe to re-run.
export const up = `
  UPDATE ai_order_extracts e
  SET po_document_id = d.id
  FROM po_documents d
  WHERE e.po_document_id IS NULL
    AND e.gmail_message_id IS NULL
    AND d.company_id = e.company_id
    AND d.file_name = e.attachment_name
    AND ABS(EXTRACT(EPOCH FROM (d.created_at - e.created_at))) < 120
    AND NOT EXISTS (SELECT 1 FROM ai_order_extracts x WHERE x.po_document_id = d.id);
`;

// Data-only migration; nothing to undo structurally
export const down = `SELECT 1;`;
