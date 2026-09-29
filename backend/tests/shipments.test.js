// QA (Module 37) - Shipments: the spec's partial shipment example (Modules 16-18):
// 10 MT order -> 6 MT shipment -> 4 MT balance -> second shipment -> full delivery,
// plus over-allocation prevention and editing shipment details.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createCompany, exitWhenDone, orderBody, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('ship');
let server;
let a;
let orderId;
let itemId;
let firstShipment;
let secondShipment;

const order = async () => (await server.api('GET', `/orders/${orderId}`, { token: a.admin.token })).json;
const status = async (shipmentId, value, token = a.member.token) =>
  server.api('POST', `/shipments/${shipmentId}/status`, { token, body: { status: value } });

before(async () => {
  server = await startServer();
  a = await createCompany(tag, 'a');
  const res = await server.api('POST', '/orders', { token: a.admin.token, body: orderBody({ poNumber: `${tag}-PO` }) });
  orderId = res.json.order.id;
  itemId = (await order()).items[0].id;
});

after(async () => {
  await removeCompanies([a?.id]);
  await server.close();
  exitWhenDone();
});

describe('Partial shipment (10 MT order)', () => {
  test('first shipment of 6 MT -> Partially Dispatched, 4 MT balance', async () => {
    const res = await server.api('POST', `/orders/${orderId}/shipments`, {
      token: a.member.token,
      body: { shipmentNumber: 'SHP-1', quantity: '6', transporter: 'VRL' },
    });
    assert.equal(res.status, 201, res.text);
    firstShipment = res.json.shipment.id;
    const o = await order();
    assert.equal(o.order.status, 'partially-dispatched');
    assert.equal(Number(o.items[0].dispatched), 6);
    assert.equal(Number(o.items[0].quantity) - Number(o.items[0].dispatched), 4);
  });

  test('over-allocation is blocked (5 MT when only 4 MT is left)', async () => {
    const res = await server.api('POST', `/orders/${orderId}/shipments`, {
      token: a.member.token,
      body: { shipmentNumber: 'SHP-X', quantity: '5' },
    });
    assert.equal(res.status, 400);
  });

  test('the same item listed twice cannot exceed the balance', async () => {
    const res = await server.api('POST', `/orders/${orderId}/shipments`, {
      token: a.member.token,
      body: { shipmentNumber: 'SHP-X', lineItems: [{ orderItemId: itemId, quantity: 3 }, { orderItemId: itemId, quantity: 3 }] },
    });
    assert.equal(res.status, 400);
  });

  test('a shipment needs a quantity and a new shipment number', async () => {
    const noQty = await server.api('POST', `/orders/${orderId}/shipments`, { token: a.member.token, body: { shipmentNumber: 'SHP-X' } });
    assert.equal(noQty.status, 400);
    const sameNumber = await server.api('POST', `/orders/${orderId}/shipments`, { token: a.member.token, body: { shipmentNumber: 'shp-1', quantity: '1' } });
    assert.equal(sameNumber.status, 400);
  });

  test('6 MT delivered -> Partially Delivered, 4 MT balance', async () => {
    assert.equal((await status(firstShipment, 'delivered')).status, 200);
    const o = await order();
    assert.equal(o.order.status, 'partially-delivered');
    assert.equal(Number(o.items[0].delivered), 6);
  });

  test('second shipment of 4 MT, then delivered -> Delivered, balance 0', async () => {
    const res = await server.api('POST', `/orders/${orderId}/shipments`, {
      token: a.member.token,
      body: { shipmentNumber: 'SHP-2', quantity: '4' },
    });
    assert.equal(res.status, 201, res.text);
    secondShipment = res.json.shipment.id;
    assert.equal((await status(secondShipment, 'in-transit')).status, 200);
    assert.equal((await status(secondShipment, 'delivered')).status, 200);
    const o = await order();
    assert.equal(o.order.status, 'delivered');
    assert.equal(Number(o.items[0].delivered), 10);
    assert.equal(Number(o.items[0].quantity) - Number(o.items[0].delivered), 0);
  });

  test('the full history is kept in the timeline', async () => {
    const events = (await server.api('GET', `/orders/${orderId}/events`, { token: a.admin.token })).json.trackingEvents;
    const text = events.map((e) => e.description).join(' | ');
    for (const expected of ['Shipment SHP-1 created', 'Shipment SHP-2 created', 'Partially Dispatched', 'Delivered']) {
      assert.ok(text.includes(expected), `timeline should mention "${expected}"`);
    }
  });
});

describe('Shipment details', () => {
  test('LR / transporter can be added later and are shown on the shipment', async () => {
    const res = await server.api('PATCH', `/shipments/${firstShipment}`, {
      token: a.member.token,
      body: { lrNumber: 'LR928721', expectedDeliveryDate: '2026-10-05' },
    });
    assert.equal(res.status, 200, res.text);
    const s = (await server.api('GET', `/shipments/${firstShipment}`, { token: a.member.token })).json.shipment;
    assert.equal(s.lr_number, 'LR928721');
    assert.equal(s.expected_delivery_date_value, '2026-10-05');
    assert.equal(s.shipment_number, 'SHP-1', 'the shipment number cannot be changed');
  });

  test('invalid dates and empty edits are rejected', async () => {
    const badDate = await server.api('PATCH', `/shipments/${firstShipment}`, { token: a.member.token, body: { dispatchDate: '2026-13-40' } });
    assert.equal(badDate.status, 400);
    const empty = await server.api('PATCH', `/shipments/${firstShipment}`, { token: a.member.token, body: {} });
    assert.equal(empty.status, 400);
  });

  test('a cancelled shipment cannot be edited', async () => {
    const other = await server.api('POST', '/orders', { token: a.admin.token, body: orderBody({ poNumber: `${tag}-PO-2` }) });
    const shipment = await server.api('POST', `/orders/${other.json.order.id}/shipments`, {
      token: a.member.token,
      body: { shipmentNumber: 'SHP-C', quantity: '2' },
    });
    assert.equal((await status(shipment.json.shipment.id, 'cancelled')).status, 200);
    const edit = await server.api('PATCH', `/shipments/${shipment.json.shipment.id}`, { token: a.member.token, body: { lrNumber: 'X' } });
    assert.equal(edit.status, 400);
  });
});
