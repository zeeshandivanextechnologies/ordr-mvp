import { Router } from 'express';
import {
  signup,
  login,
  logout,
  getMe,
  forgotPassword,
  verifyOtp,
  resendOtp,
  resetPassword,
  googleCallback,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.post('/signup', asyncHandler(signup));
router.post('/login', asyncHandler(login));
router.post('/logout', asyncHandler(logout));
router.get('/me', authenticate, asyncHandler(getMe));
router.post('/forgot-password', asyncHandler(forgotPassword));
router.post('/verify-otp', asyncHandler(verifyOtp));
router.post('/resend-otp', asyncHandler(resendOtp));
router.post('/reset-password', asyncHandler(resetPassword));
router.post('/google/callback', asyncHandler(googleCallback));

export default router;
