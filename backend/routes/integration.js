import express from 'express';
import { connectGmail, gmailCallback, getConnectionStatus } from '../controllers/integrationController.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/role.js';

const router = express.Router();

// Get connection status (any authenticated user can view)
router.get('/status', authenticate, getConnectionStatus);

// Generate OAuth URL (admin only - manage integration)
router.get('/gmail/connect', authenticate, requireAdmin, connectGmail);

// Handle OAuth callback (public endpoint, validates state token internally)
router.get('/gmail/callback', gmailCallback);

export default router;
