// QA (Module 4) - Dashboard Needs Attention: one entry per order with party, material,
// quantities and days, e.g. "10 MT ordered · 6 MT dispatched · 4 MT pending".
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../config/database.js';
import { createCompany, exitWhenDone, orderBody, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('dash');
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
const dashboard = async (orderType = 'all') =>
  (await server.api('GET', `/dashboard?order_type=${orderType}`, { token: a.member.token })).json;

before(async () => {
  server = await startServer();
  a = await createCompany(tag, 'a');

  await createOrder('overdue', { partyName: 'Overdue Industries', requiredDeliveryDate: dateFromToday(-3), items: [{ product: 'Chemical A', qty: '5', unit: 'MT', unitPrice: '100' }] });

  // 10 MT ordered, 6 MT dispatched (not delivered yet)
  const partial = await createOrder('partial', { partyName: 'Partial Traders' });
  const ship = await server.api('POST', `/orders/${partial}/shipments`, {
    token: a.member.token,
    body: { shipmentNumber: 'SHP-1', quantity: '6', transporter: 'VRL', lrNumber: 'LR-1' },
  });
  assert.equal(ship.status, 201, ship.text);

  const stale = await createOrder('stale', { type: 'purchase', partyName: 'Sleepy Supplier' });
  await query(`UPDATE orders SET updated_at = NOW() - INTERVAL '10 days', created_at = NOW() - INTERVAL '10 days' WHERE id = $1`, [stale]);
  await query(`UPDATE tracking_events SET created_at = NOW() - INTERVAL '10 days' WHERE order_id = $1`, [stale]);
});

after(async () => {
  await removeCompanies([a?.id]);
  await server.close();
  exitWhenDone();
});

describe('Dashboard Needs Attention', () => {
  test('overdue order shows party, quantity + material and days overdue', async () => {
    const d = await dashboard();
    const entry = d.needsAttention.find((x) => x.orderId === ids.overdue && x.type === 'overdue');
    assert.ok(entry, JSON.stringify(d.needsAttention));
    assert.equal(entry.title, 'Overdue – Overdue Industries');
    assert.match(entry.desc, /5 MT Chemical A/);
    // 3 days (±1 around midnight, the dashboard uses the company time zone)
    assert.match(entry.desc, /[234] days overdue/);
    assert.equal(entry.link, `/app/orders/${ids.overdue}`);
  });

  test('partly dispatched order shows ordered / dispatched / pending', async () => {
    const d = await dashboard();
    const entry = d.needsAttention.find((x) => x.orderId === ids.partial && x.type === 'partial');
    assert.ok(entry, JSON.stringify(d.needsAttention));
    assert.match(entry.desc, /10 MT ordered · 6 MT dispatched · 4 MT pending/);
  });

  test('stale order shows days without update', async () => {
    const d = await dashboard();
    const entry = d.needsAttention.find((x) => x.orderId === ids.stale && x.type === 'no-update');
    assert.ok(entry, JSON.stringify(d.needsAttention));
    assert.match(entry.desc, /No update for 10 days/);
  });

  test('order type toggle filters the entries and the total', async () => {
    const d = await dashboard('purchase');
    assert.ok(d.needsAttention.every((x) => x.orderId === ids.stale));
    assert.equal(d.needsAttentionTotal, d.needsAttention.length);
    assert.ok(d.needsAttentionTotal >= 1);
  });

  test('the dashboard shows at most 5 entries and reports the full total', async () => {
    for (let i = 0; i < 6; i += 1) {
      await createOrder(`late${i}`, { requiredDeliveryDate: dateFromToday(-5) });
    }
    const d = await dashboard();
    assert.equal(d.needsAttention.length, 5);
    assert.ok(d.needsAttentionTotal > 5);
    // Every kind of problem still gets a place, not only overdue orders
    const types = new Set(d.needsAttention.map((x) => x.type));
    assert.ok(types.has('partial') && types.has('no-update'), [...types].join(','));
  });
});
