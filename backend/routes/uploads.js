import express from 'express';
import upload from '../middleware/upload.js';
import { uploadPO } from '../controllers/orderController.js';
import { authenticate } from '../middleware/auth.js';
import { requireActivePlan } from '../services/planGuard.js';

const router = express.Router();

// Module 31 spec path for PO uploads (same as POST /api/orders/upload)
router.post('/order-document', authenticate, requireActivePlan, upload.single('file'), uploadPO);

export default router;
