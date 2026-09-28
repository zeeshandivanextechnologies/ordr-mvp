import express from 'express';
import {
  listAiExtracts,
  getAiExtract,
  updateAiExtract,
  confirmAiExtract,
  deleteAiExtract,
} from '../controllers/aiInboxController.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/role.js';
import { requireActivePlan } from '../services/planGuard.js';
import { uuidParam } from '../middleware/validate.js';

const router = express.Router();

// Malformed ids are "not found" instead of a database error
router.param('id', uuidParam);

router.use(authenticate);

router.get('/', listAiExtracts);
router.get('/:id', getAiExtract);
router.patch('/:id', requireActivePlan, updateAiExtract);
router.post('/:id/confirm', requireActivePlan, confirmAiExtract);
router.delete('/:id', requireAdmin, requireActivePlan, deleteAiExtract);

export default router;