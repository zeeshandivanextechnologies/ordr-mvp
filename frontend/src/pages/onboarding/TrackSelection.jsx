import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiShoppingCart, FiPackage } from 'react-icons/fi';
import '../../styles/onboarding.css';

export default function TrackSelection() {
  const [selected, setSelected] = useState([]);

  const steps = [
    { num: 1, label: 'Company Details', completed: true },
    { num: 2, label: 'What to Track', active: true },
    { num: 3, label: 'Connect Inbox', active: false },
    { num: 4, label: 'Invite Team', active: false },
    { num: 5, label: 'All Set!', active: false },
  ];

  const toggleOption = (option) => {
    if (selected.includes(option)) {
      setSelected(selected.filter(item => item !== option));
    } else {
      setSelected([...selected, option]);
    }
  };

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
          <Link to="/onboarding/company" className="back-arrow"><FiArrowLeft /></Link>
          <span className="step-counter">2 of 5</span>
        </div>

        <div className="onboarding-content centered">
          <h1 className="onboarding-heading">What do you track?</h1>
          <p className="onboarding-desc">Select the order types you want to manage.</p>

          <div className="track-options-grid">
            <div 
              className={`track-option-card ${selected.includes('customer') ? 'selected' : ''}`}
              onClick={() => toggleOption('customer')}
            >
              <div className="track-card-icon"><FiShoppingCart /></div>
              <h5>Sales orders</h5>
              <p>Track orders from your customers</p>
            </div>

            <div 
              className={`track-option-card ${selected.includes('supplier') ? 'selected' : ''}`}
              onClick={() => toggleOption('supplier')}
            >
              <div className="track-card-icon"><FiPackage /></div>
              <h5>Purchase orders</h5>
              <p>Track orders to your suppliers</p>
            </div>
          </div>

          <div className="onboarding-nav">
            <Link to="/onboarding/company" className="nav-back">Back</Link>
            <Link 
              to="/onboarding/gmail" 
              className={`onboarding-next-btn ${selected.length === 0 ? 'disabled' : ''}`}
              onClick={(e) => selected.length === 0 && e.preventDefault()}
            >
              Next
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
