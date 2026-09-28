import express from 'express';
import {
  connectGmail,
  gmailCallback,
  getConnectionStatus,
  scanInbox,
  disconnectGmail,
} from '../controllers/integrationController.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/role.js';
import { requireActivePlan } from '../services/planGuard.js';
import { uuidParam } from '../middleware/validate.js';

const router = express.Router();

// Malformed ids are "not found" instead of a database error
router.param('id', uuidParam);

// Get connection status (any authenticated user can view)
router.get('/status', authenticate, getConnectionStatus);

// Generate OAuth URL (managing the Gmail integration is admin-only)
router.get('/gmail/connect', authenticate, requireAdmin, requireActivePlan, connectGmail);

// Handle OAuth callback (public endpoint, validates state token internally)
router.get('/gmail/callback', gmailCallback);

// Scan inbox for new messages (deduplicates by message id)
router.post('/gmail/scan', authenticate, requireAdmin, requireActivePlan, scanInbox);

// Disconnect / deactivate a Gmail connection
router.delete('/gmail/:id', authenticate, requireAdmin, disconnectGmail);

export default router;