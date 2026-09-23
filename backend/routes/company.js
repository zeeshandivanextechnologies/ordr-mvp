import express from 'express';
import { getCompany, updateCompany } from '../controllers/companyController.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/role.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getCompany);
router.patch('/', requireAdmin, updateCompany);

export default router;
