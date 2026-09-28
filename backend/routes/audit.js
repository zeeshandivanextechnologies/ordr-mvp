import express from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/role.js';

const router = express.Router();

// GET /audit-logs?limit=100&entity_type=order&entity_id=...  (admin only, read-only)
// There is intentionally no route to edit or delete audit entries.
router.get('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
    const { rows } = await query(
      `SELECT id, user_id, user_name, action, entity_type, entity_id, details, created_at
       FROM audit_logs
       WHERE company_id = $1
         AND ($2::text IS NULL OR entity_type = $2)
         AND ($3::text IS NULL OR entity_id = $3)
       ORDER BY created_at DESC
       LIMIT $4`,
      [req.user.company_id, req.query.entity_type || null, req.query.entity_id || null, limit]
    );
    res.json({ logs: rows });
  } catch (error) {
    next(error);
  }
});

export default router;
