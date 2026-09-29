// Landing page content (Home) managed by admins from "Website Content" in the app.
// Only edited sections are stored; the website falls back to its built-in defaults.
import fs from 'fs';
import path from 'path';
import sanitizeHtml from 'sanitize-html';
import { query } from '../config/database.js';
import { SITE_IMAGE_DIR } from '../middleware/siteImageUpload.js';
import { logAudit } from '../utils/audit.js';
import { PAID_PLAN_IDS, PLANS } from '../utils/plans.js';

export const LANDING_SECTIONS = [
  'hero', 'stats', 'inputMethods', 'features', 'howItWorks', 'pricing', 'testimonials', 'faq', 'cta', 'footer',
];
const MAX_SECTION_BYTES = 200 * 1024;
const keyFor = (section) => `landing.${section}`;

// GET /api/site-content/landing (public): { sections: { hero: {...}, ... }, updatedAt }
export const getLandingContent = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT key, content, updated_at FROM site_content WHERE key LIKE 'landing.%'`
    );
    const sections = {};
    let updatedAt = null;
    for (const row of rows) {
      const section = row.key.slice('landing.'.length);
      if (!LANDING_SECTIONS.includes(section)) continue;
      sections[section] = row.content;
      if (!updatedAt || row.updated_at > updatedAt) updatedAt = row.updated_at;
    }
    res.set('Cache-Control', 'no-cache');
    res.json({ sections, updatedAt });
  } catch (error) {
    next(error);
  }
};

// GET /api/site-content/plans (public): prices and limits for the pricing section,
// taken from the real plans so the website and Billing always match
export const getPublicPlans = (req, res) => {
  res.json({
    plans: PAID_PLAN_IDS.map((id) => ({ id, name: PLANS[id].name, price: PLANS[id].price, limits: PLANS[id].limits })),
  });
};

// PUT /api/site-content/landing/:section { content } (admin)
export const saveLandingSection = async (req, res, next) => {
  try {
    const { section } = req.params;
    if (!LANDING_SECTIONS.includes(section)) {
      return res.status(404).json({ message: 'Unknown section' });
    }
    const content = req.body?.content;
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      return res.status(400).json({ message: 'Section content is missing' });
    }
    if (Buffer.byteLength(JSON.stringify(content)) > MAX_SECTION_BYTES) {
      return res.status(400).json({ message: 'This section is too large' });
    }

    const { rows } = await query(
      `INSERT INTO site_content (key, content, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET content = EXCLUDED.content, updated_by = EXCLUDED.updated_by, updated_at = NOW()
       RETURNING content, updated_at`,
      [keyFor(section), JSON.stringify(content), req.user.id]
    );
    await logAudit(req, 'site_content.updated', { entityType: 'site_content', entityId: keyFor(section), details: { section } });
    res.json({ message: 'Section saved', section, content: rows[0].content, updatedAt: rows[0].updated_at });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/site-content/landing/:section (admin): back to the default content
export const resetLandingSection = async (req, res, next) => {
  try {
    const { section } = req.params;
    if (!LANDING_SECTIONS.includes(section)) {
      return res.status(404).json({ message: 'Unknown section' });
    }
    await query('DELETE FROM site_content WHERE key = $1', [keyFor(section)]);
    await logAudit(req, 'site_content.reset', { entityType: 'site_content', entityId: keyFor(section), details: { section } });
    res.json({ message: 'Section reset to default', section });
  } catch (error) {
    next(error);
  }
};

// ---------- Images for the website (e.g. testimonial photos) ----------

const IMAGE_NAME_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;
const IMAGE_MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

// The file's first bytes must match its type (not just its name)
const looksLikeImage = (filePath, type) => {
  let head;
  try {
    const fd = fs.openSync(filePath, 'r');
    head = Buffer.alloc(12);
    fs.readSync(fd, head, 0, 12, 0);
    fs.closeSync(fd);
  } catch {
    return false;
  }
  if (type === 'jpg') return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (type === 'png') return head.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (type === 'webp') return head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP';
  return false;
};

// POST /api/site-content/images (admin, multipart field "image") -> { path }
export const uploadSiteImage = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Please choose a photo to upload' });
    const type = path.extname(req.file.filename).slice(1);
    if (!looksLikeImage(req.file.path, type)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: 'This file is not a valid image' });
    }
    await logAudit(req, 'site_content.image_uploaded', { entityType: 'site_image', entityId: req.file.filename });
    // Path under the API; the admin page turns it into a full link
    res.status(201).json({ message: 'Photo uploaded', path: `/site-content/images/${req.file.filename}` });
  } catch (error) {
    next(error);
  }
};

// GET /api/site-content/images/:name (public): the uploaded photo
export const getSiteImage = (req, res) => {
  const { name } = req.params;
  if (!IMAGE_NAME_RE.test(name)) return res.status(404).json({ message: 'Not found' });
  const filePath = path.join(SITE_IMAGE_DIR, name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Not found' });
  res.set({
    'Content-Type': IMAGE_MIME[name.split('.').pop()],
    // The website may be on another domain than the API
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Cache-Control': 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  });
  res.sendFile(filePath);
};

// ---------- Legal pages (Website Content > CMS): Privacy Policy, Terms, Refund Policy ----------

export const LEGAL_PAGES = ['privacy', 'terms', 'refund'];
const legalKey = (page) => `legal.${page}`;
const MAX_SECTIONS = 60;

// Only simple formatting from the editor survives: no scripts, styles, images or event handlers
const cleanLegalHtml = (html) =>
  sanitizeHtml(String(html || ''), {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h3', 'h4', 'ul', 'ol', 'li', 'a'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesAppliedToAttributes: ['href'],
    allowProtocolRelative: false,
    transformTags: {
      // Links that open a new tab never get access to this page
      a: (tagName, attribs) => (attribs.target === '_blank' ? { tagName, attribs: { ...attribs, rel: 'noopener noreferrer' } } : { tagName, attribs }),
    },
  }).trim();

const cleanText = (value, max) => String(value ?? '').trim().slice(0, max);

// GET /api/site-content/legal/:page (public): { content | null, updatedAt }
export const getLegalPage = async (req, res, next) => {
  try {
    const { page } = req.params;
    if (!LEGAL_PAGES.includes(page)) return res.status(404).json({ message: 'Page not found' });
    const { rows } = await query('SELECT content, updated_at FROM site_content WHERE key = $1', [legalKey(page)]);
    res.set('Cache-Control', 'no-cache');
    res.json({ content: rows[0]?.content || null, updatedAt: rows[0]?.updated_at || null });
  } catch (error) {
    next(error);
  }
};

// PUT /api/site-content/legal/:page { content } (admin)
export const saveLegalPage = async (req, res, next) => {
  try {
    const { page } = req.params;
    if (!LEGAL_PAGES.includes(page)) return res.status(404).json({ message: 'Page not found' });
    const input = req.body?.content;
    if (!input || typeof input !== 'object' || !Array.isArray(input.sections)) {
      return res.status(400).json({ message: 'Page content is missing' });
    }
    if (input.sections.length === 0) return res.status(400).json({ message: 'Add at least one section' });
    if (input.sections.length > MAX_SECTIONS) return res.status(400).json({ message: `A page can have at most ${MAX_SECTIONS} sections` });

    const sections = input.sections.map((s) => ({ title: cleanText(s?.title, 200), html: cleanLegalHtml(s?.html) }));
    const emptyAt = sections.findIndex((s) => !s.title);
    if (emptyAt !== -1) return res.status(400).json({ message: `Section ${emptyAt + 1} needs a title` });

    const content = {
      title: cleanText(input.title, 150),
      subtitle: cleanText(input.subtitle, 300),
      contactTitle: cleanText(input.contactTitle, 150),
      contactEmail: cleanText(input.contactEmail, 200),
      // "Last updated" is the day the page is saved
      lastUpdated: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      sections,
    };
    if (!content.title) return res.status(400).json({ message: 'The page needs a title' });
    if (Buffer.byteLength(JSON.stringify(content)) > MAX_SECTION_BYTES * 2) {
      return res.status(400).json({ message: 'This page is too large' });
    }

    const { rows } = await query(
      `INSERT INTO site_content (key, content, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET content = EXCLUDED.content, updated_by = EXCLUDED.updated_by, updated_at = NOW()
       RETURNING content, updated_at`,
      [legalKey(page), JSON.stringify(content), req.user.id]
    );
    await logAudit(req, 'site_content.updated', { entityType: 'site_content', entityId: legalKey(page), details: { page } });
    res.json({ message: 'Page saved', content: rows[0].content, updatedAt: rows[0].updated_at });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/site-content/legal/:page (admin): back to the built-in content
export const resetLegalPage = async (req, res, next) => {
  try {
    const { page } = req.params;
    if (!LEGAL_PAGES.includes(page)) return res.status(404).json({ message: 'Page not found' });
    await query('DELETE FROM site_content WHERE key = $1', [legalKey(page)]);
    await logAudit(req, 'site_content.reset', { entityType: 'site_content', entityId: legalKey(page), details: { page } });
    res.json({ message: 'Page reset to default' });
  } catch (error) {
    next(error);
  }
};
