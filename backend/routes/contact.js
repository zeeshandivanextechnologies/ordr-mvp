import express from 'express';
import rateLimit from 'express-rate-limit';
import { getContactInfo, submitContactMessage } from '../controllers/contactController.js';

const router = express.Router();

// Public form: a few messages per visitor, to keep spam out of the team inbox
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many messages. Please try again in 15 minutes.' },
});

// Contact details for the Contact Us page and the website footer
router.get('/info', getContactInfo);
router.post('/', contactLimiter, submitContactMessage);

export default router;
