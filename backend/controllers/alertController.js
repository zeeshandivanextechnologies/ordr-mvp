import { query } from '../config/database.js';
import { refreshAlertsIfStale } from '../services/alertService.js';
import { logAudit } from '../utils/audit.js';

// GET /alerts: the company's alerts (freshly evaluated) with counts per status
export const listAlerts = async (req, res, next) => {
  try {
    const { company_id: companyId } = req.user;
    await refreshAlertsIfStale(companyId);

    const { rows } = await query(
      `SELECT id, type, severity, title, description, order_id, shipment_id, po_number, party_name,
              link, status, auto_resolved, resolved_at, dismissed_at, created_at, updated_at
       FROM alerts
       WHERE company_id = $1
       ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END,
                CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
                created_at DESC
       LIMIT 500`,
      [companyId]
    );
    const counts = { open: 0, resolved: 0, dismissed: 0 };
    for (const a of rows) if (counts[a.status] !== undefined) counts[a.status] += 1;
    res.json({ alerts: rows, counts });
  } catch (error) {
    next(error);
  }
};

const changeStatus = (newStatus) => async (req, res, next) => {
  try {
    const { company_id: companyId, id: userId } = req.user;
    const column = newStatus === 'dismissed' ? 'dismissed' : 'resolved';
    const { rows } = await query(
      `UPDATE alerts SET status = $1, ${column}_at = NOW(), ${column}_by = $2, updated_at = NOW()
       WHERE id = $3 AND company_id = $4 AND status = 'open'
       RETURNING id, type`,
      [newStatus, userId, req.params.id, companyId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Open alert not found' });
    }
    await logAudit(req, `alert.${newStatus}`, { entityType: 'alert', entityId: rows[0].id, details: { type: rows[0].type } });
    res.json({ message: newStatus === 'dismissed' ? 'Alert dismissed' : 'Alert resolved' });
  } catch (error) {
    next(error);
  }
};

// POST /alerts/:id/resolve and POST /alerts/:id/dismiss
export const resolveAlert = changeStatus('resolved');
export const dismissAlert = changeStatus('dismissed');

// POST /alerts/resolve-all
export const resolveAllAlerts = async (req, res, next) => {
  try {
    const { company_id: companyId, id: userId } = req.user;
    const result = await query(
      `UPDATE alerts SET status = 'resolved', resolved_at = NOW(), resolved_by = $1, updated_at = NOW()
       WHERE company_id = $2 AND status = 'open'`,
      [userId, companyId]
    );
    if (result.rowCount > 0) {
      await logAudit(req, 'alert.resolved_all', { entityType: 'alert', details: { count: result.rowCount } });
    }
    res.json({ message: 'All open alerts resolved', updated: result.rowCount });
  } catch (error) {
    next(error);
  }
};
