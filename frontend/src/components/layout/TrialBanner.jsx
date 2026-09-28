import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiClock, FiX, FiZap, FiPackage, FiCpu } from 'react-icons/fi';
import api from '../../services/api';
import { useAuth } from '../AuthProvider';
import { onBillingChanged } from '../../utils/billingEvents';
import '../../styles/member.css';

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function TrialBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [billing, setBilling] = useState(null);
  const { role } = useAuth();
  const { pathname } = useLocation();

  const loadBilling = useCallback(() => {
    api
      .get('/billing')
      .then((res) => setBilling(res.data))
      .catch(() => {});
  }, []);

  // Reload on every page change so usage stays current after new orders / uploads
  useEffect(() => {
    loadBilling();
  }, [pathname, loadBilling]);

  // Reload right away after a payment or upgrade request on the Billing page
  useEffect(() => onBillingChanged(loadBilling), [loadBilling]);

  // Shown during the free trial, and whenever the trial / plan has ended (read-only)
  if (dismissed || !billing) return null;
  if (billing.subscription.plan !== 'trial' && billing.subscription.status !== 'expired') return null;
  const isPaidPlan = billing.subscription.plan !== 'trial';

  const sub = billing.subscription;
  const expired = sub.status === 'expired';
  const trial = {
    daysLeft: sub.daysLeft ?? 0,
    totalDays: sub.trialDays,
    endDate: formatDate(sub.trialEndsAt),
    ordersUsed: billing.usage.orders,
    ordersLimit: billing.limits.ordersPerMonth,
    aiUsed: billing.usage.aiExtractions,
    aiLimit: billing.limits.aiExtractions,
  };
  const barWidth = (used, limit) => `${limit ? Math.min((used / limit) * 100, 100) : 0}%`;

  const isUrgent = expired || trial.daysLeft <= 3;

  return (
    <div className={`trial-banner ${isUrgent ? 'urgent' : ''}`}>
      <div className="trial-banner-content">
        <div className='trail-main-box'>
          <div className="trial-banner-icon">
          <FiClock />
        </div>

        <div className="trial-banner-info">
          <div className="d-flex align-items-center gap-2">
            <span className="trial-banner-title">
              {isPaidPlan ? `${sub.planName} Plan` : 'Free Trial'}
            </span>
            <span className={`trial-urgency-badge ${isUrgent ? 'urgent' : ''}`}>
              {expired ? (isPaidPlan ? 'Expired' : 'Ended') : `${trial.daysLeft} day${trial.daysLeft === 1 ? '' : 's'} left`}
            </span>
          </div>
          <div className="trial-banner-sub">
            {isPaidPlan
              ? `Plan expired on ${formatDate(sub.currentPeriodEnd)}. Your data is safe - renew to keep adding orders.`
              : expired
                ? `Trial ended on ${trial.endDate}. Your data is safe - choose a plan to keep adding orders.`
                : `Trial ends on ${trial.endDate}`}
          </div>
        </div>
        </div>

        <div className='trail-exit-box'>
          <div className="trial-banner-stats">
          <div className="trial-stat">
            <FiPackage size={14} />
            <span className="trial-stat-text">{trial.ordersUsed}/{trial.ordersLimit} Orders</span>
            <div className="trial-stat-bar">
              <div
                className="trial-stat-bar-fill"
                style={{ width: barWidth(trial.ordersUsed, trial.ordersLimit) }}
              ></div>
            </div>
          </div>
          <div className="trial-stat">
            <FiCpu size={14} />
            <span className="trial-stat-text">{trial.aiUsed}/{trial.aiLimit} AI</span>
            <div className="trial-stat-bar">
              <div
                className="trial-stat-bar-fill"
                style={{ width: barWidth(trial.aiUsed, trial.aiLimit) }}
              ></div>
            </div>
          </div>
        </div>

        <div className="trial-banner-actions">
          {role === 'admin' && (
            <Link to="/app/billing" className="thm-btn py-2 px-3" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
              <FiZap /> Upgrade
            </Link>
          )}
          <button className="trial-dismiss-btn" onClick={() => setDismissed(true)}>
            <FiX />
          </button>
        </div>
        </div>



      </div>
    </div>
  );
}
