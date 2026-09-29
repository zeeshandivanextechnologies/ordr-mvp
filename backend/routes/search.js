import express from 'express';
import { globalSearch } from '../controllers/searchController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Module 25: header search (admins and members, read-only)
router.get('/', authenticate, globalSearch);

export default router;
