// Background job: periodically scans every company's connected Gmail inbox so
// new order emails are picked up without the user pressing "Scan Now".
import { query } from '../config/database.js';
import config from '../config/environment.js';
import { runGmailScan } from '../controllers/integrationController.js';
import { companyHasActiveAccess } from '../services/planGuard.js';

const FIRST_RUN_DELAY_MS = 60 * 1000;
let running = false;

const scanAllCompanies = async () => {
  // Skip if the previous round is still going (large inboxes / slow network)
  if (running) return;
  running = true;
  try {
    const result = await query('SELECT DISTINCT company_id FROM email_connections WHERE is_active = true');
    for (const { company_id: companyId } of result.rows) {
      try {
        // No automatic scanning once the company's trial / plan has ended
        if (!(await companyHasActiveAccess(companyId))) continue;
        const scan = await runGmailScan(companyId);
        if (scan.newMessages > 0) {
          console.log(`[gmail-auto-scan] company ${companyId}: ${scan.newMessages} new, ${scan.potentialOrders} potential orders`);
        }
      } catch (err) {
        // 409 = a manual scan is already running for this company
        if (err.status !== 409) {
          console.error(`[gmail-auto-scan] company ${companyId}: ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.error('[gmail-auto-scan] failed:', err.message);
  } finally {
    running = false;
  }
};

export const startGmailAutoScan = () => {
  const minutes = config.gmailAutoScanMinutes;
  if (!(minutes > 0)) {
    console.log('Gmail auto-scan disabled (GMAIL_AUTO_SCAN_MINUTES=0)');
    return;
  }
  setTimeout(scanAllCompanies, FIRST_RUN_DELAY_MS);
  setInterval(scanAllCompanies, minutes * 60 * 1000);
  console.log(`Gmail auto-scan every ${minutes} min`);
};
