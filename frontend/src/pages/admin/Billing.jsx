import { useState, useEffect } from 'react';
import { FiCheck, FiZap, FiMail, FiBarChart2, FiUsers } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { loadRazorpay } from '../../utils/razorpay';
import { notifyBillingChanged } from '../../utils/billingEvents';
import '../../styles/member.css';

const formatDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusBadge = {
  trialing: { label: 'Trial', className: 'processing' },
  active: { label: 'Active', className: 'delivered' },
  expired: { label: 'Expired', className: 'delayed' },
  cancelled: { label: 'Cancelled', className: 'cancelled' },
};

export default function Billing() {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [data, setData] = useState(null);
  const [requesting, setRequesting] = useState(null);
  // Pay monthly automatically (Razorpay subscription) instead of a one-time month
  const [autoRenew, setAutoRenew] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let mounted = true;
    api
      .get('/billing')
      .then((res) => {
        if (mounted) setData(res.data);
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

  const handleUpgrade = async (plan) => {
    setSelectedPlan(plan.id);
    const isCurrentPlan = sub?.plan === plan.id && sub?.status === 'active';
    if (!data?.paymentsEnabled) await requestUpgrade(plan);
    // Renewing the current plan is always a one-time extra month
    else if (autoRenew && !isCurrentPlan) await subscribeWithRazorpay(plan);
    else await payWithRazorpay(plan);
  };

  const cancelAutoRenew = async () => {
    if (!window.confirm('Turn off auto-renew? Your plan stays active until the end of the paid period and will not be charged again.')) return;
    setCancelling(true);
    try {
      const res = await api.post('/billing/cancel-auto-renew');
      setData(res.data);
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
                <div className="billing-detail-row">
                  <span className="billing-detail-label">Auto-Renew</span>
                  <span className="billing-detail-value">
                    {sub?.autoRenew ? 'On' : 'Off'}
                    {sub?.autoRenew && (
                      <button type="button" className="btn btn-link btn-sm p-0 ms-2 text-danger" onClick={cancelAutoRenew} disabled={cancelling}>
                        {cancelling ? 'Cancelling...' : 'Cancel'}
                      </button>
                    )}
                  </span>
                </div>
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
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="autoRenewToggle"
                    checked={autoRenew}
                    onChange={(e) => setAutoRenew(e.target.checked)}
                    disabled={!!requesting}
                  />
                  <label className="form-check-label" htmlFor="autoRenewToggle" style={{ fontSize: 14 }}>
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

      {data?.payments && data.payments.length > 0 && (
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
                      <th>Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((p) => (
                      <tr key={p.paymentId || p.paidAt}>
                        <td>{formatDate(p.paidAt)}</td>
                        <td>{p.planName}</td>
                        <td>{p.currency === 'INR' ? '₹' : `${p.currency} `}{Number(p.amount).toLocaleString('en-IN')}</td>
                        <td>{p.paymentId || '—'}</td>
                        <td><span className="status-badge delivered">Paid</span></td>
                        <td>
                          {p.id ? (
                            <button type="button" className="thm-btn p-1 fz-14" onClick={() => viewInvoice(p.id)} title={p.invoiceNumber || ''}>
                              View
                            </button>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
