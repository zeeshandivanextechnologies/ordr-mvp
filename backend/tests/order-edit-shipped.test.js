// QA (Module 17) - Editing an order that already has shipments: the shipped quantity must
// still fit, and a shipped product cannot be renamed or removed (shipments link by product name).
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createCompany, exitWhenDone, orderBody, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('edit');
let server;
let a;
let orderId;
let body;

const order = async () => (await server.api('GET', `/orders/${orderId}`, { token: a.admin.token })).json;
const edit = (items) => server.api('PUT', `/orders/${orderId}`, { token: a.admin.token, body: { ...body, items } });

before(async () => {
  server = await startServer();
  a = await createCompany(tag, 'a');
  // 10 MT Chemical A + 5 MT Chemical B, then 6 MT of Chemical A shipped
  body = orderBody({
    poNumber: `${tag}-PO`,
    items: [
      { product: 'Chemical A', qty: '10', unit: 'MT', unitPrice: '500' },
      { product: 'Chemical B', qty: '5', unit: 'MT', unitPrice: '300' },
    ],
  });
  const res = await server.api('POST', '/orders', { token: a.admin.token, body });
  assert.equal(res.status, 201, res.text);
  orderId = res.json.order.id;
  const itemA = (await order()).items.find((i) => i.product === 'Chemical A');
  const ship = await server.api('POST', `/orders/${orderId}/shipments`, {
    token: a.member.token,
    body: { shipmentNumber: 'SHP-1', lineItems: [{ orderItemId: itemA.id, quantity: 6 }] },
  });
  assert.equal(ship.status, 201, ship.text);
});

after(async () => {
  await removeCompanies([a?.id]);
  await server.close();
  exitWhenDone();
});

describe('Edit order with shipments', () => {
  test('quantity below the dispatched quantity is blocked', async () => {
    const res = await edit([
      { product: 'Chemical A', qty: '5', unit: 'MT', unitPrice: '500' },
      { product: 'Chemical B', qty: '5', unit: 'MT', unitPrice: '300' },
    ]);
    assert.equal(res.status, 400);
    assert.match(res.json.message, /Chemical A.*6 MT already dispatched/);
    // Nothing changed
    const o = await order();
    assert.equal(Number(o.items.find((i) => i.product === 'Chemical A').quantity), 10);
    assert.equal(Number(o.items.find((i) => i.product === 'Chemical A').dispatched), 6);
  });

  test('renaming or removing a shipped product is blocked', async () => {
    const renamed = await edit([
      { product: 'Chemical A Grade 1', qty: '10', unit: 'MT', unitPrice: '500' },
      { product: 'Chemical B', qty: '5', unit: 'MT', unitPrice: '300' },
    ]);
    assert.equal(renamed.status, 400);
    assert.match(renamed.json.message, /cannot be removed or renamed/);

    const removed = await edit([{ product: 'Chemical B', qty: '5', unit: 'MT', unitPrice: '300' }]);
    assert.equal(removed.status, 400);
  });

  test('allowed edits still work: exact shipped quantity, more quantity, unshipped item changes', async () => {
    const res = await edit([
      { product: 'Chemical A', qty: '6', unit: 'MT', unitPrice: '550' },
      { product: 'Chemical B (new grade)', qty: '8', unit: 'MT', unitPrice: '300' },
      { product: 'Chemical C', qty: '2', unit: 'MT', unitPrice: '100' },
    ]);
    assert.equal(res.status, 200, res.text);
    const o = await order();
    const itemA = o.items.find((i) => i.product === 'Chemical A');
    assert.equal(Number(itemA.quantity), 6);
    assert.equal(Number(itemA.dispatched), 6);
    assert.equal(o.items.length, 3);

    // Same name with different spacing / case still counts as the same product
    const again = await edit([
      { product: '  chemical a ', qty: '12', unit: 'MT', unitPrice: '550' },
    ]);
    assert.equal(again.status, 200, again.text);
    assert.equal(Number((await order()).items[0].dispatched), 6);
  });
});
