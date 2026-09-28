import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  signup,
  login,
  logout,
  getMe,
  updateProfile,
  updateAvatar,
  changePassword,
  forgotPassword,
  verifyOtp,
  resendOtp,
  resetPassword,
  googleCallback,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// Brute-force protection (per IP, 15 minutes)
const WINDOW_MS = 15 * 60 * 1000;
// Password guessing: only failed attempts count, so normal logins are never blocked
const loginLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 10,
  skipSuccessfulRequests: true,
  message: { error: 'Too many failed attempts. Please try again in 15 minutes.' },
});
// Sending OTP emails (prevents email flooding)
const otpSendLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 5,
  message: { error: 'Too many OTP requests. Please try again in 15 minutes.' },
});
// Checking OTP codes / resetting the password
const otpCheckLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 15,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
});
// Account creation
const signupLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 10,
  message: { error: 'Too many sign-up attempts. Please try again later.' },
});

router.post('/signup', signupLimiter, asyncHandler(signup));
router.post('/login', loginLimiter, asyncHandler(login));
router.post('/logout', asyncHandler(logout));
router.get('/me', authenticate, asyncHandler(getMe));
router.patch('/profile', authenticate, asyncHandler(updateProfile));
router.patch('/avatar', authenticate, asyncHandler(updateAvatar));
router.patch('/password', authenticate, loginLimiter, asyncHandler(changePassword));
router.post('/forgot-password', otpSendLimiter, asyncHandler(forgotPassword));
router.post('/verify-otp', otpCheckLimiter, asyncHandler(verifyOtp));
router.post('/resend-otp', otpSendLimiter, asyncHandler(resendOtp));
router.post('/reset-password', otpCheckLimiter, asyncHandler(resetPassword));
router.post('/google/callback', loginLimiter, asyncHandler(googleCallback));

export default router;
