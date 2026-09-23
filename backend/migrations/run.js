import { query } from '../config/database.js';
import { up as up1, down as down1 } from './001_initial.js';
import { up as up2, down as down2 } from './002_add_tracking_preferences.js';
import { up as up3, down as down3 } from './003_add_team_invitations.js';
import { up as up4, down as down4 } from './004_drop_unused_user_fields.js';
import { up as up5, down as down5 } from './005_add_user_profile_fields.js';
import { up as up6, down as down6 } from './006_create_notification_preferences.js';
import { up as up7, down as down7 } from './007_avatar_url_text.js';

async function runMigrations() {
  try {
    console.log('Running migrations...');
    // await query(up1);
    // await query(up2);
    // await query(up3);
    await query(up4);
    await query(up5);
    await query(up6);
    await query(up7);
    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

async function rollbackMigrations() {
  try {
    console.log('Rolling back migrations...');
    await query(down);
    console.log('Rollback completed successfully!');
  } catch (error) {
    console.error('Rollback failed:', error);
    process.exit(1);
  }
}

const command = process.argv[2];

if (command === 'rollback') {
  rollbackMigrations();
} else {
  runMigrations();
}
