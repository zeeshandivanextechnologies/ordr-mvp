import express from 'express';
import { connectGmail, gmailCallback, getConnectionStatus } from '../controllers/integrationController.js';
import { authenticate } from '../middleware/auth.js';
import { requireMember } from '../middleware/role.js';

const router = express.Router();

// Get connection status (any authenticated user can view)
router.get('/status', authenticate, getConnectionStatus);

// Generate OAuth URL (admin and members can manage their own integration)
router.get('/gmail/connect', authenticate, requireMember, connectGmail);

// Handle OAuth callback (public endpoint, validates state token internally)
router.get('/gmail/callback', gmailCallback);

export default router;
