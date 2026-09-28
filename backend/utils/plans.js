// Plans and limits from the Phase 1 spec (Module 28 / 29). null = unlimited.
export const TRIAL_DAYS = 14;

export const PLANS = {
  trial: {
    id: 'trial',
    name: 'Free Trial',
    price: 0,
    // Suggested trial limits (Module 29): only orders and AI extractions are capped
    limits: { users: null, ordersPerMonth: 100, gmailInboxes: null, aiExtractions: 100, historyMonths: null },
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    price: 999,
    limits: { users: 2, ordersPerMonth: 50, gmailInboxes: 1, aiExtractions: 25, historyMonths: 3 },
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    price: 2499,
    limits: { users: 5, ordersPerMonth: 200, gmailInboxes: 1, aiExtractions: 150, historyMonths: 12 },
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 4999,
    limits: { users: 10, ordersPerMonth: 750, gmailInboxes: 3, aiExtractions: 600, historyMonths: 24 },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 9999,
    limits: { users: 25, ordersPerMonth: 2000, gmailInboxes: 5, aiExtractions: 1500, historyMonths: null },
  },
};

export const PAID_PLAN_IDS = ['basic', 'growth', 'business', 'pro'];
