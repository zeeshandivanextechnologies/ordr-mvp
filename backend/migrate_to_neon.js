import pg from 'pg';
const { Client } = pg;
import { up as up1 } from './migrations/001_initial.js';
import { up as up2 } from './migrations/002_add_tracking_preferences.js';
import { up as up3 } from './migrations/003_add_team_invitations.js';
import { up as up4 } from './migrations/004_drop_unused_user_fields.js';

const LOCAL_DB_URL = "postgresql://postgres:admin@localhost:5432/ordr_db";
const NEON_DB_URL = "postgresql://neondb_owner:npg_g54aUywTlRZQ@ep-nameless-bird-b42c7nwv-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function transferData() {
  const localClient = new Client({ connectionString: LOCAL_DB_URL });
  const neonClient = new Client({ connectionString: NEON_DB_URL });

  try {
    console.log("Connecting to databases...");
    await localClient.connect();
    await neonClient.connect();

    console.log("Running migrations on Neon DB to create tables...");
    await neonClient.query(up1);
    await neonClient.query(up2);
    await neonClient.query(up3);
    await neonClient.query(up4);
    console.log("Migrations applied on Neon DB.");

    console.log("Fetching tables from local DB...");
    const tablesRes = await localClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
    `);
    
    // Ordered to respect foreign keys
    const orderedTables = ['companies', 'users', 'password_resets', 'email_connections', 'team_invitations'];

    for (const table of orderedTables) {
      console.log(`\nTransferring data for table: ${table}...`);
      const dataRes = await localClient.query(`SELECT * FROM ${table}`);
      const rows = dataRes.rows;
      
      if (rows.length === 0) {
        console.log(`No data in ${table}. Skipping.`);
        continue;
      }

      console.log(`Found ${rows.length} rows in ${table}. Inserting...`);
      
      const columns = Object.keys(rows[0]);
      
      for (const row of rows) {
        const values = columns.map(c => row[c]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        
        const query = `
          INSERT INTO ${table} (${columns.join(', ')}) 
          VALUES (${placeholders})
          ON CONFLICT DO NOTHING
        `;
        
        try {
          await neonClient.query(query, values);
        } catch (err) {
          console.error(`Error inserting row into ${table}:`, err.message);
        }
      }
      console.log(`Finished ${table}.`);
    }
    console.log("\nData transfer completed successfully!");

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await localClient.end();
    await neonClient.end();
  }
}

transferData();
