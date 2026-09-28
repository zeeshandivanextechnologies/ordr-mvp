// Stores attachment metadata (filename, mimeType, size, attachmentId) per Gmail
// message so attachments can be downloaded later for AI extraction.
export const up = `
  ALTER TABLE gmail_messages
    ADD COLUMN IF NOT EXISTS attachments JSONB;
`;

export const down = `
  ALTER TABLE gmail_messages
    DROP COLUMN IF EXISTS attachments;
`;
