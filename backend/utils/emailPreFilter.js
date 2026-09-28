// M7 - Email Scanning Engine helpers.
// Reads subject/body/attachments from a Gmail message payload and runs the
// pre-filter that separates potential order emails from marketing/newsletter
// emails BEFORE any costly AI processing.

// Strong signals: specific to B2B orders / dispatch documents. One is enough,
// and they win over marketing footer text (e.g. "unsubscribe" in a PO email).
export const STRONG_ORDER_PHRASES = [
  'po number',
  'po no',
  'p.o. number',
  'p.o. no',
  'purchase order',
  'order confirmation',
  'confirmation of order',
  'order acknowledgement',
  'sales order',
  'proforma invoice',
  'dispatch advice',
  'dispatch details',
  'delivery challan',
  'lr number',
  'lr no',
  'lr copy',
  'awb number',
  'awb no',
  'airway bill',
  'goods receipt',
  'e way bill',
  'e-way bill',
  'ewaybill',
  'product code',
  'material code',
  'item code',
];

// Weak signals: common in order emails but also in everyday emails
// (e.g. consumer delivery notifications). At least two are required.
export const WEAK_ORDER_PHRASES = [
  'new order',
  'order placed',
  'order received',
  'order details',
  'order update',
  'dispatch',
  'dispatched',
  'shipment',
  'shipped',
  'delivery',
  'delivered',
  'delivery update',
  'quotation',
  'sku',
];

// Kept for compatibility: all order phrases
export const ORDER_PHRASES = [...STRONG_ORDER_PHRASES, ...WEAK_ORDER_PHRASES];

export const ORDER_TOKENS = ['quantity', 'qty', 'units', 'tonnes', 'grn', 'mt', 'kg', 'lr', 'awb', 'po'];

// Reference numbers are strong signals: "PO-8192", "PO No: ABC/1092", "LR 928721"
const PO_REFERENCE = /\bp\.?\s?o\.?\s*(?:no\.?|number|#|:|-)?\s*[:#-]?\s*[a-z]{0,6}[/-]?\d{3,}/i;
const TRANSPORT_REFERENCE = /\b(?:lr|awb|gr)\s*(?:no\.?|number|#|:)?\s*[:#-]?\s*\d{4,}/i;
// "5 MT", "240 pcs", "10 kg" (weak signal)
const QUANTITY_WITH_UNIT = /\b\d+(?:\.\d+)?\s*(?:mt|kg|kgs|tonnes?|tons?|pcs|nos|units|ltrs?|litres?|bags|boxes|cartons|drums|rolls|mtrs|meters)\b/i;

export const MARKETING_PHRASES = [
  'unsubscribe',
  'newsletter',
  'promotion',
  'promotional',
  'special offer',
  'limited offer',
  'discount',
  'exclusive offer',
  'sale now',
  'clearance',
  'advertisement',
  'you are receiving this',
  'view in browser',
  'no longer wish to receive',
  'email preferences',
  'mailer',
  'campaign',
  'win a',
  'free shipping',
  'refer a friend',
  'follow us on',
  'click here to buy',
];

// Only clearly-marketing aliases are sender-filtered. no-reply / notification /
// info / sales addresses frequently send legitimate order updates, so they are
// NOT treated as marketing here.
const SENDER_MARKETING = /(marketing|newsletter|promotions?|promo|mailer)/i;

const GENERIC_IMAGE = /^image\d*\.(png|jpe?g|gif)$/i;
const DOC_FILE = /\.(pdf|xlsx?|csv|jpe?g|png|docx?)$/i;
// Document attachments (PO PDFs, order sheets) are a strong signal; images are weak
const DOCUMENT_FILE = /\.(pdf|xlsx?|csv|docx?)$/i;

// Gmail base64url uses - and _ instead of + and /
const base64UrlToBuffer = (data) => {
  const b = String(data || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = b.length % 4 ? '='.repeat(4 - (b.length % 4)) : '';
  return Buffer.from(b + pad, 'base64');
};

export const htmlToText = (html) =>
  String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const MAX_BODY_LENGTH = 20000;

// Reads the charset from a part's Content-Type header (defaults to utf-8)
const partCharset = (part) => {
  const contentType = (part.headers || []).find((h) => String(h.name || '').toLowerCase() === 'content-type');
  const match = String(contentType?.value || '').match(/charset\s*=\s*"?([^";\s]+)"?/i);
  return match ? match[1].toLowerCase() : 'utf-8';
};

const decodeText = (buffer, charset) => {
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return buffer.toString('utf8');
  }
};

// Walks the Gmail payload tree, extracting plain text body (fallback: html)
// and attachment filenames plus metadata (mimeType, size, attachmentId).
export const extractBodyAndAttachments = (payload) => {
  let bodyText = '';
  let htmlText = '';
  const attachments = [];

  const walk = (part) => {
    if (!part) return;
    const mime = String(part.mimeType || '');
    const parts = part.parts || [];

    if (parts.length > 0) {
      for (const child of parts) walk(child);
      return;
    }

    if (part.filename) {
      attachments.push({
        filename: part.filename,
        mimeType: mime || null,
        size: Number(part.body?.size) || 0,
        attachmentId: part.body?.attachmentId || null,
      });
    }

    if (part.body && part.body.data && !part.filename) {
      const text = decodeText(base64UrlToBuffer(part.body.data), partCharset(part));
      if (mime === 'text/plain' && !bodyText) {
        bodyText = text;
      } else if (mime === 'text/html' && !htmlText) {
        htmlText = text;
      }
    }
  };

  walk(payload);

  const body = bodyText || htmlToText(htmlText);
  const names = attachments.map((a) => a.filename);
  const attachmentNames = names.filter((name, i) => names.indexOf(name) === i);

  return {
    body: body.slice(0, MAX_BODY_LENGTH),
    attachmentNames,
    attachments,
    hasAttachment: attachmentNames.length > 0,
  };
};

const normalizedText = (subject, body) =>
  `${String(subject || '')}\n${String(body || '')}`.toLowerCase().replace(/\s+/g, ' ');

const matchPhrases = (text, phrases) => phrases.filter((p) => text.includes(p));

const matchTokens = (text, tokens) =>
  tokens
    .map((token) => ({ token, regex: new RegExp(`\\b${token}\\b`, 'i') }))
    .filter(({ regex }) => regex.test(text))
    .map(({ token }) => token);

// Decides whether an email is likely to contain order information.
// Returns { isPotentialOrder, reason, keywords } where reason is one of
// 'order', 'marketing' or 'none'.
//
// Rules, in order:
// 1. Marketing sender (newsletter@, promo@ ...)            -> marketing
// 2. Strong order signal (PO number, LR/AWB number ...)    -> order (even with a marketing footer)
// 3. Marketing phrases in the text                         -> marketing
// 4. Document attachment (PDF/Excel/CSV/Word)              -> order
// 5. Two or more weak signals (shipped, qty, "5 MT" ...)   -> order
// 6. Otherwise                                             -> none
export const prefilterEmail = ({ subject, body, sender, attachmentNames }) => {
  const text = normalizedText(subject, body);
  const senderText = String(sender || '').toLowerCase();

  const marketingHits = matchPhrases(text, MARKETING_PHRASES);
  const senderMarketing = SENDER_MARKETING.test(senderText);

  const names = (attachmentNames || []).filter((name) => !GENERIC_IMAGE.test(name) && DOC_FILE.test(name));
  const documentFiles = names.filter((name) => DOCUMENT_FILE.test(name));
  const imageFiles = names.filter((name) => !DOCUMENT_FILE.test(name));

  const strongHits = matchPhrases(text, STRONG_ORDER_PHRASES);
  if (PO_REFERENCE.test(text)) strongHits.push('po reference');
  if (TRANSPORT_REFERENCE.test(text)) strongHits.push('lr/awb reference');

  const weakHits = matchPhrases(text, WEAK_ORDER_PHRASES).concat(
    matchTokens(text, ORDER_TOKENS).filter((t) => !strongHits.some((s) => s.includes(t)))
  );
  if (QUANTITY_WITH_UNIT.test(text)) weakHits.push('quantity with unit');
  if (imageFiles.length > 0) weakHits.push('image attachment');

  const marketing = (keywords) => ({
    isPotentialOrder: false,
    reason: 'marketing',
    keywords: keywords.slice(0, 5),
    senderMarketing,
  });
  const order = (keywords) => ({
    isPotentialOrder: true,
    reason: 'order',
    keywords: keywords.slice(0, 8),
    attachments: names,
  });

  if (senderMarketing) return marketing(marketingHits);
  if (strongHits.length > 0) return order(strongHits.concat(weakHits));
  if (marketingHits.length > 0) return marketing(marketingHits);
  if (documentFiles.length > 0) return order(weakHits.concat('document attachment'));
  if (weakHits.length >= 2) return order(weakHits);

  return { isPotentialOrder: false, reason: 'none', keywords: [] };
};