// Subscription state and plan usage for a company (Module 28 / 29).
import { query } from '../config/database.js';
import { PLANS, TRIAL_DAYS } from '../utils/plans.js';

// Returns the company's subscription row, creating the 14-day trial on first use.
// The trial starts when the company was created, so existing companies keep their real trial window.
export const getOrCreateSubscription = async (companyId) => {
  const existing = await query('SELECT * FROM subscriptions WHERE company_id = $1', [companyId]);
  if (existing.rows[0]) return existing.rows[0];

  const created = await query(
    `INSERT INTO subscriptions (company_id, plan, status, trial_started_at, trial_ends_at)
     SELECT c.id, 'trial', 'trialing', c.created_at, c.created_at + ($2 || ' days')::interval
     FROM companies c WHERE c.id = $1
     ON CONFLICT (company_id) DO NOTHING
     RETURNING *`,
    [companyId, String(TRIAL_DAYS)]
  );
  if (created.rows[0]) return created.rows[0];
  // Created by a parallel request in the meantime
  return (await query('SELECT * FROM subscriptions WHERE company_id = $1', [companyId])).rows[0];
};

// Effective status: a trial past its end date is "expired" (data is never deleted)
export const effectiveStatus = (sub) => {
  if (sub.status === 'trialing' && sub.trial_ends_at && new Date(sub.trial_ends_at) < new Date()) return 'expired';
  if (sub.status === 'active' && sub.current_period_end && new Date(sub.current_period_end) < new Date()) return 'expired';
  return sub.status;
};

// Usage counted against the plan: whole trial period for trials, the current calendar month otherwise
export const getUsage = async (companyId, sub) => {
  const isTrial = sub.plan === 'trial';
  const since = isTrial ? sub.trial_started_at : null;

  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM users WHERE company_id = $1 AND is_active = true) AS users,
       (SELECT COUNT(*)::int FROM orders
         WHERE company_id = $1
           AND created_at >= COALESCE($2::timestamptz, date_trunc('month', NOW()))) AS orders,
       (SELECT COUNT(*)::int FROM email_connections WHERE company_id = $1 AND is_active = true) AS gmail_inboxes,
       (SELECT COUNT(*)::int FROM ai_order_extracts
         WHERE company_id = $1
           AND created_at >= COALESCE($2::timestamptz, date_trunc('month', NOW()))) AS ai_extractions`,
    [companyId, since]
  );
  return rows[0];
};

// Activates (or renews) a paid plan for one month. Runs in the caller's transaction.
// - Same active plan: the new month is added after the current end date (no paid days lost)
// - Different plan while one is still active: the unused value of the old plan is converted
//   into extra days on the new plan (proration)
// Returns { prorationDays }.
const DAY_MS = 24 * 60 * 60 * 1000;
const addMonth = (date) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
};

export const activatePlan = async (client, companyId, planId) => {
  await getOrCreateSubscription(companyId);
  const { rows } = await client.query(
    'SELECT plan, status, current_period_start, current_period_end FROM subscriptions WHERE company_id = $1 FOR UPDATE',
    [companyId]
  );
  const sub = rows[0];
  const now = new Date();
  const stillActive = sub.status === 'active' && sub.current_period_end && new Date(sub.current_period_end) > now;

  let periodStart = now;
  let periodEnd = addMonth(now);
  let prorationDays = 0;

  if (stillActive && sub.plan === planId) {
    periodStart = new Date(sub.current_period_start || now);
    periodEnd = addMonth(sub.current_period_end);
  } else if (stillActive && PLANS[sub.plan]?.price && PLANS[planId]?.price) {
    const oldStart = new Date(sub.current_period_start || now).getTime();
    const oldEnd = new Date(sub.current_period_end).getTime();
    const periodMs = Math.max(oldEnd - oldStart, DAY_MS);
    const unusedValue = PLANS[sub.plan].price * ((oldEnd - now.getTime()) / periodMs);
    // Unused rupees buy days of the new plan at its daily rate (30-day month)
    prorationDays = Math.floor(unusedValue / (PLANS[planId].price / 30));
    periodEnd = new Date(periodEnd.getTime() + prorationDays * DAY_MS);
  }

  await client.query(
    `UPDATE subscriptions
     SET plan = $1::varchar, status = 'active',
         current_period_start = $2, current_period_end = $3,
         requested_plan = NULL, requested_at = NULL, requested_by = NULL,
         updated_at = NOW()
     WHERE company_id = $4`,
    [planId, periodStart.toISOString(), periodEnd.toISOString(), companyId]
  );
  return { prorationDays };
};

export const buildBillingSummary = async (companyId) => {
  const sub = await getOrCreateSubscription(companyId);
  const plan = PLANS[sub.plan] || PLANS.trial;
  const status = effectiveStatus(sub);
  const usage = await getUsage(companyId, sub);

  const daysLeft = sub.plan === 'trial' && sub.trial_ends_at
    ? Math.max(Math.ceil((new Date(sub.trial_ends_at) - Date.now()) / 86400000), 0)
    : null;

  return {
    subscription: {
      plan: plan.id,
      planName: plan.name,
      price: plan.price,
      status,
      trialStartedAt: sub.trial_started_at,
      trialEndsAt: sub.trial_ends_at,
      trialDays: TRIAL_DAYS,
      daysLeft,
      currentPeriodEnd: sub.current_period_end,
      requestedPlan: sub.requested_plan,
      requestedAt: sub.requested_at,
      autoRenew: !!sub.auto_renew,
    },
    limits: plan.limits,
    usagePeriod: sub.plan === 'trial' ? 'trial' : 'month',
    usage: {
      users: usage.users,
      orders: usage.orders,
      gmailInboxes: usage.gmail_inboxes,
      aiExtractions: usage.ai_extractions,
    },
  };
};
