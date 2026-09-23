import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMoreHorizontal} from 'react-icons/fi';
import { toast } from 'react-toastify';
import companyService from '../../services/companyService';
import authService from '../../services/authService';
import { useAuth } from '../../components/AuthProvider';
import { countries } from '../../utils/countries';
import { timezones } from '../../utils/timezones';
import '../../styles/onboarding.css';
import { HiOfficeBuilding } from 'react-icons/hi';

export default function CompanyDetails() {
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('India');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const res = await companyService.getCompany();
        if (res.company) {
          setCompanyName(res.company.name || '');
          setIndustry(res.company.industry || '');
          setCountry(res.company.country || 'India');
          setTimezone(res.company.timezone || 'Asia/Kolkata');
        }
      } catch (err) {
        toast.error('Failed to load company details');
      }
      try {
        const meRes = await authService.getMe();
        const me = meRes.user || {};
        setPhone(me.phone || '');
        setDesignation(me.designation || '');
        setGstNumber(me.gst_number || '');
      } catch {
        // ignore profile load errors, fields default to empty
      }
    };
    fetchCompany();
  }, []);

  const steps = [
    { num: 1, label: 'Company Details', active: true },
    { num: 2, label: 'What to Track', active: false },
    { num: 3, label: 'Connect Inbox', active: false },
    { num: 4, label: 'Invite Team', active: false },
    { num: 5, label: 'All Set!', active: false },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authService.updateProfile({
        full_name: user?.full_name || '',
        email: user?.email || '',
        phone,
        designation,
        gstNumber,
      });
      await companyService.updateCompany({
        name: companyName,
        industry,
        country,
        timezone
      });
      toast.success('Company details saved');
      navigate('/onboarding/track');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save company details');
    } finally {
      setLoading(false);
    }
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

                <div className="row">
                  <div className="col-lg-12 col-md-12 col-sm-12">
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
                  </div>

                  <div className="col-lg-6 col-md-6 col-sm-12">
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

                  </div>

                  <div className="col-lg-6 col-md-6 col-sm-12">
                    <div className="custom-frm-bx">
                  <label className="">Country</label>
                  <select
                    className="form-select onboarding-control"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  >
                    <option value="">Select country</option>
                    {countries.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                  </div>

                  <div className="col-lg-6 col-md-6 col-sm-12">
                    <div className="custom-frm-bx">
                  <label className="">Timezone</label>
                  <select
                    className="form-select onboarding-control"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    <option value="">Select timezone</option>
                    {timezones.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                </div>
                  </div>

                  <div className="col-lg-6 col-md-6 col-sm-12">
                    <div className="custom-frm-bx">
                      <label className="">Phone</label>
                      <input
                        type="tel"
                        className="form-control onboarding-control"
                        placeholder="e.g. +91 98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="col-lg-6 col-md-6 col-sm-12">
                    <div className="custom-frm-bx">
                      <label className="">Designation</label>
                      <input
                        type="text"
                        className="form-control onboarding-control"
                        placeholder="e.g. Purchase Manager"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="col-lg-6 col-md-6 col-sm-12">
                    <div className="custom-frm-bx">
                      <label className="">GST Number</label>
                      <input
                        type="text"
                        className="form-control onboarding-control"
                        placeholder="e.g. 27AABCU9603R1ZM"
                        value={gstNumber}
                        onChange={(e) => setGstNumber(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className='mt-3'>
                  <button type="submit" className="thm-lg-btn w-100" disabled={loading}>
                    {loading ? 'Saving...' : 'Next'}
                  </button>
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
