import { getClient, query } from '../config/database.js';
import path from 'path';
import { logAudit } from '../utils/audit.js';
import fs from 'fs';
import { hasValidSignature, hashFile, processDocument } from '../services/documentProcessor.js';
import { assertWithinLimit, getPlanContext, historyCondition, remainingQuota, sendPlanError } from '../services/planGuard.js';
import { MANUAL_ORDER_STATUSES, STATUS_LABELS, normalizeStatus, recalculateOrder } from '../utils/orderStatus.js';

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

    const orderResult = await query('SELECT id FROM orders WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL', [id, companyId]);
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
           order_id, company_id, product, sku, description, quantity, unit, unit_price, total, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, clock_timestamp())`,
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

    // Items were re-created, so restore dispatched/delivered quantities from shipments
    const recalculatedStatus = await recalculateOrder(client, id, companyId, userId);
    if (recalculatedStatus) updatedOrder.status = recalculatedStatus;

    await client.query('COMMIT');

    await logAudit(req, 'order.edited', { entityType: 'order', entityId: id, details: { po_number: updatedOrder.po_number } });
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

// Manual status change (Received/Confirmed/Processing/Ready for Dispatch/Cancelled).
// Once active shipments exist, the status is derived from them instead.
export const updateOrderStatus = async (req, res, next) => {
  const client = await getClient();
  try {
    const { company_id: companyId, id: userId } = req.user;
    const { id } = req.params;
    const status = normalizeStatus(req.body?.status);

    if (!MANUAL_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid order status' });
    }

    await client.query('BEGIN');

    const orderResult = await client.query(
      'SELECT id, status FROM orders WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL FOR UPDATE',
      [id, companyId]
    );
    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Order not found' });
    }

    const currentStatus = normalizeStatus(orderResult.rows[0].status);
    if (currentStatus === status) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Order is already ${STATUS_LABELS[status]}` });
    }
    if (currentStatus === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Cancelled orders cannot be updated' });
    }

    const activeShipments = await client.query(
      `SELECT COUNT(*)::int AS count FROM shipments
       WHERE order_id = $1 AND LOWER(COALESCE(status, '')) <> 'cancelled'`,
      [id]
    );
    if (activeShipments.rows[0].count > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'This order has shipments, so its status is updated from shipment status. Cancel the shipments first.',
      });
    }

    const updated = await client.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );

    await client.query(
      `INSERT INTO tracking_events (order_id, company_id, status, description, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, clock_timestamp())`,
      [id, companyId, status, `Order status changed to ${STATUS_LABELS[status]}`, userId]
    );

    await client.query('COMMIT');

    await logAudit(req, 'order.status_changed', { entityType: 'order', entityId: id, details: { from: currentStatus, to: status } });
    res.json({ message: 'Order status updated', order: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
};

export const deleteOrder = async (req, res, next) => {
  const client = await getClient();
  try {
    const { company_id: companyId, id: userId, full_name: userName } = req.user;
    const { id } = req.params;

    const orderResult = await query('SELECT id FROM orders WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL', [id, companyId]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Soft delete: the order is hidden everywhere, but its history, items, shipments
    // and documents are kept (tracking history must never be deleted)
    await client.query('BEGIN');
    await client.query(
      'UPDATE orders SET deleted_at = NOW(), deleted_by = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3',
      [userId, id, companyId]
    );
    await client.query(
      `INSERT INTO tracking_events (order_id, company_id, status, description, created_by, created_at)
       VALUES ($1, $2, 'deleted', $3, $4, clock_timestamp())`,
      [id, companyId, `Order deleted${userName ? ` by ${userName}` : ''}`, userId]
    );
    await client.query('COMMIT');

    await logAudit(req, 'order.deleted', { entityType: 'order', entityId: id });
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
      lineItems,
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

    // Per-item quantities ({ orderItemId, quantity }) or, for single-item orders, one total quantity
    const perItem = Array.isArray(lineItems)
      ? lineItems
          .map((li) => ({ orderItemId: li?.orderItemId, quantity: parseFloat(li?.quantity) }))
          .filter((li) => li.orderItemId && (Number.isFinite(li.quantity) ? li.quantity !== 0 : false))
      : null;

    const qtyToAllocate = quantity ? parseFloat(quantity) : 0;
    if (!perItem && (!Number.isFinite(qtyToAllocate) || qtyToAllocate < 0)) {
      return res.status(400).json({ message: 'Quantity must be a valid number' });
    }
    if (perItem && perItem.some((li) => !(li.quantity > 0))) {
      return res.status(400).json({ message: 'Item quantities must be greater than 0' });
    }
    if (perItem && perItem.length === 0) {
      return res.status(400).json({ message: 'Enter a quantity for at least one item' });
    }

    const orderResult = await query('SELECT id, status FROM orders WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL', [orderId, companyId]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (normalizeStatus(orderResult.rows[0].status) === 'cancelled') {
      return res.status(400).json({ message: 'Cannot add a shipment to a cancelled order' });
    }

    await client.query('BEGIN');

    // Lock the order so two shipments cannot over-allocate the same quantity
    await client.query('SELECT id FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    const itemsResult = await client.query(
      'SELECT id, product, unit, quantity, dispatched FROM order_items WHERE order_id = $1 ORDER BY created_at, id',
      [orderId]
    );
    const orderItems = itemsResult.rows.map((i) => ({
      ...i,
      available: Math.max((parseFloat(i.quantity) || 0) - (parseFloat(i.dispatched) || 0), 0),
    }));

    // Work out how much of each order item goes in this shipment
    const allocations = [];
    if (perItem) {
      for (const li of perItem) {
        const item = orderItems.find((i) => i.id === li.orderItemId);
        if (!item) {
          throw Object.assign(new Error('One of the items does not belong to this order'), { status: 400 });
        }
        if (li.quantity > item.available + 0.000001) {
          throw Object.assign(
            new Error(`Only ${item.available.toLocaleString('en-IN')} ${item.unit || ''} of "${item.product}" is left to ship`.replace('  ', ' ')),
            { status: 400 }
          );
        }
        allocations.push({ item, quantity: li.quantity });
      }
    } else if (qtyToAllocate > 0) {
      let remaining = qtyToAllocate;
      for (const item of orderItems) {
        if (remaining <= 0.000001) break;
        if (item.available <= 0) continue;
        const take = Math.min(remaining, item.available);
        allocations.push({ item, quantity: take });
        remaining -= take;
      }
      if (remaining > 0.000001) {
        throw Object.assign(new Error('Shipment quantity exceeds remaining order quantity'), { status: 400 });
      }
    }

    const totalQty = perItem ? allocations.reduce((sum, a) => sum + a.quantity, 0) : qtyToAllocate;
    // Items text defaults to a summary of the per-item quantities
    const itemsText = items && String(items).trim()
      ? items
      : perItem
        ? allocations.map((a) => `${a.item.product} x ${a.quantity}${a.item.unit ? ' ' + a.item.unit : ''}`).join(', ')
        : null;

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
        totalQty || null,
        itemsText || null,
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

    for (const { item, quantity: qty } of allocations) {
      await client.query(
        `INSERT INTO shipment_items (company_id, shipment_id, order_item_id, product, unit, quantity, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, clock_timestamp())`,
        [companyId, result.rows[0].id, item.id, item.product, item.unit, qty]
      );
    }

    await client.query(
      `INSERT INTO tracking_events (
         order_id, company_id, status, description, created_by
       ) VALUES ($1, $2, $3, $4, $5)`,
      [orderId, companyId, 'Dispatched', `Shipment ${shipmentNumber.trim()} created`, userId]
    );

    // Dispatched/delivered quantities and the order status are derived from shipment items
    await recalculateOrder(client, orderId, companyId, userId);

    await client.query('COMMIT');

    await logAudit(req, 'shipment.created', { entityType: 'shipment', entityId: result.rows[0].id, details: { order_id: orderId, shipment_number: result.rows[0].shipment_number, quantity: result.rows[0].quantity } });
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
    // Plan history window: older completed orders are hidden (never deleted)
    const planCtx = await getPlanContext(companyId);

    const result = await query(
      `SELECT o.*,
         (SELECT product FROM order_items oi WHERE oi.order_id = o.id ORDER BY oi.created_at, oi.id LIMIT 1) AS material,
         (SELECT unit FROM order_items oi WHERE oi.order_id = o.id ORDER BY oi.created_at, oi.id LIMIT 1) AS material_unit,
         COALESCE((SELECT SUM(quantity) FROM order_items oi WHERE oi.order_id = o.id), 0) AS total_qty,
         (SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
         (SELECT COUNT(DISTINCT LOWER(COALESCE(unit, '')))::int FROM order_items oi WHERE oi.order_id = o.id) AS unit_count,
         -- All materials and shipment tracking numbers, for search
         (SELECT string_agg(product, ' | ' ORDER BY created_at, id) FROM order_items oi WHERE oi.order_id = o.id) AS materials,
         (SELECT string_agg(concat_ws(' ', s.shipment_number, s.lr_number, s.awb_number, s.gr_number), ' | ')
            FROM shipments s WHERE s.order_id = o.id) AS tracking_numbers,
         -- Latest activity on the order (edit, status change, shipment update or timeline event)
         GREATEST(
           o.updated_at,
           COALESCE((SELECT MAX(s.updated_at) FROM shipments s WHERE s.order_id = o.id), o.updated_at),
           COALESCE((SELECT MAX(te.created_at) FROM tracking_events te WHERE te.order_id = o.id), o.updated_at)
         ) AS last_activity_at
       FROM orders o
       WHERE o.company_id = $1 AND o.deleted_at IS NULL AND ${historyCondition(planCtx)}
       ORDER BY last_activity_at DESC NULLS LAST, o.created_at DESC`,
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

    const planCtx = await getPlanContext(companyId);
    const orderResult = await query(
      `SELECT * FROM orders WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL AND ${historyCondition(planCtx, 'orders')}`,
      [id, companyId]
    );
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
              expected_delivery_date, status, created_at,
              (SELECT COUNT(*)::int FROM shipment_items si WHERE si.shipment_id = shipments.id) AS item_count,
              (SELECT string_agg(concat(si.product, ' x ', trim(to_char(si.quantity, 'FM999999999990.##')), CASE WHEN si.unit IS NOT NULL THEN ' ' || si.unit ELSE '' END), ', ' ORDER BY si.created_at, si.id)
                 FROM shipment_items si WHERE si.shipment_id = shipments.id) AS item_summary
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
  try {
    const { company_id: companyId, id: userId } = req.user;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
    const fileType = ext === 'jpeg' ? 'jpg' : ext;
    const fileSize = req.file.size;
    const filePath = req.file.path;
    const discardUpload = () => fs.unlink(filePath, () => {});

    // The file's content must match its extension (not just its name)
    if (!hasValidSignature(filePath, ext)) {
      discardUpload();
      return res.status(400).json({ message: `This file is not a valid ${ext.toUpperCase()} file` });
    }

    // Plan limit: AI extractions
    try {
      await assertWithinLimit(companyId, 'aiExtractions');
    } catch (planErr) {
      discardUpload();
      if (sendPlanError(res, planErr)) return;
      throw planErr;
    }

    // Same file uploaded before?
    const fileHash = hashFile(filePath);
    const previous = await query(
      `SELECT d.*, (SELECT id FROM ai_order_extracts e WHERE e.po_document_id = d.id ORDER BY e.created_at LIMIT 1) AS extract_id
       FROM po_documents d
       WHERE d.company_id = $1 AND d.file_hash = $2
       ORDER BY d.created_at DESC LIMIT 1`,
      [companyId, fileHash]
    );
    let document = previous.rows[0] || null;
    if (document && document.extract_id) {
      discardUpload();
      return res.status(409).json({
        message: `This file was already uploaded on ${new Date(document.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}. Check the AI Order Inbox.`,
        existingExtractId: document.extract_id,
      });
    }

    if (document) {
      // Earlier upload of the same file was never processed (e.g. AI was busy): reuse it
      discardUpload();
    } else {
      const docResult = await query(
        `INSERT INTO po_documents (
           company_id, uploaded_by, file_name, file_path, file_type, file_size, status, file_hash
         ) VALUES ($1, $2, $3, $4, $5, $6, 'Pending', $7)
         RETURNING *`,
        [companyId, userId, req.file.originalname, filePath, fileType, fileSize, fileHash]
      );
      document = docResult.rows[0];
    }

    const maxExtracts = await remainingQuota(companyId, 'aiExtractions');
    const result = await processDocument({ document, companyId, userId, maxExtracts });

    res.status(201).json({
      message: 'PO uploaded successfully',
      document,
      extracted: result.created > 0,
      extractCount: result.created,
      // true when the AI service was overloaded; the file is saved and can be processed again
      aiBusy: result.created === 0 && result.aiBusy,
      // orders left out because the plan's AI extraction limit was reached
      skippedByPlanLimit: result.skippedByPlanLimit || 0,
    });
  } catch (error) {
    next(error);
  }
};

// Runs extraction again for an uploaded document that produced no AI detection
// (e.g. the AI service was busy during upload)
export const reprocessDocument = async (req, res, next) => {
  try {
    const { company_id: companyId, id: userId } = req.user;
    const { rows } = await query(
      `SELECT d.*, EXISTS (SELECT 1 FROM ai_order_extracts e WHERE e.po_document_id = d.id) AS has_extract
       FROM po_documents d WHERE d.id = $1 AND d.company_id = $2`,
      [req.params.id, companyId]
    );
    const document = rows[0];
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    if (document.has_extract) {
      return res.status(400).json({ message: 'This document was already processed. Check the AI Order Inbox.' });
    }
    if (!fs.existsSync(document.file_path)) {
      return res.status(404).json({ message: 'File is no longer available. Please upload it again.' });
    }
    try {
      await assertWithinLimit(companyId, 'aiExtractions');
    } catch (planErr) {
      if (sendPlanError(res, planErr)) return;
      throw planErr;
    }

    const maxExtracts = await remainingQuota(companyId, 'aiExtractions');
    const result = await processDocument({ document, companyId, userId, maxExtracts });
    res.json({
      message: result.created > 0 ? 'Document processed' : 'Could not read order details',
      document,
      extracted: result.created > 0,
      extractCount: result.created,
      aiBusy: result.created === 0 && result.aiBusy,
    });
  } catch (error) {
    next(error);
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

    // Plan limit: orders per month (or during the trial)
    try {
      await assertWithinLimit(companyId, 'ordersPerMonth');
    } catch (planErr) {
      if (sendPlanError(res, planErr)) return;
      throw planErr;
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
           order_id, company_id, product, sku, description, quantity, unit, unit_price, total, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, clock_timestamp())`,
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

    await logAudit(req, 'order.created', { entityType: 'order', entityId: newOrder.id, details: { po_number: newOrder.po_number, source: 'Manual' } });
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