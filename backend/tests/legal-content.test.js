// Website Content > CMS: Privacy Policy, Terms and Refund Policy edited with the rich-text editor.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../config/database.js';
import { createCompany, exitWhenDone, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('legal');
let server;
let a;

const page = (html) => ({
  title: 'Refund Policy',
  subtitle: 'How refunds work.',
  contactTitle: 'Need help?',
  contactEmail: 'help@ordr.example',
  sections: [{ title: 'Overview', html }],
});

before(async () => {
  server = await startServer();
  a = await createCompany(tag, 'a');
  await query(`DELETE FROM site_content WHERE key = 'legal.refund'`);
});

after(async () => {
  await query(`DELETE FROM site_content WHERE key = 'legal.refund'`);
  await removeCompanies([a?.id]);
  await server.close();
  exitWhenDone();
});

describe('CMS: legal pages', () => {
  test('nothing saved: the page shows its built-in content', async () => {
    const res = await server.api('GET', '/site-content/legal/refund');
    assert.equal(res.status, 200);
    assert.equal(res.json.content, null);
    assert.equal((await server.api('GET', '/site-content/legal/cookies')).status, 404);
  });

  test('an admin saves formatted text; scripts and unsafe links are removed', async () => {
    const html = '<p>Hello <strong>bold</strong> <a href="/terms-and-conditions">Terms</a></p>'
      + '<ul><li><p>Point</p></li></ul>'
      + '<script>alert(1)</script><p onclick="steal()">x</p><a href="javascript:alert(1)">bad</a>'
      + '<a href="https://example.com" target="_blank">out</a><img src="x" onerror="alert(1)">';
    const res = await server.api('PUT', '/site-content/legal/refund', { token: a.admin.token, body: { content: page(html) } });
    assert.equal(res.status, 200, res.text);
    const saved = res.json.content.sections[0].html;
    assert.match(saved, /<strong>bold<\/strong>/);
    assert.match(saved, /href="\/terms-and-conditions"/);
    assert.match(saved, /<ul><li><p>Point<\/p><\/li><\/ul>/);
    for (const bad of ['<script', 'onclick', 'javascript:', '<img', 'onerror']) assert.ok(!saved.includes(bad), `${bad} must be removed`);
    assert.match(saved, /target="_blank" rel="noopener noreferrer"/);
    assert.match(res.json.content.lastUpdated, /\d{1,2} [A-Z][a-z]+ \d{4}/, 'last updated is set to the save day');

    const pub = await server.api('GET', '/site-content/legal/refund');
    assert.equal(pub.json.content.title, 'Refund Policy');
  });

  test('a page needs a title and titled sections', async () => {
    const put = (content) => server.api('PUT', '/site-content/legal/refund', { token: a.admin.token, body: { content } });
    assert.equal((await put({ ...page('<p>x</p>'), title: '' })).status, 400);
    assert.equal((await put({ ...page('<p>x</p>'), sections: [] })).status, 400);
    assert.equal((await put({ ...page('<p>x</p>'), sections: [{ title: '', html: '<p>x</p>' }] })).status, 400);
  });

  test('members and visitors cannot change the pages; reset restores the default', async () => {
    const body = { content: page('<p>x</p>') };
    assert.equal((await server.api('PUT', '/site-content/legal/refund', { token: a.member.token, body })).status, 403);
    assert.equal((await server.api('PUT', '/site-content/legal/refund', { body })).status, 401);
    assert.equal((await server.api('DELETE', '/site-content/legal/refund', { token: a.admin.token })).status, 200);
    assert.equal((await server.api('GET', '/site-content/legal/refund')).json.content, null);
  });
});
