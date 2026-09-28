// Minimal Razorpay client (Orders API + signature checks) using fetch, no SDK needed.
// Needs RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET; RAZORPAY_WEBHOOK_SECRET for webhooks.
import crypto from 'crypto';

const API = 'https://api.razorpay.com/v1';

export const isRazorpayConfigured = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

export const getRazorpayKeyId = () => process.env.RAZORPAY_KEY_ID;

// amount is in paise (₹1 = 100)
export const createRazorpayOrder = async ({ amount, currency = 'INR', receipt, notes }) => {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const response = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency, receipt, notes }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data?.error?.description || `Razorpay error ${response.status}`), { status: 502 });
  }
  return data;
};

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Checkout success: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
export const verifyPaymentSignature = (orderId, paymentId, signature) => {
  if (!orderId || !paymentId || !signature || !process.env.RAZORPAY_KEY_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return safeEqual(expected, signature);
};

// Webhook: signature = HMAC_SHA256(raw request body, webhook_secret)
export const verifyWebhookSignature = (rawBody, signature) => {
  if (!rawBody || !signature || !process.env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
};

// ---------- Subscriptions (auto-renew) ----------

const razorpayRequest = async (method, pathname, body) => {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const response = await fetch(`${API}${pathname}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data?.error?.description || `Razorpay error ${response.status}`), { status: 502 });
  }
  return data;
};

// Monthly Razorpay plan for an ORDR plan (amount in paise)
export const createRazorpayPlan = ({ name, amount }) =>
  razorpayRequest('POST', '/plans', {
    period: 'monthly',
    interval: 1,
    item: { name: `ORDR ${name}`, amount, currency: 'INR', description: `ORDR ${name} plan - monthly` },
  });

// total_count = number of monthly charges allowed by the mandate (10 years)
export const createRazorpaySubscription = ({ planId, notes }) =>
  razorpayRequest('POST', '/subscriptions', {
    plan_id: planId,
    total_count: 120,
    customer_notify: 1,
    notes,
  });

// Stops future charges; the current paid month stays active
export const cancelRazorpaySubscription = (subscriptionId) =>
  razorpayRequest('POST', `/subscriptions/${subscriptionId}/cancel`, { cancel_at_cycle_end: 1 });

// Subscription checkout success: signature = HMAC_SHA256(payment_id + "|" + subscription_id, key_secret)
export const verifySubscriptionSignature = (paymentId, subscriptionId, signature) => {
  if (!paymentId || !subscriptionId || !signature || !process.env.RAZORPAY_KEY_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${paymentId}|${subscriptionId}`)
    .digest('hex');
  return safeEqual(expected, signature);
};
