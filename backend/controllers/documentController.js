import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { query } from '../config/database.js';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

// Limits for the on-page table preview of spreadsheets
const PREVIEW_MAX_ROWS = 200;
const PREVIEW_MAX_COLS = 30;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads');

const CONTENT_TYPES = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// Loads a company's document and its safe on-disk path. Sends a 404 and returns null if unavailable.
const loadDocument = async (req, res) => {
  const { rows } = await query(
    'SELECT file_name, file_path, file_type FROM po_documents WHERE id = $1 AND company_id = $2',
    [req.params.id, req.user.company_id]
  );
  const doc = rows[0];
  if (!doc) {
    res.status(404).json({ message: 'Document not found' });
    return null;
  }
  // Never serve anything outside the uploads folder
  const filePath = path.resolve(doc.file_path);
  if (!filePath.startsWith(UPLOADS_ROOT + path.sep) || !fs.existsSync(filePath)) {
    res.status(404).json({ message: 'File is no longer available' });
    return null;
  }
  return { doc, filePath };
};

// Table preview of a CSV / Excel document: { sheets: [{ name, rows, truncated }] }
export const getDocumentPreview = async (req, res, next) => {
  try {
    const loaded = await loadDocument(req, res);
    if (!loaded) return;
    const { doc, filePath } = loaded;

    const ext = String(doc.file_type || path.extname(doc.file_name).slice(1)).toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx') {
      return res.status(400).json({ message: 'Table preview is only available for CSV and Excel files' });
    }

    const workbook = ext === 'csv'
      ? XLSX.read(fs.readFileSync(filePath, 'utf8').replace(/^﻿/, ''), { type: 'string', raw: true })
      : XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: true });

    const sheets = workbook.SheetNames.map((name) => {
      const all = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: false, defval: '', blankrows: false });
      const rows = all
        .slice(0, PREVIEW_MAX_ROWS)
        .map((row) => row.slice(0, PREVIEW_MAX_COLS).map((cell) => String(cell ?? '')));
      return { name, rows, truncated: all.length > PREVIEW_MAX_ROWS };
    });

    res.json({ sheets });
  } catch (error) {
    next(error);
  }
};

// Streams a stored order document (uploaded PO or Gmail attachment).
// Only documents of the user's own company are served; ?download=1 forces a download.
export const getDocumentFile = async (req, res, next) => {
  try {
    const loaded = await loadDocument(req, res);
    if (!loaded) return;
    const { doc, filePath } = loaded;

    const ext = String(doc.file_type || path.extname(doc.file_name).slice(1)).toLowerCase();
    const disposition = req.query.download === '1' ? 'attachment' : 'inline';
    const safeName = String(doc.file_name).replace(/["\r\n]/g, '');

    res.setHeader('Content-Type', CONTENT_TYPES[ext] || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${safeName.replace(/[^\x20-\x7E]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(safeName)}`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    fs.createReadStream(filePath).on('error', next).pipe(res);
  } catch (error) {
    next(error);
  }
};
