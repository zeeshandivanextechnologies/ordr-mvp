// Module 35: append-only record of important user actions (who did what, when).
// Rows are never updated or deleted by the application.
export const up = `
  CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255),
    action VARCHAR(60) NOT NULL,
    entity_type VARCHAR(40),
    entity_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created ON audit_logs(company_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
`;

export const down = `
  DROP TABLE IF EXISTS audit_logs;
`;
