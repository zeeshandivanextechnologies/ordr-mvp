import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMoreHorizontal, FiPlus, FiUsers, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import teamService from '../../services/teamService';
import '../../styles/onboarding.css';

export default function InviteTeam() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [invites, setInvites] = useState([
    { email: '', role: 'admin' },
    { email: '', role: 'member' },
  ]);

  const steps = [
    { num: 1, label: 'Company Details', completed: true },
    { num: 2, label: 'What to Track', completed: true },
    { num: 3, label: 'Connect Inbox', completed: true },
    { num: 4, label: 'Invite Team', active: true },
    { num: 5, label: 'All Set!', active: false },
  ];

  const addInvite = () => {
    setInvites([...invites, { email: '', role: 'member' }]);
    toast.info('New team member row added');
  };

  const removeInvite = (index) => {
    if (invites.length > 1) {
      setInvites(invites.filter((_, i) => i !== index));
      toast.error('Team member row removed');
    }
  };

  const updateInvite = (index, field, value) => {
    const newInvites = [...invites];
    newInvites[index][field] = value;
    setInvites(newInvites);
  };

  const handleSendInvites = async () => {
    // Filter out empty emails
    const validInvites = invites.filter(inv => inv.email.trim() !== '');
    
    if (validInvites.length === 0) {
      // If all are empty, just skip to dashboard
      navigate('/onboarding/dashboard');
      return;
    }

    setLoading(true);
    try {
      const res = await teamService.inviteMembers(validInvites);
      if (res.success && res.success.length > 0) {
        toast.success(`Successfully invited ${res.success.length} team members!`);
      }
      if (res.failed && res.failed.length > 0) {
        toast.warning(`Failed to invite ${res.failed.length} members. ${res.failed[0].reason}`);
      }
      navigate('/onboarding/dashboard');
    } catch (error) {
      toast.error('An error occurred while sending invites.');
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
              <h1 className="onboarding-heading">Invite your team</h1>
              <p className="onboarding-desc">Work together, keep everyone updated.</p>

              <div className="invite-form">
                {invites.map((invite, index) => (

                  <div className='row align-items-center' key={index}>
                    <div className={invites.length > 1 ? 'col-7 col-lg-7 col-md-7 col-sm-7' : 'col-8 col-lg-8 col-md-8 col-sm-8'}>
                      <div className="custom-frm-bx">
                        <input
                          type="email"
                          className="form-control onboarding-control"
                          placeholder="colleague@company.com"
                          value={invite.email}
                          onChange={(e) => updateInvite(index, 'email', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className='col-4 col-lg-4 col-md-4 col-sm-4'>
                      <div className="custom-frm-bx">
                        <select
                          className="form-select onboarding-control role-select"
                          value={invite.role}
                          onChange={(e) => updateInvite(index, 'role', e.target.value)}
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                      </div> 
                    </div>
                    {invites.length > 1 && (
                      <div className='col-1 col-lg-1 col-md-1 col-sm-1 p-0'>
                        <div className="custom-frm-bx">
                          <button 
                            type="button" 
                            className="remove-invite-btn" 
                            onClick={() => removeInvite(index)}
                          >
                            <FiTrash2  />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  
                ))}

                <button type="button" className="add-another-btn" onClick={addInvite}>
                  <FiPlus /> Add another
                </button>
              </div>

              <div className="mt-3">
                <button 
                  type="button" 
                  className="thm-lg-btn w-100"
                  onClick={handleSendInvites}
                  disabled={loading}
                >
                  {loading ? 'Sending Invites...' : 'Send Invites'}
                </button>
              </div>

              <div className="onboarding-nav">
                <Link to="/onboarding/gmail" className="nav-back">Back</Link>
                <Link to="/onboarding/dashboard" className="nav-skip">Skip for now</Link>
              </div>
            </div>
          </div>

          <div className="col-lg-3 col-xl-3 onboarding-right-side">
            <div className="info-card">
              <div className="info-card-icon">
                <FiUsers size={48} color="#201d6a" />
              </div>
              <h4 className="info-card-title">Collaborate with your team</h4>
              <ul className="info-card-list">
                <li><span className="check-icon">✓</span> Admin access</li>
                <li><span className="check-icon">✓</span> Member roles</li>
                <li><span className="check-icon">✓</span> Real-time updates</li>
                <li><span className="check-icon">✓</span> Shared workspace</li>
                <li><span className="check-icon">✓</span> Easy management</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
