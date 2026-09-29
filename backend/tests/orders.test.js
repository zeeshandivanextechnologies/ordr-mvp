// QA (Module 37) - Orders: manual sales / purchase orders, multiple line items, edit, search.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createCompany, exitWhenDone, orderBody, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('orders');
let server;
let a;
let b;

before(async () => {
  server = await startServer();
  a = await createCompany(tag, 'a');
  b = await createCompany(tag, 'b');
});

after(async () => {
  await removeCompanies([a?.id, b?.id]);
  await server.close();
  exitWhenDone();
});

describe('Manual orders', () => {
  let salesId;

  test('manual sales order with several line items', async () => {
    const res = await server.api('POST', '/orders', {
      token: a.member.token,
      body: orderBody({
        poNumber: `${tag}-SO-1`,
        items: [
          { product: 'Chemical A', qty: '10', unit: 'MT', unitPrice: '500' },
          { product: 'Drum 200L', qty: '40', unit: 'Nos', unitPrice: '25.5' },
        ],
      }),
    });
    assert.equal(res.status, 201, res.text);
    salesId = res.json.order.id;
    assert.equal(res.json.order.order_type, 'sales');
    assert.equal(res.json.order.source, 'Manual');

    const detail = await server.api('GET', `/orders/${salesId}`, { token: a.member.token });
    assert.equal(detail.json.items.length, 2);
    assert.equal(Number(detail.json.order.total_value), 10 * 500 + 40 * 25.5);
    assert.ok(detail.json.trackingEvents.length >= 1, 'an initial tracking event is created');
  });

  test('manual purchase order', async () => {
    const res = await server.api('POST', '/orders', {
      token: a.admin.token,
      body: orderBody({ type: 'purchase', partyName: 'Steel Supplier Pvt Ltd', poNumber: `${tag}-PO-1` }),
    });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.json.order.order_type, 'purchase');
  });

  test('an order needs a customer/supplier, a PO number and a valid line', async () => {
    const noParty = await server.api('POST', '/orders', { token: a.admin.token, body: orderBody({ partyName: '' }) });
    assert.equal(noParty.status, 400);
    const noQty = await server.api('POST', '/orders', {
      token: a.admin.token,
      body: orderBody({ items: [{ product: 'Chemical A', qty: '0', unit: 'MT' }] }),
    });
    assert.equal(noQty.status, 400);
  });

  test('an admin can edit an order; a member cannot', async () => {
    const edited = orderBody({
      poNumber: `${tag}-SO-1`,
      partyName: 'ABC Industries Ltd',
      items: [{ product: 'Chemical A', qty: '12', unit: 'MT', unitPrice: '500' }],
    });
    const byMember = await server.api('PUT', `/orders/${salesId}`, { token: a.member.token, body: edited });
    assert.equal(byMember.status, 403);

    const byAdmin = await server.api('PUT', `/orders/${salesId}`, { token: a.admin.token, body: edited });
    assert.equal(byAdmin.status, 200, byAdmin.text);
    const detail = await server.api('GET', `/orders/${salesId}`, { token: a.admin.token });
    assert.equal(detail.json.order.party_name, 'ABC Industries Ltd');
    assert.equal(detail.json.items.length, 1);
    assert.equal(Number(detail.json.items[0].quantity), 12);
  });

  test('the orders list has both sales and purchase orders', async () => {
    const res = await server.api('GET', '/orders', { token: a.member.token });
    const types = new Set(res.json.orders.map((o) => o.order_type));
    assert.ok(types.has('sales') && types.has('purchase'));
  });
});

describe('Search', () => {
  test('finds orders by PO, customer and material', async () => {
    for (const q of [`${tag}-SO-1`, 'ABC Industries Ltd', 'Chemical A']) {
      const res = await server.api('GET', `/search?q=${encodeURIComponent(q)}`, { token: a.member.token });
      assert.equal(res.status, 200);
      assert.ok(res.json.orders.some((o) => o.po_number === `${tag}-SO-1`), `"${q}" should find the order`);
    }
  });

  test('another company finds nothing of it', async () => {
    const res = await server.api('GET', `/search?q=${encodeURIComponent(`${tag}-SO-1`)}`, { token: b.admin.token });
    assert.equal(res.json.orders.length, 0);
    assert.equal(res.json.shipments.length, 0);
  });

  test('very short or special-character searches are safe', async () => {
    const short = await server.api('GET', '/search?q=a', { token: a.admin.token });
    assert.deepEqual([short.json.orders.length, short.json.shipments.length], [0, 0]);
    const special = await server.api('GET', `/search?q=${encodeURIComponent("100%_'")}`, { token: a.admin.token });
    assert.equal(special.status, 200);
  });
});
