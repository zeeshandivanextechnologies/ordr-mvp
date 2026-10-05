// QA (Module 37 / 8 / 32) - AI classification "Not an Order" (fake AI, no real Gemini calls):
// such an email creates no AI Inbox entry and no update suggestion, is marked processed,
// and never reaches the (more expensive) extraction step.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../config/database.js';
import { prefilterEmail } from '../utils/emailPreFilter.js';
import { processPendingGmailMessages } from '../services/gmailOrderProcessor.js';
import { clearAiMock, createCompany, exitWhenDone, mockAi, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('notorder');
let server;
let a;
let connectionId;

// How often each AI step was called
const calls = { classification: 0, extraction: 0, update: 0 };

const addEmail = async (messageId, { subject, body }) => {
  const sender = 'someone@partner.example';
  const pre = prefilterEmail({ subject, body, sender, attachmentNames: [] });
  await query(
    `INSERT INTO gmail_messages (company_id, email_connection_id, message_id, thread_id, sender_email, sender_name,
       subject, body, received_at, is_potential_order, prefilter_reason, processed)
     VALUES ($1, $2, $3, $3, $4, 'Partner', $5, $6, NOW(), $7, $8, false)`,
    [a.id, connectionId, `${tag}-${messageId}`, sender, subject, body, pre.isPotentialOrder, pre.reason]
  );
  return pre;
};
const message = async (messageId) =>
  (await query('SELECT * FROM gmail_messages WHERE company_id = $1 AND message_id = $2', [a.id, `${tag}-${messageId}`])).rows[0];
const count = async (table) =>
  (await query(`SELECT COUNT(*)::int AS c FROM ${table} WHERE company_id = $1`, [a.id])).rows[0].c;

before(async () => {
  server = await startServer();
  a = await createCompany(tag, 'a');
  const conn = await query(
    `INSERT INTO email_connections (company_id, user_id, provider, email, is_active) VALUES ($1, $2, 'gmail', $3, true) RETURNING id`,
    [a.id, a.admin.id, `${tag}@gmail.example`]
  );
  connectionId = conn.rows[0].id;

  // Fake AI: the answer depends on a marker word in the email
  mockAi({
    'AI Classification': (parts) => {
      calls.classification += 1;
      const text = parts[parts.length - 1].text || '';
      if (/MEETING/.test(text)) return { classification: 'Not an Order', confidence: 88, reason: 'A meeting invite about orders' };
      if (/ODDANSWER/.test(text)) return { classification: 'Spam', confidence: 70, reason: 'Unknown category' };
      return { classification: 'New Sales Order', confidence: 90, reason: 'A sales order' };
    },
    'AI Extraction': () => {
      calls.extraction += 1;
      return { order_type: 'sales', party_name: `${tag} Buyer`, po_number: `${tag}-SO-1`, items: [{ product: 'Chemical A', quantity: 5, unit: 'MT' }], confidence: 90 };
    },
    'AI Update Extraction': () => {
      calls.update += 1;
      return null;
    },
  });
});

after(async () => {
  clearAiMock();
  await removeCompanies([a?.id]);
  await server.close();
  exitWhenDone();
});

describe('AI classification: Not an Order', () => {
  test('a "Not an Order" email creates nothing, is marked processed and skips extraction', async () => {
    // Mentions a PO, so it passes the keyword pre-filter and reaches the AI
    const pre = await addEmail('meeting', {
      subject: 'MEETING about purchase order PO 4455',
      body: 'Hi, can we meet tomorrow at 3 pm to discuss the purchase order PO 4455 dispatch schedule? MEETING invite attached.',
    });
    assert.equal(pre.isPotentialOrder, true, 'the email must reach the AI for this test');

    const summary = await processPendingGmailMessages(a.id);
    assert.equal(summary.created, 0);
    assert.equal(summary.classified, 1);

    assert.equal(await count('ai_order_extracts'), 0, 'no AI Inbox entry');
    assert.equal(await count('order_update_suggestions'), 0, 'no update suggestion');
    assert.equal(calls.classification, 1);
    assert.equal(calls.extraction, 0, 'the extraction model is never called (Module 32 cost control)');
    assert.equal(calls.update, 0);

    const m = await message('meeting');
    assert.equal(m.processed, true);
    assert.equal(m.ai_classification, 'Not an Order');
    assert.equal(m.ai_confidence, 88);
    assert.equal(m.ai_error, null);
  });

  test('an unknown category from the AI is treated as "Not an Order"', async () => {
    await addEmail('odd', {
      subject: 'ODDANSWER purchase order PO 7788 query',
      body: 'Question about purchase order PO 7788 quantity. ODDANSWER',
    });
    await processPendingGmailMessages(a.id);
    const m = await message('odd');
    assert.equal(m.processed, true);
    assert.equal(m.ai_classification, 'Not an Order');
    assert.equal(await count('ai_order_extracts'), 0);
    assert.equal(calls.extraction, 0);
  });

  test('a processed "Not an Order" email is not sent to the AI again', async () => {
    const before = calls.classification;
    await processPendingGmailMessages(a.id);
    assert.equal(calls.classification, before);
  });

  test('a real order in the same inbox still becomes an AI Inbox entry', async () => {
    await addEmail('order', {
      subject: `Sales order ${tag}-SO-1`,
      body: `Please find our purchase order ${tag}-SO-1 for 5 MT Chemical A.`,
    });
    const summary = await processPendingGmailMessages(a.id);
    assert.equal(summary.created, 1);
    assert.equal(await count('ai_order_extracts'), 1);
    assert.equal(calls.extraction, 1);
  });
});
