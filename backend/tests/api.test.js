// API tests (node:test). Run with: npm test
// Uses the database from .env. Creates two temporary companies and removes them at the end.
import 'dotenv/config';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import config from '../config/environment.js';
import { getClient, query } from '../config/database.js';
import { activatePlan, getOrCreateSubscription } from '../services/subscriptionService.js';

const tag = `test-${Date.now()}`;
let server;
let baseUrl;
const companies = {};
const users = {};

const tokenFor = (userId) => jwt.sign({ userId }, config.jwtSecret, { expiresIn: '10m' });

const api = async (method, path, { token, body, headers = {} } = {}) => {
  const res = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // HTML / plain responses
  }
  return { status: res.status, json, text, headers: res.headers };
};

const createCompany = async (key) => {
  const company = await query('INSERT INTO companies (name) VALUES ($1) RETURNING id', [`${tag} ${key}`]);
  companies[key] = company.rows[0].id;
  for (const role of ['admin', 'member']) {
    const user = await query(
      `INSERT INTO users (company_id, full_name, email, role, is_active)
       VALUES ($1, $2, $3, $4, true) RETURNING id`,
      [companies[key], `${key} ${role}`, `${tag}-${key}-${role}@example.com`, role]
    );
    users[`${key}_${role}`] = { id: user.rows[0].id, token: tokenFor(user.rows[0].id) };
  }
  await getOrCreateSubscription(companies[key]);
};

const newOrder = (overrides = {}) => ({
  type: 'sales',
  partyName: 'Test Customer',
  poNumber: `PO-${crypto.randomUUID().slice(0, 8)}`,
  items: [{ product: 'Steel Pipe', qty: 10, rate: 100 }],
  ...overrides,
});

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
  await createCompany('a');
  await createCompany('b');
});

after(async () => {
  const ids = Object.values(companies);
  const userIds = Object.values(users).map((u) => u.id);
  try {
    await query('DELETE FROM companies WHERE id = ANY($1::uuid[])', [ids]);
    await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
  } catch (error) {
    console.error(`Cleanup failed (remove rows named "${tag}" manually):`, error.message);
  }
  await new Promise((resolve) => server.close(resolve));
  // The shared pool keeps the process alive otherwise
  setTimeout(() => process.exit(process.exitCode || 0), 100).unref();
});

describe('Authentication', () => {
  test('requests without a token are rejected', async () => {
    const res = await api('GET', '/orders');
    assert.equal(res.status, 401);
  });

  test('a forged token is rejected', async () => {
    const forged = jwt.sign({ userId: users.a_admin.id }, 'wrong-secret');
    const res = await api('GET', '/orders', { token: forged });
    assert.equal(res.status, 401);
  });

  test('forgot password does not reveal whether an email exists', async () => {
    const res = await api('POST', '/auth/forgot-password', { body: { email: `${tag}-nobody@example.com` } });
    assert.ok([200, 429].includes(res.status), `unexpected ${res.status}`);
    if (res.status === 200) assert.match(res.json.message, /If an account exists/);
  });
});

describe('Orders', () => {
  let orderId;

  test('validation errors return 400', async () => {
    const res = await api('POST', '/orders', { token: users.a_admin.token, body: newOrder({ partyName: '' }) });
    assert.equal(res.status, 400);
    const noItems = await api('POST', '/orders', { token: users.a_admin.token, body: newOrder({ items: [] }) });
    assert.equal(noItems.status, 400);
  });

  test('an order can be created and read back', async () => {
    const res = await api('POST', '/orders', { token: users.a_member.token, body: newOrder() });
    assert.equal(res.status, 201, res.text);
    orderId = res.json.order.id;

    const detail = await api('GET', `/orders/${orderId}`, { token: users.a_admin.token });
    assert.equal(detail.status, 200);
    assert.equal(detail.json.items.length, 1);

    const list = await api('GET', '/orders', { token: users.a_admin.token });
    assert.ok(list.json.orders.some((o) => o.id === orderId));
  });

  test('another company cannot see or change the order', async () => {
    const detail = await api('GET', `/orders/${orderId}`, { token: users.b_admin.token });
    assert.equal(detail.status, 404);
    const list = await api('GET', '/orders', { token: users.b_admin.token });
    assert.ok(!list.json.orders.some((o) => o.id === orderId));
    const del = await api('DELETE', `/orders/${orderId}`, { token: users.b_admin.token });
    assert.equal(del.status, 404);
  });

  test('a malformed id is "not found", not a server error', async () => {
    const res = await api('GET', '/orders/not-a-uuid', { token: users.a_admin.token });
    assert.equal(res.status, 404);
  });

  test('members cannot delete orders', async () => {
    const res = await api('DELETE', `/orders/${orderId}`, { token: users.a_member.token });
    assert.equal(res.status, 403);
  });

  test('deleting is a soft delete: the order disappears but the row is kept', async () => {
    const res = await api('DELETE', `/orders/${orderId}`, { token: users.a_admin.token });
    assert.equal(res.status, 200);
    const detail = await api('GET', `/orders/${orderId}`, { token: users.a_admin.token });
    assert.equal(detail.status, 404);
    const row = await query('SELECT deleted_at FROM orders WHERE id = $1', [orderId]);
    assert.ok(row.rows[0]?.deleted_at);
  });
});

describe('Plan enforcement', () => {
  test('an expired trial is read-only (402 PLAN_EXPIRED)', async () => {
    await query(
      `UPDATE subscriptions SET trial_ends_at = NOW() - interval '1 day' WHERE company_id = $1`,
      [companies.b]
    );
    const create = await api('POST', '/orders', { token: users.b_admin.token, body: newOrder() });
    assert.equal(create.status, 402);
    assert.equal(create.json.code, 'PLAN_EXPIRED');
    // Reading still works
    const list = await api('GET', '/orders', { token: users.b_admin.token });
    assert.equal(list.status, 200);
  });
});

describe('Billing', () => {
  test('billing summary is available', async () => {
    const res = await api('GET', '/billing', { token: users.a_admin.token });
    assert.equal(res.status, 200);
    assert.equal(res.json.subscription.plan, 'trial');
    assert.equal(res.json.subscription.autoRenew, false);
  });

  test('members cannot start a checkout', async () => {
    const res = await api('POST', '/billing/checkout', { token: users.a_member.token, body: { plan: 'basic' } });
    assert.equal(res.status, 403);
  });

  test('cancelling auto-renew without a subscription is rejected', async () => {
    const res = await api('POST', '/billing/cancel-auto-renew', { token: users.a_admin.token });
    assert.equal(res.status, 400);
  });

  test('webhook with an invalid signature is rejected', async () => {
    const res = await api('POST', '/billing/webhook', {
      body: { event: 'payment.captured', payload: {} },
      headers: { 'x-razorpay-signature': 'invalid' },
    });
    assert.equal(res.status, 400);
  });

  test('switching plans mid-period credits the unused days (proration)', async () => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await activatePlan(client, companies.a, 'growth');
      const { prorationDays } = await activatePlan(client, companies.a, 'business');
      // ~₹2,499 unused buys ~14 days of Business (₹4,999 / 30 per day)
      assert.ok(prorationDays >= 13 && prorationDays <= 15, `got ${prorationDays}`);
      const renew = await activatePlan(client, companies.a, 'business');
      assert.equal(renew.prorationDays, 0);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  test('invoices are only visible to their own company', async () => {
    const payment = await query(
      `INSERT INTO payments (company_id, user_id, plan, amount, currency, provider_order_id, provider_payment_id, status, paid_at, invoice_number)
       VALUES ($1, $2, 'basic', 99900, 'INR', $3, $4, 'paid', NOW(), $5) RETURNING id`,
      [companies.a, users.a_admin.id, `${tag}-order`, `${tag}-pay`, `${tag}-INV`]
    );
    const id = payment.rows[0].id;

    const own = await api('GET', `/billing/invoices/${id}`, { token: users.a_admin.token });
    assert.equal(own.status, 200);
    assert.match(own.headers.get('content-type'), /text\/html/);
    assert.ok(own.text.includes(`${tag}-INV`));
    assert.ok(own.text.includes('₹999.00'));

    const other = await api('GET', `/billing/invoices/${id}`, { token: users.b_admin.token });
    assert.equal(other.status, 404);
    const member = await api('GET', `/billing/invoices/${id}`, { token: users.a_member.token });
    assert.equal(member.status, 403);

    const history = await api('GET', '/billing', { token: users.a_admin.token });
    assert.ok(history.json.payments.some((p) => p.id === id && p.invoiceNumber === `${tag}-INV`));
  });
});
