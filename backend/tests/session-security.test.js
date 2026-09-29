// Security (Module 33): Gmail "state" tokens cannot log in, cookie-only changes from other
// websites are blocked (CSRF), and a password change / reset ends older sessions.
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import config from '../config/environment.js';
import { query } from '../config/database.js';
import { exitWhenDone, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('session');
const email = `${tag}@example.com`;
const password = 'Password123';
let server;
let companyId;
let userId;
let token;

// Raw request with full control over headers (cookie / origin)
const raw = (method, path, headers = {}, body) =>
  fetch(server.baseUrl + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

before(async () => {
  server = await startServer();
  const res = await server.api('POST', '/auth/signup', { body: { full_name: 'Session Tester', email, password } });
  companyId = res.json.user.company_id;
  userId = res.json.user.id;
  token = res.json.token;
});

after(async () => {
  await removeCompanies([companyId]);
  await server.close();
  exitWhenDone();
});

describe('Gmail connect state token', () => {
  test('the Google connect link carries a state that cannot be used to log in', async () => {
    const connect = await server.api('GET', '/integration/gmail/connect', { token });
    assert.equal(connect.status, 200, connect.text);
    const state = new URL(connect.json.url).searchParams.get('state');
    assert.equal(jwt.decode(state).typ, 'gmail_state');

    const misuse = await server.api('GET', '/orders', { token: state });
    assert.equal(misuse.status, 401);
  });

  test('older-style tokens without a type still work (nobody is logged out by this change)', async () => {
    const legacy = jwt.sign({ userId }, config.jwtSecret, { expiresIn: '1h' });
    assert.equal((await server.api('GET', '/orders', { token: legacy })).status, 200);
  });
});

describe('CSRF protection for the login cookie', () => {
  const cookie = () => `token=${token}`;

  test('a change sent with only the cookie from another website is blocked', async () => {
    const res = await raw('POST', '/alerts/resolve-all', { Cookie: cookie(), Origin: 'https://evil.example' });
    assert.equal(res.status, 403);
    const noOrigin = await raw('POST', '/alerts/resolve-all', { Cookie: cookie() });
    assert.equal(noOrigin.status, 403);
  });

  test('the same change from the ORDR app, or with the Authorization header, works', async () => {
    const fromApp = await raw('POST', '/alerts/resolve-all', { Cookie: cookie(), Origin: 'http://localhost:5173' });
    assert.equal(fromApp.status, 200);
    const withHeader = await raw('POST', '/alerts/resolve-all', { Authorization: `Bearer ${token}`, Origin: 'https://evil.example' });
    assert.equal(withHeader.status, 200, 'other websites cannot add this header, so it is safe');
  });

  test('reading with only the cookie still works (no data is changed)', async () => {
    const res = await raw('GET', '/orders', { Cookie: cookie(), Origin: 'https://evil.example' });
    assert.equal(res.status, 200);
  });
});

describe('Password change / reset ends older sessions', () => {
  test('changing the password signs out other devices but keeps this one', async () => {
    const otherDevice = (await server.api('POST', '/auth/login', { body: { email, password } })).json.token;
    // Tokens only record whole seconds: make sure the change happens in a later second
    await new Promise((r) => setTimeout(r, 1100));

    const change = await server.api('PATCH', '/auth/password', {
      token,
      body: { current_password: password, new_password: 'Changed12345' },
    });
    assert.equal(change.status, 200, change.text);
    assert.ok(change.json.token, 'this device gets a fresh session');

    assert.equal((await server.api('GET', '/orders', { token: otherDevice })).status, 401);
    assert.equal((await server.api('GET', '/orders', { token })).status, 401, 'the old token of this device also ends');
    assert.equal((await server.api('GET', '/orders', { token: change.json.token })).status, 200);
    token = change.json.token;
  });

  test('a password reset signs out every session', async () => {
    await new Promise((r) => setTimeout(r, 1100));
    await server.api('POST', '/auth/forgot-password', { body: { email } });
    const otp = '314159';
    const hash = crypto.createHash('sha256').update(`${userId}:${otp}`).digest('hex');
    await query('UPDATE password_resets SET token = $1 WHERE user_id = $2 AND used = false', [hash, userId]);
    const reset = await server.api('POST', '/auth/reset-password', { body: { email, otp, password: 'AfterReset123' } });
    assert.equal(reset.status, 200, reset.text);

    assert.equal((await server.api('GET', '/orders', { token })).status, 401);
    const login = await server.api('POST', '/auth/login', { body: { email, password: 'AfterReset123' } });
    assert.equal((await server.api('GET', '/orders', { token: login.json.token })).status, 200);
  });
});
