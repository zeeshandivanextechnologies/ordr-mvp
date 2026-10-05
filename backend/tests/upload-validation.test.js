// QA (Module 37 / 11 / 33) - PO upload validation: only PDF / XLSX / CSV / JPG / PNG,
// at most 10 MB, and the file content must match its extension. Rejected files are not kept.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../config/database.js';
import { clearAiMock, createCompany, exitWhenDone, mockAi, removeCompanies, startServer, uniqueTag } from './helpers.js';

const tag = uniqueTag('upval');
const UPLOAD_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads', 'po');
let server;
let a;

const upload = (bytes, name, token = a.member.token) => {
  const form = new FormData();
  form.append('file', new Blob([bytes]), name);
  return server.api('POST', '/orders/upload', { token, form });
};
const uploadedFiles = () => new Set(fs.readdirSync(UPLOAD_DIR));
const documentCount = async () =>
  (await query('SELECT COUNT(*)::int AS c FROM po_documents WHERE company_id = $1', [a.id])).rows[0].c;

// Smallest valid PNG (1x1 pixel)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

before(async () => {
  server = await startServer();
  a = await createCompany(tag, 'a');
  // No real AI: every extraction answers "nothing found"
  mockAi({});
});

after(async () => {
  clearAiMock();
  // Files this test stored (accepted uploads) are removed with their documents
  const docs = await query('SELECT file_path FROM po_documents WHERE company_id = $1', [a?.id]);
  for (const d of docs.rows) fs.unlink(d.file_path, () => {});
  await removeCompanies([a?.id]);
  await server.close();
  exitWhenDone();
});

describe('PO upload validation', () => {
  test('unsupported file types are rejected and not kept', async () => {
    const before = uploadedFiles();
    for (const name of ['order.docx', 'setup.exe', 'notes.txt', 'order']) {
      const res = await upload(Buffer.from('hello'), name);
      assert.equal(res.status, 400, `${name}: ${res.text}`);
      assert.match(res.json.error || res.json.message, /Unsupported file type/);
    }
    assert.deepEqual(uploadedFiles(), before, 'nothing saved on the server');
    assert.equal(await documentCount(), 0);
  });

  test('a file over 10 MB is refused with a clear 400 (not a server error)', async () => {
    const before = uploadedFiles();
    const res = await upload(Buffer.alloc(10 * 1024 * 1024 + 100, 0x41), 'big.csv');
    assert.equal(res.status, 400, res.text);
    assert.match(res.json.error, /too large/i);
    assert.deepEqual(uploadedFiles(), before, 'the partial file is not kept');
    assert.equal(await documentCount(), 0);
  });

  test('a renamed file whose content does not match its extension is rejected and deleted', async () => {
    const before = uploadedFiles();
    const cases = [
      [Buffer.from('MZ this is really a program'), 'invoice.pdf', /not a valid PDF/],
      [Buffer.from('just some text'), 'photo.png', /not a valid PNG/],
      [Buffer.from('plain text, not a zip'), 'sheet.xlsx', /not a valid XLSX/],
      [PNG, 'fake.jpg', /not a valid JPG/],
    ];
    for (const [bytes, name, pattern] of cases) {
      const res = await upload(bytes, name);
      assert.equal(res.status, 400, `${name}: ${res.text}`);
      assert.match(res.json.message, pattern);
    }
    assert.deepEqual(uploadedFiles(), before, 'rejected files are deleted');
    assert.equal(await documentCount(), 0);
  });

  test('valid files are accepted (CSV, PNG, PDF)', async () => {
    const csv = await upload(Buffer.from(`Customer,${tag} Ltd\nPO No,${tag}-1\n\nProduct,Qty,Unit\nChemical A,5,MT\n`), 'order.csv');
    assert.equal(csv.status, 201, csv.text);
    const png = await upload(PNG, 'scan.png');
    assert.equal(png.status, 201, png.text);
    const pdf = await upload(Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n'), 'order.pdf');
    assert.equal(pdf.status, 201, pdf.text);
    assert.equal(await documentCount(), 3);
  });

  test('upload needs a signed-in user', async () => {
    const form = new FormData();
    form.append('file', new Blob([PNG]), 'scan.png');
    assert.equal((await server.api('POST', '/orders/upload', { form })).status, 401);
  });
});
