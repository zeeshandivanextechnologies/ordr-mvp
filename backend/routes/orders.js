import express from 'express';
import upload from '../middleware/upload.js';
import { createOrder, uploadPO, listOrders, getOrderDetail, createShipment, updateOrder, deleteOrder } from '../controllers/orderController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', listOrders);
router.get('/:id', getOrderDetail);
router.post('/', createOrder);
router.put('/:id', updateOrder);
router.delete('/:id', deleteOrder);
router.post('/:id/shipments', createShipment);
router.post('/upload', upload.single('file'), uploadPO);

export default router;
