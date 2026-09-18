import { useState } from 'react';
import { FiUser, FiMail, FiLock, FiBell, FiLink, FiSave, FiHome, FiUsers, FiPlus, FiTrash2 } from 'react-icons/fi';
import '../../styles/member.css';

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('profile');

  const users = [
    { name: 'Rahul Sharma', email: 'rahul@abcindustries.com', role: 'Admin', status: 'Active' },
    { name: 'Priya Patel', email: 'priya@abcindustries.com', role: 'Member', status: 'Active' },
    { name: 'Amit Kumar', email: 'amit@abcindustries.com', role: 'Member', status: 'Pending' },
  ];

  const [invites, setInvites] = useState([{ email: '', role: 'Member' }]);

  const addInvite = () => setInvites([...invites, { email: '', role: 'Member' }]);
  const removeInvite = (index) => setInvites(invites.filter((_, i) => i !== index));
  const updateInvite = (index, field, value) => {
    const updated = [...invites];
    updated[index][field] = value;
    setInvites(updated);
  };

  return (
    <>
      <div className="row">
        <div className="col-lg-12">
          <div className="member-page-header">
            <div>
              <h2>Settings</h2>
              <p>Manage your account and company preferences</p>
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
            <button className={`tab-btn d-flex align-items-center gap-2 ${activeTab === 'company' ? 'active' : ''}`} onClick={() => setActiveTab('company')}>
              <FiHome /> Company
            </button>
            <button className={`tab-btn d-flex align-items-center gap-2 ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
              <FiUsers /> Users
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

              {activeTab === 'company' && (
                <div className="row">
                  {[
                    { label: 'Company Name', value: 'ABC Industries', type: 'text' },
                    { label: 'Industry', value: 'Manufacturing', type: 'text' },
                    { label: 'Country', value: 'India', type: 'text' },
                    { label: 'Timezone', value: 'Asia/Kolkata (IST)', type: 'text' },
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

              {activeTab === 'users' && (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0" style={{ fontSize: 16, fontWeight: 600 }}>Team Members</h5>
                    <button className="thm-btn outline py-2" onClick={addInvite}>
                      <FiPlus size={14} /> Invite Member
                    </button>
                  </div>

                  <div className="table-responsive">
                    <table className="member-table">
                      <thead>
                        <tr>
                          <th>Sr. No.</th>
                          <th>User</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <div className="user-avatar" >
                                  {user.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <span style={{ fontWeight: 500 }}>{user.name}</span>
                              </div>
                            </td>
                            <td>{user.email}</td>
                            <td>
                              <span className={`status-badge ${user.role === 'Admin' ? 'confirmed' : 'dispatched'}`}>
                                {user.role}
                              </span>
                            </td>
                            <td>
                              <span className={`status-badge ${user.status === 'Active' ? 'delivered' : 'processing'}`}>
                                {user.status}
                              </span>
                            </td>
                            <td>
                              {user.role !== 'Admin' && (
                                <button className="remove-line-btn" style={{ width: 30, height: 30 }}>
                                  <FiTrash2 size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {invites.some(inv => inv.email) && (
                    <div className="mt-3">
                      <h5 className="mb-3" style={{ fontSize: 16, fontWeight: 600 }}>Pending Invites</h5>
                      {invites.map((inv, idx) => (
                        inv.email && (
                          <div key={idx} className="d-flex align-items-center gap-3 mb-2">
                            <span style={{ fontSize: 16, fontWeight : 500 }}>{inv.email}</span>
                            <span className="status-badge processing">{inv.role}</span>
                            <button className="remove-line-btn" style={{ width: 28, height: 28 }} onClick={() => removeInvite(idx)}>
                              <FiTrash2 size={12} />
                            </button>
                          </div>
                        )
                      ))}
                    </div>
                  )}

                  <div className="mt-3">
                    <h5 className="mb-3" style={{ fontSize: 16, fontWeight: 600 }}>Send New Invites</h5>
                    {invites.map((inv, idx) => (
                      <div key={idx} className="d-flex align-items-center gap-3 mb-2">
                        <div className="custom-frm-bx mb-0 flex-grow-1">
                          <input
                            type="email"
                            className="form-control"
                            placeholder="Enter email address"
                            value={inv.email}
                            onChange={(e) => updateInvite(idx, 'email', e.target.value)}
                          />
                        </div>
                        <div className="custom-frm-bx mb-0" style={{ minWidth: 120 }}>
                          <select
                            className="form-select"
                            value={inv.role}
                            onChange={(e) => updateInvite(idx, 'role', e.target.value)}
                          >
                            <option value="Admin">Admin</option>
                            <option value="Member">Member</option>
                          </select>
                        </div>
                        {invites.length > 1 && (
                          <button className="remove-line-btn" style={{ width: 35, height: 35 }} onClick={() => removeInvite(idx)}>
                            <FiTrash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button className="thm-btn outline py-2 mt-2" onClick={addInvite}>
                      <FiPlus size={14} /> Add Another
                    </button>
                    <div className="text-end mt-3">
                      <button className="thm-btn"><FiMail /> Send Invites</button>
                    </div>
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
                       <div className="d-flex justify-content-between align-items-center">
                          <div className='details-box'>
                            <h5 className='mb-2'>{item.label}</h5>
                            <h6 className="mb-0">{item.desc}</h6>
                          </div>
                          <div className="theme-switch">
                            <input type="checkbox" id={`admin-switch-${idx}`} defaultChecked={idx < 2} />
                            <label className="switch-slider" htmlFor={`admin-switch-${idx}`}></label>
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
                    <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-3">
                          <div className="kpi-icon" style={{ background: '#e3f2fd', color: '#1565c0' }}>
                            <FiMail />
                          </div>
                          <div className='details-box'>
                            <h5 className="">Gmail</h5>
                            <h6 className="mb-0">rahul@abcindustries.com</h6>
                          </div>
                        </div>
                        <span className="status-badge dispatched">Connected</span>
                      </div>
                  </div>
                  <div className="col-md-6 mb-3">
                   <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-3">
                          <div className="kpi-icon" style={{ background: '#f5f5f5', color: '#9e9e9e' }}>
                            <FiMail />
                          </div>
                          <div className='details-box'>
                            <h5 className="">Outlook</h5>
                            <h6 className="mb-0">Not connected</h6>
                          </div>
                        </div>
                        <button className="thm-btn outline">Connect</button>
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
