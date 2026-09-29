// QA (Module 37) - Security: company A cannot see company B's data in any module,
// members cannot use admin-only functions, and requests without a login are blocked.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../config/database.js';
import { createCompany, exitWhenDone, orderBody, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('sec');
let server;
let a;
let b;
const ids = {};

before(async () => {
  server = await startServer();
  a = await createCompany(tag, 'a');
  b = await createCompany(tag, 'b');

  const order = await server.api('POST', '/orders', { token: a.admin.token, body: orderBody({ poNumber: `${tag}-A` }) });
  ids.order = order.json.order.id;
  const shipment = await server.api('POST', `/orders/${ids.order}/shipments`, { token: a.admin.token, body: { shipmentNumber: 'S1', quantity: '2' } });
  ids.shipment = shipment.json.shipment.id;
  ids.detection = (await query(
    `INSERT INTO ai_order_extracts (company_id, status, customer_name, po_number) VALUES ($1, 'New', 'X', 'PO-SEC') RETURNING id`, [a.id]
  )).rows[0].id;
  ids.update = (await query(
    `INSERT INTO order_update_suggestions (company_id, gmail_message_id, classification, update_type, order_id)
     VALUES ($1, $2, 'Dispatch Update', 'dispatched', $3) RETURNING id`, [a.id, `${tag}-msg`, ids.order]
  )).rows[0].id;
});

after(async () => {
  await removeCompanies([a?.id, b?.id]);
  await server.close();
  exitWhenDone();
});

describe('Company A cannot see or change company B data', () => {
  const reads = () => [
    ['GET', `/orders/${ids.order}`],
    ['GET', `/orders/${ids.order}/events`],
    ['GET', `/orders/${ids.order}/documents`],
    ['GET', `/shipments/${ids.shipment}`],
    ['GET', `/ai-inbox/${ids.detection}`],
    ['GET', `/ai-inbox/updates/${ids.update}`],
    ['GET', `/ai-inbox/updates/orders/${ids.order}`],
  ];

  test('reading another company\'s records returns 404', async () => {
    for (const [method, path] of reads()) {
      const res = await server.api(method, path, { token: b.admin.token });
      assert.equal(res.status, 404, `${method} ${path} should be hidden from company B`);
    }
  });

  test('changing another company\'s records is refused', async () => {
    const attempts = [
      ['PUT', `/orders/${ids.order}`, orderBody()],
      ['DELETE', `/orders/${ids.order}`],
      ['PATCH', `/orders/${ids.order}/status`, { status: 'confirmed' }],
      ['POST', `/orders/${ids.order}/shipments`, { shipmentNumber: 'X', quantity: '1' }],
      ['PATCH', `/shipments/${ids.shipment}`, { lrNumber: 'HACK' }],
      ['POST', `/shipments/${ids.shipment}/status`, { status: 'delivered' }],
      ['POST', `/ai-inbox/${ids.detection}/confirm`],
      ['POST', `/ai-inbox/updates/${ids.update}/apply`, {}],
    ];
    for (const [method, path, body] of attempts) {
      const res = await server.api(method, path, { token: b.admin.token, body });
      assert.ok([400, 404].includes(res.status), `${method} ${path} returned ${res.status}`);
    }
    const s = (await query('SELECT lr_number, status FROM shipments WHERE id = $1', [ids.shipment])).rows[0];
    assert.equal(s.lr_number, null);
    assert.notEqual(String(s.status).toLowerCase(), 'delivered');
  });

  test('lists only contain the own company\'s records', async () => {
    const lists = [
      ['/orders', 'orders'],
      ['/shipments', 'shipments'],
      ['/ai-inbox', 'extracts'],
      ['/ai-inbox/updates', 'updates'],
    ];
    for (const [path, key] of lists) {
      const res = await server.api('GET', path, { token: b.admin.token });
      assert.equal(res.status, 200);
      assert.equal(res.json[key].length, 0, `${path} must not show company A records`);
    }
  });
});

describe('Members cannot use admin-only functions', () => {
  test('admin-only endpoints return 403 for a member', async () => {
    const adminOnly = [
      ['GET', '/team/members'],
      ['POST', '/team/invite', { invites: [{ email: `${tag}-new@example.com`, role: 'member' }] }],
      ['PATCH', `/team/members/${a.admin.id}/role`, { role: 'member' }],
      ['PATCH', '/company', { name: 'Hacked' }],
      ['GET', '/company/users'],
      ['POST', '/billing/checkout', { plan: 'growth' }],
      ['GET', '/integration/gmail/connect'],
      ['POST', '/integration/gmail/scan'],
      ['DELETE', `/orders/${ids.order}`],
      ['PUT', `/orders/${ids.order}`, orderBody()],
      ['GET', '/audit-logs'],
      ['GET', '/analytics/summary'],
    ];
    for (const [method, path, body] of adminOnly) {
      const res = await server.api(method, path, { token: a.member.token, body });
      assert.equal(res.status, 403, `${method} ${path} should be admin-only (got ${res.status})`);
    }
  });

  test('members can still do their own work (view, create orders, shipments, status)', async () => {
    assert.equal((await server.api('GET', '/orders', { token: a.member.token })).status, 200);
    const order = await server.api('POST', '/orders', { token: a.member.token, body: orderBody({ poNumber: `${tag}-M` }) });
    assert.equal(order.status, 201);
    const shipment = await server.api('POST', `/orders/${order.json.order.id}/shipments`, {
      token: a.member.token,
      body: { shipmentNumber: 'M1', quantity: '1' },
    });
    assert.equal(shipment.status, 201);
    const status = await server.api('POST', `/shipments/${shipment.json.shipment.id}/status`, { token: a.member.token, body: { status: 'in-transit' } });
    assert.equal(status.status, 200);
  });
});

describe('Invalid API access is blocked', () => {
  test('no login -> 401 everywhere', async () => {
    for (const path of ['/orders', '/shipments', '/ai-inbox', '/alerts', '/dashboard', '/search?q=ab', '/billing', '/company', '/notifications/inbox']) {
      const res = await server.api('GET', path);
      assert.equal(res.status, 401, `${path} without login`);
    }
  });

  test('a removed user\'s token stops working', async () => {
    const extra = await query(
      `INSERT INTO users (company_id, full_name, email, role, is_active) VALUES ($1, 'Leaver', $2, 'member', true) RETURNING id`,
      [a.id, `${tag}-leaver@example.com`]
    );
    const { tokenFor } = await import('./helpers.js');
    const token = tokenFor(extra.rows[0].id);
    assert.equal((await server.api('GET', '/orders', { token })).status, 200);
    const removed = await server.api('DELETE', `/team/members/${extra.rows[0].id}`, { token: a.admin.token });
    assert.equal(removed.status, 200);
    assert.equal((await server.api('GET', '/orders', { token })).status, 401);
  });

  test('malformed ids are "not found", not server errors', async () => {
    for (const path of ['/orders/abc', '/shipments/1%27%20OR%201=1', '/ai-inbox/xyz', '/ai-inbox/updates/123']) {
      const res = await server.api('GET', path, { token: a.admin.token });
      assert.equal(res.status, 404, path);
    }
  });
});
