// Module 23: alerts raised by the rules engine (overdue, stale, partial, missing tracking, ...).
// dedupe_key identifies one occurrence of a problem so the same alert is never created twice
// (a dismissed alert does not come back unless the situation changes, e.g. a new due date).
export const up = `
  CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    type VARCHAR(40) NOT NULL,
    severity VARCHAR(10) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
    po_number VARCHAR(100),
    party_name VARCHAR(255),
    link VARCHAR(500),
    dedupe_key VARCHAR(200) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    auto_resolved BOOLEAN NOT NULL DEFAULT false,
    dismissed_at TIMESTAMP WITH TIME ZONE,
    dismissed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE UNIQUE INDEX IF NOT EXISTS uq_alerts_company_dedupe ON alerts(company_id, dedupe_key);
  CREATE INDEX IF NOT EXISTS idx_alerts_company_status ON alerts(company_id, status, created_at DESC);
`;

export const down = `
  DROP TABLE IF EXISTS alerts;
`;
