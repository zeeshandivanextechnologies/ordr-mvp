// QA (Module 37) - Authentication: signup, login, logout, password reset, onboarding.
// Google login needs a real Google account and is tested by hand.
import crypto from 'crypto';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../config/database.js';
import { exitWhenDone, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('auth');
const email = `${tag}@example.com`;
const password = 'Password123';
let server;
let companyId;
let token;

before(async () => {
  server = await startServer();
});

after(async () => {
  await removeCompanies([companyId]);
  await server.close();
  exitWhenDone();
});

describe('Authentication', () => {
  test('signup creates a company, an admin and a session', async () => {
    const res = await server.api('POST', '/auth/signup', { body: { full_name: 'Auth Tester', email, password } });
    assert.equal(res.status, 201);
    assert.equal(res.json.user.role, 'admin');
    assert.ok(res.json.token);
    assert.match(res.headers.get('set-cookie') || '', /token=/);
    companyId = res.json.user.company_id;
    token = res.json.token;

    const me = await server.api('GET', '/auth/me', { token });
    assert.equal(me.status, 200);
    assert.equal(me.json.user.email, email);
    assert.equal(me.json.user.onboarding_completed, false, 'a new company still has to finish onboarding');
  });

  test('signup with an email that is already registered is rejected', async () => {
    const res = await server.api('POST', '/auth/signup', { body: { full_name: 'Again', email, password } });
    assert.equal(res.status, 409);
  });

  test('signup needs a password of at least 8 characters', async () => {
    const res = await server.api('POST', '/auth/signup', { body: { full_name: 'Short', email: `short-${email}`, password: 'abc' } });
    assert.equal(res.status, 400);
  });

  test('login works with the right password and fails with a wrong one', async () => {
    const ok = await server.api('POST', '/auth/login', { body: { email: email.toUpperCase(), password } });
    assert.equal(ok.status, 200);
    assert.ok(ok.json.token);

    const wrong = await server.api('POST', '/auth/login', { body: { email, password: 'wrong-password' } });
    assert.equal(wrong.status, 401);
  });

  test('logout clears the session cookie', async () => {
    const res = await server.api('POST', '/auth/logout', { token });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('set-cookie') || '', /token=;/);
  });

  test('password reset with an emailed OTP', async () => {
    const forgot = await server.api('POST', '/auth/forgot-password', { body: { email } });
    assert.equal(forgot.status, 200);

    // The OTP goes out by email; the test replaces the stored hash with a known code
    const user = (await query('SELECT id FROM users WHERE email = $1', [email])).rows[0];
    const otp = '482913';
    const hash = crypto.createHash('sha256').update(`${user.id}:${otp}`).digest('hex');
    await query('UPDATE password_resets SET token = $1 WHERE user_id = $2 AND used = false', [hash, user.id]);

    const wrongOtp = await server.api('POST', '/auth/verify-otp', { body: { email, otp: '000000' } });
    assert.equal(wrongOtp.status, 400);
    const verify = await server.api('POST', '/auth/verify-otp', { body: { email, otp } });
    assert.equal(verify.status, 200);

    const reset = await server.api('POST', '/auth/reset-password', { body: { email, otp, password: 'NewPassword456' } });
    assert.equal(reset.status, 200);

    const oldLogin = await server.api('POST', '/auth/login', { body: { email, password } });
    assert.equal(oldLogin.status, 401);
    const newLogin = await server.api('POST', '/auth/login', { body: { email, password: 'NewPassword456' } });
    assert.equal(newLogin.status, 200);

    // Sessions from before the reset have ended; continue with the new login
    assert.equal((await server.api('GET', '/auth/me', { token })).status, 401);
    token = newLogin.json.token;
  });

  test('finishing onboarding is remembered', async () => {
    const res = await server.api('POST', '/company/onboarding/complete', { token });
    assert.equal(res.status, 200);
    const me = await server.api('GET', '/auth/me', { token });
    assert.equal(me.json.user.onboarding_completed, true);
  });
});
