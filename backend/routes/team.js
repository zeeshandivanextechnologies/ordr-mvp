import express from 'express';
import { inviteTeamMembers, verifyTeamInvite, acceptTeamInvite } from '../controllers/teamController.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/role.js';

const router = express.Router();

router.post('/invite', authenticate, requireAdmin, inviteTeamMembers);

router.get('/invitations/:token', verifyTeamInvite);
router.post('/invitations/:token/accept', acceptTeamInvite);

export default router;
