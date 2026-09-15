import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMoreHorizontal, FiBuilding } from 'react-icons/fi';
import '../../styles/onboarding.css';

export default function CompanyDetails() {
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('india');

  const steps = [
    { num: 1, label: 'Company Details', active: true },
    { num: 2, label: 'What to Track', active: false },
    { num: 3, label: 'Connect Inbox', active: false },
    { num: 4, label: 'Invite Team', active: false },
    { num: 5, label: 'All Set!', active: false },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    window.location.href = '/onboarding/track';
  };

  return (
    <div className="onboarding-page">
      <div className="container">
        <div className="row ">

          <div className='col-lg-12'>
            <div className='onboarding-header'>
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
                <div key={step.num} className={`sidebar-step ${step.active ? 'active' : ''}`}>
                  <div className="step-circle">{step.num}</div>
                  <span className="step-label">{step.label}</span>
                  {index < steps.length - 1 && <div className="step-line"></div>}
                </div>
              ))}
            </div>
          </div>

          <div className="col-lg-5 col-xl-6 ">


            <div className="onboarding-content">
              <h1 className="onboarding-heading">Let's set up your workspace</h1>
              <p className="onboarding-desc">Tell us about your business</p>

              <form onSubmit={handleSubmit} className="onboarding-form">
                <div className="custom-frm-bx">
                  <label className="">Company name</label>
                  <input
                    type="text"
                    className="form-control onboarding-control"
                    placeholder="e.g. ABC Chemicals Pvt Ltd"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </div>

                <div className="custom-frm-bx">
                  <label className="">Industry</label>
                  <select
                    className="form-select onboarding-control"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    required
                  >
                    <option value="">Select industry</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="trading">Trading</option>
                    <option value="logistics">Logistics</option>
                    <option value="retail">Retail</option>
                    <option value="chemicals">Chemicals</option>
                    <option value="electronics">Electronics</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="custom-frm-bx">
                  <label className="">Country</label>
                  <select
                    className="form-select onboarding-control"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  >
                    <option value="india">India</option>
                    <option value="uae">UAE</option>
                    <option value="usa">USA</option>
                    <option value="uk">UK</option>
                  </select>
                </div>

                <div className='mt-4'>
                  <button type="submit" className="thm-lg-btn w-100">Next</button>
                </div>
              </form>
            </div>
          </div>

          <div className="col-lg-4 col-xl-4 onboarding-right-side">
            <div className="info-card">
              <div className="info-card-icon">
                <FiBuilding size={56} color="#2D4735" />
              </div>
              <h4 className="info-card-title">A smarter<br />way to track<br />your orders</h4>
              <ul className="info-card-list">
                <li><span className="check-icon">✓</span> Sales orders</li>
                <li><span className="check-icon">✓</span> Purchase orders</li>
                <li><span className="check-icon">✓</span> Shipments</li>
                <li><span className="check-icon">✓</span> Deliveries</li>
                <li><span className="check-icon">✓</span> All in one place</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
