// Billing: the invoice / receipt as a PDF (attached to the payment confirmation email).
// Drawn with pdfkit to match the HTML invoice (Billing > View): same colours, sections,
// wording and numbers. Poppins is embedded because the built-in PDF fonts have no "₹".
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { PLANS } from '../utils/plans.js';

const require = createRequire(import.meta.url);
const PDFDocument = require('pdfkit');

const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fonts');
const FONTS = {
  regular: path.join(FONT_DIR, 'Poppins-Regular.ttf'),
  medium: path.join(FONT_DIR, 'Poppins-Medium.ttf'),
  semibold: path.join(FONT_DIR, 'Poppins-SemiBold.ttf'),
  bold: path.join(FONT_DIR, 'Poppins-Bold.ttf'),
};

// Same palette as the HTML invoice
const C = {
  primary: '#201d6a',
  soft: '#f1f0fa',
  text: '#00022A',
  muted: '#626884',
  border: '#d9d8e6',
  success: '#2e7d32',
  white: '#ffffff',
};

const inr = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The same values the HTML invoice shows (billingController buildInvoiceHtml)
export const invoiceValues = (p) => {
  const sellerGstin = process.env.INVOICE_SELLER_GSTIN || '';
  const rate = Number(process.env.GST_RATE ?? 18);
  const taxable = Math.round(p.amount / (1 + rate / 100));
  return {
    sellerGstin,
    rate,
    taxable,
    gst: p.amount - taxable,
    title: sellerGstin ? 'Tax Invoice' : 'Payment Receipt',
    date: new Date(p.paid_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    sellerName: process.env.INVOICE_SELLER_NAME || 'ORDR',
    sellerAddress: process.env.INVOICE_SELLER_ADDRESS || '',
    planName: PLANS[p.plan]?.name || p.plan,
    isSubscription: p.kind === 'subscription',
  };
};

/** Builds the invoice PDF for a paid payment row (as loaded for the HTML invoice). Resolves to a Buffer. */
export const buildInvoicePdf = (p) =>
  new Promise((resolve, reject) => {
    try {
      const v = invoiceValues(p);
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        info: { Title: `${v.title} ${p.invoice_number || ''}`.trim(), Author: v.sellerName },
      });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('regular', FONTS.regular);
      doc.registerFont('medium', FONTS.medium);
      doc.registerFont('semibold', FONTS.semibold);
      doc.registerFont('bold', FONTS.bold);

      const X = 28;
      const W = doc.page.width - X * 2;
      const PAD = 12;
      const RADIUS = 10;
      const top = 28;

      const textHeight = (text, font, size, width, opts = {}) => {
        doc.font(font).fontSize(size);
        return doc.heightOfString(String(text), { width, ...opts });
      };
      const write = (text, x, y, { font = 'regular', size = 10.5, color = C.text, width, align = 'left', spacing = 0, lineGap = 0 } = {}) => {
        doc.font(font).fontSize(size).fillColor(color);
        doc.text(String(text), x, y, { width, align, characterSpacing: spacing, lineGap, lineBreak: true });
        return doc.heightOfString(String(text), { width, characterSpacing: spacing, lineGap });
      };

      // ---------- head (navy band with rounded top corners)
      const leftW = W * 0.6 - PAD * 2;
      const rightW = W * 0.4 - PAD;
      const subLines = [v.sellerAddress || 'B2B Order Tracking Platform', v.sellerGstin ? `GSTIN: ${v.sellerGstin}` : null].filter(Boolean);
      const brandH = textHeight(v.sellerName, 'bold', 19.5, leftW);
      const subH = subLines.reduce((h, line) => h + textHeight(line, 'regular', 9.75, leftW, { lineGap: 2 }), 0);
      const titleH = textHeight(v.title.toUpperCase(), 'semibold', 15, rightW, { characterSpacing: 1.1 });
      const pillH = 16;
      const headH = PAD * 2 + Math.max(brandH + subH, titleH + 4 + pillH);

      doc.save();
      doc.roundedRect(X, top, W, doc.page.height - top * 2, RADIUS).clip();
      doc.rect(X, top, W, headH).fill(C.primary);
      doc.restore();

      let ly = top + PAD;
      ly += write(v.sellerName, X + PAD, ly, { font: 'bold', size: 19.5, color: C.white, width: leftW, spacing: 0.75 });
      for (const line of subLines) {
        ly += write(line, X + PAD, ly, { size: 9.75, color: '#d2d1e1', width: leftW, lineGap: 2 });
      }
      const rightX = X + W - PAD - rightW;
      const titleY = top + PAD;
      write(v.title.toUpperCase(), rightX, titleY, { font: 'semibold', size: 15, color: C.white, width: rightW, align: 'right', spacing: 1.1 });
      doc.font('semibold').fontSize(9);
      const pillText = 'PAID';
      const pillW = doc.widthOfString(pillText, { characterSpacing: 0.4 }) + 24;
      const pillX = X + W - PAD - pillW;
      const pillY = titleY + titleH + 4;
      doc.roundedRect(pillX, pillY, pillW, pillH, 8).fill(C.white);
      write(pillText, pillX, pillY + 3, { font: 'semibold', size: 9, color: C.success, width: pillW, align: 'center', spacing: 0.4 });

      let y = top + headH + PAD;
      const innerX = X + PAD;
      const innerW = W - PAD * 2;

      // ---------- meta (invoice no., date, payment id)
      const meta = [
        [v.sellerGstin ? 'INVOICE NO.' : 'RECEIPT NO.', p.invoice_number || '—'],
        ['DATE', v.date],
        ['PAYMENT ID', p.provider_payment_id || '—'],
      ];
      const colGap = 9;
      const colW = (innerW - PAD * 2 - colGap * 2) / 3;
      const labelH = textHeight('LABEL', 'medium', 9, colW);
      const metaValueH = Math.max(...meta.map(([, value]) => textHeight(value, 'semibold', 10.5, colW)));
      const metaH = PAD * 2 + labelH + metaValueH;
      doc.roundedRect(innerX, y, innerW, metaH, 7.5).fill(C.soft);
      meta.forEach(([label, value], i) => {
        const cx = innerX + PAD + i * (colW + colGap);
        write(label, cx, y + PAD, { font: 'medium', size: 9, color: C.muted, width: colW, spacing: 0.45 });
        write(value, cx, y + PAD + labelH, { font: 'semibold', size: 10.5, color: C.text, width: colW });
      });
      y += metaH + PAD;

      // ---------- parties (billed from / billed to)
      const partyGap = 12;
      const partyW = (innerW - partyGap) / 2;
      const partyPadX = 13.5;
      const partyTextW = partyW - partyPadX * 2;
      const parties = [
        { label: 'BILLED FROM', name: v.sellerName, lines: [v.sellerAddress, v.sellerGstin ? `GSTIN: ${v.sellerGstin}` : null] },
        { label: 'BILLED TO', name: p.company_name, lines: [p.payer_name, p.payer_email, p.payer_gstin ? `GSTIN: ${p.payer_gstin}` : null] },
      ].map((party) => ({ ...party, lines: party.lines.filter(Boolean) }));
      const partyHeight = (party) =>
        PAD * 2 + labelH + textHeight(party.name || '—', 'semibold', 11.25, partyTextW) + 3 +
        party.lines.reduce((h, line) => h + textHeight(line, 'regular', 9.75, partyTextW, { lineGap: 2 }), 0);
      const partiesH = Math.max(...parties.map(partyHeight));
      parties.forEach((party, i) => {
        const px = innerX + i * (partyW + partyGap);
        doc.roundedRect(px, y, partyW, partiesH, 7.5).lineWidth(0.75).stroke(C.border);
        let py = y + PAD;
        py += write(party.label, px + partyPadX, py, { font: 'medium', size: 9, color: C.muted, width: partyTextW, spacing: 0.45 });
        py += write(party.name || '—', px + partyPadX, py, { font: 'semibold', size: 11.25, color: C.text, width: partyTextW }) + 3;
        for (const line of party.lines) {
          py += write(line, px + partyPadX, py, { size: 9.75, color: C.muted, width: partyTextW, lineGap: 2 });
        }
      });
      y += partiesH + PAD;

      // ---------- item table
      const cols = [
        { title: 'Description', w: innerW * 0.55, align: 'left' },
        { title: 'Period', w: innerW * 0.2, align: 'left' },
        { title: 'Amount', w: innerW * 0.25, align: 'right' },
      ];
      const cellPad = 10.5;
      const headRowH = 24;
      doc.roundedRect(innerX, y, innerW, headRowH, 6).fill(C.primary);
      let cx = innerX;
      for (const col of cols) {
        write(col.title, cx + cellPad, y + 6.5, { font: 'medium', size: 9.75, color: C.white, width: col.w - cellPad * 2, align: col.align });
        cx += col.w;
      }
      y += headRowH;
      const itemName = `ORDR ${v.planName} Plan`;
      const itemSub = v.isSubscription ? 'Monthly subscription (auto-renew)' : 'One-time monthly payment';
      const descW = cols[0].w - cellPad * 2;
      const rowH = cellPad * 2 + textHeight(itemName, 'semibold', 10.5, descW) + textHeight(itemSub, 'regular', 9.75, descW);
      let ry = y + cellPad;
      ry += write(itemName, innerX + cellPad, ry, { font: 'semibold', size: 10.5, color: C.text, width: descW });
      write(itemSub, innerX + cellPad, ry, { size: 9.75, color: C.muted, width: descW });
      write('1 month', innerX + cols[0].w + cellPad, y + cellPad, { size: 10.5, color: C.text, width: cols[1].w - cellPad * 2 });
      write(inr(v.taxable), innerX + cols[0].w + cols[1].w + cellPad, y + cellPad, { size: 10.5, color: C.text, width: cols[2].w - cellPad * 2, align: 'right' });
      y += rowH;
      doc.moveTo(innerX, y).lineTo(innerX + innerW, y).lineWidth(0.75).stroke(C.border);
      y += PAD;

      // ---------- totals
      const totalsW = 240;
      const tx = innerX + innerW - totalsW;
      const totalRow = (label, value) => {
        write(label, tx, y, { size: 10.5, color: C.muted, width: totalsW / 2 });
        write(value, tx + totalsW / 2, y, { font: 'medium', size: 10.5, color: C.text, width: totalsW / 2, align: 'right' });
        y += 20;
      };
      totalRow('Taxable Amount', inr(v.taxable));
      totalRow(`GST @ ${v.rate}%`, inr(v.gst));
      const grandH = 30;
      doc.roundedRect(tx, y + 4, totalsW, grandH, 6).fill(C.soft);
      write('Total Paid', tx + 10.5, y + 4 + 7.5, { font: 'bold', size: 12, color: C.primary, width: totalsW / 2 });
      write(inr(p.amount), tx + totalsW / 2, y + 4 + 7.5, { font: 'bold', size: 12, color: C.primary, width: totalsW / 2 - 10.5, align: 'right' });
      y += 4 + grandH + PAD;

      // ---------- footer
      doc.moveTo(innerX, y).lineTo(innerX + innerW, y).lineWidth(0.75).dash(3, { space: 3 }).stroke(C.border);
      doc.undash();
      y += 8;
      const footW = innerW / 2 - 6;
      let fy = y;
      fy += write('Thank you for your business!', innerX, fy, { font: 'semibold', size: 10.5, color: C.primary, width: footW });
      fy += write('Prices are inclusive of GST. Paid online via Razorpay.', innerX, fy, { size: 9.75, color: C.muted, width: footW, lineGap: 2 });
      const docWord = v.sellerGstin ? 'invoice' : 'receipt';
      const rightH = write(`This is a computer-generated ${docWord}\nand does not require a signature.`, innerX + innerW - footW, y, { size: 9.75, color: C.muted, width: footW, align: 'right', lineGap: 2 });
      y = Math.max(fy, y + rightH) + PAD;

      // ---------- card border (drawn last, on top of the head band)
      doc.roundedRect(X, top, W, y - top, RADIUS).lineWidth(0.75).stroke(C.border);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
