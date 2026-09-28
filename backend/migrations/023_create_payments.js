// Razorpay payments for plan purchases (one row per checkout attempt).
export const up = `
  CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    plan VARCHAR(20) NOT NULL,
    amount INTEGER NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    provider VARCHAR(20) NOT NULL DEFAULT 'razorpay',
    provider_order_id VARCHAR(100) NOT NULL UNIQUE,
    provider_payment_id VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'created',
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);
`;

export const down = `
  DROP TABLE IF EXISTS payments;
`;
