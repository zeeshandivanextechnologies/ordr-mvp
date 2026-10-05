export const up = `
ALTER TABLE companies
ADD COLUMN pan VARCHAR(50),
ADD COLUMN registration_number VARCHAR(100),
ADD COLUMN gst_number VARCHAR(50),
ADD COLUMN address TEXT;
`;

export const down = `
ALTER TABLE companies
DROP COLUMN pan,
DROP COLUMN registration_number,
DROP COLUMN gst_number,
DROP COLUMN address;
`;
