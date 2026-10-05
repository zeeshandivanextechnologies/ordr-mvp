// QA (Module 21) - Email update matching: customer/supplier + date + product, and the same
// PO number used by two parties. Matching only suggests; nothing is applied here.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { matchOrderUpdate } from '../services/orderUpdateService.js';
import { createCompany, exitWhenDone, orderBody, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('match');
let server;
let a;
const ids = {};

const createOrder = async (key, overrides) => {
  const res = await server.api('POST', '/orders', { token: a.admin.token, body: orderBody({ poNumber: `${tag}-${key}`, ...overrides }) });
  assert.equal(res.status, 201, res.text);
  ids[key] = res.json.order.id;
};
const chemical = (product) => [{ product, qty: '10', unit: 'MT', unitPrice: '100' }];

before(async () => {
  server = await startServer();
  a = await createCompany(tag, 'a');

  // Same party, same product, different dates
  await createOrder('sep1', { partyName: `${tag} Dates Ltd`, orderDate: '2026-09-01', requiredDeliveryDate: '2026-09-10', items: chemical('Chemical A') });
  await createOrder('sep20', { partyName: `${tag} Dates Ltd`, orderDate: '2026-09-20', requiredDeliveryDate: '2026-09-30', items: chemical('Chemical A') });

  // Same party, both dated before the update, due on different days
  await createOrder('due5', { partyName: `${tag} Due Co`, orderDate: '2026-08-01', requiredDeliveryDate: '2026-09-05', items: chemical('Chemical B') });
  await createOrder('due25', { partyName: `${tag} Due Co`, orderDate: '2026-08-01', requiredDeliveryDate: '2026-09-25', items: chemical('Chemical B') });

  // Same party, no dates to tell them apart
  await createOrder('nodate1', { partyName: `${tag} Nodate Co`, items: chemical('Chemical C') });
  await createOrder('nodate2', { partyName: `${tag} Nodate Co`, items: chemical('Chemical C') });

  // Only one open order for this party
  await createOrder('single', { partyName: `${tag} Single Co`, orderDate: '2026-09-28', items: chemical('Chemical D') });

  // Same PO number for two different parties
  await createOrder('shared-x', { partyName: `${tag} Xylo Corp`, poNumber: `${tag}-SHARED`, items: chemical('Chemical E') });
  await createOrder('shared-y', { partyName: `${tag} Yarn Mills`, poNumber: `${tag}-SHARED`, items: chemical('Chemical E') });
});

after(async () => {
  await removeCompanies([a?.id]);
  await server.close();
  exitWhenDone();
});

describe('Party + date + product', () => {
  test('an order dated after the email cannot be meant', async () => {
    const m = await matchOrderUpdate(a.id, { party_name: `${tag} Dates Ltd`, product: 'Chemical A', update_type: 'dispatched' }, { emailDate: '2026-09-08T10:00:00Z' });
    assert.equal(m?.orderId, ids.sep1);
    assert.equal(m.method, 'party');
    assert.equal(m.confidence, 'low');
  });

  test('the date written in the email wins over the email date', async () => {
    const m = await matchOrderUpdate(a.id, { party_name: `${tag} Dates Ltd`, product: 'Chemical A', event_date: '2026-09-25', update_type: 'dispatched' }, { emailDate: '2026-09-08T10:00:00Z' });
    // Both orders exist by 25 Sep; 30 Sep is closer than 10 Sep
    assert.equal(m?.orderId, ids.sep20);
  });

  test('the order due closest to the update date is picked', async () => {
    const m = await matchOrderUpdate(a.id, { party_name: `${tag} Due Co`, product: 'Chemical B', update_type: 'dispatched' }, { emailDate: '2026-09-06T08:00:00Z' });
    assert.equal(m?.orderId, ids.due5);
  });

  test('no dates to tell orders apart: no guess, the user picks the order', async () => {
    const m = await matchOrderUpdate(a.id, { party_name: `${tag} Nodate Co`, product: 'Chemical C', update_type: 'dispatched' }, { emailDate: '2026-09-06T08:00:00Z' });
    assert.equal(m, null);
  });

  test('a single open order still matches as before, whatever the date', async () => {
    const m = await matchOrderUpdate(a.id, { party_name: `${tag} Single Co`, product: 'Chemical D', update_type: 'dispatched' }, { emailDate: '2026-09-01T08:00:00Z' });
    assert.equal(m?.orderId, ids.single);
  });
});

describe('Same PO number for two parties', () => {
  test('the party in the email picks the right order', async () => {
    const m = await matchOrderUpdate(a.id, { po_number: `${tag}-SHARED`, party_name: `${tag} Xylo Corp`, update_type: 'dispatched' });
    assert.equal(m?.orderId, ids['shared-x']);
    assert.equal(m.method, 'po');
    assert.equal(m.confidence, 'high');
  });

  test('without a party it stays a low-confidence guess, as before', async () => {
    const m = await matchOrderUpdate(a.id, { po_number: `${tag}-SHARED`, update_type: 'dispatched' });
    assert.ok([ids['shared-x'], ids['shared-y']].includes(m?.orderId));
    assert.equal(m.confidence, 'low');
  });
});
