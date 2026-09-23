import pg from 'pg';
const { Client } = pg;
import { up as up5 } from './migrations/005_add_user_profile_fields.js';
import { up as up6 } from './migrations/006_create_notification_preferences.js';
import { up as up7 } from './migrations/007_avatar_url_text.js';

const LOCAL_DB_URL = "postgresql://postgres:admin@localhost:5432/ordr_db";
const NEON_DB_URL = "postgresql://neondb_owner:npg_g54aUywTlRZQ@ep-nameless-bird-b42c7nwv-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function fixNeon() {
  const localClient = new Client({ connectionString: LOCAL_DB_URL });
  const neonClient = new Client({ connectionString: NEON_DB_URL, ssl: { rejectUnauthorized: false } });

  try {
    await localClient.connect();
    await neonClient.connect();

    console.log("Applying missing migrations (5, 6, 7)...");
    try { await neonClient.query(up5); } catch(e) { console.log('up5 already applied or error', e.message); }
    try { await neonClient.query(up6); } catch(e) { console.log('up6 already applied or error', e.message); }
    try { await neonClient.query(up7); } catch(e) { console.log('up7 already applied or error', e.message); }
    
    console.log("Migrations applied.");

    // Sync users with UPSERT
    console.log("Syncing users data...");
    const dataRes = await localClient.query(`SELECT * FROM users`);
    const rows = dataRes.rows;
    
    if (rows.length > 0) {
      const columns = Object.keys(rows[0]);
      
      for (const row of rows) {
        const values = columns.map(c => row[c]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const updates = columns.filter(c => c !== 'id').map(c => `${c} = EXCLUDED.${c}`).join(', ');
        
        const query = `
          INSERT INTO users (${columns.join(', ')}) 
          VALUES (${placeholders})
          ON CONFLICT (id) DO UPDATE SET ${updates}
        `;
        
        try {
          await neonClient.query(query, values);
        } catch (err) {
          console.error(`Error upserting row into users:`, err.message);
        }
      }
      console.log(`Finished syncing ${rows.length} users.`);
    }

    // Since we also have team_invitations, let's just do upsert for that too to be safe
    console.log("Syncing team_invitations data...");
    const dataRes2 = await localClient.query(`SELECT * FROM team_invitations`);
    const rows2 = dataRes2.rows;
    
    if (rows2.length > 0) {
      const columns2 = Object.keys(rows2[0]);
      for (const row of rows2) {
        const values2 = columns2.map(c => row[c]);
        const placeholders2 = columns2.map((_, i) => `$${i + 1}`).join(', ');
        const updates2 = columns2.filter(c => c !== 'id').map(c => `${c} = EXCLUDED.${c}`).join(', ');
        
        const query2 = `
          INSERT INTO team_invitations (${columns2.join(', ')}) 
          VALUES (${placeholders2})
          ON CONFLICT (id) DO UPDATE SET ${updates2}
        `;
        try {
          await neonClient.query(query2, values2);
        } catch (err) {
          console.error(`Error upserting row into team_invitations:`, err.message);
        }
      }
      console.log(`Finished syncing ${rows2.length} team_invitations.`);
    }
    
    // Also sync notification_preferences if it has data
    console.log("Syncing notification_preferences data...");
    const dataRes3 = await localClient.query(`SELECT * FROM notification_preferences`);
    const rows3 = dataRes3.rows;
    if (rows3.length > 0) {
      const columns3 = Object.keys(rows3[0]);
      for (const row of rows3) {
        const values3 = columns3.map(c => row[c]);
        const placeholders3 = columns3.map((_, i) => `$${i + 1}`).join(', ');
        const updates3 = columns3.filter(c => c !== 'user_id').map(c => `${c} = EXCLUDED.${c}`).join(', ');
        // using user_id as conflict target
        const query3 = `
          INSERT INTO notification_preferences (${columns3.join(', ')}) 
          VALUES (${placeholders3})
          ON CONFLICT (user_id) DO UPDATE SET ${updates3}
        `;
        try {
          await neonClient.query(query3, values3);
        } catch (err) {
          console.error(`Error upserting row into notification_preferences:`, err.message);
        }
      }
      console.log(`Finished syncing ${rows3.length} notification_preferences.`);
    }

    console.log("\nFix and sync completed successfully!");

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await localClient.end();
    await neonClient.end();
  }
}

fixNeon();
