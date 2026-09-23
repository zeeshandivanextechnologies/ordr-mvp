import express from 'express';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(authenticate);

router.get('/', asyncHandler(getNotificationPreferences));
router.patch('/', asyncHandler(updateNotificationPreferences));

export default router;