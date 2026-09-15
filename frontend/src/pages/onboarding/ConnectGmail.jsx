import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import '../../styles/onboarding.css';

export default function ConnectGmail() {
  const steps = [
    { num: 1, label: 'Company Details', completed: true },
    { num: 2, label: 'What to Track', completed: true },
    { num: 3, label: 'Connect Inbox', active: true },
    { num: 4, label: 'Invite Team', active: false },
    { num: 5, label: 'All Set!', active: false },
  ];

  return (
    <div className="onboarding-page">
      <div className="onboarding-sidebar">
        <div className="sidebar-steps">
          {steps.map((step) => (
            <div key={step.num} className={`sidebar-step ${step.active ? 'active' : ''} ${step.completed ? 'completed' : ''}`}>
              <div className="step-circle">{step.completed ? '✓' : step.num}</div>
              <span className="step-label">{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="onboarding-main">
        <div className="onboarding-header">
          <Link to="/onboarding/track" className="back-arrow"><FiArrowLeft /></Link>
          <span className="step-counter">3 of 5</span>
        </div>

        <div className="onboarding-content centered">
          <h1 className="onboarding-heading">Connect your inbox</h1>
          <p className="onboarding-desc">We'll scan your emails to find orders, confirmations and delivery updates.</p>

          <div className="email-providers">
            <div className="provider-card recommended">
              <div className="provider-logo gmail-logo">
                <svg width="40" height="40" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M6 12l18 13L42 12v-2c0-2-1.5-4-4-4H10C7 6 5 8 5 10v2z"/>
                  <path fill="#4285F4" d="M42 12l-18 13L6 12"/>
                  <path fill="#34A853" d="M6 36V12l18 13"/>
                  <path fill="#FBBC05" d="M42 36V12L24 25"/>
                  <rect fill="#C5221F" x="5" y="36" width="38" height="2" rx="1"/>
                </svg>
              </div>
              <h5>Gmail</h5>
              <span className="provider-badge recommended-badge">Recommended</span>
              <button className="provider-btn primary">Connect Gmail</button>
            </div>

            <div className="provider-card coming-soon">
              <div className="provider-logo outlook-logo">
                <svg width="40" height="40" viewBox="0 0 48 48">
                  <rect x="4" y="8" width="28" height="32" rx="2" fill="#0078D4"/>
                  <ellipse cx="18" cy="24" rx="8" ry="10" fill="#fff"/>
                  <rect x="28" y="12" width="16" height="24" rx="2" fill="#0364B8"/>
                  <path fill="#1490DF" d="M28 12l8 4v16l-8-4"/>
                </svg>
              </div>
              <h5>Outlook</h5>
              <span className="provider-badge coming-soon-badge">Coming soon</span>
              <button className="provider-btn outline" disabled>Notify me</button>
            </div>
          </div>

          <div className="provider-features">
            <div className="feature-check"><span className="check-icon">✓</span> Secure & read-only</div>
            <div className="feature-check"><span className="check-icon">✓</span> Finds orders automatically</div>
          </div>

          <div className="onboarding-nav">
            <Link to="/onboarding/track" className="nav-back">Back</Link>
            <Link to="/onboarding/team" className="nav-skip">Skip for now</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
