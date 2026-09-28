import express from 'express';
import upload from '../middleware/upload.js';
import { createOrder, uploadPO, listOrders, getOrderDetail, createShipment, updateOrder, updateOrderStatus, deleteOrder, reprocessDocument } from '../controllers/orderController.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/role.js';
import { requireActivePlan } from '../services/planGuard.js';
import { uuidParam } from '../middleware/validate.js';

const router = express.Router();

// Malformed ids are "not found" instead of a database error
router.param('id', uuidParam);

router.use(authenticate);

router.get('/', listOrders);
router.get('/:id', getOrderDetail);
// Write actions are blocked once the trial / plan has ended (read-only access)
router.post('/', requireActivePlan, createOrder);
// Editing and deleting orders is admin-only; members can view, create and add shipments
router.put('/:id', requireAdmin, requireActivePlan, updateOrder);
router.delete('/:id', requireAdmin, requireActivePlan, deleteOrder);
// Members can update order status (per Phase 1 roles), but not edit the order itself
router.patch('/:id/status', requireActivePlan, updateOrderStatus);
router.post('/:id/shipments', requireActivePlan, createShipment);
router.post('/upload', requireActivePlan, upload.single('file'), uploadPO);
// Retry extraction for an uploaded document that produced no AI detection
router.post('/documents/:id/reprocess', requireActivePlan, reprocessDocument);

export default router;
