import express from 'express';
import { listShipments, getShipment, updateShipmentStatus } from '../controllers/shipmentController.js';
import { authenticate } from '../middleware/auth.js';
import { requireActivePlan } from '../services/planGuard.js';
import { uuidParam } from '../middleware/validate.js';

const router = express.Router();

// Malformed ids are "not found" instead of a database error
router.param('id', uuidParam);

router.use(authenticate);

// Admins and members can both view shipments and update their status
router.get('/', listShipments);
router.get('/:id', getShipment);
router.post('/:id/status', requireActivePlan, updateShipmentStatus);

export default router;
