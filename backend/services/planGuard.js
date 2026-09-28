// Enforces the company's plan (Module 28 / 29): usage limits, read-only access
// after the trial / plan ends, history window and paid features.
// Limits are "hard": the action is refused with a clear message (HTTP 402).
import { query } from '../config/database.js';
import { PLANS } from '../utils/plans.js';
import { effectiveStatus, getOrCreateSubscription, getUsage } from './subscriptionService.js';

const LIMIT_LABELS = {
  users: { usage: 'users', text: (n) => `${n} user${n === 1 ? '' : 's'}` },
  ordersPerMonth: { usage: 'orders', text: (n) => `${n} orders` },
  gmailInboxes: { usage: 'gmail_inboxes', text: (n) => `${n} Gmail inbox${n === 1 ? '' : 'es'}` },
  aiExtractions: { usage: 'ai_extractions', text: (n) => `${n} AI extractions` },
};

// Paid features and the lowest plans that include them (higher plans include lower plans' features)
const FEATURE_PLANS = {
  excelExport: ['trial', 'growth', 'business', 'pro'],
  advancedReporting: ['business', 'pro'],
  prioritySupport: ['business', 'pro'],
};

export const planError = (message, code) =>
  Object.assign(new Error(message), { status: 402, code });

export const getPlanContext = async (companyId) => {
  const sub = await getOrCreateSubscription(companyId);
  const plan = PLANS[sub.plan] || PLANS.trial;
  return { sub, plan, status: effectiveStatus(sub) };
};

export const isReadOnly = (ctx) => ctx.status === 'expired' || ctx.status === 'cancelled';

// Throws when the trial / plan has ended (data stays available read-only)
export const assertCanWrite = async (companyId, ctx = null) => {
  const c = ctx || (await getPlanContext(companyId));
  if (isReadOnly(c)) {
    throw planError(
      c.plan.id === 'trial'
        ? 'Your free trial has ended. Your data is safe - choose a plan in Billing to continue adding and updating orders.'
        : 'Your plan has expired. Your data is safe - renew your plan in Billing to continue.',
      'PLAN_EXPIRED'
    );
  }
  return c;
};

// How many more of `limitKey` the company can use right now (Infinity = no limit)
export const remainingQuota = async (companyId, limitKey, ctx = null) => {
  const c = ctx || (await getPlanContext(companyId));
  const limit = c.plan.limits[limitKey];
  if (limit === null || limit === undefined) return Infinity;
  const usage = await getUsage(companyId, c.sub);
  return Math.max(limit - (usage[LIMIT_LABELS[limitKey].usage] || 0), 0);
};

// Throws when adding `adding` more would go over the plan limit (also checks read-only)
export const assertWithinLimit = async (companyId, limitKey, adding = 1) => {
  const ctx = await assertCanWrite(companyId);
  const remaining = await remainingQuota(companyId, limitKey, ctx);
  if (remaining < adding) {
    const limit = ctx.plan.limits[limitKey];
    const period = limitKey === 'ordersPerMonth' || limitKey === 'aiExtractions'
      ? ctx.plan.id === 'trial' ? ' during the trial' : ' this month'
      : '';
    throw planError(
      `Your ${ctx.plan.name} plan allows ${LIMIT_LABELS[limitKey].text(limit)}${period}, and that limit has been reached. Upgrade your plan in Billing to add more.`,
      'PLAN_LIMIT_REACHED'
    );
  }
  return ctx;
};

export const hasFeature = (ctx, feature) => (FEATURE_PLANS[feature] || []).includes(ctx.plan.id);

// SQL condition hiding completed orders older than the plan's history window.
// Open orders always stay visible so day-to-day work is never blocked.
export const historyCondition = (ctx, alias = 'o') => {
  const months = ctx.plan.limits.historyMonths;
  if (!months) return 'TRUE';
  return `NOT (LOWER(${alias}.status) IN ('delivered', 'cancelled') AND ${alias}.created_at < NOW() - INTERVAL '${Number(months)} months')`;
};

// Express middleware: blocks write actions once the trial / plan has ended
export const requireActivePlan = async (req, res, next) => {
  try {
    await assertCanWrite(req.user.company_id);
    next();
  } catch (error) {
    if (error.status === 402) {
      return res.status(402).json({ message: error.message, error: error.message, code: error.code });
    }
    next(error);
  }
};

// Sends a plan error as a 402 response; returns false for other errors
export const sendPlanError = (res, error) => {
  if (error?.status !== 402) return false;
  res.status(402).json({ message: error.message, error: error.message, code: error.code });
  return true;
};

export const companyHasActiveAccess = async (companyId) => !isReadOnly(await getPlanContext(companyId));

// Pending invitations count towards the user limit
export const pendingInvitationCount = async (companyId) =>
  (await query(
    `SELECT COUNT(*)::int AS count FROM team_invitations
     WHERE company_id = $1 AND status = 'pending' AND expires_at > NOW()`,
    [companyId]
  )).rows[0].count;
