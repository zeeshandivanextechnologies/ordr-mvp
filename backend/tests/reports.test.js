// Reports (Business / Pro): "Orders by Status" with sales / purchase split and value.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../config/database.js';
import { activatePlan } from '../services/subscriptionService.js';
import { getClient } from '../config/database.js';
import { createCompany, exitWhenDone, orderBody, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('reports');
let server;
let a;

before(async () => {
  server = await startServer();
  a = await createCompany(tag, 'a');
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await activatePlan(client, a.id, 'business');
    await client.query('COMMIT');
  } finally {
    client.release();
  }
  const mk = (overrides) => server.api('POST', '/orders', { token: a.admin.token, body: orderBody(overrides) });
  await mk({ poNumber: `${tag}-1` });
  await mk({ poNumber: `${tag}-2`, type: 'purchase' });
  const third = await mk({ poNumber: `${tag}-3` });
  // A legacy status spelling is counted with the current one
  await query(`UPDATE orders SET status = 'In Transit' WHERE id = $1`, [third.json.order.id]);
  const fourth = await mk({ poNumber: `${tag}-4` });
  await query(`UPDATE orders SET status = 'in-transit' WHERE id = $1`, [fourth.json.order.id]);
});

after(async () => {
  await removeCompanies([a?.id]);
  await server.close();
  exitWhenDone();
});

describe('Reports - Orders by Status', () => {
  test('each status has orders, sales / purchase split and value, in journey order', async () => {
    const res = await server.api('GET', '/reports?months=3', { token: a.admin.token });
    assert.equal(res.status, 200, res.text);
    const rows = res.json.byStatus;
    assert.deepEqual(rows.map((r) => r.status), ['received', 'in-transit']);
    const received = rows[0];
    assert.deepEqual([received.count, received.salesOrders, received.purchaseOrders, received.value], [2, 1, 1, 10000]);
    assert.equal(rows[1].count, 2, '"In Transit" and "in-transit" are one row');
  });

  test('plans without advanced reporting are still locked', async () => {
    const b = await createCompany(tag, 'b');
    const res = await server.api('GET', '/reports', { token: b.admin.token });
    await removeCompanies([b.id]);
    assert.equal(res.status, 402);
  });
});
