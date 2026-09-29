import express from 'express';
import { getCompany, updateCompany, completeOnboarding } from '../controllers/companyController.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/role.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { uuidParam } from '../middleware/validate.js';
import { requireActivePlan } from '../services/planGuard.js';
import { listTeamMembers, inviteTeamMembers, removeTeamMember } from '../controllers/teamController.js';

const router = express.Router();

// Malformed ids are "not found" instead of a database error
router.param('id', uuidParam);

router.use(authenticate);

router.get('/', getCompany);
router.patch('/', requireAdmin, updateCompany);
router.post('/onboarding/complete', requireAdmin, asyncHandler(completeOnboarding));

// Module 31 spec paths for team management (same handlers and rules as /api/team)
router.get('/users', requireAdmin, asyncHandler(listTeamMembers));
router.post('/users/invite', requireAdmin, requireActivePlan, asyncHandler(inviteTeamMembers));
router.delete('/users/:id', requireAdmin, asyncHandler(removeTeamMember));

export default router;
