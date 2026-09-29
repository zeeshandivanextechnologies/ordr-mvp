// Loaded before every test file (node --test --import ./tests/setup.js).
// Points the app at a separate TEST database and switches off everything that
// would reach the outside world (email, AI, Razorpay), so `npm test` can never
// touch real data or real customers.
import dotenv from 'dotenv';

dotenv.config();

process.env.NODE_ENV = 'test';
// Email: nodemailer builds messages but sends nothing (utils/emailService.js)
process.env.EMAIL_DISABLED = 'true';
// AI: real Gemini calls are blocked in tests; tests provide fake answers (utils/orderExtraction.js)
process.env.GEMINI_API_KEY = '';
// Payments: Razorpay is treated as "not configured", so no API call is ever made
process.env.RAZORPAY_KEY_ID = '';
process.env.RAZORPAY_KEY_SECRET = '';
process.env.RAZORPAY_WEBHOOK_SECRET = process.env.TEST_RAZORPAY_WEBHOOK_SECRET || 'test-webhook-secret';

// Database: TEST_DATABASE_URL, or the local DB_* settings with the database name + "_test".
// Empty strings (not delete) so a later dotenv.config() cannot bring the real values back.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else {
  process.env.DATABASE_URL = '';
  process.env.DB_NAME = process.env.TEST_DB_NAME || `${process.env.DB_NAME || 'ordr_db'}_test`;
}

const dbName = process.env.DATABASE_URL
  ? decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.replace(/^\//, ''))
  : process.env.DB_NAME;
const host = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : process.env.DB_HOST || 'localhost';

if (/neon\.tech|render\.com|amazonaws\.com/i.test(host) || !/test/i.test(dbName || '')) {
  console.error(
    `\nRefusing to run tests against "${dbName}" on "${host}".\n` +
    'Tests only run on a database whose name contains "test" and never on hosted production databases.\n' +
    'Create the local test database with: npm run test:db\n'
  );
  process.exit(1);
}

export const TEST_DB = { host, dbName };
