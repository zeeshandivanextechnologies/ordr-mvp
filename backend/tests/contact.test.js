// Contact Us form (public): validation, spam trap and delivery to the team inbox.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../config/database.js';
import { exitWhenDone, startServer, uniqueTag } from './helpers.js';

let server;
const tag = uniqueTag('contact');
const valid = { name: 'Priya Shah', email: `${tag}@buyer.example`, company: 'Shah Traders', topic: 'Product demo', message: 'Hi' }; // a short message is fine (no minimum length)

before(async () => {
  process.env.CONTACT_INBOX = 'team@ordr.example';
  server = await startServer();
});

after(async () => {
  await query('DELETE FROM contact_messages WHERE email = $1', [valid.email]);
  await server.close();
  exitWhenDone();
});

describe('Contact Us form', () => {
  test('contact details and topics come from the server (with defaults)', async () => {
    const res = await server.api('GET', '/contact/info');
    assert.equal(res.status, 200);
    assert.equal(res.json.email, process.env.CONTACT_EMAIL || 'hello@ordr.in');
    assert.match(res.json.phoneLink, /^tel:\+?\d+$/);
    assert.ok(res.json.address && res.json.hours);
    assert.ok(res.json.topics.includes('Product demo'));
  });

  test('a valid message is accepted without logging in, saved and emailed', async () => {
    const res = await server.api('POST', '/contact', { body: valid });
    assert.equal(res.status, 200, res.text);
    assert.match(res.json.message, /get back to you/);
    const row = (await query('SELECT name, topic, message, email_sent FROM contact_messages WHERE email = $1', [valid.email])).rows[0];
    assert.equal(row.name, 'Priya Shah');
    assert.equal(row.topic, 'Product demo');
    assert.equal(row.email_sent, true);
  });

  test('name, a valid email and a message are required (a short message is fine)', async () => {
    assert.equal((await server.api('POST', '/contact', { body: { ...valid, name: '' } })).status, 400);
    assert.equal((await server.api('POST', '/contact', { body: { ...valid, email: 'not-an-email' } })).status, 400);
    assert.equal((await server.api('POST', '/contact', { body: { ...valid, message: '   ' } })).status, 400);
  });

  test('bots that fill the hidden field get a normal answer but nothing is saved or sent', async () => {
    const before = (await query('SELECT COUNT(*)::int AS c FROM contact_messages WHERE email = $1', [valid.email])).rows[0].c;
    const res = await server.api('POST', '/contact', { body: { ...valid, website: 'http://spam.example' } });
    assert.equal(res.status, 200);
    const afterCount = (await query('SELECT COUNT(*)::int AS c FROM contact_messages WHERE email = $1', [valid.email])).rows[0].c;
    assert.equal(afterCount, before);
  });

  test('too many messages from one visitor are limited', async () => {
    let last;
    for (let i = 0; i < 6; i += 1) last = await server.api('POST', '/contact', { body: valid });
    assert.equal(last.status, 429);
  });
});
