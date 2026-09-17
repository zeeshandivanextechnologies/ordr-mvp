import { useState } from 'react';
import { FiUser, FiMail, FiLock, FiBell, FiLink, FiSave } from 'react-icons/fi';
import '../../styles/member.css';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <>
      <div className="row">
        <div className="col-lg-12">
          <div className="member-page-header">
            <div>
              <h2>Settings</h2>
              <p>Manage your account preferences</p>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-12">
          <div className="member-tabs">
            <button className={`tab-btn d-flex align-items-center gap-2 ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
              <FiUser /> Profile
            </button>
            <button className={`tab-btn d-flex align-items-center gap-2 ${activeTab === 'password' ? 'active' : ''}`} onClick={() => setActiveTab('password')}>
              <FiLock /> Password
            </button>
            <button className={`tab-btn d-flex align-items-center gap-2 ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
              <FiBell /> Notifications
            </button>
            <button className={`tab-btn d-flex align-items-center gap-2 ${activeTab === 'connected' ? 'active' : ''}`} onClick={() => setActiveTab('connected')}>
              <FiLink /> Connected Accounts
            </button>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-12">
          <div className="member-card">
            <div className="member-card-body">
              {activeTab === 'profile' && (
                <div className="row">
                  {[
                    { label: 'Full Name', value: 'Rahul Sharma', type: 'text' },
                    { label: 'Email', value: 'rahul@abcindustries.com', type: 'email' },
                    { label: 'Phone', value: '+91 98765 43210', type: 'tel' },
                    { label: 'Company Name', value: 'ABC Industries', type: 'text' },
                    { label: 'Designation', value: 'Purchase Manager', type: 'text' },
                    { label: 'GST Number', value: '27AABCU9603R1ZM', type: 'text' },
                  ].map((item, idx) => (
                    <div className="col-lg-6 col-md-6 col-sm-12" key={idx}>
                      <div className="custom-frm-bx">
                        <label>{item.label}</label>
                        <input type={item.type} className="form-control" defaultValue={item.value} />
                      </div>
                    </div>
                  ))}
                  <div className="col-lg-12 text-end">
                    <button className="thm-btn"><FiSave /> Save Changes</button>
                  </div>
                </div>
              )}

              {activeTab === 'password' && (
                <div className="row">
                  <div className="col-lg-6 col-md-6 col-sm-12">
                    <div className="custom-frm-bx">
                      <label>Current Password</label>
                      <input type="password" className="form-control" placeholder="Enter current password" />
                    </div>
                  </div>
                  <div className="col-lg-6 col-md-6 col-sm-12">
                    <div className="custom-frm-bx">
                      <label>New Password</label>
                      <input type="password" className="form-control" placeholder="Enter new password" />
                    </div>
                  </div>
                  <div className="col-lg-6 col-md-6 col-sm-12">
                    <div className="custom-frm-bx">
                      <label>Confirm New Password</label>
                      <input type="password" className="form-control" placeholder="Confirm new password" />
                    </div>
                  </div>
                  <div className="col-lg-12 text-end">
                    <button className="thm-btn"><FiSave /> Update Password</button>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="row">
                  {[
                    { label: 'Email Notifications', desc: 'Receive order updates via email' },
                    { label: 'Shipment Alerts', desc: 'Get notified when shipment status changes' },
                    { label: 'AI Order Detection', desc: 'Notify when new order detected from email' },
                    { label: 'Delivery Reminders', desc: 'Reminder before delivery due date' },
                  ].map((item, idx) => (
                    <div className="col-md-6 mb-3" key={idx}>
                      <div className="details-box">
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <h5 className='mb-2'>{item.label}</h5>
                            <h6 className="text-muted">{item.desc}</h6>
                          </div>
                          <div className="theme-switch">
                            <input type="checkbox" id={`switch-${idx}`} defaultChecked={idx < 2} />
                            <label className="switch-slider" htmlFor={`switch-${idx}`}></label>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="col-lg-12 text-end">
                    <button className="thm-btn"><FiSave /> Save Preferences</button>
                  </div>
                </div>
              )}

              {activeTab === 'connected' && (
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <div className="details-box">
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-3">
                          <div className="kpi-icon" style={{ background: '#e3f2fd', color: '#1565c0' }}>
                            <FiMail />
                          </div>
                          <div>
                            <h5 className="mb-0">Gmail</h5>
                            <h6 className="mb-0">rahul@abcindustries.com</h6>
                          </div>
                        </div>
                        <span className="status-badge dispatched">Connected</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 mb-3">
                    <div className="details-box">
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-3">
                          <div className="kpi-icon" style={{ background: '#f5f5f5', color: '#9e9e9e' }}>
                            <FiMail />
                          </div>
                          <div>
                            <h5 className="mb-0">Outlook</h5>
                            <h6 className="mb-0">Not connected</h6>
                          </div>
                        </div>
                        <button className="thm-btn outline">Connect</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
