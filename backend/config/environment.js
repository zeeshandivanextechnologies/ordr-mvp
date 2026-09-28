import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';

// A real, long JWT secret is mandatory in production (the dev fallback is public in the code)
if (nodeEnv === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to a random value of at least 32 characters in production');
}
if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set; using an insecure development secret.');
}

export default {
  port: process.env.PORT || 5000,
  nodeEnv,
  jwtSecret: process.env.JWT_SECRET || 'ordr-dev-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  backendUrl: (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/+$/, ''),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  },
  // Automatic Gmail scan interval in minutes (0 disables it)
  gmailAutoScanMinutes:
    process.env.GMAIL_AUTO_SCAN_MINUTES && Number.isFinite(Number(process.env.GMAIL_AUTO_SCAN_MINUTES))
      ? Number(process.env.GMAIL_AUTO_SCAN_MINUTES)
      : 15,
  ai: {
    provider: process.env.AI_PROVIDER || 'openai',
    apiKey: process.env.AI_API_KEY,
  },
};
