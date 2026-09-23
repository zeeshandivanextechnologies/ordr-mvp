import express from 'express';
import { inviteTeamMembers, verifyTeamInvite, acceptTeamInvite, listTeamMembers, removeTeamMember, revokeInvitation, updateMemberStatus } from '../controllers/teamController.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/role.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.get('/members', authenticate, requireAdmin, asyncHandler(listTeamMembers));
router.delete('/members/:id', authenticate, requireAdmin, asyncHandler(removeTeamMember));
router.patch('/members/:id/status', authenticate, requireAdmin, asyncHandler(updateMemberStatus));
router.delete('/invitations/:id', authenticate, requireAdmin, asyncHandler(revokeInvitation));

router.post('/invite', authenticate, requireAdmin, asyncHandler(inviteTeamMembers));

router.get('/invitations/:token', verifyTeamInvite);
router.post('/invitations/:token/accept', acceptTeamInvite);

export default router;
