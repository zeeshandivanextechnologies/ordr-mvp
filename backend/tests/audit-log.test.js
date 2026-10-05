// QA (Module 35) - Audit log for sign-in, password, company settings and PO upload.
// Recording never blocks the action itself.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../config/database.js';
import { clearAiMock, createCompany, exitWhenDone, mockAi, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('audit');
let server;
let a;

const PASSWORD = 'Str0ngPass!23';
const logsFor = async (action) =>
  (await query('SELECT * FROM audit_logs WHERE company_id = $1 AND action = $2 ORDER BY created_at', [a.id, action])).rows;

before(async () => {
  server = await startServer();
  a = await createCompany(tag, 'a');
  mockAi({});
  // A known password for the member, so the real login route can be used
  const bcrypt = (await import('bcryptjs')).default;
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(PASSWORD, 4), a.member.id]);
});

after(async () => {
  clearAiMock();
  await removeCompanies([a?.id]);
  await server.close();
  exitWhenDone();
});

describe('Audit log', () => {
  test('login and logout are recorded; a failed login is not', async () => {
    const email = (await query('SELECT email FROM users WHERE id = $1', [a.member.id])).rows[0].email;
    const bad = await server.api('POST', '/auth/login', { body: { email, password: 'wrong-password' } });
    assert.equal(bad.status, 401);
    assert.equal((await logsFor('auth.login')).length, 0);

    const res = await server.api('POST', '/auth/login', { body: { email, password: PASSWORD } });
    assert.equal(res.status, 200, res.text);
    const [login] = await logsFor('auth.login');
    assert.equal(login.user_id, a.member.id);
    assert.equal(login.details.method, 'password');

    const out = await server.api('POST', '/auth/logout', { token: res.json.token });
    assert.equal(out.status, 200);
    assert.equal((await logsFor('auth.logout')).length, 1);

    // Logout without a session still works (nothing to record)
    assert.equal((await server.api('POST', '/auth/logout')).status, 200);
    assert.equal((await logsFor('auth.logout')).length, 1);
  });

  test('password change is recorded', async () => {
    const res = await server.api('PATCH', '/auth/password', {
      token: a.member.token,
      body: { current_password: PASSWORD, new_password: `${PASSWORD}x` },
    });
    assert.equal(res.status, 200, res.text);
    assert.equal((await logsFor('auth.password_changed')).length, 1);
  });

  test('company settings: only real changes are recorded, with old and new values', async () => {
    const res = await server.api('PATCH', '/company', { token: a.admin.token, body: { industry: `${tag} Chemicals`, stale_days: 7 } });
    assert.equal(res.status, 200, res.text);
    const [log] = await logsFor('company.updated');
    assert.equal(log.details.changes.industry.to, `${tag} Chemicals`);
    assert.equal(log.details.changes.stale_days.to, 7);
    assert.equal(log.details.changes.name, undefined);

    // Saving the same values again adds nothing
    await server.api('PATCH', '/company', { token: a.admin.token, body: { industry: `${tag} Chemicals`, stale_days: 7 } });
    assert.equal((await logsFor('company.updated')).length, 1);
  });

  test('PO upload is recorded with the file name', async () => {
    const form = new FormData();
    form.append('file', new Blob([`Customer,${tag} Ltd\nPO No,${tag}-PO\n\nProduct,Qty,Unit\nChemical A,5,MT\n`], { type: 'text/csv' }), `${tag}.csv`);
    // Admin token: the member's sessions ended with the password change above
    const res = await server.api('POST', '/orders/upload', { token: a.admin.token, form });
    assert.equal(res.status, 201, res.text);
    const [log] = await logsFor('document.uploaded');
    assert.equal(log.user_id, a.admin.id);
    assert.equal(log.details.file_name, `${tag}.csv`);
    assert.equal(log.details.detections_created, 1);
  });
});
