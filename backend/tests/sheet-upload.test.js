// QA (Module 11) - Excel / CSV upload: structured sheets are read directly and only sent to
// the AI when the sheet alone is not enough.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { extractOrder, parseOrderList, parseStructuredRows } from '../utils/orderExtraction.js';
import { clearAiMock, createCompany, exitWhenDone, mockAi, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('sheet');
let server;
let a;
let aiCalls = 0;

// Counts AI extraction calls; answers with a fixed order (or nothing when aiAnswer is null)
let aiAnswer = null;
const useAi = () => {
  mockAi({
    'AI Extraction': () => {
      aiCalls += 1;
      return aiAnswer;
    },
  });
};

const uploadCsv = (csv, name) => {
  const form = new FormData();
  form.append('file', new Blob([csv], { type: 'text/csv' }), name);
  return server.api('POST', '/orders/upload', { token: a.member.token, form });
};
const detection = async (id) => (await server.api('GET', `/ai-inbox/${id}`, { token: a.member.token })).json;
const firstDetectionFor = async (poOrParty) => {
  const res = await server.api('GET', `/ai-inbox?q=${encodeURIComponent(poOrParty)}`, { token: a.member.token });
  return res.json.extracts?.[0] || res.json.detections?.[0] || res.json.items?.[0] || null;
};

before(async () => {
  server = await startServer();
  a = await createCompany(tag, 'a');
  useAi();
});

after(async () => {
  clearAiMock();
  await removeCompanies([a?.id]);
  await server.close();
  exitWhenDone();
});

describe('Sheet parsing (no AI)', () => {
  test('labels like "Buyer\'s Name" and "PO Ref No" are recognised', () => {
    const { fields } = parseStructuredRows([
      ["Buyer's Name", 'ABC Industries'],
      ['PO Ref No', 'ABC/1092'],
      [],
      ['Product', 'Qty', 'Unit'],
      ['Chemical A', '5', 'MT'],
    ]);
    assert.equal(fields.party_name, 'ABC Industries');
    assert.equal(fields.po_number, 'ABC/1092');
  });

  test('"Qty (MT)" header gives the unit when there is no Unit column', () => {
    const { items } = parseStructuredRows([
      ['Product', 'Qty (MT)', 'Rate'],
      ['Chemical A', '10', '500'],
    ]);
    assert.equal(items[0].quantity, '10');
    assert.equal(items[0].unit, 'MT');
  });

  test('order list still needs 2+ POs by default; a single-order register is found on request', () => {
    const rows = [
      ['PO Number', 'Customer', 'Product', 'Qty', 'Unit'],
      ['PO-1', 'ABC Industries', 'Chemical A', '10', 'MT'],
      ['PO-1', 'ABC Industries', 'Chemical B', '4', 'MT'],
    ];
    assert.equal(parseOrderList(rows), null);
    const single = parseOrderList(rows, { minOrders: 1, requireItemColumns: true });
    assert.equal(single.length, 1);
    assert.equal(single[0].po_number, 'PO-1');
    assert.equal(single[0].items.length, 2);
  });

  test('Gmail attachments (with email text) with a missing party still go to the AI', async () => {
    aiCalls = 0;
    aiAnswer = { party_name: 'From Email Ltd', po_number: 'PO-9', items: [], confidence: 80 };
    const structured = { fields: { po_number: 'PO-9' }, items: [{ product: 'Chemical A', quantity: '5', unit: 'MT' }] };
    const result = await extractOrder({ content: { text: 'x', structured }, extraText: 'From: someone\nSubject: PO-9' });
    assert.equal(aiCalls, 1);
    assert.equal(result.usedAi, true);
    assert.equal(result.raw.party_name, 'From Email Ltd');
    // Items read from the sheet are kept
    assert.equal(result.raw.items[0].product, 'Chemical A');
  });
});

describe('Excel / CSV upload', () => {
  test('complete sheet: read directly, no AI, lands in New', async () => {
    aiCalls = 0;
    const csv = `Customer,${tag} Complete Ltd\nPO No,${tag}-C1\n\nProduct,Qty,Unit,Rate\nChemical A,10,MT,500\n`;
    const res = await uploadCsv(csv, 'complete.csv');
    assert.equal(res.status, 201, res.text);
    assert.equal(res.json.extractCount, 1);
    assert.equal(aiCalls, 0);
    const d = await firstDetectionFor(`${tag}-C1`);
    assert.ok(d, 'detection not found');
    assert.equal(d.status, 'New');
  });

  test('single-order register sheet (PO / Customer as columns): read directly, no AI', async () => {
    aiCalls = 0;
    const csv = `PO Number,Customer,Product,Qty,Unit\n${tag}-R1,${tag} Register Ltd,Chemical A,10,MT\n${tag}-R1,${tag} Register Ltd,Chemical B,4,MT\n`;
    const res = await uploadCsv(csv, 'register.csv');
    assert.equal(res.status, 201, res.text);
    assert.equal(res.json.extractCount, 1);
    assert.equal(aiCalls, 0);
    const d = await firstDetectionFor(`${tag}-R1`);
    assert.ok(d, 'detection not found');
    const full = await detection(d.id);
    const extract = full.extract || full.detection || full;
    assert.equal(extract.customer_name, `${tag} Register Ltd`);
    assert.equal((extract.line_items || []).length, 2);
  });

  test('party missing: items + PO read directly, no AI, lands in Needs Review', async () => {
    aiCalls = 0;
    const csv = `PO No,${tag}-P1\n\nProduct,Qty,Unit\nChemical A,6,MT\n`;
    const res = await uploadCsv(csv, 'no-party.csv');
    assert.equal(res.status, 201, res.text);
    assert.equal(res.json.extractCount, 1);
    assert.equal(aiCalls, 0);
    const d = await firstDetectionFor(`${tag}-P1`);
    assert.ok(d, 'detection not found');
    assert.equal(d.status, 'Needs Review');
  });

  test('neither PO nor party: goes to the AI; if the AI fails the read items are kept', async () => {
    aiCalls = 0;
    aiAnswer = null; // AI gives nothing
    const csv = `Product,Qty,Unit\n${tag} Special Chemical,3,MT\n`;
    const res = await uploadCsv(csv, 'items-only.csv');
    assert.equal(res.status, 201, res.text);
    assert.equal(aiCalls, 1);
    assert.equal(res.json.extractCount, 1);
    assert.equal(res.json.aiBusy, false);
  });
});
