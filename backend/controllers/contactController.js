// Contact Us page on the public website: contact details for the page, and the
// contact form (validated, saved, then emailed to the ORDR team inbox).
import { query } from '../config/database.js';
import { sendContactMessageEmail } from '../utils/emailService.js';

export const CONTACT_TOPICS = ['General question', 'Sales & pricing', 'Product demo', 'Support', 'Billing', 'Partnership', 'Other'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value, max) => String(value ?? '').trim().slice(0, max);

// Details shown on the Contact Us page and in the website footer (set in .env, with defaults)
export const getContactInfo = (req, res) => {
  const phone = process.env.CONTACT_PHONE || '+91 98765 43210';
  res.json({
    email: process.env.CONTACT_EMAIL || 'hello@ordr.in',
    phone,
    phoneLink: `tel:${phone.replace(/[^\d+]/g, '')}`,
    address: process.env.CONTACT_ADDRESS || 'Mumbai, India',
    hours: process.env.CONTACT_HOURS || 'Mon – Sat, 10:00 AM – 7:00 PM IST',
    topics: CONTACT_TOPICS,
  });
};

// POST /api/contact { name, email, company?, phone?, topic?, message }
export const submitContactMessage = async (req, res, next) => {
  try {
    const body = req.body || {};
    // Hidden field that people never fill in; bots usually do
    if (clean(body.website, 200)) return res.json({ message: 'Thanks! We will get back to you soon.' });

    const details = {
      name: clean(body.name, 100),
      email: clean(body.email, 200).toLowerCase(),
      company: clean(body.company, 150),
      phone: clean(body.phone, 30),
      topic: CONTACT_TOPICS.includes(body.topic) ? body.topic : 'General question',
      message: clean(body.message, 5000),
    };
    if (!details.name) return res.status(400).json({ message: 'Please enter your name' });
    if (!EMAIL_RE.test(details.email)) return res.status(400).json({ message: 'Please enter a valid email address' });
    if (!details.message) return res.status(400).json({ message: 'Please write your message' });

    // Saved first, so the message is never lost even if the email fails
    const saved = await query(
      `INSERT INTO contact_messages (name, email, company, phone, topic, message, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [details.name, details.email, details.company || null, details.phone || null, details.topic, details.message,
        req.ip ? String(req.ip).slice(0, 64) : null]
    );

    // Team inbox: CONTACT_INBOX, else the address ORDR sends email from
    const inbox = process.env.CONTACT_INBOX || process.env.SMTP_USER;
    const sent = inbox ? await sendContactMessageEmail(inbox, details) : false;
    if (sent) await query('UPDATE contact_messages SET email_sent = true WHERE id = $1', [saved.rows[0].id]);

    res.json({ message: 'Thanks! We will get back to you soon.' });
  } catch (error) {
    next(error);
  }
};
