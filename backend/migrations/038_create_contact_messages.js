// Contact Us form: every message is saved (and also emailed to the team inbox),
// so nothing is lost if the email cannot be delivered.
export const up = `
  CREATE TABLE IF NOT EXISTS contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(200) NOT NULL,
    company VARCHAR(150),
    phone VARCHAR(30),
    topic VARCHAR(50),
    message TEXT NOT NULL,
    email_sent BOOLEAN NOT NULL DEFAULT false,
    ip_address VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages (created_at DESC);
`;

export const down = `
  DROP TABLE IF EXISTS contact_messages;
`;
