// Shared helpers for the API tests (run on the test database, see tests/setup.js).
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import config from '../config/environment.js';
import { query } from '../config/database.js';
import { getOrCreateSubscription } from '../services/subscriptionService.js';

export const uniqueTag = (label) => `test-${label}-${crypto.randomUUID().slice(0, 8)}`;

export const tokenFor = (userId) => jwt.sign({ userId }, config.jwtSecret, { expiresIn: '1h' });

// Starts the app on a free port. Returns { baseUrl, close, api }.
export const startServer = async () => {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const api = async (method, path, { token, body, form } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(baseUrl + path, {
      method,
      headers,
      body: form || (body !== undefined ? JSON.stringify(body) : undefined),
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
  const close = () => new Promise((resolve) => server.close(resolve));
  return { baseUrl, api, close };
};

// A company (onboarding finished, 14-day trial) with one admin and one member.
export const createCompany = async (tag, key) => {
  const company = await query(
    'INSERT INTO companies (name, onboarding_completed) VALUES ($1, true) RETURNING id',
    [`${tag} ${key}`]
  );
  const companyId = company.rows[0].id;
  const result = { id: companyId };
  for (const role of ['admin', 'member']) {
    const email = `${tag}-${key}-${role}@example.com`;
    const user = await query(
      `INSERT INTO users (company_id, full_name, email, role, is_active)
       VALUES ($1, $2, $3, $4, true) RETURNING id`,
      [companyId, `${key} ${role}`, email, role]
    );
    result[role] = { id: user.rows[0].id, email, token: tokenFor(user.rows[0].id) };
  }
  await getOrCreateSubscription(companyId);
  return result;
};

// Removes test companies with everything they own (orders, shipments, alerts ...) and their users.
export const removeCompanies = async (companyIds) => {
  const ids = companyIds.filter(Boolean);
  if (ids.length === 0) return;
  try {
    const users = await query('SELECT id FROM users WHERE company_id = ANY($1::uuid[])', [ids]);
    const userIds = users.rows.map((u) => u.id);
    await query('DELETE FROM companies WHERE id = ANY($1::uuid[])', [ids]);
    if (userIds.length) {
      await query('DELETE FROM user_notification_preferences WHERE user_id = ANY($1::uuid[])', [userIds]);
      await query('DELETE FROM password_resets WHERE user_id = ANY($1::uuid[])', [userIds]);
      await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
    }
  } catch (error) {
    console.error('Test cleanup failed:', error.message);
  }
};

// The shared database pool keeps the process alive, so each test file exits when done
export const exitWhenDone = () => setTimeout(() => process.exit(process.exitCode || 0), 100).unref();

// An order in the shape the Add / Edit Order page sends
export const orderBody = (overrides = {}) => ({
  type: 'sales',
  partyName: 'ABC Industries',
  poNumber: `PO-${crypto.randomUUID().slice(0, 8)}`,
  currency: 'INR',
  items: [{ product: 'Chemical A', sku: 'CHEM-A', qty: '10', unit: 'MT', unitPrice: '500' }],
  ...overrides,
});

// Fake Gemini: answers are chosen per call label ('AI Classification', 'AI Extraction', 'AI Update Extraction')
export const mockAi = (answers) => {
  globalThis.__ordrAiMock = async (parts, label) => {
    const answer = typeof answers[label] === 'function' ? answers[label](parts) : answers[label];
    if (!answer) return { data: null, error: `No mock answer for ${label}`, busy: false };
    return { data: answer, error: null, busy: false };
  };
};
export const clearAiMock = () => {
  delete globalThis.__ordrAiMock;
};

// Fake answers for outside services (Google, Razorpay) while the test server stays real.
// handler(url, options) returns { status, body } for URLs it knows, or undefined to pass through.
// Returns the list of intercepted calls and a restore() function.
export const mockExternalFetch = (handler) => {
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
      const answer = await handler(url, options);
      if (answer) {
        calls.push({ url, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
        return new Response(JSON.stringify(answer.body ?? {}), {
          status: answer.status ?? 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected outside call in a test: ${url}`);
    }
    return realFetch(input, options);
  };
  return { calls, restore: () => { globalThis.fetch = realFetch; } };
};
