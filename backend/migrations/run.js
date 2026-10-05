import { query } from '../config/database.js';
import { up as up1, down as down1 } from './001_initial.js';
import { up as up2, down as down2 } from './002_add_tracking_preferences.js';
import { up as up3, down as down3 } from './003_add_team_invitations.js';
import { up as up4, down as down4 } from './004_drop_unused_user_fields.js';
import { up as up5, down as down5 } from './005_add_user_profile_fields.js';
import { up as up6, down as down6 } from './006_create_notification_preferences.js';
import { up as up7, down as down7 } from './007_avatar_url_text.js';
import { up as up8, down as down8 } from './008_create_orders_tables.js';
import { up as up9, down as down9 } from './009_add_order_items_company_id.js';
import { up as up10, down as down10 } from './010_create_po_documents.js';
import { up as up11, down as down11 } from './011_create_shipments.js';
import { up as up12, down as down12 } from './012_create_ai_order_extracts.js';
import { up as up13, down as down13 } from './013_create_gmail_messages.js';
import { up as up14, down as down14 } from './014_gmail_message_details.js';
import { up as up15, down as down15 } from './015_gmail_attachment_metadata.js';
import { up as up16, down as down16 } from './016_ai_extract_fields.js';
import { up as up17, down as down17 } from './017_gmail_ai_processing.js';
import { up as up18, down as down18 } from './018_link_old_extract_documents.js';
import { up as up19, down as down19 } from './019_upload_duplicates.js';
import { up as up20, down as down20 } from './020_create_shipment_items.js';
import { up as up21, down as down21 } from './021_soft_delete_orders.js';
import { up as up22, down as down22 } from './022_create_subscriptions.js';
import { up as up23, down as down23 } from './023_create_payments.js';
import { up as up24, down as down24 } from './024_otp_attempts.js';
import { up as up25, down as down25 } from './025_create_audit_logs.js';
import { up as up26, down as down26 } from './026_create_notifications.js';
import { up as up27, down as down27 } from './027_create_alerts.js';
import { up as up28, down as down28 } from './028_soft_remove_users.js';
import { up as up29, down as down29 } from './029_notification_categories.js';
import { up as up30, down as down30 } from './030_attention_thresholds.js';
import { up as up31, down as down31 } from './031_performance_indexes.js';
import { up as up32, down as down32 } from './032_billing_autorenew_invoices.js';
import { up as up33, down as down33 } from './033_onboarding_completed.js';
import { up as up34, down as down34 } from './034_order_update_suggestions.js';
import { up as up35, down as down35 } from './035_notification_cleared.js';
import { up as up36, down as down36 } from './036_create_analytics_events.js';
import { up as up37, down as down37 } from './037_password_changed_at.js';
import { up as up38, down as down38 } from './038_create_contact_messages.js';
import { up as up39, down as down39 } from './039_create_site_content.js';
import { up as up40, down as down40 } from './040_add_company_details.js';
import { up as up41, down as down41 } from './041_add_order_addresses.js';

import { up as up43, down as down43 } from './043_add_gst_to_orders.js';

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
    await query(up8);
    await query(up9);
    await query(up10);
    await query(up11);
    await query(up12);
    await query(up13);
    await query(up14);
    await query(up15);
    await query(up16);
    await query(up17);
    await query(up18);
    await query(up19);
    await query(up20);
    await query(up21);
    await query(up22);
    await query(up23);
    await query(up24);
    await query(up25);
    await query(up26);
    await query(up27);
    await query(up28);
    await query(up29);
    await query(up30);
    await query(up31);
    await query(up32);
    await query(up33);
    await query(up34);
    await query(up35);
    await query(up36);
    await query(up37);
    await query(up38);
    await query(up39);
    // await query(up40);
    // await query(up41);

    await query(up43);
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
