import express from 'express';
import {
  listAiExtracts,
  getAiExtract,
  updateAiExtract,
  confirmAiExtract,
  deleteAiExtract,
  ignoreAiExtract,
} from '../controllers/aiInboxController.js';
import {
  listOrderUpdates,
  getOrderUpdate,
  getOrderUpdateTarget,
  applyOrderUpdate,
  ignoreOrderUpdate,
  restoreOrderUpdate,
} from '../controllers/orderUpdateController.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/role.js';
import { requireActivePlan } from '../services/planGuard.js';
import { uuidParam } from '../middleware/validate.js';

const router = express.Router();

// Malformed ids are "not found" instead of a database error
router.param('id', uuidParam);
router.param('updateId', uuidParam);
router.param('orderId', uuidParam);

router.use(authenticate);

// Module 21: order update suggestions (registered before '/:id' so "updates" is not read as an id).
// Admins and members can apply them, like updating status or adding shipment details by hand.
router.get('/updates', listOrderUpdates);
router.get('/updates/orders/:orderId', getOrderUpdateTarget);
router.get('/updates/:updateId', getOrderUpdate);
router.post('/updates/:updateId/apply', requireActivePlan, applyOrderUpdate);
router.post('/updates/:updateId/ignore', requireActivePlan, ignoreOrderUpdate);
router.post('/updates/:updateId/restore', requireActivePlan, restoreOrderUpdate);

router.get('/', listAiExtracts);
router.get('/:id', getAiExtract);
router.patch('/:id', requireActivePlan, updateAiExtract);
router.post('/:id/confirm', requireActivePlan, confirmAiExtract);
// Module 31 spec paths (also served under /api/ai-detections)
router.post('/:id/ignore', requireActivePlan, ignoreAiExtract);
router.patch('/:id/extracted-data', requireActivePlan, updateAiExtract);
router.delete('/:id', requireAdmin, requireActivePlan, deleteAiExtract);

export default router;