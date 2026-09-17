import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMoreHorizontal, FiShoppingCart, FiPackage } from 'react-icons/fi';
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

          <div className="col-lg-5 col-xl-6">
            <div className="onboarding-content">
              <h1 className="onboarding-heading">What do you track?</h1>
              <p className="onboarding-desc">Select the order types you want to manage.</p>

              <div className="track-options-grid">
                <div
                  className={`track-option-card ${selected.includes('customer') ? 'selected' : ''}`}
                  onClick={() => toggleOption('customer')}
                >
                  <div className="track-card-icon"><FiShoppingCart /></div>
                  <h5>Customer Orders</h5>
                  <p>Track sales orders from your customers</p>
                </div>

                <div
                  className={`track-option-card ${selected.includes('supplier') ? 'selected' : ''}`}
                  onClick={() => toggleOption('supplier')}
                >
                  <div className="track-card-icon"><FiPackage /></div>
                  <h5>Supplier Orders</h5>
                  <p>Track purchase orders from your suppliers</p>
                </div>
              </div>

              <div className="mt-4">
                <Link
                  to="/onboarding/gmail"
                  className={`thm-lg-btn d-block text-center ${selected.length === 0 ? 'disabled' : ''}`}
                  onClick={(e) => selected.length === 0 && e.preventDefault()}
                >
                  Next
                </Link>
              </div>

              <div className="onboarding-nav">
                <Link to="/onboarding/company" className="nav-back">Back</Link>
                <Link to="/onboarding/gmail" className="nav-skip">Skip for now</Link>
              </div>
            </div>
          </div>

          <div className="col-lg-4 col-xl-4 onboarding-right-side">
            <div className="info-card">
              <div className="info-card-icon">
                <FiShoppingCart size={56} color="#2D4735" />
              </div>
              <h4 className="info-card-title">Track both<br />types of orders</h4>
              <ul className="info-card-list">
                <li><span className="check-icon">✓</span> Customer orders</li>
                <li><span className="check-icon">✓</span> Supplier orders</li>
                <li><span className="check-icon">✓</span> Real-time status</li>
                <li><span className="check-icon">✓</span> AI-powered tracking</li>
                <li><span className="check-icon">✓</span> All in one place</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
