// QA (Module 25) - Global search finds shipments by the material they carry, and results
// still say whether they are an order or a shipment.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createCompany, exitWhenDone, orderBody, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('srch');
let server;
let a;
let b;
let shipmentA;

const search = async (q, token = a.member.token) =>
  (await server.api('GET', `/search?q=${encodeURIComponent(q)}`, { token })).json;

before(async () => {
  server = await startServer();
  a = await createCompany(tag, 'a');
  b = await createCompany(tag, 'b');

  // Order with two products; the shipment carries only the first one
  const material = `${tag}Resin`;
  const res = await server.api('POST', '/orders', {
    token: a.admin.token,
    body: orderBody({
      poNumber: `${tag}-PO`,
      items: [
        { product: `${material} Alpha`, qty: '10', unit: 'MT', unitPrice: '100' },
        { product: `${tag}Other Beta`, qty: '5', unit: 'MT', unitPrice: '100' },
      ],
    }),
  });
  assert.equal(res.status, 201, res.text);
  const orderId = res.json.order.id;
  const detail = (await server.api('GET', `/orders/${orderId}`, { token: a.admin.token })).json;
  const alpha = detail.items.find((i) => i.product.endsWith('Alpha'));
  const ship = await server.api('POST', `/orders/${orderId}/shipments`, {
    token: a.member.token,
    body: { shipmentNumber: `${tag}-SHP`, lineItems: [{ orderItemId: alpha.id, quantity: 4 }], lrNumber: 'LR-1' },
  });
  assert.equal(ship.status, 201, ship.text);
  shipmentA = ship.json.shipment.id;

  // Same material name in another company
  await server.api('POST', '/orders', {
    token: b.admin.token,
    body: orderBody({ poNumber: `${tag}-B`, items: [{ product: `${material} Alpha`, qty: '1', unit: 'MT', unitPrice: '1' }] }),
  });
});

after(async () => {
  await removeCompanies([a?.id, b?.id]);
  await server.close();
  exitWhenDone();
});

describe('Global search: shipments by material', () => {
  test('a material finds the order and the shipment that carries it', async () => {
    const r = await search(`${tag}Resin`);
    assert.equal(r.orders.length, 1);
    assert.equal(r.shipments.length, 1);
    assert.equal(r.shipments[0].id, shipmentA);
    assert.match(r.shipments[0].material, /Alpha$/);
  });

  test('a product the shipment does not carry does not return the shipment', async () => {
    const r = await search(`${tag}Other`);
    assert.equal(r.orders.length, 1);
    assert.equal(r.shipments.length, 0);
  });

  test('other search fields still work (LR number, shipment number)', async () => {
    assert.equal((await search(`${tag}-SHP`)).shipments.length, 1);
    const byPo = await search(`${tag}-PO`);
    assert.equal(byPo.orders.length, 1);
    assert.equal(byPo.shipments.length, 1);
  });

  test('another company never sees these results', async () => {
    const r = await search(`${tag}Resin`, b.member.token);
    assert.equal(r.shipments.length, 0);
    assert.ok(r.orders.every((o) => o.po_number === `${tag}-B`));
  });
});
