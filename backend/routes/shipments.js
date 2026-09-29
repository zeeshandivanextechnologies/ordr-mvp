import express from 'express';
import { listShipments, getShipment, updateShipment, updateShipmentStatus } from '../controllers/shipmentController.js';
import { authenticate } from '../middleware/auth.js';
import { requireActivePlan } from '../services/planGuard.js';
import { uuidParam } from '../middleware/validate.js';

const router = express.Router();

// Malformed ids are "not found" instead of a database error
router.param('id', uuidParam);

router.use(authenticate);

// Admins and members can both view shipments, edit their details and update their status
router.get('/', listShipments);
router.get('/:id', getShipment);
router.patch('/:id', requireActivePlan, updateShipment);
router.post('/:id/status', requireActivePlan, updateShipmentStatus);

export default router;
