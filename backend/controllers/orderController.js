import { getClient, query } from '../config/database.js';
import path from 'path';
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
const XLSX = require('xlsx');

const buildCleanItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error('At least one product line is required'), { status: 400 });
  }

  return items.map((item) => {
    if (!item.product || !item.product.trim()) {
      throw Object.assign(new Error('Product/Material is required for every line'), { status: 400 });
    }

    const quantity = parseFloat(item.qty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw Object.assign(new Error('Quantity must be greater than 0'), { status: 400 });
    }

    const unitPrice = parseFloat(item.unitPrice);
    const price = Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;

    return {
      product: item.product.trim(),
      sku: item.sku ? item.sku.trim() : null,
      description: item.description ? item.description.trim() : null,
      quantity,
      unit: item.unit || 'PCS',
      unitPrice: price,
      total: Math.round(quantity * price * 100) / 100,
    };
  });
};

export const updateOrder = async (req, res, next) => {
  const client = await getClient();
  try {
    const { company_id: companyId, id: userId } = req.user;
    const { id } = req.params;

    const orderResult = await query('SELECT id FROM orders WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const {
      type,
      partyName,
      poNumber,
      orderDate,
      requiredDeliveryDate,
      deliveryAddress,
      city,
      state,
      country,
      currency,
      items,
    } = req.body;

    if (!partyName || !partyName.trim()) {
      return res.status(400).json({ message: 'Customer/Supplier Name is required' });
    }

    if (!poNumber || !poNumber.trim()) {
      return res.status(400).json({ message: 'PO / Order Number is required' });
    }

    const orderType = type === 'purchase' ? 'purchase' : 'sales';
    const cleanItems = buildCleanItems(items);
    const totalValue = cleanItems.reduce((sum, item) => sum + item.total, 0);

    await client.query('BEGIN');

    const updatedResult = await client.query(
      `UPDATE orders SET
         order_type = $1, party_name = $2, po_number = $3, order_date = $4,
         required_delivery_date = $5, delivery_address = $6, city = $7, state = $8,
         country = $9, currency = $10, total_value = $11, updated_at = CURRENT_TIMESTAMP
       WHERE id = $12 AND company_id = $13
       RETURNING *`,
      [
        orderType,
        partyName.trim(),
        poNumber.trim(),
        orderDate || null,
        requiredDeliveryDate || null,
        deliveryAddress || null,
        city || null,
        state || null,
        country || null,
        currency || 'INR',
        totalValue,
        id,
        companyId,
      ]
    );

    const updatedOrder = updatedResult.rows[0];

    await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);

    for (const item of cleanItems) {
      await client.query(
        `INSERT INTO order_items (
           order_id, company_id, product, sku, description, quantity, unit, unit_price, total
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          companyId,
          item.product,
          item.sku,
          item.description,
          item.quantity,
          item.unit,
          item.unitPrice,
          item.total,
        ]
      );
    }

    await client.query(
      `INSERT INTO tracking_events (
         order_id, company_id, status, description, created_by
       ) VALUES ($1, $2, $3, $4, $5)`,
      [id, companyId, updatedOrder.status || 'Received', 'Order details updated', userId]
    );

    await client.query('COMMIT');

    res.json({ message: 'Order updated successfully', order: updatedOrder });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  } finally {
    client.release();
  }
};

export const deleteOrder = async (req, res, next) => {
  const client = await getClient();
  try {
    const { company_id: companyId } = req.user;
    const { id } = req.params;

    const orderResult = await query('SELECT id FROM orders WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM orders WHERE id = $1', [id]);
    await client.query('COMMIT');

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
};

export const createShipment = async (req, res, next) => {
  const client = await getClient();
  try {
    const { company_id: companyId, id: userId } = req.user;
    const { id: orderId } = req.params;

    const {
      shipmentNumber,
      quantity,
      items,
      transporter,
      lrNumber,
      awbNumber,
      grNumber,
      vehicleNumber,
      origin,
      destination,
      dispatchDate,
      expectedDeliveryDate,
    } = req.body;

    if (!shipmentNumber || !shipmentNumber.trim()) {
      return res.status(400).json({ message: 'Shipment Number is required' });
    }

    const qtyToAllocate = quantity ? parseFloat(quantity) : 0;
    if (!Number.isFinite(qtyToAllocate) || qtyToAllocate < 0) {
      return res.status(400).json({ message: 'Quantity must be a valid number' });
    }

    const orderResult = await query('SELECT id FROM orders WHERE id = $1 AND company_id = $2', [orderId, companyId]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO shipments (
         company_id, order_id, created_by, shipment_number, quantity, items,
         transporter, lr_number, awb_number, gr_number, vehicle_number,
         origin, destination, dispatch_date, expected_delivery_date, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'Dispatched')
       RETURNING *`,
      [
        companyId,
        orderId,
        userId,
        shipmentNumber.trim(),
        qtyToAllocate || null,
        items || null,
        transporter || null,
        lrNumber || null,
        awbNumber || null,
        grNumber || null,
        vehicleNumber || null,
        origin || null,
        destination || null,
        dispatchDate || null,
        expectedDeliveryDate || null,
      ]
    );

    if (qtyToAllocate > 0) {
      const itemsResult = await client.query(
        'SELECT id, quantity, dispatched FROM order_items WHERE order_id = $1 ORDER BY created_at, id',
        [orderId]
      );
      let remaining = qtyToAllocate;
      for (const item of itemsResult.rows) {
        if (remaining <= 0.000001) break;
        const itemQty = parseFloat(item.quantity) || 0;
        const itemDispatched = parseFloat(item.dispatched) || 0;
        const available = Math.max(itemQty - itemDispatched, 0);
        if (available <= 0) continue;
        const allocate = Math.min(remaining, available);
        await client.query(
          'UPDATE order_items SET dispatched = dispatched + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [allocate, item.id]
        );
        remaining -= allocate;
      }
      if (remaining > 0.000001) {
        throw Object.assign(new Error('Shipment quantity exceeds remaining order quantity'), { status: 400 });
      }
    }

    await client.query(
      `INSERT INTO tracking_events (
         order_id, company_id, status, description, created_by
       ) VALUES ($1, $2, $3, $4, $5)`,
      [orderId, companyId, 'Dispatched', `Shipment ${shipmentNumber.trim()} created`, userId]
    );

    await client.query('COMMIT');

    res.status(201).json({ message: 'Shipment created successfully', shipment: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  } finally {
    client.release();
  }
};

export const listOrders = async (req, res, next) => {
  try {
    const { company_id: companyId } = req.user;

    const result = await query(
      `SELECT o.*,
         (SELECT product FROM order_items oi WHERE oi.order_id = o.id ORDER BY oi.created_at, oi.id LIMIT 1) AS material,
         (SELECT unit FROM order_items oi WHERE oi.order_id = o.id ORDER BY oi.created_at, oi.id LIMIT 1) AS material_unit,
         COALESCE((SELECT SUM(quantity) FROM order_items oi WHERE oi.order_id = o.id), 0) AS total_qty
       FROM orders o
       WHERE o.company_id = $1
       ORDER BY o.created_at DESC`,
      [companyId]
    );

    res.json({ orders: result.rows });
  } catch (error) {
    next(error);
  }
};

export const getOrderDetail = async (req, res, next) => {
  try {
    const { company_id: companyId } = req.user;
    const { id } = req.params;

    const orderResult = await query('SELECT * FROM orders WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const itemsResult = await query(
      'SELECT id, product, sku, description, quantity, unit, unit_price, total, dispatched, delivered FROM order_items WHERE order_id = $1 ORDER BY created_at, id',
      [id]
    );

    const eventsResult = await query(
      'SELECT id, status, description, created_at FROM tracking_events WHERE order_id = $1 ORDER BY created_at DESC',
      [id]
    );

    const docsResult = await query(
      'SELECT id, file_name, file_type, file_size, status, created_at FROM po_documents WHERE order_id = $1 ORDER BY created_at DESC',
      [id]
    );

    const shipmentsResult = await query(
      `SELECT id, shipment_number, quantity, items, transporter, lr_number, awb_number,
              gr_number, vehicle_number, origin, destination, dispatch_date,
              expected_delivery_date, status, created_at
       FROM shipments WHERE order_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      order: orderResult.rows[0],
      items: itemsResult.rows,
      trackingEvents: eventsResult.rows,
      documents: docsResult.rows,
      shipments: shipmentsResult.rows,
    });
  } catch (error) {
    next(error);
  }
};

export const uploadPO = async (req, res, next) => {
  const client = await getClient();
  try {
    const { company_id: companyId, id: userId } = req.user;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
    const fileType = ext === 'jpeg' ? 'jpg' : ext;
    const fileSize = req.file.size;

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO po_documents (
         company_id, uploaded_by, file_name, file_path, file_type, file_size, status
       ) VALUES ($1, $2, $3, $4, $5, $6, 'Pending')
       RETURNING *`,
      [companyId, userId, req.file.originalname, req.file.path, fileType, fileSize]
    );

    let extractedText = '';
    let visionFile = null;
    let visionMime = null;
    const filePath = req.file.path;

    if (ext === 'csv') {
      try {
        extractedText = fs.readFileSync(filePath, 'utf8');
      } catch (err) {
        console.error('CSV Read error:', err);
        extractedText = 'Unable to read CSV file.';
      }
    } else if (ext === 'xlsx') {
      try {
        const workbook = XLSX.readFile(filePath);
        const sheets = [];
        for (const sheetName of workbook.SheetNames) {
          const rows = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
          sheets.push(`Sheet: ${sheetName}\n${rows}`);
        }
        extractedText = sheets.join('\n\n');
      } catch (err) {
        console.error('Excel Parsing error:', err);
        extractedText = 'Unable to parse Excel file.';
      }
    } else if (ext === 'pdf') {
      try {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdf(dataBuffer);
        extractedText = pdfData.text;
      } catch (err) {
        console.error('PDF Parsing error:', err);
        extractedText = '';
      }
      if (!extractedText || !extractedText.trim()) {
        visionFile = fs.readFileSync(filePath);
        visionMime = 'application/pdf';
      }
    } else if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
      visionFile = fs.readFileSync(filePath);
      visionMime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    }

    const instructions = `You are an AI that extracts order details from a business document.
First determine the document type: if it is a Purchase Order (this company is buying from a supplier) return order_type as "purchase"; if it is a Sales Order (this company is selling to a customer) return order_type as "sales".
Extract the following information and return it strictly in valid JSON format without markdown formatting.
JSON keys to return:
{
  "order_type": "purchase" or "sales",
  "customer_name": "String (Name of the company/party)",
  "po_number": "String (PO Number)",
  "items": "String (Summary of items, e.g., 'Steel Pipes x 50 PCS')",
  "approx_value": Number (Total approximate value),
  "confidence": Number (1 to 100, how confident are you in this extraction)
}
If you cannot find a piece of information, make a reasonable guess based on the text or leave it as "Unknown".`;

    const parts = [{ text: instructions }];
    if (extractedText && extractedText.trim()) {
      parts.push({ text: `Here is the text extracted from the document:\n${extractedText.substring(0, 8000)}` });
    }
    if (visionFile) {
      parts.push({ inlineData: { mimeType: visionMime, data: visionFile.toString('base64') } });
    }

    const modelNames = [process.env.GEMINI_MODEL || 'gemini-3.6-flash', 'gemini-3.8-flash'];
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    let aiResponse = null;
    let lastAIError = null;
    for (const modelName of modelNames) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: 'application/json' } });
        const resultAI = await model.generateContent(parts);
        let textResponse = resultAI.response.text();
        textResponse = textResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        aiResponse = JSON.parse(textResponse);
        break;
      } catch (aiErr) {
        lastAIError = aiErr.message || String(aiErr);
        console.error(`AI Extraction Error (${modelName}):`, aiErr.message);
      }
    }

    if (aiResponse && typeof aiResponse === 'object') {
      const safeValue = parseFloat(String(aiResponse.approx_value || '0').replace(/,/g, '')) || 0;
      const safeCustomer = String(aiResponse.customer_name || 'Unknown').substring(0, 250);
      const safePO = String(aiResponse.po_number || 'Unknown').substring(0, 95);
      const rawConfidence = parseInt(aiResponse.confidence, 10);
      const safeConfidence = Number.isFinite(rawConfidence) ? Math.min(Math.max(rawConfidence, 0), 100) : 0;

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

      await client.query(
        `INSERT INTO ai_order_extracts (
           company_id, order_type, customer_name, po_number, items, approx_value,
           email_date, confidence, status, attachment_name
         ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, $8, $9)`,
        [
          companyId,
          detectOrderType(aiResponse.order_type, req.file.originalname),
          safeCustomer,
          safePO,
          aiResponse.items || 'Unknown',
          safeValue,
          safeConfidence,
          'New',
          req.file.originalname
        ]
      );
    } else {
      console.warn('AI extraction failed; document stays Pending. Last error:', lastAIError);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'PO uploaded successfully',
      document: result.rows[0],
      extracted: !!aiResponse,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
};

export const createOrder = async (req, res, next) => {
  const client = await getClient();
  try {
    const { company_id: companyId, id: userId } = req.user;

    const {
      type,
      partyName,
      poNumber,
      orderDate,
      requiredDeliveryDate,
      deliveryAddress,
      city,
      state,
      country,
      currency,
      items,
    } = req.body;

    if (!partyName || !partyName.trim()) {
      return res.status(400).json({ message: 'Customer/Supplier Name is required' });
    }

    if (!poNumber || !poNumber.trim()) {
      return res.status(400).json({ message: 'PO / Order Number is required' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one product line is required' });
    }

    const orderType = type === 'purchase' ? 'purchase' : 'sales';

    const cleanItems = items.map((item) => {
      if (!item.product || !item.product.trim()) {
        throw Object.assign(new Error('Product/Material is required for every line'), { status: 400 });
      }

      const quantity = parseFloat(item.qty);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw Object.assign(new Error('Quantity must be greater than 0'), { status: 400 });
      }

      const unitPrice = parseFloat(item.unitPrice);
      const price = Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;

      return {
        product: item.product.trim(),
        sku: item.sku ? item.sku.trim() : null,
        description: item.description ? item.description.trim() : null,
        quantity,
        unit: item.unit || 'PCS',
        unitPrice: price,
        total: Math.round(quantity * price * 100) / 100,
      };
    });

    const totalValue = cleanItems.reduce((sum, item) => sum + item.total, 0);

    await client.query('BEGIN');

    const orderResult = await client.query(
      `INSERT INTO orders (
         company_id, created_by, order_type, party_name, po_number,
         order_date, required_delivery_date, delivery_address,
         city, state, country, currency, total_value, status, source
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'Received', 'Manual')
       RETURNING *`,
      [
        companyId,
        userId,
        orderType,
        partyName.trim(),
        poNumber.trim(),
        orderDate || null,
        requiredDeliveryDate || null,
        deliveryAddress || null,
        city || null,
        state || null,
        country || null,
        currency || 'INR',
        totalValue,
      ]
    );

    const newOrder = orderResult.rows[0];

    for (const item of cleanItems) {
      await client.query(
        `INSERT INTO order_items (
           order_id, company_id, product, sku, description, quantity, unit, unit_price, total
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          newOrder.id,
          companyId,
          item.product,
          item.sku,
          item.description,
          item.quantity,
          item.unit,
          item.unitPrice,
          item.total,
        ]
      );
    }

    await client.query(
      `INSERT INTO tracking_events (
         order_id, company_id, status, description, created_by
       ) VALUES ($1, $2, $3, $4, $5)`,
      [newOrder.id, companyId, 'Received', 'Order created manually', userId]
    );

    await client.query('COMMIT');

    res.status(201).json({ message: 'Order created successfully', order: newOrder });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  } finally {
    client.release();
  }
};