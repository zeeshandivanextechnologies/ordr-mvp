// QA (Module 37) - Razorpay checkout end-to-end, with Razorpay's servers replaced by fake answers.
// Covers: one-time checkout, signature checks, webhooks (and their replays), auto-renew and invoices.
// Opening the real Razorpay popup in the browser still needs a manual check with test keys.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { query } from '../config/database.js';
import { createCompany, exitWhenDone, mockExternalFetch, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('razorpay');
const KEY_SECRET = 'test_key_secret';
let server;
let razorpay;
let company;
let counter = 0;
const nextId = (prefix) => `${prefix}_${tag.replace(/-/g, '')}${(counter += 1)}`;

const hmac = (secret, text) => crypto.createHmac('sha256', secret).update(text).digest('hex');

// Razorpay calls the webhook with the raw JSON body signed by the webhook secret
const sendWebhook = async (payload, signature) => {
  const body = JSON.stringify(payload);
  const res = await fetch(`${server.baseUrl}/billing/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature ?? hmac(process.env.RAZORPAY_WEBHOOK_SECRET, body),
    },
    body,
  });
  return res.status;
};

const billing = async () => (await server.api('GET', '/billing', { token: company.admin.token })).json;
const paidPayments = async () =>
  (await query("SELECT * FROM payments WHERE company_id = $1 AND status = 'paid' ORDER BY paid_at", [company.id])).rows;

before(async () => {
  process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
  process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
  server = await startServer();
  company = await createCompany(tag, 'pay');
  razorpay = mockExternalFetch((url, options) => {
    if (!url.startsWith('https://api.razorpay.com/v1/')) return undefined;
    const path = url.replace('https://api.razorpay.com/v1', '');
    const body = options.body ? JSON.parse(options.body) : {};
    if (path === '/orders') return { body: { id: nextId('order'), amount: body.amount, currency: body.currency, status: 'created' } };
    if (path === '/plans') return { body: { id: nextId('plan') } };
    if (path === '/subscriptions') return { body: { id: nextId('sub'), status: 'created' } };
    if (/^\/subscriptions\/[^/]+\/cancel$/.test(path)) return { body: { status: 'cancelled' } };
    return { status: 404, body: { error: { description: 'Unknown test route' } } };
  });
});

after(async () => {
  razorpay.restore();
  process.env.RAZORPAY_KEY_ID = '';
  process.env.RAZORPAY_KEY_SECRET = '';
  // Payment e-mails and analytics run in the background; let them finish before cleanup
  await new Promise((resolve) => setTimeout(resolve, 300));
  await query('DELETE FROM razorpay_plans WHERE provider_plan_id LIKE $1', [`plan_${tag.replace(/-/g, '')}%`]);
  await query('DELETE FROM payments WHERE company_id = $1', [company.id]);
  await removeCompanies([company.id]);
  await server.close();
  exitWhenDone();
});

describe('Razorpay one-time checkout', () => {
  let orderId;

  test('only admins can start a checkout, and only for a paid plan', async () => {
    assert.equal((await server.api('POST', '/billing/checkout', { token: company.member.token, body: { plan: 'growth' } })).status, 403);
    assert.equal((await server.api('POST', '/billing/checkout', { token: company.admin.token, body: { plan: 'trial' } })).status, 400);
  });

  test('checkout creates a Razorpay order and a pending payment', async () => {
    const res = await server.api('POST', '/billing/checkout', { token: company.admin.token, body: { plan: 'growth' } });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.keyId, 'rzp_test_key');
    assert.ok(res.json.orderId);
    assert.ok(res.json.amount > 0);
    orderId = res.json.orderId;

    const sent = razorpay.calls.find((c) => c.url.endsWith('/orders'));
    assert.equal(sent.body.amount, res.json.amount);
    const row = await query('SELECT status, plan FROM payments WHERE provider_order_id = $1', [orderId]);
    assert.equal(row.rows[0].status, 'created');
    assert.equal(row.rows[0].plan, 'growth');
  });

  test('a wrong signature is refused and the payment is marked failed', async () => {
    const res = await server.api('POST', '/billing/verify', {
      token: company.admin.token,
      body: { razorpay_order_id: orderId, razorpay_payment_id: 'pay_fake', razorpay_signature: 'bad-signature' },
    });
    assert.equal(res.status, 400);
    const row = await query('SELECT status FROM payments WHERE provider_order_id = $1', [orderId]);
    assert.equal(row.rows[0].status, 'failed');
    assert.equal((await billing()).subscription.plan, 'trial', 'plan does not change');
  });

  test('a correct signature activates the plan and creates an invoice', async () => {
    const start = await server.api('POST', '/billing/checkout', { token: company.admin.token, body: { plan: 'growth' } });
    orderId = start.json.orderId;
    const paymentId = nextId('pay');
    const res = await server.api('POST', '/billing/verify', {
      token: company.admin.token,
      body: { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: hmac(KEY_SECRET, `${orderId}|${paymentId}`) },
    });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.subscription.plan, 'growth');
    assert.equal(res.json.subscription.status, 'active');
    assert.ok(new Date(res.json.subscription.currentPeriodEnd) > new Date());
    assert.equal(res.json.payments.length, 1);
    assert.match(res.json.payments[0].invoiceNumber, /^ORDR-\d{4}-\d{6}$/);

    const invoice = await server.api('GET', `/billing/invoices/${res.json.payments[0].id}`, { token: company.admin.token });
    assert.equal(invoice.status, 200);
    assert.ok(invoice.text.includes(res.json.payments[0].invoiceNumber));
  });

  test('the webhook for the same payment (and replays) does not charge or extend twice', async () => {
    const before = await billing();
    const [payment] = await paidPayments();
    const payload = { event: 'payment.captured', payload: { payment: { entity: { id: payment.provider_payment_id, order_id: orderId } } } };
    assert.equal(await sendWebhook(payload), 200);
    assert.equal(await sendWebhook(payload), 200);
    assert.equal((await paidPayments()).length, 1);
    assert.equal((await billing()).subscription.currentPeriodEnd, before.subscription.currentPeriodEnd);
  });

  test('a webhook with a wrong signature is ignored', async () => {
    const payload = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_x', order_id: orderId } } } };
    assert.equal(await sendWebhook(payload, 'forged'), 400);
  });

  test('if the browser closes before verify, the webhook still activates the plan', async () => {
    const start = await server.api('POST', '/billing/checkout', { token: company.admin.token, body: { plan: 'growth' } });
    const beforeEnd = new Date((await billing()).subscription.currentPeriodEnd);
    const payload = { event: 'order.paid', payload: { payment: { entity: { id: nextId('pay'), order_id: start.json.orderId } } } };
    assert.equal(await sendWebhook(payload), 200);
    assert.equal((await paidPayments()).length, 2);
    assert.ok(new Date((await billing()).subscription.currentPeriodEnd) > beforeEnd, 'same plan paid again adds a month');
  });
});

describe('Razorpay auto-renew (subscriptions)', () => {
  let subscriptionId;

  test('subscribe creates a Razorpay subscription kept as pending', async () => {
    const res = await server.api('POST', '/billing/subscribe', { token: company.admin.token, body: { plan: 'business' } });
    assert.equal(res.status, 200, res.text);
    assert.ok(res.json.subscriptionId);
    subscriptionId = res.json.subscriptionId;
    const row = await query('SELECT pending_subscription_id, pending_subscription_plan FROM subscriptions WHERE company_id = $1', [company.id]);
    assert.equal(row.rows[0].pending_subscription_id, subscriptionId);
    assert.equal(row.rows[0].pending_subscription_plan, 'business');
    assert.equal((await billing()).subscription.plan, 'growth', 'current plan stays until the first payment');
  });

  test('a wrong subscription signature is refused', async () => {
    const res = await server.api('POST', '/billing/verify-subscription', {
      token: company.admin.token,
      body: { razorpay_payment_id: 'pay_x', razorpay_subscription_id: subscriptionId, razorpay_signature: 'bad' },
    });
    assert.equal(res.status, 400);
    assert.equal((await billing()).subscription.autoRenew, false);
  });

  test('a correct first payment switches the plan and turns auto-renew on', async () => {
    const paymentId = nextId('pay');
    const res = await server.api('POST', '/billing/verify-subscription', {
      token: company.admin.token,
      body: {
        razorpay_payment_id: paymentId,
        razorpay_subscription_id: subscriptionId,
        razorpay_signature: hmac(KEY_SECRET, `${paymentId}|${subscriptionId}`),
      },
    });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.subscription.plan, 'business');
    assert.equal(res.json.subscription.autoRenew, true);
    assert.equal(res.json.payments[0].autoRenew, true);
    assert.equal((await paidPayments()).length, 3);
  });

  test('a monthly charge webhook extends the plan once, even when replayed', async () => {
    const beforeEnd = new Date((await billing()).subscription.currentPeriodEnd);
    const payload = {
      event: 'subscription.charged',
      payload: { subscription: { entity: { id: subscriptionId } }, payment: { entity: { id: nextId('pay') } } },
    };
    assert.equal(await sendWebhook(payload), 200);
    const afterFirst = (await billing()).subscription.currentPeriodEnd;
    assert.ok(new Date(afterFirst) > beforeEnd);

    assert.equal(await sendWebhook(payload), 200);
    assert.equal((await billing()).subscription.currentPeriodEnd, afterFirst);
    assert.equal((await paidPayments()).length, 4);
  });

  test('cancelling auto-renew stops future charges but keeps the plan', async () => {
    const res = await server.api('POST', '/billing/cancel-auto-renew', { token: company.admin.token });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.subscription.autoRenew, false);
    assert.equal(res.json.subscription.plan, 'business');
    assert.ok(razorpay.calls.some((c) => c.url.endsWith(`/subscriptions/${subscriptionId}/cancel`)));
    assert.equal((await server.api('POST', '/billing/cancel-auto-renew', { token: company.admin.token })).status, 400);
  });

  test('a cancellation webhook from Razorpay also turns auto-renew off', async () => {
    await query('UPDATE subscriptions SET auto_renew = true WHERE company_id = $1', [company.id]);
    const payload = { event: 'subscription.cancelled', payload: { subscription: { entity: { id: subscriptionId } } } };
    assert.equal(await sendWebhook(payload), 200);
    assert.equal((await billing()).subscription.autoRenew, false);
  });
});

describe('Razorpay not set up', () => {
  test('checkout says payments are not configured instead of failing', async () => {
    const saved = process.env.RAZORPAY_KEY_ID;
    process.env.RAZORPAY_KEY_ID = '';
    try {
      const res = await server.api('POST', '/billing/checkout', { token: company.admin.token, body: { plan: 'growth' } });
      assert.equal(res.status, 503);
      assert.equal(res.json.code, 'PAYMENTS_NOT_CONFIGURED');
    } finally {
      process.env.RAZORPAY_KEY_ID = saved;
    }
  });
});
