// Performance (Module 34): Orders, Tracking and AI Inbox lists page through large data on
// the server (limit / offset, search, filters) while the old full-list response still works.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../config/database.js';
import { createCompany, exitWhenDone, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('lists');
let server;
let a;
let b;

before(async () => {
  server = await startServer();
  a = await createCompany(tag, 'a');
  b = await createCompany(tag, 'b');
  // 120 orders: 80 sales + 40 purchase, some with a legacy status spelling, each with a shipment
  await query(
    `INSERT INTO orders (company_id, created_by, order_type, party_name, po_number, status, source, total_value, updated_at)
     SELECT $1, $2, CASE WHEN g % 3 = 0 THEN 'purchase' ELSE 'sales' END, 'Party ' || g, $3 || '-' || g,
            CASE WHEN g % 10 = 0 THEN 'In Transit' WHEN g % 5 = 0 THEN 'in-transit' ELSE 'received' END,
            'Manual', 1000, NOW() - g * INTERVAL '1 minute'
     FROM generate_series(1, 120) g`,
    [a.id, a.admin.id, tag]
  );
  await query(
    `INSERT INTO order_items (order_id, company_id, product, quantity, unit, unit_price, total)
     SELECT id, company_id, CASE WHEN po_number LIKE '%-7' THEN 'Special Copper Wire' ELSE 'Steel' END, 10, 'MT', 1, 10
     FROM orders WHERE company_id = $1`,
    [a.id]
  );
  await query(
    `INSERT INTO shipments (company_id, order_id, created_by, shipment_number, lr_number, status, updated_at)
     SELECT company_id, id, $2, 'S-' || po_number, CASE WHEN po_number LIKE '%-9' THEN 'LR-99999' END,
            CASE WHEN po_number LIKE '%0' THEN 'Delivered' ELSE 'in-transit' END, updated_at
     FROM orders WHERE company_id = $1`,
    [a.id, a.admin.id]
  );
  await query(
    `INSERT INTO ai_order_extracts (company_id, status, customer_name, po_number, order_type, source_body)
     SELECT $1, (ARRAY['New','Needs Review','Confirmed','Ignored'])[1 + g % 4], 'Buyer ' || g, 'AI-' || g,
            CASE WHEN g % 2 = 0 THEN 'Purchase' ELSE 'Sales' END, 'long email body'
     FROM generate_series(1, 60) g`,
    [a.id]
  );
});

after(async () => {
  await removeCompanies([a?.id, b?.id]);
  await server.close();
  exitWhenDone();
});

const get = (path, token = a.admin.token) => server.api('GET', path, { token });

describe('Orders list', () => {
  test('without a limit the full list comes back as before', async () => {
    const res = await get('/orders');
    assert.equal(res.json.orders.length, 120);
    assert.equal(res.json.total, undefined);
  });

  test('pages of 50 with totals and tab counts, newest activity first', async () => {
    const p1 = await get('/orders?limit=50&offset=0&type=sales');
    assert.equal(p1.json.orders.length, 50);
    assert.equal(p1.json.total, 80);
    assert.deepEqual(p1.json.typeCounts, { sales: 80, purchase: 40 });
    const p2 = await get('/orders?limit=50&offset=50&type=sales');
    assert.equal(p2.json.orders.length, 30);
    const ids = new Set([...p1.json.orders, ...p2.json.orders].map((o) => o.id));
    assert.equal(ids.size, 80, 'no order appears on two pages');
    const times = p1.json.orders.map((o) => new Date(o.last_activity_at).getTime());
    assert.deepEqual(times, [...times].sort((x, y) => y - x));
    assert.ok(p1.json.orders[0].materials !== undefined && p1.json.orders[0].tracking_numbers !== undefined);
  });

  test('status filter also matches older spellings ("In Transit")', async () => {
    const res = await get('/orders?limit=200&status=in-transit');
    assert.equal(res.json.total, 24);
  });

  test('search by PO, material and LR number', async () => {
    assert.equal((await get(`/orders?limit=50&q=${tag}-11`)).json.orders.some((o) => o.po_number === `${tag}-11`), true);
    const material = await get('/orders?limit=50&q=copper');
    assert.ok(material.json.total >= 1 && material.json.orders.every((o) => /Copper/.test(o.materials)));
    const lr = await get('/orders?limit=50&q=LR-99999');
    assert.ok(lr.json.total >= 1);
  });

  test('another company sees none of these orders', async () => {
    const res = await get('/orders?limit=50', b.admin.token);
    assert.equal(res.json.total, 0);
  });
});

describe('Tracking list', () => {
  test('full list without a limit; pages, status counts and search with one', async () => {
    assert.equal((await get('/shipments')).json.shipments.length, 120);
    const page = await get('/shipments?limit=50&offset=0');
    assert.equal(page.json.shipments.length, 50);
    assert.equal(page.json.total, 120);
    assert.equal(page.json.counts.all, 120);
    assert.equal(page.json.counts.delivered, 12, '"Delivered" counts as delivered');
    const delivered = await get('/shipments?limit=50&status=delivered');
    assert.equal(delivered.json.total, 12);
    assert.ok(delivered.json.shipments.every((s) => s.status === 'delivered'));
    const lr = await get('/shipments?limit=50&q=LR-99999');
    assert.ok(lr.json.total >= 1 && lr.json.shipments.every((s) => s.lr_number === 'LR-99999'));
  });
});

describe('AI Order Inbox list', () => {
  test('the list no longer carries the email body; the detail page still does', async () => {
    const list = await get('/ai-inbox');
    assert.equal(list.json.extracts.length, 60);
    assert.equal(list.json.extracts[0].source_body, undefined);
    const detail = await get(`/ai-inbox/${list.json.extracts[0].id}`);
    assert.equal(detail.json.extract.source_body, 'long email body');
  });

  test('tabs page through one status; counts cover all detections', async () => {
    const page = await get('/ai-inbox?limit=10&status=New');
    assert.equal(page.json.extracts.length, 10);
    assert.equal(page.json.total, 15);
    assert.deepEqual(page.json.counts, { New: 15, 'Needs Review': 15, Confirmed: 15, Ignored: 15 });
    const purchase = await get('/ai-inbox?limit=50&status=New&type=purchase');
    assert.ok(purchase.json.extracts.every((e) => e.order_type === 'Purchase'));
    const search = await get('/ai-inbox?limit=50&q=AI-17');
    assert.ok(search.json.extracts.some((e) => e.po_number === 'AI-17'));
  });
});
