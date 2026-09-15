import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import '../../styles/onboarding.css';

export default function GoToDashboard() {
  const steps = [
    { num: 1, label: 'Company Details', completed: true },
    { num: 2, label: 'What to Track', completed: true },
    { num: 3, label: 'Connect Inbox', completed: true },
    { num: 4, label: 'Invite Team', completed: true },
    { num: 5, label: 'All Set!', active: true },
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
          <Link to="/onboarding/team" className="back-arrow"><FiArrowLeft /></Link>
          <span className="step-counter">5 of 5</span>
        </div>

        <div className="onboarding-content centered">
          <div className="all-set-content">
            <div className="all-set-icon">
              <FiCheckCircle />
            </div>
            <h1 className="onboarding-heading">All set!</h1>
            <p className="onboarding-desc">You're ready to start tracking your orders. Your workspace is set up and ready to go.</p>
            <Link to="/" className="go-dashboard-btn">Go to Dashboard</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
