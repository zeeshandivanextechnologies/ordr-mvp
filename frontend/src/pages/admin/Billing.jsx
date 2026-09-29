import { useState, useEffect } from 'react';
import { FiCheck, FiZap, FiMail, FiBarChart2, FiUsers } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { loadRazorpay } from '../../utils/razorpay';
import { notifyBillingChanged } from '../../utils/billingEvents';
import BootstrapPagination from '../../components/BootstrapPagination';
import '../../styles/member.css';

const formatDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Remembers the admin's "Auto-renew monthly" choice across page reloads (this browser only)
const AUTO_RENEW_PREF_KEY = 'ordr:billing:auto-renew';

const statusBadge = {
  trialing: { label: 'Trial', className: 'processing' },
  active: { label: 'Active', className: 'delivered' },
  expired: { label: 'Expired', className: 'delayed' },
  cancelled: { label: 'Cancelled', className: 'cancelled' },
};

export default function Billing() {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [data, setData] = useState(null);
  // Payment History: 10 payments per page
  const [paymentsOffset, setPaymentsOffset] = useState(0);
  const [requesting, setRequesting] = useState(null);
  // Pay monthly automatically (Razorpay subscription) instead of a one-time month
  const [autoRenew, setAutoRenew] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let mounted = true;
    api
      .get('/billing')
      .then((res) => {
        if (!mounted) return;
        setData(res.data);
        // Switch starts ON when auto-renew is active, otherwise as the admin last left it
        let saved = null;
        try { saved = localStorage.getItem(AUTO_RENEW_PREF_KEY); } catch { /* storage unavailable */ }
        setAutoRenew(res.data?.subscription?.autoRenew ? true : saved === 'on');
      })
      .catch(() => {
        if (mounted) toast.error('Failed to load billing details');
      });
    return () => {
      mounted = false;
    };
  }, []);

  const sub = data?.subscription;
  const isTrial = sub?.plan === 'trial';
  // A paid plan is running: the auto-renew switch then shows / changes the real auto-renew status
  const hasActivePaidPlan = !!sub && !isTrial && sub.status === 'active';
  const autoRenewOn = hasActivePaidPlan ? !!sub.autoRenew : autoRenew;
  const badge = statusBadge[sub?.status] || { label: sub?.status || '—', className: '' };

  const currentPlan = {
    name: sub ? sub.planName : '—',
    price: sub ? (isTrial ? 'Free' : `₹${Number(sub.price).toLocaleString('en-IN')}/mo`) : '—',
    billingCycle: sub ? (isTrial ? `${sub.trialDays}-day trial` : 'Monthly') : '—',
    nextBillingLabel: isTrial ? 'Trial Ends' : 'Next Billing',
    nextBilling: sub ? formatDate(isTrial ? sub.trialEndsAt : sub.currentPeriodEnd) : '—',
    status: badge.label,
    statusClass: badge.className,
  };

  // null limit = unlimited
  const usage = data
    ? [
        { label: 'Orders Used', used: data.usage.orders, total: data.limits.ordersPerMonth },
        { label: 'AI Extractions', used: data.usage.aiExtractions, total: data.limits.aiExtractions },
        { label: 'Gmail Inboxes', used: data.usage.gmailInboxes, total: data.limits.gmailInboxes },
        { label: 'Team Members', used: data.usage.users, total: data.limits.users },
      ]
    : [];

  // Without online payment set up, an upgrade is recorded as a request for the team
  const requestUpgrade = async (plan) => {
    if (!window.confirm(`Request an upgrade to the ${plan.name} plan (₹${plan.price}/month)? Our team will contact you to complete the payment.`)) return;
    setRequesting(plan.id);
    try {
      const res = await api.post('/billing/upgrade-request', { plan: plan.id });
      setData(res.data);
      notifyBillingChanged();
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to request the upgrade');
    } finally {
      setRequesting(null);
    }
  };

  // Razorpay checkout: pay for one month of the plan; the backend verifies and activates it
  const payWithRazorpay = async (plan) => {
    setRequesting(plan.id);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) {
        toast.error('Could not load the payment window. Check your internet connection and try again.');
        setRequesting(null);
        return;
      }
      const { data: checkout } = await api.post('/billing/checkout', { plan: plan.id });
      const razorpay = new window.Razorpay({
        key: checkout.keyId,
        order_id: checkout.orderId,
        amount: checkout.amount,
        currency: checkout.currency,
        name: 'ORDR',
        description: `${checkout.planName} plan - 1 month`,
        prefill: { ...checkout.prefill },
        notes: { plan: plan.id },
        theme: { color: '#2D4735' },
        handler: async (response) => {
          try {
            const res = await api.post('/billing/verify', response);
            setData(res.data);
            notifyBillingChanged();
            toast.success(res.data.message);
          } catch (err) {
            toast.error(err.response?.data?.message || 'Payment could not be verified');
          } finally {
            setRequesting(null);
          }
        },
        modal: { ondismiss: () => setRequesting(null) },
      });
      razorpay.on('payment.failed', (resp) => {
        toast.error(resp?.error?.description || 'Payment failed. Please try again.');
        setRequesting(null);
      });
      razorpay.open();
    } catch (err) {
      if (err.response?.data?.code === 'PAYMENTS_NOT_CONFIGURED') {
        setRequesting(null);
        await requestUpgrade(plan);
        return;
      }
      toast.error(err.response?.data?.message || 'Failed to start the payment');
      setRequesting(null);
    }
  };

  // Razorpay subscription checkout: first month now, then charged automatically every month
  const subscribeWithRazorpay = async (plan) => {
    setRequesting(plan.id);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) {
        toast.error('Could not load the payment window. Check your internet connection and try again.');
        setRequesting(null);
        return;
      }
      const { data: checkout } = await api.post('/billing/subscribe', { plan: plan.id });
      const razorpay = new window.Razorpay({
        key: checkout.keyId,
        subscription_id: checkout.subscriptionId,
        name: 'ORDR',
        description: `${checkout.planName} plan - monthly auto-renew`,
        prefill: { ...checkout.prefill },
        notes: { plan: plan.id },
        theme: { color: '#2D4735' },
        handler: async (response) => {
          try {
            const res = await api.post('/billing/verify-subscription', response);
            setData(res.data);
            notifyBillingChanged();
            toast.success(res.data.message);
          } catch (err) {
            toast.error(err.response?.data?.message || 'Payment could not be verified');
          } finally {
            setRequesting(null);
          }
        },
        modal: { ondismiss: () => setRequesting(null) },
      });
      razorpay.on('payment.failed', (resp) => {
        toast.error(resp?.error?.description || 'Payment failed. Please try again.');
        setRequesting(null);
      });
      razorpay.open();
    } catch (err) {
      if (err.response?.data?.code === 'PAYMENTS_NOT_CONFIGURED') {
        setRequesting(null);
        await requestUpgrade(plan);
        return;
      }
      toast.error(err.response?.data?.message || 'Failed to start the payment');
      setRequesting(null);
    }
  };

  // The switch only decides how the next plan is paid (subscription vs one-time month)
  // With a paid plan running, the switch IS auto-renew: ON starts it for the current plan
  // (Razorpay subscription, paid now, plan extended by a month), OFF cancels it.
  // Without one (trial / expired), it only chooses how the next plan is paid.
  const handleAutoRenewToggle = async (checked) => {
    if (hasActivePaidPlan) {
      if (checked && !sub.autoRenew) {
        const currentPlanOption = plans.find((p) => p.id === sub.plan);
        if (!currentPlanOption) return;
        const price = `₹${Number(sub.price).toLocaleString('en-IN')}`;
        if (!window.confirm(`Start auto-renew for your ${sub.planName} plan? You pay ${price} now, your plan is extended by 1 month, and it then renews automatically every month. You can cancel anytime.`)) return;
        await subscribeWithRazorpay(currentPlanOption);
        return;
      }
      if (!checked && sub.autoRenew) {
        await cancelAutoRenew();
        return;
      }
      return;
    }

    setAutoRenew(checked);
    try { localStorage.setItem(AUTO_RENEW_PREF_KEY, checked ? 'on' : 'off'); } catch { /* storage unavailable */ }
    if (checked) {
      toast.info('Auto-renew on: the plan you choose next will renew automatically every month. You can cancel anytime.');
    } else {
      toast.info('Auto-renew off: the plan you choose next will be a one-time payment for 1 month.');
    }
  };

  const handleUpgrade = async (plan) => {
    setSelectedPlan(plan.id);
    const isCurrentPlan = sub?.plan === plan.id && sub?.status === 'active';
    if (!data?.paymentsEnabled) await requestUpgrade(plan);
    // Renewing the current plan is always a one-time extra month
    else if (autoRenewOn && !isCurrentPlan) await subscribeWithRazorpay(plan);
    else await payWithRazorpay(plan);
  };

  const cancelAutoRenew = async () => {
    if (!window.confirm('Turn off auto-renew? Your plan stays active until the end of the paid period and will not be charged again.')) return;
    setCancelling(true);
    try {
      const res = await api.post('/billing/cancel-auto-renew');
      setData(res.data);
      // The "Auto-renew monthly" switch follows: the next plan will be a one-time payment
      setAutoRenew(false);
      try { localStorage.setItem(AUTO_RENEW_PREF_KEY, 'off'); } catch { /* storage unavailable */ }
      notifyBillingChanged();
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel auto-renew');
    } finally {
      setCancelling(false);
    }
  };

  // The invoice needs the login token, so it is fetched first and then opened as a page
  const viewInvoice = async (paymentRowId) => {
    const win = window.open('', '_blank');
    try {
      const res = await api.get(`/billing/invoices/${paymentRowId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/html' }));
      if (win) win.location.href = url;
      else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      if (win) win.close();
      toast.error('Failed to load the invoice');
    }
  };

  // Downloads the same invoice page as a PDF. It is rendered in a hidden frame so its
  // styles never touch the app, then captured (html2canvas) and saved as an A4 PDF (jsPDF).
  const [downloadingId, setDownloadingId] = useState(null);
  const downloadInvoice = async (paymentRowId, invoiceNumber) => {
    if (downloadingId) return;
    setDownloadingId(paymentRowId);
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('tabindex', '-1');
    Object.assign(frame.style, { position: 'fixed', left: '-10000px', top: '0', width: '840px', height: '1200px', border: '0' });
    try {
      const res = await api.get(`/billing/invoices/${paymentRowId}`, { responseType: 'text' });
      document.body.appendChild(frame);
      await new Promise((resolve) => {
        frame.onload = resolve;
        frame.srcdoc = res.data;
      });
      const doc = frame.contentDocument;
      if (doc.fonts?.ready) await doc.fonts.ready;
      const invoice = doc.querySelector('.invoice');
      if (!invoice) throw new Error('Invoice not found');

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const canvas = await html2canvas(invoice, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const margin = 8;
      const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2;
      const pageHeight = pdf.internal.pageSize.getHeight() - margin * 2;
      let width = pageWidth;
      let height = (canvas.height * width) / canvas.width;
      if (height > pageHeight) {
        height = pageHeight;
        width = (canvas.width * height) / canvas.height;
      }
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', margin + (pageWidth - width) / 2, margin, width, height);
      pdf.save(`${invoiceNumber || 'ORDR-invoice'}.pdf`);
    } catch {
      toast.error('Failed to download the invoice');
    } finally {
      frame.remove();
      setDownloadingId(null);
    }
  };

  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      price: '999',
      period: '/month',
      icon: <FiMail />,
      features: [
        { text: '2 users', included: true },
        { text: '50 orders/month', included: true },
        { text: '1 Gmail inbox', included: true },
        { text: '25 AI extractions', included: true },
        { text: '3 months history', included: true },
        { text: 'Excel export', included: false },
        { text: 'Priority support', included: false },
        { text: 'Advanced reporting', included: false },
      ],
    },
    {
      id: 'growth',
      name: 'Growth',
      price: '2,499',
      period: '/month',
      icon: <FiZap />,
      features: [
        { text: '5 users', included: true },
        { text: '200 orders/month', included: true },
        { text: '1 Gmail inbox', included: true },
        { text: '150 AI extractions', included: true },
        { text: '12 months history', included: true },
        { text: 'Excel export', included: true },
        { text: 'Priority support', included: false },
        { text: 'Advanced reporting', included: false },
      ],
    },
    {
      id: 'business',
      name: 'Business',
      price: '4,999',
      period: '/month',
      icon: <FiBarChart2 />,
      features: [
        { text: '10 users', included: true },
        { text: '750 orders/month', included: true },
        { text: '3 Gmail inboxes', included: true },
        { text: '600 AI extractions', included: true },
        { text: '24 months history', included: true },
        { text: 'Priority support', included: true },
        { text: 'Advanced reporting', included: true },
        { text: 'Excel export', included: true },
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '9,999',
      period: '/month',
      icon: <FiUsers />,
      features: [
        { text: '25 users', included: true },
        { text: '2,000 orders/month', included: true },
        { text: '5 Gmail inboxes', included: true },
        { text: '1,500 AI extractions', included: true },
        { text: 'Unlimited history', included: true },
        { text: 'Priority support', included: true },
        { text: 'Advanced reporting', included: true },
        { text: 'Excel export', included: true },
      ],
    },
  ];

  return (
    <>
      <div className="row">
        <div className="col-lg-12">
          <div className="member-page-header">
            <div>
              <h2>Billing & Subscription</h2>
              <p>Manage your plan, usage, and payment settings</p>
            </div>
          </div>
        </div>
      </div>

      {sub?.status === 'expired' && (
        <div className="row">
          <div className="col-lg-12">
            <div className="alert alert-warning">
              {isTrial ? 'Your free trial has ended.' : 'Your plan has expired.'} Your data is safe and has not been deleted. Choose a plan below to continue.
            </div>
          </div>
        </div>
      )}

      <div className="row mb-4">
        <div className="col-lg-4 col-md-6 col-sm-12 mb-3">
          <div className="member-card h-100">
            <div className="member-card-body">
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="kpi-icon" style={{ background: 'var(--primary-color)', color: '#fff' }}>
                  <FiZap />
                </div>
                <div>
                  <h6 className="mb-0" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Current Plan</h6>
                  <h4 className="mb-0" style={{ fontSize: 20, fontWeight: 700 }}>{currentPlan.name}</h4>
                </div>
              </div>
              <div className="billing-detail-row">
                <span className="billing-detail-label">Price</span>
                <span className="billing-detail-value">{currentPlan.price}</span>
              </div>
              <div className="billing-detail-row">
                <span className="billing-detail-label">Billing Cycle</span>
                <span className="billing-detail-value">{currentPlan.billingCycle}</span>
              </div>
              <div className="billing-detail-row">
                <span className="billing-detail-label">{currentPlan.nextBillingLabel}</span>
                <span className="billing-detail-value">{currentPlan.nextBilling}</span>
              </div>
              {isTrial && sub?.daysLeft !== null && sub?.status === 'trialing' && (
                <div className="billing-detail-row">
                  <span className="billing-detail-label">Days Left</span>
                  <span className="billing-detail-value">{sub.daysLeft}</span>
                </div>
              )}
              {sub?.requestedPlan && (
                <div className="billing-detail-row">
                  <span className="billing-detail-label">Upgrade Requested</span>
                  <span className="billing-detail-value text-capitalize">{sub.requestedPlan} ({formatDate(sub.requestedAt)})</span>
                </div>
              )}
              {!isTrial && data?.paymentsEnabled && (
                <>
                  <div className="billing-detail-row">
                    <span className="billing-detail-label">Auto-Renew</span>
                    <span className="billing-detail-value d-flex align-items-center gap-2">
                      <span className={`status-badge ${sub?.autoRenew ? 'delivered' : 'cancelled'}`}>
                        {sub?.autoRenew ? 'On' : 'Off'}
                      </span>
                      {sub?.autoRenew && (
                        <button type="button" className="thm-btn outline fz-14 auto-renew-cancel" onClick={cancelAutoRenew} disabled={cancelling}>
                          {cancelling ? 'Cancelling...' : 'Cancel'}
                        </button>
                      )}
                    </span>
                  </div>
                  {!sub?.autoRenew && !hasActivePaidPlan && autoRenew && (
                    <div className="auto-renew-note">Auto-renew will start with the next plan you choose below.</div>
                  )}
                </>
              )}
              <div className="billing-detail-row border-0">
                <span className="billing-detail-label">Status</span>
                <span className={`status-badge ${currentPlan.statusClass}`}>{currentPlan.status}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-8 col-md-6 col-sm-12 mb-3">
          <div className="member-card">
            <div className="member-card-header">
              <h5>{data?.usagePeriod === 'trial' ? 'Usage During Trial' : 'Usage This Month'}</h5>
            </div>
            <div className="member-card-body">
              <div className="row">
                {usage.map((item, idx) => {
                  const unlimited = item.total === null || item.total === undefined;
                  const pct = unlimited ? 0 : Math.min(Math.round((item.used / item.total) * 100), 100);
                  const isHigh = pct > 80;
                  return (
                    <div className="col-lg-6 col-md-6 col-sm-12 mb-2" key={idx}>
                      <div className="usage-item">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="usage-label">{item.label}</span>
                          <span className="usage-count">{unlimited ? `${item.used} / Unlimited` : `${item.used}/${item.total}`}</span>
                        </div>
                        <div className="usage-bar">
                          <div
                            className={`usage-bar-fill ${isHigh ? 'high' : ''}`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                        <span className="usage-pct">{unlimited ? 'No limit' : `${pct}% used`}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-12">
          <div className="member-card">
            <div className="member-card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
              <h5>Choose Your Plan</h5>
              {data?.paymentsEnabled && (
                <div className={`auto-renew-toggle${autoRenewOn ? ' on' : ''}`}>
                  <div className="theme-switch">
                    <input
                      type="checkbox"
                      id="autoRenewToggle"
                      checked={autoRenewOn}
                      onChange={(e) => handleAutoRenewToggle(e.target.checked)}
                      disabled={!!requesting || cancelling}
                    />
                    <label className="switch-slider" htmlFor="autoRenewToggle"></label>
                  </div>
                  <label className="auto-renew-label" htmlFor="autoRenewToggle">
                    Auto-renew monthly
                  </label>
                </div>
              )}
            </div>
            <div className="member-card-body">
              <div className="row">
                {plans.map((plan) => {
                  // "Current Plan" only for the company's active paid plan
                  const isCurrent = sub?.plan === plan.id && sub?.status === 'active';
                  // With online payment, a pending request never blocks paying for that plan
                  const isRequested = sub?.requestedPlan === plan.id && !isCurrent && !data?.paymentsEnabled;
                  const badgeText = isCurrent ? 'Current Plan' : isRequested ? 'Requested' : null;
                  return (
                  <div className="col-lg-3 col-md-6 col-sm-12 mb-3" key={plan.id}>
                    <div className={`billing-plan-card ${selectedPlan === plan.id ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}>
                      {badgeText && <span className="plan-badge">{badgeText}</span>}
                      <div className="billing-plan-icon">{plan.icon}</div>
                      <h4 className="plan-name">{plan.name}</h4>
                      <div className="plan-price">
                        <span className="plan-amount">₹{plan.price}</span>
                        <span className="plan-period">{plan.period}</span>
                      </div>
                      <ul className="plan-features">
                        {plan.features.map((f, i) => (
                          <li key={i} className={f.included ? '' : 'disabled'}>
                            <FiCheck size={14} className={f.included ? 'text-success' : 'text-muted'} />
                            {f.text}
                          </li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        data?.paymentsEnabled ? (
                          // Pay again to extend the current plan by one more month
                          <button className="thm-btn outline w-100" onClick={() => handleUpgrade(plan)} disabled={!!requesting}>
                            {requesting === plan.id ? 'Processing...' : 'Renew (+1 month)'}
                          </button>
                        ) : (
                          <button className="thm-btn outline w-100" disabled>Current Plan</button>
                        )
                      ) : isRequested ? (
                        <button className="thm-btn outline w-100" disabled>Upgrade Requested</button>
                      ) : (
                        <button className="thm-btn w-100" onClick={() => handleUpgrade(plan)} disabled={!data || !!requesting}>
                          {requesting === plan.id ? (data?.paymentsEnabled ? 'Processing...' : 'Requesting...') : isTrial ? 'Choose Plan' : 'Upgrade'}
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {data?.payments && data.payments.length > 0 && (() => {
        const PAYMENTS_PER_PAGE = 10;
        // Stay on a page that has rows (e.g. the list got shorter)
        const start = paymentsOffset >= data.payments.length
          ? Math.floor((data.payments.length - 1) / PAYMENTS_PER_PAGE) * PAYMENTS_PER_PAGE
          : paymentsOffset;
        const pagePayments = data.payments.slice(start, start + PAYMENTS_PER_PAGE);
        return (
        <div className="row mt-3">
          <div className="col-lg-12">
            <div className="member-card">
              <div className="member-card-header">
                <h5>Payment History</h5>
              </div>
              <div className="table-responsive">
                <table className="member-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Plan</th>
                      <th>Amount</th>
                      <th>Payment ID</th>
                      <th>Status</th>
                      <th className='text-center'>Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagePayments.map((p) => (
                      <tr key={p.paymentId || p.paidAt}>
                        <td>{formatDate(p.paidAt)}</td>
                        <td>{p.planName}</td>
                        <td>{p.currency === 'INR' ? '₹' : `${p.currency} `}{Number(p.amount).toLocaleString('en-IN')}</td>
                        <td>{p.paymentId || '—'}</td>
                        <td><span className="status-badge delivered">Paid</span></td>
                        <td>
                          {p.id ? (
                            <div className="d-flex gap-2 justify-content-center align-items-center">
                              <button type="button" className="thm-btn p-1 fz-14" onClick={() => viewInvoice(p.id)} title={p.invoiceNumber || ''}>
                                View
                              </button>
                              <button
                                type="button"
                                className="thm-btn outline p-1 fz-14"
                                onClick={() => downloadInvoice(p.id, p.invoiceNumber)}
                                disabled={!!downloadingId}
                                title={p.invoiceNumber ? `Download ${p.invoiceNumber}.pdf` : 'Download PDF'}
                              >
                                {downloadingId === p.id ? 'Downloading...' : 'Download'}
                              </button>
                            </div>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <BootstrapPagination total={data.payments.length} limit={PAYMENTS_PER_PAGE} offset={start} onChange={setPaymentsOffset} />
            </div>
          </div>
        </div>
        );
      })()}
    </>
  );
}
