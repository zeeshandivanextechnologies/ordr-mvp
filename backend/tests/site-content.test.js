// Website Content: landing page sections edited by admins, read by everyone.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { query } from '../config/database.js';
import { SITE_IMAGE_DIR } from '../middleware/siteImageUpload.js';
import { createCompany, exitWhenDone, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('site');
let server;
let a;

before(async () => {
  server = await startServer();
  a = await createCompany(tag, 'a');
  await query(`DELETE FROM site_content WHERE key = 'landing.hero'`);
});

after(async () => {
  await query(`DELETE FROM site_content WHERE key = 'landing.hero'`);
  await removeCompanies([a?.id]);
  await server.close();
  exitWhenDone();
});

describe('Website Content (landing page)', () => {
  test('the website reads content and real plan prices without logging in', async () => {
    const content = await server.api('GET', '/site-content/landing');
    assert.equal(content.status, 200);
    assert.equal(content.json.sections.hero, undefined, 'nothing edited yet: the website uses its defaults');

    const plans = await server.api('GET', '/site-content/plans');
    assert.deepEqual(plans.json.plans.map((p) => [p.id, p.price]), [['basic', 999], ['growth', 2499], ['business', 4999], ['pro', 9999]]);
    assert.equal(plans.json.plans[0].limits.users, 2);
  });

  test('an admin saves a section and the website shows it', async () => {
    const hero = { badge: 'Trusted by 900+ businesses', titleLine1: 'Every order.', titleHighlight: 'One place.' };
    const save = await server.api('PUT', '/site-content/landing/hero', { token: a.admin.token, body: { content: hero } });
    assert.equal(save.status, 200, save.text);
    const content = await server.api('GET', '/site-content/landing');
    assert.deepEqual(content.json.sections.hero, hero);
    const audit = await query(`SELECT action FROM audit_logs WHERE company_id = $1 AND action = 'site_content.updated'`, [a.id]);
    assert.equal(audit.rows.length, 1);
  });

  test('reset brings back the default content', async () => {
    const reset = await server.api('DELETE', '/site-content/landing/hero', { token: a.admin.token });
    assert.equal(reset.status, 200);
    const content = await server.api('GET', '/site-content/landing');
    assert.equal(content.json.sections.hero, undefined);
  });

  test('members and visitors cannot change the website', async () => {
    const body = { content: { badge: 'hacked' } };
    assert.equal((await server.api('PUT', '/site-content/landing/hero', { token: a.member.token, body })).status, 403);
    assert.equal((await server.api('PUT', '/site-content/landing/hero', { body })).status, 401);
    assert.equal((await server.api('DELETE', '/site-content/landing/hero', { token: a.member.token })).status, 403);
  });

  test('unknown sections and bad content are rejected', async () => {
    assert.equal((await server.api('PUT', '/site-content/landing/navbar', { token: a.admin.token, body: { content: {} } })).status, 404);
    assert.equal((await server.api('PUT', '/site-content/landing/hero', { token: a.admin.token, body: { content: 'text' } })).status, 400);
    const huge = { text: 'x'.repeat(210 * 1024) };
    assert.equal((await server.api('PUT', '/site-content/landing/hero', { token: a.admin.token, body: { content: huge } })).status, 400);
  });

  // Smallest valid PNG (1x1 pixel)
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const upload = (token, bytes, name) => {
    const form = new FormData();
    form.append('image', new Blob([bytes]), name);
    return server.api('POST', '/site-content/images', { token, form });
  };

  test('an admin uploads a testimonial photo and the website can show it', async () => {
    const res = await upload(a.admin.token, PNG, 'priya.png');
    assert.equal(res.status, 201, res.text);
    assert.match(res.json.path, /^\/site-content\/images\/[0-9a-f-]{36}\.png$/);

    const img = await fetch(server.baseUrl + res.json.path);
    assert.equal(img.status, 200);
    assert.equal(img.headers.get('content-type'), 'image/png');
    assert.equal(img.headers.get('cross-origin-resource-policy'), 'cross-origin');
    fs.unlinkSync(path.join(SITE_IMAGE_DIR, path.basename(res.json.path)));
  });

  test('photo upload is admin-only and only accepts real images', async () => {
    assert.equal((await upload(a.member.token, PNG, 'x.png')).status, 403);
    assert.equal((await upload(undefined, PNG, 'x.png')).status, 401);
    assert.equal((await upload(a.admin.token, Buffer.from('not an image'), 'fake.png')).status, 400);
    assert.equal((await upload(a.admin.token, PNG, 'photo.gif')).status, 400);
    assert.equal((await upload(a.admin.token, Buffer.alloc(2 * 1024 * 1024 + 10, 1), 'big.png')).status, 400);
    assert.equal((await fetch(server.baseUrl + '/site-content/images/..%2F..%2F.env')).status, 404);
  });
});
