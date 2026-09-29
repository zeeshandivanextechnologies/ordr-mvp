import { getClient, query } from "../config/database.js";
import { logAudit } from "../utils/audit.js";
import { trackEvent } from "../utils/analytics.js";
import { sendPaymentConfirmationEmail } from "../utils/emailService.js";
import { buildInvoicePdf } from "../services/invoicePdf.js";
import config from "../config/environment.js";
import { PAID_PLAN_IDS, PLANS } from "../utils/plans.js";
import {
  activatePlan,
  buildBillingSummary,
  getOrCreateSubscription,
} from "../services/subscriptionService.js";
import {
  cancelRazorpaySubscription,
  createRazorpayOrder,
  createRazorpayPlan,
  createRazorpaySubscription,
  getRazorpayKeyId,
  isRazorpayConfigured,
  verifyPaymentSignature,
  verifySubscriptionSignature,
  verifyWebhookSignature,
} from "../services/razorpayService.js";

const withPaymentsFlag = async (companyId) => ({
  ...(await buildBillingSummary(companyId)),
  // Online payment is available only when Razorpay keys are set
  paymentsEnabled: isRazorpayConfigured(),
});

// Billing summary for the current user (+ payment history for admins)
const billingResponse = async (req) => {
  const summary = await withPaymentsFlag(req.user.company_id);
  if (req.user.role === "admin") {
    const { rows } = await query(
      `SELECT id, plan, amount, currency, provider_payment_id, paid_at, invoice_number, kind
         FROM payments WHERE company_id = $1 AND status = 'paid'
         ORDER BY paid_at DESC LIMIT 240`,
      [req.user.company_id],
    );
    summary.payments = rows.map((p) => ({
      id: p.id,
      invoiceNumber: p.invoice_number,
      autoRenew: p.kind === "subscription",
      plan: p.plan,
      planName: PLANS[p.plan]?.name || p.plan,
      amount: p.amount / 100,
      currency: p.currency,
      paymentId: p.provider_payment_id,
      paidAt: p.paid_at,
    }));
  }
  return summary;
};

// GET /billing: current plan, trial state, limits and usage
export const getBilling = async (req, res, next) => {
  try {
    res.json(await billingResponse(req));
  } catch (error) {
    next(error);
  }
};

// Invoice numbers: ORDR-2026-000123 (sequential, never reused)
const NEXT_INVOICE_NUMBER_SQL = `'ORDR-' || to_char(NOW(), 'YYYY') || '-' || lpad(nextval('invoice_number_seq')::text, 6, '0')`;
// Extra days given for unused value of the previous plan, reported back to the user once
const lastProration = new Map();
const prorationNote = (companyId) => {
  const days = lastProration.get(companyId) || 0;
  lastProration.delete(companyId);
  return days > 0
    ? ` ${days} extra day${days === 1 ? "" : "s"} were added for the unused part of your previous plan.`
    : "";
};

// Marks a Razorpay order as paid and activates its plan. Safe to call twice
// (checkout callback and webhook can both arrive). Returns the company id or null.
const completePayment = async (providerOrderId, providerPaymentId) => {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT * FROM payments WHERE provider_order_id = $1 FOR UPDATE",
      [providerOrderId],
    );
    const payment = rows[0];
    if (!payment) {
      await client.query("ROLLBACK");
      return null;
    }
    let prorationDays = 0;
    const newlyPaid = payment.status !== "paid";
    if (newlyPaid) {
      await client.query(
        `UPDATE payments SET status = 'paid', provider_payment_id = $1, paid_at = NOW(), updated_at = NOW(),
           invoice_number = ${NEXT_INVOICE_NUMBER_SQL}
         WHERE id = $2`,
        [providerPaymentId, payment.id],
      );
      ({ prorationDays } = await activatePlan(
        client,
        payment.company_id,
        payment.plan,
      ));
    }
    await client.query("COMMIT");
    lastProration.set(payment.company_id, prorationDays);
    if (newlyPaid) {
      sendPaymentEmail(payment.id, payment.company_id);
      trackEvent({
        event: "subscription_started",
        companyId: payment.company_id,
        userId: payment.user_id,
        properties: { plan: payment.plan, kind: "one_time" },
        dedupeKey: `subscription_started:${providerOrderId}`,
      });
    }
    return payment.company_id;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

// POST /billing/checkout { plan }: creates a Razorpay order for one month of the plan
export const createCheckout = async (req, res, next) => {
  try {
    const {
      company_id: companyId,
      id: userId,
      full_name: fullName,
      email,
    } = req.user;
    const planId = String(req.body?.plan || "").toLowerCase();
    if (!PAID_PLAN_IDS.includes(planId)) {
      return res.status(400).json({ message: "Please choose a valid plan" });
    }
    if (!isRazorpayConfigured()) {
      return res
        .status(503)
        .json({
          message: "Online payment is not set up yet",
          code: "PAYMENTS_NOT_CONFIGURED",
        });
    }

    const plan = PLANS[planId];
    const amount = plan.price * 100; // paise
    const order = await createRazorpayOrder({
      amount,
      currency: "INR",
      receipt: `ordr_${Date.now()}`,
      notes: { company_id: companyId, plan: planId },
    });

    await query(
      `INSERT INTO payments (company_id, user_id, plan, amount, currency, provider_order_id)
       VALUES ($1, $2, $3, $4, 'INR', $5)`,
      [companyId, userId, planId, amount, order.id],
    );

    trackEvent({
      event: "plan_selected",
      companyId,
      userId,
      properties: { plan: planId, kind: "one_time" },
    });
    const company = await query("SELECT name FROM companies WHERE id = $1", [
      companyId,
    ]);
    res.json({
      keyId: getRazorpayKeyId(),
      orderId: order.id,
      amount,
      currency: "INR",
      planName: plan.name,
      companyName: company.rows[0]?.name || "ORDR",
      prefill: { name: fullName || "", email: email || "" },
    });
  } catch (error) {
    if (error.status === 502)
      return res.status(502).json({ message: error.message });
    next(error);
  }
};

// POST /billing/verify: called by the browser after a successful Razorpay checkout
export const verifyCheckout = async (req, res, next) => {
  try {
    const { company_id: companyId } = req.user;
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body || {};

    const { rows } = await query(
      "SELECT company_id, plan FROM payments WHERE provider_order_id = $1",
      [orderId],
    );
    if (!rows[0] || rows[0].company_id !== companyId) {
      return res.status(404).json({ message: "Payment not found" });
    }
    if (!verifyPaymentSignature(orderId, paymentId, signature)) {
      await query(
        `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE provider_order_id = $1 AND status = 'created'`,
        [orderId],
      );
      return res
        .status(400)
        .json({
          message:
            "Payment could not be verified. If money was deducted, it will be confirmed automatically or refunded.",
        });
    }

    await completePayment(orderId, paymentId);
    await logAudit(req, "plan.purchased", {
      entityType: "payment",
      entityId: orderId,
      details: { plan: rows[0].plan, payment_id: paymentId },
    });
    res.json({
      message: `Payment successful. Your ${PLANS[rows[0].plan].name} plan is now active.${prorationNote(companyId)}`,
      ...(await billingResponse(req)),
    });
  } catch (error) {
    next(error);
  }
};

// POST /billing/webhook (no login): Razorpay server-to-server notification.
// Activates the plan even if the user closed the browser before /verify ran.
export const razorpayWebhook = async (req, res) => {
  try {
    if (
      !verifyWebhookSignature(req.rawBody, req.headers["x-razorpay-signature"])
    ) {
      return res.status(400).json({ message: "Invalid signature" });
    }
    const event = req.body?.event;
    const entity = req.body?.payload?.payment?.entity;

    // Auto-renew: every monthly charge extends the plan; cancellation stops auto-renew
    const subscription = req.body?.payload?.subscription?.entity;
    if (subscription?.id) {
      if (event === "subscription.charged" && entity?.id) {
        const owner = await query(
          `SELECT company_id, COALESCE(provider_subscription_plan, pending_subscription_plan) AS plan
           FROM subscriptions WHERE provider_subscription_id = $1 OR pending_subscription_id = $1`,
          [subscription.id],
        );
        const companyId =
          owner.rows[0]?.company_id || subscription.notes?.company_id;
        const planId = owner.rows[0]?.plan || subscription.notes?.plan;
        if (companyId && PLANS[planId]) {
          await recordSubscriptionPayment({
            companyId,
            planId,
            paymentId: entity.id,
            subscriptionId: subscription.id,
          });
          // Browser closed before verification: the paid subscription still becomes the active one
          const activated = await query(
            `UPDATE subscriptions
             SET provider_subscription_id = $1, provider_subscription_plan = $2, auto_renew = true,
                 pending_subscription_id = NULL, pending_subscription_plan = NULL, updated_at = NOW()
             WHERE company_id = $3 AND pending_subscription_id = $1`,
            [subscription.id, planId, companyId],
          );
          if (activated.rowCount > 0) {
            trackEvent({
              event: "subscription_started",
              companyId,
              properties: { plan: planId, kind: "auto_renew" },
              dedupeKey: `subscription_started:${subscription.id}`,
            });
          }
        }
      } else if (
        [
          "subscription.cancelled",
          "subscription.halted",
          "subscription.completed",
        ].includes(event)
      ) {
        const stopped = await query(
          "UPDATE subscriptions SET auto_renew = false, updated_at = NOW() WHERE provider_subscription_id = $1 RETURNING company_id",
          [subscription.id],
        );
        if (stopped.rows[0]) {
          trackEvent({
            event: "subscription_cancelled",
            companyId: stopped.rows[0].company_id,
            properties: { reason: event.replace("subscription.", "") },
            dedupeKey: `subscription_cancelled:${subscription.id}`,
          });
        }
      }
      return res.json({ received: true });
    }
    if (
      (event === "payment.captured" || event === "order.paid") &&
      entity?.order_id
    ) {
      await completePayment(entity.order_id, entity.id);
    }
    res.json({ received: true });
  } catch (error) {
    console.error("Razorpay webhook error:", error.message);
    // A 5xx makes Razorpay retry later
    res.status(500).json({ message: "Webhook processing failed" });
  }
};

// POST /billing/upgrade-request { plan }
// No payment gateway is part of Phase 1, so an upgrade is recorded as a request
// for the team to complete (no fake payment flow).
export const requestUpgrade = async (req, res, next) => {
  try {
    const { company_id: companyId, id: userId } = req.user;
    const planId = String(req.body?.plan || "").toLowerCase();
    if (!PAID_PLAN_IDS.includes(planId)) {
      return res.status(400).json({ message: "Please choose a valid plan" });
    }

    const sub = await getOrCreateSubscription(companyId);
    if (sub.plan === planId && sub.status === "active") {
      return res
        .status(400)
        .json({ message: `You are already on the ${PLANS[planId].name} plan` });
    }

    await query(
      `UPDATE subscriptions
       SET requested_plan = $1, requested_at = NOW(), requested_by = $2, updated_at = NOW()
       WHERE company_id = $3`,
      [planId, userId, companyId],
    );

    await logAudit(req, "plan.upgrade_requested", {
      entityType: "subscription",
      details: { plan: planId },
    });
    trackEvent({
      event: "plan_selected",
      companyId,
      userId,
      properties: { plan: planId, kind: "upgrade_request" },
    });
    res.json({
      message: `Upgrade to ${PLANS[planId].name} requested. Our team will contact you to complete the payment.`,
      ...(await billingResponse(req)),
    });
  } catch (error) {
    next(error);
  }
};

// ---------- Auto-renew (Razorpay Subscriptions) ----------

// Razorpay plan id for an ORDR plan (created once per plan / price and remembered)
const getRazorpayPlanId = async (planId) => {
  const plan = PLANS[planId];
  const amount = plan.price * 100;
  const saved = await query(
    "SELECT provider_plan_id FROM razorpay_plans WHERE plan = $1 AND amount = $2",
    [planId, amount],
  );
  if (saved.rows[0]) return saved.rows[0].provider_plan_id;
  const created = await createRazorpayPlan({ name: plan.name, amount });
  await query(
    "INSERT INTO razorpay_plans (plan, amount, provider_plan_id) VALUES ($1, $2, $3) ON CONFLICT (plan, amount) DO NOTHING",
    [planId, amount, created.id],
  );
  return created.id;
};

// Records one paid month of a subscription (first charge or a renewal). Idempotent per payment id.
const recordSubscriptionPayment = async ({
  companyId,
  planId,
  paymentId,
  subscriptionId,
  userId = null,
}) => {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO payments (company_id, user_id, plan, amount, currency, provider_order_id, provider_payment_id, status, paid_at, kind, invoice_number)
       VALUES ($1, $2, $3, $4, 'INR', $5, $6, 'paid', NOW(), 'subscription', ${NEXT_INVOICE_NUMBER_SQL})
       ON CONFLICT (provider_order_id) DO NOTHING
       RETURNING id`,
      [
        companyId,
        userId,
        planId,
        PLANS[planId].price * 100,
        `sub_${paymentId}`,
        paymentId,
      ],
    );
    let prorationDays = 0;
    if (inserted.rows.length > 0) {
      ({ prorationDays } = await activatePlan(client, companyId, planId));
    }
    await client.query("COMMIT");
    lastProration.set(companyId, prorationDays);
    if (inserted.rows.length > 0)
      sendPaymentEmail(inserted.rows[0].id, companyId);
    return inserted.rows.length > 0;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

// POST /billing/subscribe { plan }: starts a monthly auto-renewing subscription checkout
export const createSubscriptionCheckout = async (req, res, next) => {
  try {
    const { company_id: companyId, full_name: fullName, email } = req.user;
    const planId = String(req.body?.plan || "").toLowerCase();
    if (!PAID_PLAN_IDS.includes(planId)) {
      return res.status(400).json({ message: "Please choose a valid plan" });
    }
    if (!isRazorpayConfigured()) {
      return res
        .status(503)
        .json({
          message: "Online payment is not set up yet",
          code: "PAYMENTS_NOT_CONFIGURED",
        });
    }
    await getOrCreateSubscription(companyId);

    const razorpayPlanId = await getRazorpayPlanId(planId);
    const subscription = await createRazorpaySubscription({
      planId: razorpayPlanId,
      notes: { company_id: companyId, plan: planId },
    });
    // Kept as pending until the first payment succeeds (an existing subscription stays active meanwhile)
    await query(
      "UPDATE subscriptions SET pending_subscription_id = $1, pending_subscription_plan = $2, updated_at = NOW() WHERE company_id = $3",
      [subscription.id, planId, companyId],
    );

    trackEvent({
      event: "plan_selected",
      companyId,
      userId: req.user.id,
      properties: { plan: planId, kind: "auto_renew" },
    });
    res.json({
      keyId: getRazorpayKeyId(),
      subscriptionId: subscription.id,
      planName: PLANS[planId].name,
      amount: PLANS[planId].price * 100,
      prefill: { name: fullName || "", email: email || "" },
    });
  } catch (error) {
    if (error.status === 502)
      return res.status(502).json({ message: error.message });
    next(error);
  }
};

// POST /billing/verify-subscription: after the first auto-renew payment in the browser
export const verifySubscriptionCheckout = async (req, res, next) => {
  try {
    const { company_id: companyId, id: userId } = req.user;
    const {
      razorpay_payment_id: paymentId,
      razorpay_subscription_id: subscriptionId,
      razorpay_signature: signature,
    } = req.body || {};

    const sub = await getOrCreateSubscription(companyId);
    // Pending (normal case) or already activated by the webhook
    const isPending =
      !!subscriptionId && subscriptionId === sub.pending_subscription_id;
    if (
      !isPending &&
      (!subscriptionId || subscriptionId !== sub.provider_subscription_id)
    ) {
      return res.status(404).json({ message: "Subscription not found" });
    }
    if (!verifySubscriptionSignature(paymentId, subscriptionId, signature)) {
      return res
        .status(400)
        .json({
          message:
            "Payment could not be verified. If money was deducted, it will be confirmed automatically or refunded.",
        });
    }

    const planId = isPending
      ? sub.pending_subscription_plan
      : sub.provider_subscription_plan;
    await recordSubscriptionPayment({
      companyId,
      planId,
      paymentId,
      subscriptionId,
      userId,
    });

    // The new subscription replaces any previous one (its future charges are stopped)
    if (
      sub.provider_subscription_id &&
      sub.provider_subscription_id !== subscriptionId &&
      sub.auto_renew
    ) {
      await cancelRazorpaySubscription(sub.provider_subscription_id).catch(
        (err) =>
          console.error("Could not cancel previous subscription:", err.message),
      );
    }
    await query(
      `UPDATE subscriptions
       SET provider_subscription_id = $1, provider_subscription_plan = $2, auto_renew = true,
           pending_subscription_id = NULL, pending_subscription_plan = NULL, updated_at = NOW()
       WHERE company_id = $3`,
      [subscriptionId, planId, companyId],
    );

    await logAudit(req, "plan.subscribed", {
      entityType: "subscription",
      entityId: subscriptionId,
      details: { plan: planId, payment_id: paymentId },
    });
    trackEvent({
      event: "subscription_started",
      companyId,
      userId,
      properties: { plan: planId, kind: "auto_renew" },
      dedupeKey: `subscription_started:${subscriptionId}`,
    });
    res.json({
      message: `Payment successful. Your ${PLANS[planId].name} plan is active and renews automatically every month.${prorationNote(companyId)}`,
      ...(await billingResponse(req)),
    });
  } catch (error) {
    next(error);
  }
};

// POST /billing/cancel-auto-renew: no more monthly charges; the paid period stays active
export const cancelAutoRenew = async (req, res, next) => {
  try {
    const { company_id: companyId } = req.user;
    const sub = await getOrCreateSubscription(companyId);
    if (!sub.auto_renew || !sub.provider_subscription_id) {
      return res.status(400).json({ message: "Auto-renew is not active" });
    }
    if (isRazorpayConfigured()) {
      await cancelRazorpaySubscription(sub.provider_subscription_id);
    }
    await query(
      "UPDATE subscriptions SET auto_renew = false, updated_at = NOW() WHERE company_id = $1",
      [companyId],
    );
    await logAudit(req, "plan.auto_renew_cancelled", {
      entityType: "subscription",
      entityId: sub.provider_subscription_id,
    });
    trackEvent({
      event: "subscription_cancelled",
      companyId,
      userId: req.user.id,
      properties: { reason: "user" },
      dedupeKey: `subscription_cancelled:${sub.provider_subscription_id}`,
    });
    res.json({
      message:
        "Auto-renew cancelled. Your plan stays active until the end of the paid period.",
      ...(await billingResponse(req)),
    });
  } catch (error) {
    if (error.status === 502)
      return res.status(502).json({ message: error.message });
    next(error);
  }
};

// ---------- Invoices ----------

const escapeHtml = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const inr = (paise) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// GET /billing/invoices/:id: printable invoice (GST-inclusive prices).
// Seller details come from INVOICE_SELLER_NAME / _ADDRESS / _GSTIN and GST_RATE (default 18).
// Loads a paid payment of the company with what its invoice shows (null when not found)
const loadInvoicePayment = async (paymentId, companyId) => {
  const { rows } = await query(
    `SELECT p.*, c.name AS company_name, u.full_name AS payer_name, u.email AS payer_email, u.gst_number AS payer_gstin
     FROM payments p
     JOIN companies c ON c.id = p.company_id
     LEFT JOIN users u ON u.id = p.user_id
     WHERE p.id = $1 AND p.company_id = $2 AND p.status = 'paid'`,
    [paymentId, companyId],
  );
  return rows[0] || null;
};

// The invoice / receipt page (also attached to the payment confirmation email)
const buildInvoiceHtml = (p) => {
  const sellerGstin = process.env.INVOICE_SELLER_GSTIN || "";
  const rate = Number(process.env.GST_RATE ?? 18);
  const taxable = Math.round(p.amount / (1 + rate / 100));
  const gst = p.amount - taxable;
  const title = sellerGstin ? "Tax Invoice" : "Payment Receipt";
  const date = new Date(p.paid_at).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const sellerName = process.env.INVOICE_SELLER_NAME || "ORDR";
  const sellerAddress = process.env.INVOICE_SELLER_ADDRESS || "";
  const planName = PLANS[p.plan]?.name || p.plan;
  const isSubscription = p.kind === "subscription";

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} ${escapeHtml(p.invoice_number || "")}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{--primary:#201d6a;--primary-soft:#f1f0fa;--text:#00022A;--muted:#626884;--border:#d9d8e6;--bg:#FBFBFB;--success:#2e7d32}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);font-family:"Poppins",Segoe UI,Arial,sans-serif;color:var(--text);font-size:14px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .toolbar{max-width:800px;margin:0px auto;padding:0px;display:flex;justify-content:flex-end;gap:10px}
  .btn{font-family:inherit;font-size:14px;font-weight:500;border-radius:8px;padding:9px 18px;cursor:pointer;border:1px solid var(--primary)}
  .btn-primary{background:var(--primary);color:#fff}
  .btn-outline{background:#fff;color:var(--primary)}
  .invoice{max-width:800px;margin:16px auto 32px;background:#fff;border:1px solid var(--border);border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(32,29,106,.06)}
  .head{background:var(--primary);color:#fff;padding:16px;display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap}
  .brand{font-size:26px;font-weight:700;letter-spacing:1px; line-height : 1;}
  .brand-sub{font-size:13px;opacity:.8;margin-top:0px;line-height:1.6;white-space:pre-line}
  .doc{text-align:right}
  .doc-title{font-size:20px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px}
  .paid{display:inline-block;margin-top:0px;background:#fff;color:var(--success);font-weight:600;font-size:12px;padding:4px 12px;border-radius:20px;letter-spacing:.5px}
  .invoice-body{padding:16px}
  .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;background:var(--primary-soft);border-radius:10px;padding:16px;}
  .label-invoice{font-size:12px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:0px}
  .value{font-size:14px;font-weight:600;word-break:break-all}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
  .party{border:1px solid var(--border);border-radius:10px;padding:16px 18px}
  .party-name{font-size:15px;font-weight:600;margin-bottom:4px}
  .muted{color:var(--muted);font-size:13px;line-height:1.6}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  thead th{background:var(--primary);color:#fff;font-weight:500;font-size:13px;padding:11px 14px;text-align:left}
  thead th:first-child{border-radius:8px 0 0 8px} thead th:last-child{border-radius:0 8px 8px 0}
  tbody td{padding:14px;border-bottom:1px solid var(--border);vertical-align:top}
  .right{text-align:right}
  .item-name{font-weight:600}
  .totals{margin-left:auto;margin-top:16px;width:320px;max-width:100%}
  .totals .row{display:flex;justify-content:space-between;padding:7px 0;color:var(--muted)}
  .totals .row span:last-child{color:var(--text);font-weight:500}
  .totals .grand{margin-top:6px;padding:12px 14px;background:var(--primary-soft);border-radius:8px;color:var(--primary);font-weight:700;font-size:16px}
  .totals .grand span:last-child{color:var(--primary);font-weight:700}
  .foot{margin-top:16px;padding-top:10px;border-top:1px dashed var(--border);display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
  .thanks{font-weight:600;color:var(--primary)}

  @media print{
  .toolbar{
  display : none;
  margin : 0px !important;
  }



    @page{margin:5mm}
  }
</style></head>
<body class="invoice-body">
<div class="toolbar">
  <button class="btn btn-outline" onclick="window.close()">Close</button>
  <button class="btn btn-primary" onclick="window.print()">Print / Save as PDF</button>
</div>
<div class="invoice">
  <div class="head">
    <div>
      <div class="brand">${escapeHtml(sellerName)}</div>
      ${sellerAddress ? `<div class="brand-sub">${escapeHtml(sellerAddress)}</div>` : '<div class="brand-sub">B2B Order Tracking Platform</div>'}
      ${sellerGstin ? `<div class="brand-sub">GSTIN: ${escapeHtml(sellerGstin)}</div>` : ""}
    </div>
    <div class="doc">
      <div class="doc-title">${escapeHtml(title)}</div>
      <span class="paid">&#10003; PAID</span>
    </div>
  </div>

  <div class="invoice-body">
    <div class="meta">
      <div><div class="label-invoice">${sellerGstin ? "Invoice No." : "Receipt No."}</div><div class="value">${escapeHtml(p.invoice_number || "—")}</div></div>
      <div><div class="label-invoice">Date</div><div class="value">${escapeHtml(date)}</div></div>
      <div><div class="label-invoice">Payment ID</div><div class="value">${escapeHtml(p.provider_payment_id || "—")}</div></div>
    </div>

    <div class="parties">
      <div class="party">
        <div class="label-invoice">Billed From</div>
        <div class="party-name">${escapeHtml(sellerName)}</div>
        ${sellerAddress ? `<div class="muted">${escapeHtml(sellerAddress)}</div>` : ""}
        ${sellerGstin ? `<div class="muted">GSTIN: ${escapeHtml(sellerGstin)}</div>` : ""}
      </div>
      <div class="party">
        <div class="label-invoice">Billed To</div>
        <div class="party-name">${escapeHtml(p.company_name)}</div>
        ${p.payer_name ? `<div class="muted">${escapeHtml(p.payer_name)}</div>` : ""}
        ${p.payer_email ? `<div class="muted">${escapeHtml(p.payer_email)}</div>` : ""}
        ${p.payer_gstin ? `<div class="muted">GSTIN: ${escapeHtml(p.payer_gstin)}</div>` : ""}
      </div>
    </div>

    <table>
      <thead><tr><th>Description</th><th>Period</th><th class="right">Amount</th></tr></thead>
      <tbody>
        <tr>
          <td><div class="item-name">ORDR ${escapeHtml(planName)} Plan</div>
            <div class="muted">${isSubscription ? "Monthly subscription (auto-renew)" : "One-time monthly payment"}</div></td>
          <td>1 month</td>
          <td class="right">${inr(taxable)}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="row"><span>Taxable Amount</span><span>${inr(taxable)}</span></div>
      <div class="row"><span>GST @ ${rate}%</span><span>${inr(gst)}</span></div>
      <div class="row grand"><span>Total Paid</span><span>${inr(p.amount)}</span></div>
    </div>

    <div class="foot">
      <div>
        <div class="thanks">Thank you for your business!</div>
        <div class="muted">Prices are inclusive of GST. Paid online via Razorpay.</div>
      </div>
      <div class="muted right">This is a computer-generated ${sellerGstin ? "invoice" : "receipt"}<br>and does not require a signature.</div>
    </div>
  </div>
</div>
</body></html>`;
};

// Payment confirmation email with the invoice attached as a PDF (same content as Billing > View).
// Goes to the user who paid, or to the company's admins for automatic renewals.
// Fire-and-forget: an email problem never affects the payment.
const sendPaymentEmail = (paymentId, companyId) => {
  (async () => {
    const p = await loadInvoicePayment(paymentId, companyId);
    if (!p) return;
    let recipients = p.payer_email
      ? [{ email: p.payer_email, name: p.payer_name }]
      : [];
    if (recipients.length === 0) {
      const admins = await query(
        `SELECT email, full_name AS name FROM users
         WHERE company_id = $1 AND role = 'admin' AND is_active = true AND removed_at IS NULL`,
        [companyId],
      );
      recipients = admins.rows;
    }
    if (recipients.length === 0) return;

    const sub = await query(
      "SELECT current_period_end FROM subscriptions WHERE company_id = $1",
      [companyId],
    );
    const periodEnd = sub.rows[0]?.current_period_end;
    const details = {
      companyName: p.company_name,
      planName: PLANS[p.plan]?.name || p.plan,
      amountText: inr(p.amount),
      invoiceNumber: p.invoice_number,
      validUntil: periodEnd
        ? new Date(periodEnd).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : null,
      isSubscription: p.kind === "subscription",
      billingLink: `${config.frontendUrl}/app/billing`,
    };
    // Invoice as PDF; if the PDF cannot be built, the same invoice page is attached instead
    const baseName = p.invoice_number || "ORDR-invoice";
    let attachment;
    try {
      attachment = {
        filename: `${baseName}.pdf`,
        content: await buildInvoicePdf(p),
        contentType: "application/pdf",
      };
    } catch (err) {
      console.error("Invoice PDF failed, attaching HTML instead:", err.message);
      attachment = {
        filename: `${baseName}.html`,
        content: buildInvoiceHtml(p),
        contentType: "text/html; charset=utf-8",
      };
    }
    for (const r of recipients) {
      await sendPaymentConfirmationEmail(
        r.email,
        { ...details, recipientName: r.name },
        attachment,
      );
    }
  })().catch((err) => console.error("Payment email failed:", err.message));
};

export const getInvoice = async (req, res, next) => {
  try {
    const { company_id: companyId } = req.user;
    const p = await loadInvoicePayment(req.params.id, companyId);
    if (!p) return res.status(404).json({ message: "Invoice not found" });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(buildInvoiceHtml(p));
  } catch (error) {
    next(error);
  }
};
