// Landing page (Home) content. These defaults are the website's built-in text; admins can
// change any section from "Website Content" and the saved version replaces the default.
import {
  FiMail, FiUpload, FiEdit3, FiCpu, FiCheckCircle, FiTruck, FiBarChart2, FiClock, FiUsers,
  FiShield, FiZap, FiFileText, FiStar, FiBell, FiBox, FiGlobe, FiLock, FiTrendingUp,
} from 'react-icons/fi';

// Icons an admin can choose for cards (stored by name)
export const LANDING_ICONS = {
  mail: { label: 'Email', icon: FiMail },
  upload: { label: 'Upload', icon: FiUpload },
  edit: { label: 'Edit / Manual', icon: FiEdit3 },
  cpu: { label: 'AI / Processor', icon: FiCpu },
  check: { label: 'Check', icon: FiCheckCircle },
  truck: { label: 'Truck / Delivery', icon: FiTruck },
  chart: { label: 'Chart', icon: FiBarChart2 },
  clock: { label: 'Clock / Alerts', icon: FiClock },
  users: { label: 'Team', icon: FiUsers },
  shield: { label: 'Security', icon: FiShield },
  zap: { label: 'Lightning', icon: FiZap },
  file: { label: 'Document', icon: FiFileText },
  star: { label: 'Star', icon: FiStar },
  bell: { label: 'Bell', icon: FiBell },
  box: { label: 'Box / Order', icon: FiBox },
  globe: { label: 'Globe', icon: FiGlobe },
  lock: { label: 'Lock', icon: FiLock },
  trend: { label: 'Growth', icon: FiTrendingUp },
};

export const landingIcon = (name, fallback = 'check') => (LANDING_ICONS[name] || LANDING_ICONS[fallback]).icon;

export const PLAN_IDS = ['basic', 'growth', 'business', 'pro'];

// Used only if the plans cannot be loaded (same values as the backend plans)
export const DEFAULT_PLANS = [
  { id: 'basic', name: 'Basic', price: 999, limits: { users: 2, ordersPerMonth: 50, gmailInboxes: 1, aiExtractions: 25, historyMonths: 3 } },
  { id: 'growth', name: 'Growth', price: 2499, limits: { users: 5, ordersPerMonth: 200, gmailInboxes: 1, aiExtractions: 150, historyMonths: 12 } },
  { id: 'business', name: 'Business', price: 4999, limits: { users: 10, ordersPerMonth: 750, gmailInboxes: 3, aiExtractions: 600, historyMonths: 24 } },
  { id: 'pro', name: 'Pro', price: 9999, limits: { users: 25, ordersPerMonth: 2000, gmailInboxes: 5, aiExtractions: 1500, historyMonths: null } },
];

const fmt = (n) => Number(n).toLocaleString('en-IN');

// Plan limits as the pricing card bullets ("2 users", "50 orders/month", ...)
export const planLimitBullets = (limits = {}) => [
  limits.users === null || limits.users === undefined ? 'Unlimited users' : `${fmt(limits.users)} users`,
  limits.ordersPerMonth === null || limits.ordersPerMonth === undefined ? 'Unlimited orders' : `${fmt(limits.ordersPerMonth)} orders/month`,
  limits.gmailInboxes === null || limits.gmailInboxes === undefined
    ? 'Unlimited Gmail inboxes'
    : `${fmt(limits.gmailInboxes)} Gmail inbox${Number(limits.gmailInboxes) === 1 ? '' : 'es'}`,
  limits.aiExtractions === null || limits.aiExtractions === undefined ? 'Unlimited AI extractions' : `${fmt(limits.aiExtractions)} AI extractions`,
  limits.historyMonths ? `${fmt(limits.historyMonths)} months history` : 'Unlimited history',
];

export const formatPlanPrice = (price) => fmt(price);

export const DEFAULT_LANDING_CONTENT = {
  hero: {
    badge: 'Trusted by 500+ B2B businesses',
    titleLine1: 'Every business order.',
    titleHighlight: 'One place.',
    subtitle: 'Automate your order tracking. Connect your Gmail, let AI extract the details, and manage everything seamlessly from dispatch to delivery.',
    primaryButton: 'Start for Free',
    secondaryButton: 'Learn More',
  },
  stats: {
    items: [
      { value: 500, suffix: '+', label: 'Businesses Onboarded', duration: 2000 },
      { value: 1, suffix: 'M+', label: 'Orders Tracked', duration: 1500 },
      { value: 98, suffix: '%', label: 'On-time Deliveries', duration: 1800 },
    ],
  },
  inputMethods: {
    title: '3 Ways to Get Your Orders In',
    subtitle: 'Choose the method that works best for your business.',
    items: [
      { icon: 'mail', title: 'Gmail Integration', text: 'Connect your work email and let AI automatically detect and extract order details from incoming emails.', tag: 'Recommended' },
      { icon: 'upload', title: 'Upload Documents', text: 'Upload PDF, Excel, CSV, or images. Our AI reads and extracts all order information automatically.', tag: 'PDF, XLSX, CSV, JPG, PNG' },
      { icon: 'edit', title: 'Manual Entry', text: 'Add orders manually with our simple form. Perfect for phone orders or one-time purchases.', tag: 'Full Control' },
    ],
  },
  features: {
    title: 'How ORDR Works',
    subtitle: 'A seamless workflow designed to eliminate manual data entry.',
    items: [
      { icon: 'mail', title: '1. Connect Gmail', text: 'Simply connect your work email. ORDR automatically scans for incoming order receipts and invoices.' },
      { icon: 'cpu', title: '2. AI Extraction', text: 'Our smart AI reads the emails and instantly extracts PO numbers, items, quantities, and dates.' },
      { icon: 'check', title: '3. Review & Confirm', text: 'Quickly review the extracted data. Confirm or edit details before they become official tracking orders.' },
      { icon: 'truck', title: '4. Track Delivery', text: 'Monitor shipments in real-time. Keep your clients updated and ensure smooth, on-time deliveries.' },
    ],
  },
  howItWorks: {
    title: 'Everything You Need to Manage Orders',
    subtitle: 'Powerful features designed for B2B businesses.',
    items: [
      { icon: 'cpu', title: 'AI-Powered Extraction', text: 'Smart AI reads emails and documents, extracting PO numbers, items, quantities, and delivery dates with high accuracy.' },
      { icon: 'chart', title: 'Executive Dashboard', text: 'Real-time KPIs: open orders, order value, delayed shipments, and due-this-week alerts at a glance.' },
      { icon: 'truck', title: 'Partial Shipment Tracking', text: 'Track multiple shipments per order. System automatically calculates dispatched, delivered, and balance quantities.' },
      { icon: 'clock', title: 'Smart Alerts', text: 'Automated notifications for overdue orders, stale shipments, missing tracking numbers, and delivery deadlines.' },
      { icon: 'users', title: 'Team Collaboration', text: 'Invite your warehouse managers, sales team, and support staff. Control who sees what with admin and member roles.' },
      { icon: 'shield', title: 'Secure & Private', text: 'Your data is isolated and encrypted. Each company only sees their own orders. Read-only Gmail access.' },
    ],
  },
  pricing: {
    title: 'Simple, Transparent Pricing',
    subtitle: 'Start free for 14 days. No credit card required.',
    plans: {
      basic: { icon: 'mail', description: 'For small teams getting started', badge: '', buttonText: 'Start Free Trial', extraFeatures: [] },
      growth: { icon: 'zap', description: 'For growing businesses', badge: 'Most Popular', buttonText: 'Start Free Trial', extraFeatures: ['Excel export'] },
      business: { icon: 'chart', description: 'For scaling operations', badge: '', buttonText: 'Start Free Trial', extraFeatures: ['Priority support', 'Advanced reporting'] },
      pro: { icon: 'users', description: 'For large-scale operations', badge: '', buttonText: 'Start Free Trial', extraFeatures: ['Priority support'] },
    },
  },
  testimonials: {
    title: 'Trusted by Fast-Growing Businesses',
    subtitle: 'See what our users are saying about ORDR.',
    items: [
      { name: 'Rajesh Kumar', role: 'Operations Manager', company: 'TechSupply Co.', image: 'https://randomuser.me/api/portraits/men/32.jpg', rating: 5, text: 'Before ORDR, we had 3 people just reading emails and typing orders into Excel. Now, the AI does it instantly. ' },
      { name: 'Priya Sharma', role: 'Founder', company: 'BuildFast Logistics', image: 'https://randomuser.me/api/portraits/women/44.jpg', rating: 5, text: 'The Gmail integration is flawless. We never miss an order from our B2B clients anymore. Tracking everything in one dashboard is a game changer.' },
      { name: 'Amit Patel', role: 'Supply Chain Head', company: 'ChemTrade Ltd.', image: 'https://randomuser.me/api/portraits/men/45.jpg', rating: 5, text: 'Partial shipment tracking was a nightmare before ORDR. Now the system automatically calculates dispatched vs balance quantities.' },
      { name: 'Neha Gupta', role: 'Director', company: 'Vertex Distributors', image: 'https://randomuser.me/api/portraits/women/68.jpg', rating: 5, text: 'The alerts for overdue orders and missing tracking numbers have reduced our delivery delays by 40%. ' },
      { name: 'Vikram Singh', role: 'Logistics Manager', company: 'Pacific Exports', image: 'https://randomuser.me/api/portraits/men/75.jpg', rating: 5, text: 'We switched from a complicated ERP to ORDR. The simplicity and AI-powered extraction saves us hours every day. ' },
      { name: 'Meera Joshi', role: 'Procurement Head', company: 'Star Industries', image: 'https://randomuser.me/api/portraits/women/33.jpg', rating: 5, text: 'Managing 200+ supplier orders monthly was chaotic. ORDR brought everything to one place. The dashboard  into all open orders.' },
    ],
  },
  faq: {
    title: 'Frequently Asked Questions',
    subtitle: 'Everything you need to know about getting started.',
    items: [
      { question: 'What is ORDR and how does it work?', answer: 'ORDR is a B2B order-tracking platform that helps businesses manage sales orders, purchase orders, shipments, and deliveries from a single dashboard. Simply connect your Gmail, and our AI will automatically detect and extract order details from incoming emails.' },
      { question: 'Is my email data secure with ORDR?', answer: 'Yes, absolutely. We use industry-standard encryption and OAuth to connect to your Gmail. We only request read-only access and scan emails that match order-related criteria. Your personal communications are never stored or accessed.' },
      { question: 'How does the AI order extraction work?', answer: 'Our AI reads your order emails and automatically extracts key information like PO numbers, items, quantities, delivery dates, and order values. You review the extracted data before confirming — AI never creates orders without your approval.' },
      { question: 'Can I upload PDF or Excel files instead of connecting Gmail?', answer: 'Yes! ORDR supports multiple order input methods. You can upload PDF, Excel, CSV, JPG, or PNG files. Our AI will extract order data from these documents just like it does with emails. You can also add orders manually.' },
      { question: 'Does it integrate with my ERP or Tally?', answer: 'Currently, ORDR is a standalone B2B tracking platform designed for simplicity in Phase 1. ERP, SAP, Tally, WhatsApp, and logistics integrations are on our roadmap for upcoming phases.' },
      { question: 'Can I invite my team members?', answer: 'Yes! During onboarding or anytime from Settings, you can invite your warehouse managers, sales team, and support staff. Admins can manage user roles and control access levels.' },
      { question: 'What is partial shipment tracking?', answer: 'ORDR supports partial shipments out of the box. If you order 10 MT and ship 6 MT first, the system automatically tracks dispatched quantity, balance, and updates order status accordingly. You can add multiple shipments per order.' },
      { question: 'How does the 14-day free trial work?', answer: 'You get full access to all core features for 14 days — including Gmail integration, AI extraction, order tracking, and team collaboration. No credit card required. After trial, choose a plan that fits your business.' },
      { question: 'What happens if I exceed my plan limits?', answer: "We'll notify you before you reach your limits. You can upgrade your plan anytime from Settings. Your data is never deleted — you just won't be able to create new orders until you upgrade or wait for the next billing cycle." },
      { question: 'Can I track shipments in real-time?', answer: "Yes! ORDR provides real-time shipment tracking with LR/AWB numbers, route information, ETA, and status updates. You'll also get smart alerts for delays, overdue deliveries, and missing tracking information." },
    ],
  },
  cta: {
    title: 'Ready to Transform Your Order Management?',
    textStart: 'Join 500+ businesses already using ORDR to track and manage their',
    textEnd: 'B2B orders. Start your free 14-day trial today.',
    primaryButton: 'Start Free Trial',
    secondaryButton: 'View Pricing',
  },
  footer: {
    description: 'Every business order. One place. Track, manage, deliver, and grow your B2B operations with ease.',
    twitter: '#',
    linkedin: '#',
    instagram: '#',
    github: '#',
    copyright: '© 2026 ORDR Technologies. All rights reserved.',
  },
};

// Only http(s) links, "#" or site paths are used in the page (never "javascript:" etc.)
export const safeUrl = (value, fallback = '#') => {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url === '#' || url.startsWith('/') || url.startsWith('#')) return url;
  return /^https?:\/\//i.test(url) ? url : fallback;
};

// Saved sections on top of the defaults; lists fall back to the default when missing
export const mergeLandingContent = (saved = {}) => {
  const merged = {};
  for (const [section, defaults] of Object.entries(DEFAULT_LANDING_CONTENT)) {
    const custom = saved[section] && typeof saved[section] === 'object' ? saved[section] : {};
    const value = { ...defaults, ...custom };
    if ('items' in defaults && !Array.isArray(value.items)) value.items = defaults.items;
    if (section === 'pricing') {
      value.plans = {};
      for (const id of PLAN_IDS) {
        const plan = { ...defaults.plans[id], ...((custom.plans || {})[id] || {}) };
        if (!Array.isArray(plan.extraFeatures)) plan.extraFeatures = defaults.plans[id].extraFeatures;
        value.plans[id] = plan;
      }
    }
    merged[section] = value;
  }
  return merged;
};
