// QA (Module 37) - Google sign-in, with Google's servers replaced by fake answers.
// The real Google popup still needs a manual check; everything the backend does is tested here.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import config from '../config/environment.js';
import { query } from '../config/database.js';
import { exitWhenDone, mockExternalFetch, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('google');
const CLIENT_ID = config.google.clientId || 'test-google-client-id';
let server;
let google;
const companies = [];

// Fake Google accounts by access token: { sub, email, name, verified, aud }
const accounts = {};
const addAccount = (token, account) => {
  accounts[token] = { aud: CLIENT_ID, verified: true, ...account };
};

before(async () => {
  config.google.clientId = CLIENT_ID;
  server = await startServer();
  google = mockExternalFetch((url, options) => {
    if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
      const account = accounts[new URL(url).searchParams.get('access_token')];
      if (!account) return { status: 400, body: { error: 'invalid_token' } };
      return { body: { aud: account.aud, azp: account.aud, sub: account.sub, email: account.email } };
    }
    if (url.startsWith('https://www.googleapis.com/oauth2/v3/userinfo')) {
      const token = String(options.headers?.Authorization || '').replace('Bearer ', '');
      const account = accounts[token];
      if (!account) return { status: 401, body: {} };
      return { body: { sub: account.sub, email: account.email, email_verified: account.verified, name: account.name, picture: 'https://example.com/p.png' } };
    }
    return undefined;
  });
});

after(async () => {
  google.restore();
  const rows = await query('SELECT DISTINCT company_id FROM users WHERE email LIKE $1', [`${tag}%`]);
  await removeCompanies([...companies, ...rows.rows.map((r) => r.company_id)]);
  await server.close();
  exitWhenDone();
});

const googleLogin = (accessToken) => server.api('POST', '/auth/google/callback', { body: { accessToken } });

describe('Google sign-in', () => {
  test('a new Google user gets a company, an admin account and a session', async () => {
    addAccount('tok-new', { sub: `${tag}-sub-1`, email: `${tag}-new@gmail.example`, name: 'New Google User' });
    const res = await googleLogin('tok-new');
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.isNew, true);
    assert.equal(res.json.user.role, 'admin');
    assert.ok(res.json.token);
    companies.push(res.json.user.company_id);

    const me = await server.api('GET', '/auth/me', { token: res.json.token });
    assert.equal(me.json.user.email, `${tag}-new@gmail.example`);
    assert.equal(me.json.user.onboarding_completed, false, 'new users go through onboarding');
  });

  test('the same Google user signing in again gets the same account (not a new one)', async () => {
    const res = await googleLogin('tok-new');
    assert.equal(res.status, 200);
    assert.equal(res.json.isNew, false);
    const count = await query('SELECT COUNT(*)::int AS c FROM users WHERE email = $1', [`${tag}-new@gmail.example`]);
    assert.equal(count.rows[0].c, 1);
  });

  test('an email/password account is linked to Google on first Google sign-in', async () => {
    const email = `${tag}-existing@example.com`;
    const signup = await server.api('POST', '/auth/signup', { body: { full_name: 'Existing User', email, password: 'Password123' } });
    companies.push(signup.json.user.company_id);
    addAccount('tok-existing', { sub: `${tag}-sub-2`, email, name: 'Existing User' });

    const res = await googleLogin('tok-existing');
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.isNew, false);
    assert.equal(res.json.user.id, signup.json.user.id);
    const row = await query('SELECT google_id FROM users WHERE id = $1', [signup.json.user.id]);
    assert.equal(row.rows[0].google_id, `${tag}-sub-2`);
    // Password login keeps working too
    assert.equal((await server.api('POST', '/auth/login', { body: { email, password: 'Password123' } })).status, 200);
  });

  test('a deactivated account cannot sign in with Google', async () => {
    await query('UPDATE users SET is_active = false WHERE email = $1', [`${tag}-existing@example.com`]);
    const res = await googleLogin('tok-existing');
    assert.equal(res.status, 403);
  });

  test('tokens for another app, unverified emails and bad tokens are refused', async () => {
    addAccount('tok-other-app', { sub: `${tag}-sub-3`, email: `${tag}-other@gmail.example`, aud: 'someone-elses-client-id' });
    assert.equal((await googleLogin('tok-other-app')).status, 401);

    addAccount('tok-unverified', { sub: `${tag}-sub-4`, email: `${tag}-unverified@gmail.example`, verified: false });
    assert.equal((await googleLogin('tok-unverified')).status, 401);

    assert.equal((await googleLogin('tok-unknown')).status, 401);
    assert.equal((await server.api('POST', '/auth/google/callback', { body: {} })).status, 400);

    const created = await query('SELECT COUNT(*)::int AS c FROM users WHERE email IN ($1, $2)', [`${tag}-other@gmail.example`, `${tag}-unverified@gmail.example`]);
    assert.equal(created.rows[0].c, 0, 'no account is created for refused sign-ins');
  });
});
