import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMoreHorizontal} from 'react-icons/fi';
import '../../styles/onboarding.css';
import { HiOfficeBuilding } from 'react-icons/hi';

export default function CompanyDetails() {
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('india');
  const [timezone, setTimezone] = useState('IST');

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

          <div className="col-lg-6 col-xl-7">


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

                <div className="custom-frm-bx">
                  <label className="">Timezone</label>
                  <select
                    className="form-select onboarding-control"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    <option value="IST">IST (UTC +5:30) — India</option>
                    <option value="GST">GST (UTC +4:00) — UAE</option>
                    <option value="EST">EST (UTC -5:00) — USA (Eastern)</option>
                    <option value="CST">CST (UTC -6:00) — USA (Central)</option>
                    <option value="PST">PST (UTC -8:00) — USA (Pacific)</option>
                    <option value="GMT">GMT (UTC +0:00) — UK</option>
                    <option value="CET">CET (UTC +1:00) — Europe</option>
                    <option value="JST">JST (UTC +9:00) — Japan</option>
                    <option value="AEST">AEST (UTC +10:00) — Australia</option>
                    <option value="SGT">SGT (UTC +8:00) — Singapore</option>
                  </select>
                </div>

                <div className='mt-3'>
                  <button type="submit" className="thm-lg-btn w-100">Next</button>
                </div>
              </form>
            </div>
          </div>

          <div className="col-lg-3 col-xl-3 onboarding-right-side">
            <div className="info-card">
              <div className="info-card-icon">
                <HiOfficeBuilding size={48} color="#201d6a" />
              </div>
              <h4 className="info-card-title">A smarter way to track your orders</h4>
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
