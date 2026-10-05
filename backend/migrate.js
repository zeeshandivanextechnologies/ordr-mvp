import 'dotenv/config';
import { query } from './config/database.js';

async function migrate() {
  try {
    await query(`
      ALTER TABLE order_items 
      ADD COLUMN IF NOT EXISTS dispatched_quantity NUMERIC(15,3) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS invoice_rate NUMERIC(15,2) DEFAULT 0;
    `);
    console.log('Successfully altered order_items');
  } catch (err) {
    console.error(err);
  }
  process.exit();
}

migrate();
