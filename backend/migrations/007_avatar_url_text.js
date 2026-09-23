export const up = `
ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT;
`;

export const down = `
ALTER TABLE users ALTER COLUMN avatar_url TYPE VARCHAR(500);
`;