import express from 'express';
import { getReports } from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Advanced reporting (Business / Pro plans)
router.get('/', getReports);

export default router;
