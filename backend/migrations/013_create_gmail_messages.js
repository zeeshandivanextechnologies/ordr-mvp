export const up = `
  CREATE TABLE IF NOT EXISTS gmail_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email_connection_id UUID NOT NULL REFERENCES email_connections(id) ON DELETE CASCADE,
    message_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255) NOT NULL,
    sender_email VARCHAR(255),
    sender_name VARCHAR(255),
    subject VARCHAR(1000),
    snippet TEXT,
    received_at TIMESTAMP WITH TIME ZONE,
    processed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, message_id)
  );

  CREATE INDEX IF NOT EXISTS idx_gmail_messages_company_id ON gmail_messages(company_id);
  CREATE INDEX IF NOT EXISTS idx_gmail_messages_connection_id ON gmail_messages(email_connection_id);
  CREATE INDEX IF NOT EXISTS idx_gmail_messages_processed ON gmail_messages(processed);
`;

export const down = `
  DROP TABLE IF EXISTS gmail_messages;
`;