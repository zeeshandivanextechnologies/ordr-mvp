import { useState } from 'react';
import { FiCheck, FiZap, FiMail, FiBarChart2, FiUsers } from 'react-icons/fi';
import '../../styles/member.css';

export default function Billing() {
  const [selectedPlan, setSelectedPlan] = useState('growth');

  const currentPlan = {
    name: 'Growth',
    price: '2,499',
    billingCycle: 'Monthly',
    nextBilling: '15 Oct 2026',
    status: 'Active',
  };

  const usage = [
    { label: 'Orders Used', used: 127, total: 200, unit: '' },
    { label: 'AI Extractions', used: 89, total: 150, unit: '' },
    { label: 'Gmail Inboxes', used: 1, total: 1, unit: '' },
    { label: 'Team Members', used: 3, total: 5, unit: '' },
  ];

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
      badge: 'Current Plan',
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
                <span className="billing-detail-value">₹{currentPlan.price}/mo</span>
              </div>
              <div className="billing-detail-row">
                <span className="billing-detail-label">Billing Cycle</span>
                <span className="billing-detail-value">{currentPlan.billingCycle}</span>
              </div>
              <div className="billing-detail-row">
                <span className="billing-detail-label">Next Billing</span>
                <span className="billing-detail-value">{currentPlan.nextBilling}</span>
              </div>
              <div className="billing-detail-row border-0">
                <span className="billing-detail-label">Status</span>
                <span className="status-badge delivered">{currentPlan.status}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-8 col-md-6 col-sm-12 mb-3">
          <div className="member-card">
            <div className="member-card-header">
              <h5>Usage This Month</h5>
            </div>
            <div className="member-card-body">
              <div className="row">
                {usage.map((item, idx) => {
                  const pct = Math.round((item.used / item.total) * 100);
                  const isHigh = pct > 80;
                  return (
                    <div className="col-lg-6 col-md-6 col-sm-12 mb-2" key={idx}>
                      <div className="usage-item">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="usage-label">{item.label}</span>
                          <span className="usage-count">{item.used}/{item.total}</span>
                        </div>
                        <div className="usage-bar">
                          <div
                            className={`usage-bar-fill ${isHigh ? 'high' : ''}`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                        <span className="usage-pct">{pct}% used</span>
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
            <div className="member-card-header">
              <h5>Choose Your Plan</h5>
            </div>
            <div className="member-card-body">
              <div className="row">
                {plans.map((plan) => (
                  <div className="col-lg-3 col-md-6 col-sm-12 mb-3" key={plan.id}>
                    <div className={`billing-plan-card ${selectedPlan === plan.id ? 'selected' : ''} ${plan.badge ? 'current' : ''}`}>
                      {plan.badge && <span className="plan-badge">{plan.badge}</span>}
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
                      {plan.badge ? (
                        <button className="thm-btn outline w-100" disabled>Current Plan</button>
                      ) : (
                        <button className="thm-btn w-100" onClick={() => setSelectedPlan(plan.id)}>
                          Upgrade
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
