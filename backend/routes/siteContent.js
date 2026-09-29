import express from 'express';
import {
  getLandingContent,
  getPublicPlans,
  getSiteImage,
  uploadSiteImage,
  getLegalPage,
  saveLegalPage,
  resetLegalPage,
  resetLandingSection,
  saveLandingSection,
} from '../controllers/siteContentController.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/role.js';
import { siteImageUpload } from '../middleware/siteImageUpload.js';

const router = express.Router();

// Public: what the landing page shows
router.get('/landing', getLandingContent);
router.get('/plans', getPublicPlans);
router.get('/images/:name', getSiteImage);
router.get('/legal/:page', getLegalPage);

// Admin: edit or reset a section from "Website Content"
router.put('/landing/:section', authenticate, requireAdmin, saveLandingSection);
router.delete('/landing/:section', authenticate, requireAdmin, resetLandingSection);
// Admin: upload a photo (e.g. for a testimonial)
router.post('/images', authenticate, requireAdmin, siteImageUpload, uploadSiteImage);
// Admin: legal pages (Website Content > CMS)
router.put('/legal/:page', authenticate, requireAdmin, saveLegalPage);
router.delete('/legal/:page', authenticate, requireAdmin, resetLegalPage);

export default router;
