import express from 'express';
import { getDashboard } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// GET /dashboard?order_type=all|sales|purchase
router.get('/', getDashboard);

export default router;
