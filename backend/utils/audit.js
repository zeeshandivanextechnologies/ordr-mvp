// Module 35 audit log helper. Recording is best-effort: a logging problem is
// reported in the server log but never breaks the user's action.
import { query } from '../config/database.js';

export const logAudit = async (req, action, { entityType = null, entityId = null, details = null, companyId = null } = {}) => {
  try {
    const user = req?.user || {};
    const company = companyId || user.company_id;
    if (!company) return;
    await query(
      `INSERT INTO audit_logs (company_id, user_id, user_name, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        company,
        user.id || null,
        user.full_name || null,
        action,
        entityType,
        entityId ? String(entityId) : null,
        details ? JSON.stringify(details) : null,
        req?.ip ? String(req.ip).slice(0, 64) : null,
      ]
    );
  } catch (error) {
    console.error(`Audit log failed (${action}):`, error.message);
  }
};
