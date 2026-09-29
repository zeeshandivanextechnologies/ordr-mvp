import express from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/role.js';
import { ANALYTICS_EVENTS } from '../utils/analytics.js';

const router = express.Router();

// Module 36: how often each event happened for the admin's company (read-only)
// GET /api/analytics/summary?days=30
router.get('/summary', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    const { rows } = await query(
      `SELECT event, COUNT(*)::int AS count, MAX(created_at) AS last_at
       FROM analytics_events
       WHERE company_id = $1 AND created_at > NOW() - make_interval(days => $2)
       GROUP BY event`,
      [req.user.company_id, days]
    );
    const byEvent = Object.fromEntries(rows.map((r) => [r.event, r]));
    res.json({
      days,
      events: ANALYTICS_EVENTS.map((event) => ({
        event,
        count: byEvent[event]?.count || 0,
        lastAt: byEvent[event]?.last_at || null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
