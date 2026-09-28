// M9 - AI order extraction helpers: prompt, AI call, normalization of the AI
// output, and a direct parser for structured Excel/CSV files so they do not
// always need an AI call.
import fs from 'fs';
import { createRequire } from 'module';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Fields that get a per-field confidence score
export const CONFIDENCE_FIELDS = [
  'order_type',
  'party_name',
  'po_number',
  'order_date',
  'required_delivery_date',
  'delivery_location',
  'currency',
  'total_value',
  'items',
];

const MAX_AI_TEXT = 30000;
const MAX_ITEMS = 200;
const PLACEHOLDER = /^(unknown|n\/?a|na|null|none|nil|not available|not specified|-+|—)$/i;

// ---------- value normalizers (anything unclear becomes null, never a guess) ----------

export const cleanString = (value, max = 255) => {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s || PLACEHOLDER.test(s)) return null;
  return s.slice(0, max);
};

const cleanNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value).replace(/[^0-9.-]/g, '');
  if (!s || s === '-' || s === '.') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

const isValidDate = (y, m, d) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

// Accepts YYYY-MM-DD, or day-first DD/MM/YYYY (Indian documents). Returns YYYY-MM-DD or null.
export const cleanDate = (value) => {
  const s = cleanString(value, 40);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return isValidDate(y, mo, d) ? `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
  }
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return isValidDate(y, mo, d) ? `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
  }
  return null;
};

const CURRENCY_SYMBOLS = { '₹': 'INR', 'rs': 'INR', 'rs.': 'INR', 'inr': 'INR', '$': 'USD', '€': 'EUR', '£': 'GBP' };
export const cleanCurrency = (value) => {
  const s = cleanString(value, 10);
  if (!s) return null;
  const mapped = CURRENCY_SYMBOLS[s.toLowerCase()];
  if (mapped) return mapped;
  return /^[A-Za-z]{3}$/.test(s) ? s.toUpperCase() : null;
};

const cleanConfidence = (value) => {
  const n = cleanNumber(value);
  if (n === null) return null;
  return Math.round(Math.min(Math.max(n, 0), 100));
};

const round2 = (n) => Math.round(n * 100) / 100;

export const cleanLineItems = (items) => {
  if (!Array.isArray(items)) return [];
  const cleaned = [];
  for (const raw of items.slice(0, MAX_ITEMS)) {
    if (!raw || typeof raw !== 'object') continue;
    const product = cleanString(raw.product ?? raw.name ?? raw.description, 500);
    const quantity = cleanNumber(raw.quantity ?? raw.qty);
    const unitPrice = cleanNumber(raw.unit_price ?? raw.unitPrice ?? raw.rate);
    let total = cleanNumber(raw.total ?? raw.amount);
    if (!product && quantity === null) continue;
    // Line total is arithmetic on stated values, not a guess
    if (total === null && quantity !== null && unitPrice !== null) total = round2(quantity * unitPrice);
    cleaned.push({
      product,
      sku: cleanString(raw.sku ?? raw.code, 100),
      quantity: quantity !== null && quantity > 0 ? quantity : null,
      unit: cleanString(raw.unit ?? raw.uom, 20),
      unit_price: unitPrice !== null && unitPrice >= 0 ? unitPrice : null,
      total: total !== null && total >= 0 ? total : null,
      // Per-item AI confidence (absent for manually edited or directly parsed items)
      ...(cleanConfidence(raw.confidence) !== null ? { confidence: cleanConfidence(raw.confidence) } : {}),
    });
  }
  return cleaned;
};

// Short text summary kept in the legacy `items` column (used by the inbox list/search)
export const summarizeItems = (lineItems) => {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return null;
  return lineItems
    .map((i) => {
      const qty = i.quantity !== null && i.quantity !== undefined ? ` x ${i.quantity}${i.unit ? ' ' + i.unit : ''}` : '';
      return `${i.product || 'Item'}${qty}`;
    })
    .join(', ');
};

const detectOrderType = (aiType, fileName) => {
  const t = String(aiType || '').toLowerCase();
  if (t.includes('purch')) return 'Purchase';
  if (t.includes('sale')) return 'Sales';
  const n = String(fileName || '').toLowerCase();
  if (n.includes('purch') || n.includes('supplier')) return 'Purchase';
  if (/(^|[^a-z])po([^a-z]|$)/.test(n)) return 'Purchase';
  if (n.includes('sales') || /(^|[^a-z])so([^a-z]|$)/.test(n)) return 'Sales';
  return 'Sales';
};

// Turns raw AI (or parser) output into the values stored on ai_order_extracts.
export const normalizeExtraction = (raw, fileName) => {
  const lineItems = cleanLineItems(raw.items);
  const itemTotals = lineItems.map((i) => i.total);
  const itemsSum = lineItems.length > 0 && itemTotals.every((t) => t !== null)
    ? round2(itemTotals.reduce((s, t) => s + t, 0))
    : null;

  const statedTotal = cleanNumber(raw.total_value ?? raw.approx_value);
  const values = {
    order_type: raw.order_type ? detectOrderType(raw.order_type, fileName) : null,
    party_name: cleanString(raw.party_name ?? raw.customer_name, 250),
    po_number: cleanString(raw.po_number, 95),
    order_date: cleanDate(raw.order_date),
    required_delivery_date: cleanDate(raw.required_delivery_date),
    delivery_location: cleanString(raw.delivery_location, 1000),
    currency: cleanCurrency(raw.currency),
    total_value: statedTotal !== null && statedTotal >= 0 ? statedTotal : itemsSum,
    items: lineItems.length > 0 ? lineItems : null,
  };

  // Per-field confidence only for fields that actually have a value
  const rawConf = raw.field_confidence && typeof raw.field_confidence === 'object' ? raw.field_confidence : {};
  const fieldConfidence = {};
  for (const key of CONFIDENCE_FIELDS) {
    if (values[key] === null) continue;
    const c = cleanConfidence(rawConf[key] ?? (key === 'party_name' ? rawConf.customer_name : undefined));
    if (c !== null) fieldConfidence[key] = c;
  }

  const confs = Object.values(fieldConfidence);
  let confidence = cleanConfidence(raw.confidence);
  if (confidence === null) {
    confidence = confs.length > 0 ? Math.round(confs.reduce((s, c) => s + c, 0) / confs.length) : 0;
  }

  return {
    // Stored order type falls back to the file-name heuristic (column expects Purchase/Sales)
    order_type: values.order_type || detectOrderType(null, fileName),
    customer_name: values.party_name,
    po_number: values.po_number,
    order_date: values.order_date,
    required_delivery_date: values.required_delivery_date,
    delivery_location: values.delivery_location,
    currency: values.currency,
    approx_value: values.total_value,
    line_items: lineItems,
    items: summarizeItems(lineItems),
    field_confidence: fieldConfidence,
    confidence,
  };
};

// ---------- AI call ----------

export const buildExtractionPrompt = (companyName) => `You extract order data from a business document (purchase order, sales order, order confirmation or dispatch document).
${companyName ? `Our company is "${companyName}".\n` : ''}
STRICT RULES:
- Use ONLY information explicitly written in the document. NEVER guess, infer, estimate or invent values.
- If a value is not clearly present, return null. Never use "Unknown", "N/A", 0 or empty strings as placeholders.
- Never fabricate PO numbers, quantities, prices, values, dates, customer or supplier names.
- Dates must be YYYY-MM-DD. Currency must be a 3-letter ISO code (INR, USD, EUR...). Numbers must be plain numbers without commas or currency symbols.

order_type: "purchase" if our company is the buyer (ordering from a supplier), "sales" if our company is the seller (a customer is ordering from us), null if unclear.
party_name: the other party's company name (the supplier for a purchase order, the customer for a sales order).

Return ONLY valid JSON (no markdown) with exactly these keys:
{
  "order_type": "purchase" | "sales" | null,
  "party_name": string | null,
  "po_number": string | null,
  "order_date": "YYYY-MM-DD" | null,
  "required_delivery_date": "YYYY-MM-DD" | null,
  "delivery_location": string | null,
  "currency": string | null,
  "total_value": number | null,
  "items": [
    { "product": string | null, "sku": string | null, "quantity": number | null, "unit": string | null, "unit_price": number | null, "total": number | null, "confidence": 0-100 }
  ],
  "field_confidence": {
    "order_type": 0-100, "party_name": 0-100, "po_number": 0-100, "order_date": 0-100,
    "required_delivery_date": 0-100, "delivery_location": 0-100, "currency": 0-100,
    "total_value": 0-100, "items": 0-100
  },
  "confidence": 0-100
}
field_confidence: how sure you are that each returned value is correct; use null for fields you returned as null.
items[].confidence: how sure you are about that item's product, quantity and price.
confidence: overall confidence that this is a real order document and its key fields are correct.`;

// Main models for extraction, tried in order (backups are used when one is busy)
const EXTRACTION_MODELS = [
  process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash',
];
// Cheaper models for the first classification step (Module 32: cheap first, strong only when needed)
const CLASSIFICATION_MODELS = [
  process.env.GEMINI_LITE_MODEL || 'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  ...EXTRACTION_MODELS,
];

const RETRY_DELAYS_MS = [2000];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// 503 = model overloaded, 429 = rate limited: both are temporary
const isTemporaryAiError = (message) => /\b(503|429)\b|overloaded|high demand|unavailable|rate limit/i.test(message || '');

// Sends `parts` to Gemini and parses the JSON reply. Tries each model in turn and
// retries a busy model once before moving on. Returns { data, error, busy }.
const callGeminiJson = async (parts, modelNames, label) => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const models = modelNames.filter((m, i) => m && modelNames.indexOf(m) === i);

  let lastError = null;
  let allBusy = true;
  for (const modelName of models) {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: 'application/json' } });
        const result = await model.generateContent(parts);
        const textResponse = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const data = JSON.parse(textResponse);
        if (data && typeof data === 'object') return { data, error: null, busy: false };
        lastError = 'AI returned an empty response';
        allBusy = false;
        break;
      } catch (err) {
        lastError = err.message || String(err);
        console.error(`${label} Error (${modelName}):`, lastError);
        if (!isTemporaryAiError(lastError)) {
          allBusy = false;
          break;
        }
        if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
  }
  return { data: null, error: lastError, busy: allBusy };
};

// Calls Gemini with the prompt plus document text and/or file. Returns { data, error, busy }.
export const runAiExtraction = async ({ companyName, text, file, mimeType, context }) => {
  const parts = [{ text: buildExtractionPrompt(companyName) }];
  if (context) parts.push({ text: context });
  if (text && text.trim()) {
    parts.push({ text: `Document text:\n${text.substring(0, MAX_AI_TEXT)}` });
  }
  if (file) {
    parts.push({ inlineData: { mimeType, data: file.toString('base64') } });
  }
  return callGeminiJson(parts, EXTRACTION_MODELS, 'AI Extraction');
};

// ---------- Module 8: email classification ----------

export const EMAIL_CLASSIFICATIONS = [
  'New Sales Order',
  'New Purchase Order',
  'Order Update',
  'Dispatch Update',
  'Delivery Update',
  'Not an Order',
];

const buildClassificationPrompt = (companyName) => `Classify this business email for an order-tracking system.
${companyName ? `Our company is "${companyName}".\n` : ''}
Categories:
- "New Sales Order": a customer is placing a new order with our company (we sell).
- "New Purchase Order": our company is placing a new order with a supplier (we buy).
- "Order Update": a change or question about an existing order (quantity, price, date changes, confirmations of an existing PO).
- "Dispatch Update": goods for an existing order have been dispatched/shipped (LR, AWB, vehicle details).
- "Delivery Update": goods for an existing order were delivered or delivery status changed.
- "Not an Order": anything else (marketing, invoices for unrelated services, OTPs, personal mail, newsletters, consumer shopping notifications).

Use only what the email says. Do not guess. If unsure between an order and "Not an Order", prefer lower confidence.
Return ONLY JSON: {"classification": one of the categories above, "confidence": 0-100, "reason": "one short sentence"}`;

// Returns { classification, confidence, reason } or { error, busy } when the AI could not answer.
export const classifyEmail = async ({ companyName, from, subject, body, attachmentNames }) => {
  const emailText = [
    `From: ${from || ''}`,
    `Subject: ${subject || ''}`,
    attachmentNames ? `Attachments: ${attachmentNames}` : null,
    '',
    String(body || '').substring(0, 6000),
  ].filter((l) => l !== null).join('\n');

  const { data, error, busy } = await callGeminiJson(
    [{ text: buildClassificationPrompt(companyName) }, { text: emailText }],
    CLASSIFICATION_MODELS,
    'AI Classification'
  );
  if (!data) return { error, busy };

  const classification = EMAIL_CLASSIFICATIONS.find(
    (c) => c.toLowerCase() === String(data.classification || '').trim().toLowerCase()
  ) || 'Not an Order';
  return {
    classification,
    confidence: cleanConfidence(data.confidence) ?? 0,
    reason: cleanString(data.reason, 500),
  };
};

// ---------- direct parser for structured Excel / CSV ----------

// Header/label names in English plus common Hindi words
const LABELS = {
  po_number: /^((p\.?\s?o\.?|purchase\s+order|order|sales\s+order|so)\s*(no\.?|number|#|ref(erence)?|id)|ऑर्डर\s*(नं\.?|नंबर|संख्या))\s*[:#-]?$/i,
  party_name: /^((customer|supplier|vendor|buyer|party|client|bill\s+to|sold\s+to|consignee)(\s+name)?|ग्राहक|आपूर्तिकर्ता|पार्टी)\s*[:-]?$/i,
  order_date: /^(((po|order)\s+)?date|दिनांक|तारीख)\s*[:-]?$/i,
  required_delivery_date: /^((required|delivery|due|expected\s+delivery)(\s+(date|by))?|डिलीवरी\s*(तिथि|तारीख))\s*[:-]?$/i,
  delivery_location: /^(delivery\s+(address|location|place)|ship\s+to|deliver\s+to|consignee\s+address|place\s+of\s+delivery)\s*[:-]?$/i,
  currency: /^currency\s*[:-]?$/i,
  total_value: /^(grand\s+total|total\s+(amount|value)|net\s+amount|order\s+total|कुल\s*(राशि|रकम))\s*[:-]?$/i,
};

const COLUMNS = {
  product: /^(product|item|material|description|goods|item\s+name|product\s+name|particulars|item\s+description|material\s+description|सामान|वस्तु|माल|विवरण)/i,
  sku: /^(sku|item\s+code|product\s+code|material\s+code|code|part\s+no|hsn)/i,
  quantity: /^(qty|quantity|order\s+qty|मात्रा)/i,
  unit: /^(unit|uom|इकाई)$/i,
  unit_price: /^(rate|unit\s+price|price|unit\s+rate|दर)/i,
  total: /^(amount|total|line\s+total|value|राशि|रकम)/i,
};

const cellText = (v) => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim());

// "10 MT" -> quantity "10", unit "MT"
const splitQuantity = (value) => {
  const m = String(value || '').match(/^\s*([\d.,]+)\s*([A-Za-z][A-Za-z.]*)?\s*$/);
  return m ? { quantity: m[1], unit: m[2] || null } : { quantity: value, unit: null };
};

// rows: array of row arrays (cell values). Returns { fields, items }.
export const parseStructuredRows = (rows) => {
  const fields = {};
  let items = [];

  for (let r = 0; r < rows.length; r += 1) {
    const row = (rows[r] || []).map(cellText);

    // Header row of an item table: needs a product column and a quantity column
    // "Item Code" is a SKU column, not the product name
    const productCol = row.findIndex((c) => COLUMNS.product.test(c) && !COLUMNS.sku.test(c));
    const qtyCol = row.findIndex((c) => COLUMNS.quantity.test(c));
    if (items.length === 0 && productCol !== -1 && qtyCol !== -1) {
      const col = (key) => row.findIndex((c, i) => i !== productCol && COLUMNS[key].test(c));
      const map = { product: productCol, quantity: qtyCol, sku: col('sku'), unit: col('unit'), unit_price: col('unit_price'), total: col('total') };
      const parsed = [];
      for (let k = r + 1; k < rows.length; k += 1) {
        const line = (rows[k] || []).map(cellText);
        const product = line[map.product];
        if (!product || /^(total|grand\s+total|sub\s*total|कुल)/i.test(product)) break;
        const qty = map.unit >= 0 ? { quantity: line[map.quantity], unit: line[map.unit] } : splitQuantity(line[map.quantity]);
        parsed.push({
          product,
          sku: map.sku >= 0 ? line[map.sku] : null,
          quantity: qty.quantity,
          unit: qty.unit,
          unit_price: map.unit_price >= 0 ? line[map.unit_price] : null,
          total: map.total >= 0 ? line[map.total] : null,
        });
      }
      items = parsed;
      continue;
    }

    // "Label | Value" cells, "Label: Value" in one cell, or the value in the cell below the label
    for (let c = 0; c < row.length; c += 1) {
      const cell = row[c];
      if (!cell) continue;
      for (const [key, regex] of Object.entries(LABELS)) {
        if (fields[key]) continue;
        if (regex.test(cell)) {
          const isLabel = (v) => Object.values(LABELS).some((re) => re.test(v));
          // Value to the right of the label, unless that cell is another label; otherwise the cell below
          const right = row.slice(c + 1).find((v) => v);
          const below = cellText((rows[r + 1] || [])[c]);
          const value = right && !isLabel(right) ? right : below && !isLabel(below) ? below : null;
          if (value) fields[key] = value;
        } else {
          const m = cell.match(/^([^:]{2,40}):\s*(.+)$/);
          if (m && regex.test(m[1].trim())) fields[key] = m[2].trim();
        }
      }
    }
  }

  return { fields, items };
};

// Columns of a sheet that lists several orders, one or more rows per order
// (e.g. an order register or an ORDR orders export)
const LIST_COLUMNS = {
  po_number: /^(po|p\.?o\.?\s*(no\.?|number|#)|po\s*number|order\s*(no\.?|number|#|id)|purchase\s+order(\s+no\.?)?)$/i,
  party_name: /^(customer|supplier|vendor|buyer|party|client|customer\s*\/\s*supplier)(\s+name)?$/i,
  product: COLUMNS.product,
  quantity: COLUMNS.quantity,
  unit: COLUMNS.unit,
  unit_price: COLUMNS.unit_price,
  line_total: /^(amount|line\s+total|item\s+total)$/i,
  order_total: /^(order\s+value|order\s+total|total\s+value|value|total)$/i,
  order_date: /^((order|po)\s+)?date$/i,
  required_delivery_date: /^(due|delivery|required)(\s+date)?$/i,
  currency: /^currency$/i,
};

// Detects a list of several orders in one sheet. Returns an array of raw orders
// (same shape as the AI output) when 2+ different PO numbers are found, else null.
export const parseOrderList = (rows) => {
  for (let r = 0; r < rows.length; r += 1) {
    const header = (rows[r] || []).map(cellText);
    const find = (key) => header.findIndex((c) => LIST_COLUMNS[key].test(c));
    const map = Object.fromEntries(Object.keys(LIST_COLUMNS).map((k) => [k, find(k)]));
    if (map.po_number === -1 || (map.party_name === -1 && map.product === -1)) continue;

    const orders = new Map();
    for (let k = r + 1; k < rows.length; k += 1) {
      const line = (rows[k] || []).map(cellText);
      if (line.every((v) => !v)) break;
      const po = line[map.po_number];
      if (!po) continue;
      const get = (key) => (map[key] >= 0 ? line[map[key]] || null : null);

      if (!orders.has(po)) {
        orders.set(po, {
          po_number: po,
          party_name: get('party_name'),
          order_date: get('order_date'),
          required_delivery_date: get('required_delivery_date'),
          currency: get('currency'),
          total_value: get('order_total'),
          items: [],
        });
      }
      const product = get('product');
      if (product && product !== '—') {
        const qty = map.unit >= 0 ? { quantity: get('quantity'), unit: get('unit') } : splitQuantity(get('quantity'));
        orders.get(po).items.push({
          product,
          quantity: qty.quantity,
          unit: qty.unit,
          unit_price: get('unit_price'),
          total: get('line_total'),
        });
      }
    }

    if (orders.size < 2) return null;
    return [...orders.values()].map((order) => {
      const fieldConfidence = {};
      for (const [key, value] of Object.entries(order)) {
        if (key !== 'items' && value) fieldConfidence[key] = 95;
      }
      if (order.items.length > 0) fieldConfidence.items = 95;
      return { ...order, field_confidence: fieldConfidence, confidence: 90 };
    });
  }
  return null;
};

// ---------- shared document pipeline (used by PO upload and Gmail attachments) ----------

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
const XLSX = require('xlsx');

export const DOCUMENT_EXTENSIONS = ['pdf', 'xlsx', 'csv', 'jpg', 'jpeg', 'png'];

// Reads a saved document. Returns { text, visionFile, visionMime, structured }:
// text for PDF/Excel/CSV, the raw file for images and scanned PDFs, and
// parsed rows for Excel/CSV.
export const readDocumentContent = async (filePath, ext) => {
  let text = '';
  let visionFile = null;
  let visionMime = null;
  let structured = null;

  if (ext === 'csv' || ext === 'xlsx') {
    try {
      // CSV is read as plain text cells (no date/number guessing); Excel keeps real dates
      const raw = fs.readFileSync(filePath, ext === 'csv' ? 'utf8' : undefined);
      const workbook = ext === 'csv'
        ? XLSX.read(String(raw).replace(/^﻿/, ''), { type: 'string', raw: true })
        : XLSX.read(raw, { type: 'buffer', cellDates: true });
      const sheets = [];
      const allRows = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csvText = XLSX.utils.sheet_to_csv(sheet);
        sheets.push(ext === 'csv' ? csvText : `Sheet: ${sheetName}\n${csvText}`);
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }).map((row) =>
          row.map((cell) => (cell instanceof Date
            ? `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(cell.getDate()).padStart(2, '0')}`
            : cell))
        );
        allRows.push(...rows, []);
      }
      text = sheets.join('\n\n');
      structured = parseStructuredRows(allRows);
      // A sheet listing several orders becomes one AI detection per order
      structured.orderList = parseOrderList(allRows);
    } catch (err) {
      console.error(`${ext.toUpperCase()} parsing error:`, err.message);
    }
  } else if (ext === 'pdf') {
    try {
      const pdfData = await pdf(fs.readFileSync(filePath));
      text = pdfData.text || '';
    } catch (err) {
      console.error('PDF Parsing error:', err.message);
    }
    if (!text.trim()) {
      visionFile = fs.readFileSync(filePath);
      visionMime = 'application/pdf';
    }
  } else if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
    visionFile = fs.readFileSync(filePath);
    visionMime = ext === 'png' ? 'image/png' : 'image/jpeg';
  }

  return { text, visionFile, visionMime, structured };
};

// Decides how to extract an order from document content (and optional email text):
// complete structured sheets are parsed directly, everything else goes to the AI.
// Returns { raw, error, busy, usedAi }.
export const extractOrder = async ({ companyName, content, extraText, context }) => {
  const { text = '', visionFile = null, visionMime = null, structured = null } = content || {};

  const structuredItems = structured ? cleanLineItems(structured.items) : [];
  const structuredItemsComplete = structuredItems.length > 0 && structuredItems.every((i) => i.product && i.quantity !== null);
  const structuredComplete = structuredItemsComplete
    && !!cleanString(structured.fields.po_number)
    && !!cleanString(structured.fields.party_name);

  if (structuredComplete) {
    const fieldConfidence = { items: 95 };
    for (const key of Object.keys(structured.fields)) fieldConfidence[key] = 95;
    return {
      raw: { ...structured.fields, items: structuredItems, field_confidence: fieldConfidence, confidence: 90 },
      error: null,
      busy: false,
      usedAi: false,
    };
  }

  const combinedText = [extraText, text].filter((t) => t && t.trim()).join('\n\n');
  if (!combinedText.trim() && !visionFile) {
    return { raw: null, error: 'Nothing to extract', busy: false, usedAi: false };
  }

  const { data, error, busy } = await runAiExtraction({
    companyName,
    context,
    text: combinedText,
    file: visionFile,
    mimeType: visionMime,
  });
  // Items read directly from the sheet are exact; prefer them over the AI's reading
  if (data && structuredItemsComplete) {
    data.items = structuredItems;
    data.field_confidence = { ...(data.field_confidence || {}), items: 95 };
  }
  return { raw: data, error, busy, usedAi: true };
};
