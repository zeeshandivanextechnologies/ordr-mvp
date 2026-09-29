// QA (Module 37) - Gmail + AI (Modules 7-10, 21) with a fake AI (no real Gemini calls):
// valid PO email, marketing email, duplicate email, uncertain data / missing quantity,
// confidence, human review, confirm, ignore, and an update email matched to the order.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../config/database.js';
import { prefilterEmail } from '../utils/emailPreFilter.js';
import { processPendingGmailMessages } from '../services/gmailOrderProcessor.js';
import { clearAiMock, createCompany, exitWhenDone, mockAi, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('gmail');
const PO = `${tag}-PO-77`;
let server;
let a;
let connectionId;

const addEmail = async (messageId, { subject, body, threadId = messageId, sender = 'buyer@steelsupplier.example' }) => {
  const pre = prefilterEmail({ subject, body, sender, attachmentNames: [] });
  await query(
    `INSERT INTO gmail_messages (company_id, email_connection_id, message_id, thread_id, sender_email, sender_name,
       subject, body, received_at, is_potential_order, prefilter_reason, processed)
     VALUES ($1, $2, $3, $4, $5, 'Steel Supplier', $6, $7, NOW(), $8, $9, false)`,
    [a.id, connectionId, `${tag}-${messageId}`, `${tag}-${threadId}`, sender, subject, body, pre.isPotentialOrder, pre.reason]
  );
  return pre;
};
const detections = async () =>
  (await query('SELECT * FROM ai_order_extracts WHERE company_id = $1 ORDER BY created_at', [a.id])).rows;

before(async () => {
  server = await startServer();
  a = await createCompany(tag, 'a');
  const conn = await query(
    `INSERT INTO email_connections (company_id, user_id, provider, email, is_active) VALUES ($1, $2, 'gmail', $3, true) RETURNING id`,
    [a.id, a.admin.id, `${tag}@gmail.example`]
  );
  connectionId = conn.rows[0].id;

  // Fake AI answers, chosen by what the email says
  mockAi({
    'AI Classification': (parts) => {
      // parts[0] is the prompt (it mentions every category), the last part is the email itself
      const text = parts[parts.length - 1].text || '';
      if (/dispatched/i.test(text)) return { classification: 'Dispatch Update', confidence: 92, reason: 'Dispatch details' };
      return { classification: 'New Purchase Order', confidence: 90, reason: 'A purchase order' };
    },
    'AI Extraction': {
      order_type: 'purchase',
      party_name: 'Steel Supplier Pvt Ltd',
      po_number: PO,
      currency: 'INR',
      total_value: null,
      // The email does not say the quantity: the AI must return null, never a guess
      items: [{ product: 'Steel Rod 12mm', quantity: null, unit: 'MT', unit_price: 52000, confidence: 55 }],
      field_confidence: { order_type: 90, party_name: 95, po_number: 99, items: 50 },
      confidence: 62,
    },
    'AI Update Extraction': { po_number: PO, update_type: 'dispatched', lr_number: 'LR-5566', transporter: 'VRL', quantity: 3, unit: 'MT', confidence: 90 },
  });
});

after(async () => {
  clearAiMock();
  await removeCompanies([a?.id]);
  await server.close();
  exitWhenDone();
});

describe('Email pre-filter (before any AI cost)', () => {
  test('a purchase order email is a potential order', () => {
    const r = prefilterEmail({ subject: `Purchase Order ${PO}`, body: 'Please supply 5 MT steel rods. PO attached.', sender: 'buyer@x.example', attachmentNames: ['PO.pdf'] });
    assert.equal(r.isPotentialOrder, true);
  });

  test('a marketing newsletter is filtered out', () => {
    const r = prefilterEmail({ subject: 'Big Diwali sale - 50% off', body: 'Unsubscribe from our newsletter', sender: 'newsletter@shop.example', attachmentNames: [] });
    assert.equal(r.isPotentialOrder, false);
    assert.equal(r.reason, 'marketing');
  });
});

describe('Gmail -> AI -> AI Order Inbox', () => {
  test('a valid PO email becomes a detection that needs review (missing quantity, low confidence)', async () => {
    const pre = await addEmail('m1', { subject: `Purchase Order ${PO}`, body: `Dear team, please find our purchase order ${PO} for Steel Rod 12mm at Rs 52000 per MT.` });
    assert.equal(pre.isPotentialOrder, true);
    // A newsletter that the pre-filter skipped never reaches the AI
    await addEmail('m2', { subject: 'Weekly newsletter', body: 'Latest offers, unsubscribe here', sender: 'newsletter@promo.example' });

    const summary = await processPendingGmailMessages(a.id);
    assert.equal(summary.created, 1);

    const [d] = await detections();
    assert.equal(d.po_number, PO);
    assert.equal(d.status, 'Needs Review', 'confidence 62 is below the review threshold');
    assert.equal(d.confidence, 62);
    assert.equal(d.line_items[0].quantity, null, 'a missing quantity stays empty (never invented)');
    assert.equal(d.order_id, null, 'AI never creates an official order by itself');
  });

  test('scanning the same email again does not create a duplicate', async () => {
    await processPendingGmailMessages(a.id);
    assert.equal((await detections()).length, 1);
    await assert.rejects(
      addEmail('m1', { subject: 'same message again', body: 'x' }),
      /duplicate key/,
      'company + Gmail message id is unique'
    );
  });

  test('confirming needs a quantity; after the human fixes it the order is created', async () => {
    const [d] = await detections();
    const blocked = await server.api('POST', `/ai-inbox/${d.id}/confirm`, { token: a.member.token });
    assert.equal(blocked.status, 400);

    const fixed = await server.api('PATCH', `/ai-inbox/${d.id}`, {
      token: a.member.token,
      body: { line_items: [{ product: 'Steel Rod 12mm', quantity: 5, unit: 'MT', unit_price: 52000 }] },
    });
    assert.equal(fixed.status, 200, fixed.text);

    const confirmed = await server.api('POST', `/ai-inbox/${d.id}/confirm`, { token: a.member.token });
    assert.equal(confirmed.status, 201, confirmed.text);
    assert.equal(confirmed.json.order.source, 'AI Extract');
    const after = (await detections())[0];
    assert.equal(after.status, 'Confirmed');
    assert.equal(after.order_id, confirmed.json.order.id);
  });

  test('a detection can be ignored', async () => {
    const other = await query(
      `INSERT INTO ai_order_extracts (company_id, status, customer_name, po_number) VALUES ($1, 'New', 'Someone', 'PO-IGNORE') RETURNING id`,
      [a.id]
    );
    const res = await server.api('POST', `/ai-detections/${other.rows[0].id}/ignore`, { token: a.member.token });
    assert.equal(res.status, 200);
    const row = (await query('SELECT status FROM ai_order_extracts WHERE id = $1', [other.rows[0].id])).rows[0];
    assert.equal(row.status, 'Ignored');
  });

  test('a dispatch email for the order becomes a suggestion matched by PO, and applying it creates the shipment', async () => {
    await addEmail('m3', { subject: `PO ${PO} dispatched`, body: `Material for PO ${PO} dispatched today. LR No. LR-5566 via VRL.` });
    await processPendingGmailMessages(a.id);

    const list = await server.api('GET', '/ai-inbox/updates', { token: a.member.token });
    const suggestion = list.json.updates[0];
    assert.equal(suggestion.update_type, 'dispatched');
    assert.equal(suggestion.match_method, 'po');
    assert.equal(suggestion.match_confidence, 'high');
    assert.equal(suggestion.status, 'Pending', 'nothing changes until a user applies it');

    const apply = await server.api('POST', `/ai-inbox/updates/${suggestion.id}/apply`, {
      token: a.member.token,
      body: { shipmentId: 'new', shipmentNumber: 'LR-5566', quantity: 3, lrNumber: 'LR-5566', transporter: 'VRL' },
    });
    assert.equal(apply.status, 200, apply.text);
    const order = await server.api('GET', `/orders/${apply.json.orderId}`, { token: a.member.token });
    assert.equal(order.json.order.status, 'partially-dispatched');
    assert.equal(order.json.shipments[0].lr_number, 'LR-5566');
  });
});
