import React from 'react';
import { Link } from 'react-router-dom';
import { FiMoreHorizontal, FiCheckCircle } from 'react-icons/fi';
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
      <div className="container">
        <div className="row">
          <div className="col-lg-12">
            <div className="onboarding-header">
              <div>
                <Link to="/" className="sidebar-brand">ORDR</Link>
              </div>
              <div>
                <button className="header-more-btn"><FiMoreHorizontal /></button>
              </div>
            </div>
          </div>

          <div className="col-lg-3 col-xl-2 onboarding-sidebar">
            <div className="sidebar-steps">
              {steps.map((step, index) => (
                <div key={step.num} className={`sidebar-step ${step.active ? 'active' : ''} ${step.completed ? 'completed' : ''}`}>
                  <div className="step-circle">{step.completed ? '✓' : step.num}</div>
                  <span className="step-label">{step.label}</span>
                  {index < steps.length - 1 && <div className="step-line"></div>}
                </div>
              ))}
            </div>
          </div>

          <div className="col-lg-6 col-xl-7">
            <div className="onboarding-content">
              <div className="all-set-content">
                <div className="all-set-icon">
                  <FiCheckCircle size={48} />
                </div>
                <h1 className="onboarding-heading">All set!</h1>
                <p className="onboarding-desc">You're ready to start tracking your orders. Your workspace is set up and ready to go.</p>
                <Link to="/" className="thm-lg-btn d-inline-block">Go to Dashboard</Link>
              </div>
            </div>
          </div>

          <div className="col-lg-3 col-xl-3 onboarding-right-side">
            <div className="info-card">
              <div className="info-card-icon">
                <FiCheckCircle size={48} color="#201d6a" />
              </div>
              <h4 className="info-card-title">You're all set!</h4>
              <ul className="info-card-list">
                <li><span className="check-icon">✓</span> Company configured</li>
                <li><span className="check-icon">✓</span> Tracking enabled</li>
                <li><span className="check-icon">✓</span> Inbox connected</li>
                <li><span className="check-icon">✓</span> Team invited</li>
                <li><span className="check-icon">✓</span> Ready to go</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
