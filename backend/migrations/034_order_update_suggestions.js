// Module 21: email update matching. An email classified as an Order / Dispatch /
// Delivery Update becomes a suggestion ("Update PO #8192 -> Dispatched, LR 928721")
// linked to the matching order/shipment. Nothing changes until a user applies it.
//
// When the table is first created, update emails from the last 30 days that were
// classified before this module existed are queued again so they get suggestions.
// That happens only once, because the runner re-applies every migration.
export const up = `
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name = 'order_update_suggestions'
    ) THEN
      CREATE TABLE order_update_suggestions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        gmail_message_id VARCHAR(255) NOT NULL,
        thread_id VARCHAR(255),
        source_email VARCHAR(255),
        source_name VARCHAR(255),
        source_subject TEXT,
        source_body TEXT,
        email_date TIMESTAMP WITH TIME ZONE,
        classification VARCHAR(50) NOT NULL,
        update_type VARCHAR(30),
        extracted JSONB NOT NULL DEFAULT '{}'::jsonb,
        confidence INTEGER,
        reason TEXT,
        order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
        shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
        match_method VARCHAR(20),
        match_confidence VARCHAR(10),
        status VARCHAR(20) NOT NULL DEFAULT 'Pending'
          CHECK (status IN ('Pending', 'Applied', 'Ignored')),
        applied_by UUID REFERENCES users(id) ON DELETE SET NULL,
        applied_at TIMESTAMP WITH TIME ZONE,
        applied_summary TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (company_id, gmail_message_id)
      );
      CREATE INDEX idx_order_update_suggestions_company_status
        ON order_update_suggestions (company_id, status, created_at DESC);

      UPDATE gmail_messages
      SET processed = false, processed_at = NULL, ai_attempts = 0, ai_error = NULL
      WHERE ai_classification IN ('Order Update', 'Dispatch Update', 'Delivery Update')
        AND received_at > NOW() - INTERVAL '30 days';
    END IF;
  END $$;
`;

export const down = `
  DROP TABLE IF EXISTS order_update_suggestions;
`;
