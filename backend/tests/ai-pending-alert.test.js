// QA (Module 22 / 23) - "AI Review Pending" alert: an AI Inbox entry (New / Needs Review)
// waiting more than 24 hours raises one alert, which resolves itself once the entry is handled.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../config/database.js';
import { refreshCompanyAlerts } from '../services/alertService.js';
import { createCompany, exitWhenDone, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('aipend');
let server;
let a;
const ids = {};

const addDetection = async (key, { hoursAgo, status = 'New' }) => {
  const res = await query(
    `INSERT INTO ai_order_extracts (company_id, customer_name, po_number, order_type, confidence, status, created_at)
     VALUES ($1, $2, $3, 'Purchase', 80, $4, NOW() - ($5 || ' hours')::interval) RETURNING id`,
    [a.id, `${tag} Party`, `${tag}-${key}`, status, String(hoursAgo)]
  );
  ids[key] = res.rows[0].id;
};
const aiAlerts = async () =>
  (await query(`SELECT * FROM alerts WHERE company_id = $1 AND type = 'ai-pending' ORDER BY created_at`, [a.id])).rows;
const openFor = async (key) => (await aiAlerts()).filter((x) => x.po_number === `${tag}-${key}` && x.status === 'open');

before(async () => {
  server = await startServer();
  a = await createCompany(tag, 'a');
  await addDetection('old', { hoursAgo: 25 });
  await addDetection('review', { hoursAgo: 50, status: 'Needs Review' });
  await addDetection('fresh', { hoursAgo: 2 });
  await addDetection('confirmed', { hoursAgo: 30, status: 'Confirmed' });
  await addDetection('ignored', { hoursAgo: 30, status: 'Ignored' });
  await refreshCompanyAlerts(a.id);
});

after(async () => {
  await removeCompanies([a?.id]);
  await server.close();
  exitWhenDone();
});

describe('AI Review Pending alert', () => {
  test('entries waiting over 24 hours raise an alert (New and Needs Review)', async () => {
    const [old] = await openFor('old');
    assert.ok(old, 'alert for the 25-hour-old entry');
    assert.equal(old.severity, 'info');
    assert.equal(old.title, 'AI Review Pending');
    assert.equal(old.link, `/app/ai-inbox/${ids.old}/review`);
    assert.match(old.description, /waiting for review for 1 day/);

    const [review] = await openFor('review');
    assert.ok(review, 'alert for the Needs Review entry');
    assert.match(review.description, /2 days/);
  });

  test('recent, confirmed and ignored entries raise no alert', async () => {
    assert.equal((await openFor('fresh')).length, 0);
    assert.equal((await openFor('confirmed')).length, 0);
    assert.equal((await openFor('ignored')).length, 0);
  });

  test('refreshing again does not create duplicates', async () => {
    const before = (await aiAlerts()).length;
    await refreshCompanyAlerts(a.id);
    await refreshCompanyAlerts(a.id);
    assert.equal((await aiAlerts()).length, before);
  });

  test('the alert shows on the Alerts page for members', async () => {
    const res = await server.api('GET', '/alerts', { token: a.member.token });
    assert.equal(res.status, 200);
    assert.ok(res.json.alerts.some((x) => x.type === 'ai-pending' && x.po_number === `${tag}-old` && x.status === 'open'));
  });

  test('once the entry is handled, its alert resolves by itself', async () => {
    await query(`UPDATE ai_order_extracts SET status = 'Ignored' WHERE id = $1`, [ids.old]);
    await refreshCompanyAlerts(a.id);
    assert.equal((await openFor('old')).length, 0);
    const resolved = (await aiAlerts()).find((x) => x.po_number === `${tag}-old`);
    assert.equal(resolved.status, 'resolved');
    assert.equal(resolved.auto_resolved, true);
    // The other waiting entry still has its alert
    assert.equal((await openFor('review')).length, 1);
  });
});
