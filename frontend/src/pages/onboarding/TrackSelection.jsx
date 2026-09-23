import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMoreHorizontal, FiShoppingCart, FiPackage } from 'react-icons/fi';
import { toast } from 'react-toastify';
import companyService from '../../services/companyService';
import '../../styles/onboarding.css';

export default function TrackSelection() {
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const res = await companyService.getCompany();
        if (res.company && res.company.tracking_preferences) {
          setSelected(res.company.tracking_preferences);
        }
      } catch (err) {
        toast.error('Failed to load tracking preferences');
      }
    };
    fetchCompany();
  }, []);

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

  const handleNext = async (e) => {
    e.preventDefault();
    if (selected.length === 0) return;
    
    setLoading(true);
    try {
      await companyService.updateCompany({ tracking_preferences: selected });
      toast.success('Tracking preferences saved');
      navigate('/onboarding/gmail');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save tracking preferences');
    } finally {
      setLoading(false);
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

          <div className="col-lg-6 col-xl-7">
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

              <div className="mt-3">
                <button
                  onClick={handleNext}
                  className="thm-lg-btn w-100 text-center"
                  disabled={selected.length === 0 || loading}
                >
                  {loading ? 'Saving...' : 'Next'}
                </button>
              </div>

              <div className="onboarding-nav">
                <Link to="/onboarding/company" className="nav-back">Back</Link>
                <Link to="/onboarding/gmail" className="nav-skip">Skip for now</Link>
              </div>
            </div>
          </div>

          <div className="col-lg-3 col-xl-3 onboarding-right-side">
            <div className="info-card">
              <div className="info-card-icon">
                <FiShoppingCart size={48} color="#201d6a" />
              </div>
              <h4 className="info-card-title">Track both types of orders</h4>
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
