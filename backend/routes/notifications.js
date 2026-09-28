import express from 'express';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { uuidParam } from '../middleware/validate.js';

const router = express.Router();

// Malformed ids are "not found" instead of a database error
router.param('id', uuidParam);

router.use(authenticate);

router.get('/', asyncHandler(getNotificationPreferences));
router.patch('/', asyncHandler(updateNotificationPreferences));

// In-app notification inbox (each user sees only their own)
router.get('/inbox', listMyNotifications);
router.post('/inbox/read-all', markAllNotificationsRead);
router.patch('/inbox/:id/read', markNotificationRead);

export default router;