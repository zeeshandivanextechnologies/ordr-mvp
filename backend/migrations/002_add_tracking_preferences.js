export const up = `
ALTER TABLE companies ADD COLUMN tracking_preferences VARCHAR[] DEFAULT '{}';
`;

export const down = `
ALTER TABLE companies DROP COLUMN tracking_preferences;
`;
