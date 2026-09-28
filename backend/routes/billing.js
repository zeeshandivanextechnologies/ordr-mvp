import express from 'express';
import {
  cancelAutoRenew,
  createCheckout,
  createSubscriptionCheckout,
  getBilling,
  getInvoice,
  razorpayWebhook,
  requestUpgrade,
  verifyCheckout,
  verifySubscriptionCheckout,
} from '../controllers/billingController.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/role.js';
import { uuidParam } from '../middleware/validate.js';

const router = express.Router();
router.param('id', uuidParam);

// Razorpay server-to-server notification: no login, verified by its signature
router.post('/webhook', razorpayWebhook);

router.use(authenticate);

// Plan and usage are shown to everyone (trial banner); changing the plan is admin-only
router.get('/', getBilling);
router.post('/upgrade-request', requireAdmin, requestUpgrade);
router.post('/checkout', requireAdmin, createCheckout);
router.post('/verify', requireAdmin, verifyCheckout);

// Auto-renew (monthly Razorpay subscription)
router.post('/subscribe', requireAdmin, createSubscriptionCheckout);
router.post('/verify-subscription', requireAdmin, verifySubscriptionCheckout);
router.post('/cancel-auto-renew', requireAdmin, cancelAutoRenew);

// Printable invoice / receipt for a paid payment
router.get('/invoices/:id', requireAdmin, getInvoice);

export default router;
