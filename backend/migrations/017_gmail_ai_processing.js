// Module 8: AI classification of scanned Gmail messages and linking the
// resulting AI detections back to the Gmail message they came from.
export const up = `
  ALTER TABLE gmail_messages
    ADD COLUMN IF NOT EXISTS ai_classification VARCHAR(50),
    ADD COLUMN IF NOT EXISTS ai_confidence INTEGER,
    ADD COLUMN IF NOT EXISTS ai_reason TEXT,
    ADD COLUMN IF NOT EXISTS ai_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ai_error TEXT,
    ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;

  ALTER TABLE ai_order_extracts
    ADD COLUMN IF NOT EXISTS gmail_message_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS classification VARCHAR(50),
    ADD COLUMN IF NOT EXISTS classification_reason TEXT;

  -- One AI detection per Gmail message per company (Module 34)
  CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_order_extracts_gmail_message
    ON ai_order_extracts(company_id, gmail_message_id)
    WHERE gmail_message_id IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_gmail_messages_pending_ai
    ON gmail_messages(company_id)
    WHERE is_potential_order = true AND processed = false;
`;

export const down = `
  DROP INDEX IF EXISTS idx_gmail_messages_pending_ai;
  DROP INDEX IF EXISTS uq_ai_order_extracts_gmail_message;
  ALTER TABLE ai_order_extracts
    DROP COLUMN IF EXISTS gmail_message_id,
    DROP COLUMN IF EXISTS classification,
    DROP COLUMN IF EXISTS classification_reason;
  ALTER TABLE gmail_messages
    DROP COLUMN IF EXISTS ai_classification,
    DROP COLUMN IF EXISTS ai_confidence,
    DROP COLUMN IF EXISTS ai_reason,
    DROP COLUMN IF EXISTS ai_attempts,
    DROP COLUMN IF EXISTS ai_error,
    DROP COLUMN IF EXISTS processed_at;
`;
