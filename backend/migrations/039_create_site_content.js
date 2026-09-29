// Website (landing page) content edited from the admin panel. Only sections an admin
// has changed are stored; everything else shows the built-in default content.
export const up = `
  CREATE TABLE IF NOT EXISTS site_content (
    key VARCHAR(100) PRIMARY KEY,
    content JSONB NOT NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`;

export const down = `
  DROP TABLE IF EXISTS site_content;
`;
