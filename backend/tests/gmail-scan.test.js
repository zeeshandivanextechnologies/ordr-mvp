// QA (Module 37 / 6 / 7 / 34) - "Scan Inbox" endpoint with a fake Gmail API (no real Google calls):
// fetches new emails since the last scan, pre-filters them, saves them once (no duplicates),
// moves the last-scan time forward, and never touches another company's inbox.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../config/database.js';
import { encryptToken } from '../utils/tokenCrypto.js';
import { clearAiMock, createCompany, exitWhenDone, mockAi, mockExternalFetch, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('scan');
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
let server;
let a;
let b;
let c;
let google;

const id = (name) => `${tag}-${name}`;
const b64url = (text) => Buffer.from(text).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fullMessage = (name, { from, subject, body }) => ({
  id: id(name),
  threadId: id(`${name}-thread`),
  snippet: body.slice(0, 50),
  payload: {
    mimeType: 'text/plain',
    headers: [
      { name: 'From', value: from },
      { name: 'Subject', value: subject },
      { name: 'Date', value: 'Mon, 28 Sep 2026 10:00:00 +0530' },
    ],
    body: { data: b64url(body), size: body.length },
  },
});

// What the fake Gmail inbox holds
const INBOX = {
  po: fullMessage('po', {
    from: 'Buyer <buyer@steel.example>',
    subject: `Purchase Order ${id('PO-1')}`,
    body: `Dear team, please find our purchase order ${id('PO-1')} for 10 MT Steel Rod. Quantity 10 MT.`,
  }),
  news: fullMessage('news', {
    from: 'Deals <newsletter@promo.example>',
    subject: 'Weekly newsletter - big discounts',
    body: 'Latest offers this week. Click here to unsubscribe.',
  }),
};

const addConnection = async (company, email) =>
  (await query(
    `INSERT INTO email_connections (company_id, user_id, provider, email, access_token, refresh_token, token_expiry, is_active)
     VALUES ($1, $2, 'gmail', $3, $4, $5, NOW() + interval '1 hour', true) RETURNING id`,
    [company.id, company.admin.id, email, encryptToken(`access-${company.id}`), encryptToken(`refresh-${company.id}`)]
  )).rows[0].id;
const savedMessages = async (company) =>
  (await query('SELECT * FROM gmail_messages WHERE company_id = $1 ORDER BY message_id', [company.id])).rows;
const connectionRow = async (connId) => (await query('SELECT * FROM email_connections WHERE id = $1', [connId])).rows[0];
const listCalls = () => google.calls.filter((call) => call.url.startsWith(`${GMAIL}/messages?`));
const scan = (company, token = company.admin.token) => server.api('POST', '/integration/gmail/scan', { token });

// Wait for the background AI step started by the scan, so it does not run into the cleanup
const waitForProcessing = async (company) => {
  for (let i = 0; i < 50; i += 1) {
    const pending = await query(
      'SELECT COUNT(*)::int AS c FROM gmail_messages WHERE company_id = $1 AND is_potential_order AND NOT processed',
      [company.id]
    );
    if (pending.rows[0].c === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

let connA;
let connB;

before(async () => {
  server = await startServer();
  a = await createCompany(tag, 'a');
  b = await createCompany(tag, 'b');
  c = await createCompany(tag, 'c'); // no Gmail connected
  connA = await addConnection(a, `${tag}-a@gmail.example`);
  connB = await addConnection(b, `${tag}-b@gmail.example`);

  // An email saved by an earlier scan
  await query(
    `INSERT INTO gmail_messages (company_id, email_connection_id, message_id, thread_id, subject, is_potential_order, processed)
     VALUES ($1, $2, $3, $3, 'Old email', false, true)`,
    [a.id, connA, id('old')]
  );

  // The background AI step: nothing here is an order
  mockAi({ 'AI Classification': { classification: 'Not an Order', confidence: 80, reason: 'test' } });

  google = mockExternalFetch((url, options) => {
    if (!url.startsWith(GMAIL)) return undefined;
    const auth = options.headers?.Authorization || '';
    if (auth !== `Bearer access-${a.id}`) return { status: 401, body: { error: 'wrong token' } };
    if (url.startsWith(`${GMAIL}/messages?`)) {
      return { body: { messages: [{ id: INBOX.po.id }, { id: INBOX.news.id }, { id: id('old') }] } };
    }
    const match = url.match(/\/messages\/([^/?]+)\?format=full$/);
    if (match) {
      const message = Object.values(INBOX).find((m) => m.id === decodeURIComponent(match[1]));
      return message ? { body: message } : { status: 404, body: {} };
    }
    return undefined;
  });
});

after(async () => {
  google?.restore();
  clearAiMock();
  await removeCompanies([a?.id, b?.id, c?.id]);
  await server.close();
  exitWhenDone();
});

describe('Gmail scan endpoint', () => {
  test('first scan: new emails are saved and pre-filtered, the known one is skipped', async () => {
    const res = await scan(a);
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.scanned, 3);
    assert.equal(res.json.newMessages, 2);
    assert.equal(res.json.skippedDuplicates, 1);
    assert.equal(res.json.potentialOrders, 1);
    assert.equal(res.json.marketingSkipped, 1);
    assert.equal(res.json.hasMore, false);

    // First scan looks back 30 days in the inbox
    assert.match(decodeURIComponent(listCalls()[0].url), /q=in:inbox newer_than:30d/);

    const saved = await savedMessages(a);
    const po = saved.find((m) => m.message_id === id('po'));
    const news = saved.find((m) => m.message_id === id('news'));
    assert.equal(saved.length, 3);
    assert.equal(po.is_potential_order, true);
    assert.equal(po.prefilter_reason, 'order');
    assert.equal(po.thread_id, id('po-thread'), 'thread id stored (Module 6)');
    assert.equal(po.sender_email, 'buyer@steel.example');
    assert.match(po.body, /purchase order/);
    assert.equal(news.is_potential_order, false, 'newsletters never reach the AI');
    assert.equal(news.prefilter_reason, 'marketing');

    const conn = await connectionRow(connA);
    assert.ok(conn.last_scan_at, 'last scan time stored');
    assert.ok(res.json.connection.last_scan_at);
    await waitForProcessing(a);
  });

  test('second scan: continues after the last scan and saves nothing twice', async () => {
    const before = listCalls().length;
    const res = await scan(a);
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.newMessages, 0);
    assert.equal(res.json.skippedDuplicates, 3);
    assert.match(decodeURIComponent(listCalls()[before].url), /q=in:inbox after:\d+/);
    assert.equal((await savedMessages(a)).length, 3);
    await waitForProcessing(a);
  });

  test("another company's inbox is never used or changed", async () => {
    assert.ok(google.calls.every((call) => !String(call.url).includes(b.id)));
    const connB_ = await connectionRow(connB);
    assert.equal(connB_.last_scan_at, null);
    assert.equal((await savedMessages(b)).length, 0);
  });

  test('no Gmail connected: a clear 400', async () => {
    const res = await scan(c);
    assert.equal(res.status, 400);
    assert.match(res.json.error, /not connected/i);
  });

  test('members cannot start a scan', async () => {
    assert.equal((await scan(a, a.member.token)).status, 403);
  });
});
