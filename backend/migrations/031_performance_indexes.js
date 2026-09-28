// Module 34 (performance): indexes for the queries behind the Orders list, Dashboard,
// Tracking and Alerts (latest activity per order, company-wide lists).
export const up = `
  CREATE INDEX IF NOT EXISTS idx_tracking_events_order_created ON tracking_events(order_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_tracking_events_company_id ON tracking_events(company_id);
  CREATE INDEX IF NOT EXISTS idx_shipments_company_updated ON shipments(company_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_ai_order_extracts_company_status ON ai_order_extracts(company_id, status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_orders_company_created ON orders(company_id, created_at DESC);
`;

export const down = `
  DROP INDEX IF EXISTS idx_orders_company_created;
  DROP INDEX IF EXISTS idx_ai_order_extracts_company_status;
  DROP INDEX IF EXISTS idx_shipments_company_updated;
  DROP INDEX IF EXISTS idx_tracking_events_company_id;
  DROP INDEX IF EXISTS idx_tracking_events_order_created;
`;
