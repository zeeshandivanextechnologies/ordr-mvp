import express from 'express';
import { dismissAlert, listAlerts, resolveAlert, resolveAllAlerts } from '../controllers/alertController.js';
import { authenticate } from '../middleware/auth.js';
import { uuidParam } from '../middleware/validate.js';

const router = express.Router();

// Malformed ids are "not found" instead of a database error
router.param('id', uuidParam);

router.use(authenticate);

// Alerts are shared by the whole company; admins and members can act on them
router.get('/', listAlerts);
router.post('/resolve-all', resolveAllAlerts);
router.post('/:id/resolve', resolveAlert);
router.post('/:id/dismiss', dismissAlert);

export default router;
