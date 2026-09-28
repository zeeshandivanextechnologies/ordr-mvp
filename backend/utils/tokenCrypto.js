import crypto from 'crypto';
import config from '../config/environment.js';

// AES-256-GCM encryption for OAuth tokens stored in the database.
// Stored format: enc:v1:<iv>:<authTag>:<ciphertext> (all base64).
const PREFIX = 'enc:v1:';

// Prefer a dedicated key; fall back to one derived from JWT_SECRET so existing
// deployments keep working without a new env var.
const getKey = () => {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || config.jwtSecret;
  return crypto.createHash('sha256').update(String(secret)).digest();
};

export const isEncrypted = (value) => typeof value === 'string' && value.startsWith(PREFIX);

export const encryptToken = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (isEncrypted(value)) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

// Returns the plain token. Legacy plaintext values are returned as-is.
// Throws if an encrypted value cannot be decrypted (e.g. key changed).
export const decryptToken = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (!isEncrypted(value)) return value;
  const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
};
