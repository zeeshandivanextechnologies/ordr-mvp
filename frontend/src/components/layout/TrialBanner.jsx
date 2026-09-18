import { useState } from 'react';
import { FiClock, FiX, FiZap, FiPackage, FiCpu } from 'react-icons/fi';
import '../../styles/member.css';

export default function TrialBanner() {
  const [dismissed, setDismissed] = useState(false);

  const trial = {
    daysLeft: 9,
    totalDays: 14,
    startDate: '3 Sep 2026',
    endDate: '17 Sep 2026',
    ordersUsed: 47,
    ordersLimit: 100,
    aiUsed: 32,
    aiLimit: 100,
  };

  const daysPassed = trial.totalDays - trial.daysLeft;
  const progressPct = Math.round((daysPassed / trial.totalDays) * 100);
  const isUrgent = trial.daysLeft <= 3;

  if (dismissed) return null;

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
              Free Trial
            </span>
            <span className={`trial-urgency-badge ${isUrgent ? 'urgent' : ''}`}>
              {isUrgent ? `${trial.daysLeft} days left` : `${trial.daysLeft} days left`}
            </span>
          </div>
          <div className="trial-banner-sub">
            Trial ends on {trial.endDate}
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
                style={{ width: `${(trial.ordersUsed / trial.ordersLimit) * 100}%` }}
              ></div>
            </div>
          </div>
          <div className="trial-stat">
            <FiCpu size={14} />
            <span className="trial-stat-text">{trial.aiUsed}/{trial.aiLimit} AI</span>
            <div className="trial-stat-bar">
              <div
                className="trial-stat-bar-fill"
                style={{ width: `${(trial.aiUsed / trial.aiLimit) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="trial-banner-actions">
          <a href="/app/billing" className="thm-btn py-2 px-3" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
            <FiZap /> Upgrade
          </a>
          <button className="trial-dismiss-btn" onClick={() => setDismissed(true)}>
            <FiX />
          </button>
        </div>
        </div>



      </div>
    </div>
  );
}
