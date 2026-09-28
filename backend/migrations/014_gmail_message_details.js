export const up = `
  ALTER TABLE gmail_messages
    ADD COLUMN IF NOT EXISTS body TEXT,
    ADD COLUMN IF NOT EXISTS has_attachment BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS attachment_names TEXT,
    ADD COLUMN IF NOT EXISTS is_potential_order BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS prefilter_reason VARCHAR(50),
    ADD COLUMN IF NOT EXISTS prefilter_keywords TEXT;
`;

export const down = `
  ALTER TABLE gmail_messages
    DROP COLUMN IF EXISTS body,
    DROP COLUMN IF EXISTS has_attachment,
    DROP COLUMN IF EXISTS attachment_names,
    DROP COLUMN IF EXISTS is_potential_order,
    DROP COLUMN IF EXISTS prefilter_reason,
    DROP COLUMN IF EXISTS prefilter_keywords;
`;