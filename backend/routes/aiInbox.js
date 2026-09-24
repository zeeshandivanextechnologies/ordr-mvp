import express from 'express';
import {
  listAiExtracts,
  getAiExtract,
  updateAiExtract,
  confirmAiExtract,
  deleteAiExtract,
} from '../controllers/aiInboxController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', listAiExtracts);
router.get('/:id', getAiExtract);
router.patch('/:id', updateAiExtract);
router.post('/:id/confirm', confirmAiExtract);
router.delete('/:id', deleteAiExtract);

export default router;