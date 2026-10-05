// QA (Module 28 / 29 / 37) - Plan limits: users, orders per month, Gmail inboxes and AI extractions.
// At the limit the action is refused (402 PLAN_LIMIT_REACHED, or a clear reason for invites);
// one below the limit it still works, and upgrading the plan lifts the limit.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../config/database.js';
import { clearAiMock, createCompany, exitWhenDone, mockAi, orderBody, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('limits');
let server;
const companies = [];

const newCompany = async (key, plan) => {
  const c = await createCompany(tag, key);
  companies.push(c.id);
  if (plan) await setPlan(c, plan);
  return c;
};
// A paid plan, active for the current month
const setPlan = (c, plan) =>
  query(
    `UPDATE subscriptions SET plan = $2, status = 'active',
       current_period_start = NOW() - interval '1 day', current_period_end = NOW() + interval '30 days'
     WHERE company_id = $1`,
    [c.id, plan]
  );
// Usage created directly in the database (much faster than one API call each)
const addOrders = (c, n) =>
  query(
    `INSERT INTO orders (company_id, created_by, order_type, party_name, po_number)
     SELECT $1, $2, 'sales', 'Bulk Party', $3 || '-' || g FROM generate_series(1, $4) g`,
    [c.id, c.admin.id, `${tag}-${c.id.slice(0, 6)}`, n]
  );
const addDetections = (c, n) =>
  query(
    `INSERT INTO ai_order_extracts (company_id, customer_name, po_number, confidence, status)
     SELECT $1, 'Bulk Party', 'AI-' || g, 80, 'Ignored' FROM generate_series(1, $2) g`,
    [c.id, n]
  );
const addInbox = (c, n = 1) =>
  query(
    `INSERT INTO email_connections (company_id, user_id, provider, email, is_active)
     SELECT $1, $2, 'gmail', $3 || g || '@gmail.example', true FROM generate_series(1, $4) g`,
    [c.id, c.admin.id, `${tag}-${c.id.slice(0, 6)}-`, n]
  );
const createOrder = (c) => server.api('POST', '/orders', { token: c.member.token, body: orderBody() });
const uploadCsv = (c, po) => {
  const form = new FormData();
  form.append('file', new Blob([`Customer,Limit Ltd\nPO No,${po}\n\nProduct,Qty,Unit\nChemical A,5,MT\n`]), `${po}.csv`);
  return server.api('POST', '/orders/upload', { token: c.member.token, form });
};
const invite = (c, email) =>
  server.api('POST', '/team/invite', { token: c.admin.token, body: { invites: [{ email, role: 'member' }] } });

before(async () => {
  server = await startServer();
  mockAi({});
});

after(async () => {
  clearAiMock();
  const docs = await query('SELECT file_path FROM po_documents WHERE company_id = ANY($1::uuid[])', [companies]);
  const fs = await import('fs');
  for (const d of docs.rows) fs.unlink(d.file_path, () => {});
  await removeCompanies(companies);
  await server.close();
  exitWhenDone();
});

describe('Orders per month', () => {
  test('Basic (50): the 50th order is created, the 51st is refused', async () => {
    const c = await newCompany('orders', 'basic');
    await addOrders(c, 49);
    const ok = await createOrder(c);
    assert.equal(ok.status, 201, ok.text);
    const refused = await createOrder(c);
    assert.equal(refused.status, 402, refused.text);
    assert.equal(refused.json.code, 'PLAN_LIMIT_REACHED');
    assert.match(refused.json.message, /50 orders this month/);

    // Upgrade to Growth (200): orders can be created again
    await setPlan(c, 'growth');
    assert.equal((await createOrder(c)).status, 201);
  });

  test('Trial (100 orders during the trial)', async () => {
    const c = await newCompany('trial');
    await addOrders(c, 100);
    const refused = await createOrder(c);
    assert.equal(refused.status, 402);
    assert.equal(refused.json.code, 'PLAN_LIMIT_REACHED');
    assert.match(refused.json.message, /during the trial/);
  });
});

describe('AI extractions', () => {
  test('Basic (25): upload works below the limit and is refused at it', async () => {
    const c = await newCompany('ai', 'basic');
    await addDetections(c, 24);
    const ok = await uploadCsv(c, `${tag}-AI-OK`);
    assert.equal(ok.status, 201, ok.text);
    assert.equal(ok.json.extractCount, 1);

    const refused = await uploadCsv(c, `${tag}-AI-NO`);
    assert.equal(refused.status, 402, refused.text);
    assert.equal(refused.json.code, 'PLAN_LIMIT_REACHED');
    assert.match(refused.json.message, /25 AI extractions/);
  });
});

describe('Gmail inboxes', () => {
  test('Basic (1): a second inbox is refused; Business (3) allows it', async () => {
    const c = await newCompany('inbox', 'basic');
    await addInbox(c, 1);
    const refused = await server.api('GET', '/integration/gmail/connect', { token: c.admin.token });
    assert.equal(refused.status, 402, refused.text);
    assert.equal(refused.json.code, 'PLAN_LIMIT_REACHED');
    assert.match(refused.json.message, /1 Gmail inbox/);

    await setPlan(c, 'business');
    const allowed = await server.api('GET', '/integration/gmail/connect', { token: c.admin.token });
    assert.notEqual(allowed.status, 402, allowed.text);
  });
});

describe('Users', () => {
  test('Basic (2 users): with admin + member already there, an invite is refused with the reason', async () => {
    const c = await newCompany('users', 'basic');
    const res = await invite(c, `${tag}-third@example.com`);
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.success.length, 0);
    assert.match(res.json.failed[0].reason, /allows 2 users/);
    const pending = await query(`SELECT COUNT(*)::int AS c FROM team_invitations WHERE company_id = $1`, [c.id]);
    assert.equal(pending.rows[0].c, 0, 'no invitation saved');

    // Growth (5 users): the invite goes through
    await setPlan(c, 'growth');
    const ok = await invite(c, `${tag}-third@example.com`);
    assert.equal(ok.json.success.length, 1, ok.text);
  });

  test('pending invitations count as seats', async () => {
    const c = await newCompany('seats', 'growth'); // 5 users: 2 existing + 3 invites
    for (const n of [1, 2, 3]) {
      assert.equal((await invite(c, `${tag}-s${n}@example.com`)).json.success.length, 1);
    }
    const res = await invite(c, `${tag}-s4@example.com`);
    assert.equal(res.json.success.length, 0);
    assert.match(res.json.failed[0].reason, /allows 5 users/);
  });
});
