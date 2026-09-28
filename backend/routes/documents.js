import express from 'express';
import { getDocumentFile, getDocumentPreview } from '../controllers/documentController.js';
import { authenticate } from '../middleware/auth.js';
import { uuidParam } from '../middleware/validate.js';

const router = express.Router();

// Malformed ids are "not found" instead of a database error
router.param('id', uuidParam);

router.use(authenticate);

// View or download an order document (company-scoped)
router.get('/:id/file', getDocumentFile);
// Table preview for CSV / Excel documents
router.get('/:id/preview', getDocumentPreview);

export default router;
