// QA (Module 37) - Alerts / Needs Attention rules (Modules 22-23):
// overdue, due soon, stale, missing LR, partial fulfilment; no duplicates on refresh.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../config/database.js';
import { refreshCompanyAlerts } from '../services/alertService.js';
import { createCompany, exitWhenDone, orderBody, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('alerts');
let server;
let a;
const ids = {};

const dateFromToday = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const createOrder = async (key, overrides) => {
  const res = await server.api('POST', '/orders', { token: a.admin.token, body: orderBody({ poNumber: `${tag}-${key}`, ...overrides }) });
  assert.equal(res.status, 201, res.text);
  ids[key] = res.json.order.id;
  return ids[key];
};
const alertsFor = async (orderId) => {
  const res = await server.api('GET', '/alerts', { token: a.member.token });
  return res.json.alerts.filter((x) => x.order_id === orderId && x.status === 'open').map((x) => x.type);
};

before(async () => {
  server = await startServer();
  a = await createCompany(tag, 'a');

  await createOrder('overdue', { requiredDeliveryDate: dateFromToday(-3) });
  await createOrder('due', { requiredDeliveryDate: dateFromToday(1) });
  await createOrder('later', { requiredDeliveryDate: dateFromToday(20) });

  // Stale: no activity for 10 days
  const stale = await createOrder('stale', {});
  await query(`UPDATE orders SET updated_at = NOW() - INTERVAL '10 days', created_at = NOW() - INTERVAL '10 days' WHERE id = $1`, [stale]);
  await query(`UPDATE tracking_events SET created_at = NOW() - INTERVAL '10 days' WHERE order_id = $1`, [stale]);

  // Dispatched without LR / AWB, and a partially delivered order
  const noLr = await createOrder('nolr', {});
  const s1 = await server.api('POST', `/orders/${noLr}/shipments`, { token: a.admin.token, body: { shipmentNumber: 'S1', quantity: '10' } });
  ids.noLrShipment = s1.json.shipment.id;
  const partial = await createOrder('partial', {});
  const s2 = await server.api('POST', `/orders/${partial}/shipments`, {
    token: a.admin.token,
    body: { shipmentNumber: 'S1', quantity: '6', lrNumber: 'LR1', transporter: 'VRL', expectedDeliveryDate: dateFromToday(2) },
  });
  await server.api('POST', `/shipments/${s2.json.shipment.id}/status`, { token: a.admin.token, body: { status: 'delivered' } });

  await refreshCompanyAlerts(a.id);
});

after(async () => {
  await removeCompanies([a?.id]);
  await server.close();
  exitWhenDone();
});

describe('Needs attention rules', () => {
  test('overdue order', async () => {
    assert.ok((await alertsFor(ids.overdue)).includes('overdue'));
  });

  test('delivery due soon (default 1 day)', async () => {
    assert.ok((await alertsFor(ids.due)).includes('due-soon'));
    assert.deepEqual(await alertsFor(ids.later), [], 'an order due in 20 days has no alert');
  });

  test('stale order (no update for 5+ days)', async () => {
    assert.ok((await alertsFor(ids.stale)).includes('stale'));
  });

  test('dispatched shipment without LR / AWB', async () => {
    const res = await server.api('GET', '/alerts', { token: a.member.token });
    assert.ok(res.json.alerts.some((x) => x.shipment_id === ids.noLrShipment && x.type === 'missing-tracking'));
  });

  test('partial fulfilment (6 of 10 MT delivered)', async () => {
    assert.ok((await alertsFor(ids.partial)).includes('partial'));
  });

  test('refreshing again does not create duplicates, and fixed problems resolve themselves', async () => {
    const before = (await query('SELECT COUNT(*)::int AS c FROM alerts WHERE company_id = $1', [a.id])).rows[0].c;
    await refreshCompanyAlerts(a.id);
    const again = (await query('SELECT COUNT(*)::int AS c FROM alerts WHERE company_id = $1', [a.id])).rows[0].c;
    assert.equal(again, before);

    // Adding the LR number resolves the missing-tracking alert
    await server.api('PATCH', `/shipments/${ids.noLrShipment}`, { token: a.admin.token, body: { lrNumber: 'LR-777' } });
    await refreshCompanyAlerts(a.id);
    const row = await query(
      `SELECT status FROM alerts WHERE company_id = $1 AND shipment_id = $2 AND type = 'missing-tracking'`,
      [a.id, ids.noLrShipment]
    );
    assert.equal(row.rows[0].status, 'resolved');
  });

  test('an alert can be dismissed', async () => {
    const res = await server.api('GET', '/alerts', { token: a.member.token });
    const target = res.json.alerts.find((x) => x.order_id === ids.overdue);
    const dismissed = await server.api('POST', `/alerts/${target.id}/dismiss`, { token: a.member.token });
    assert.equal(dismissed.status, 200);
  });
});
