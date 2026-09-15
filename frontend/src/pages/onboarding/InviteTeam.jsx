import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiPlus } from 'react-icons/fi';
import '../../styles/onboarding.css';

export default function InviteTeam() {
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
  };

  const removeInvite = (index) => {
    if (invites.length > 1) {
      setInvites(invites.filter((_, i) => i !== index));
    }
  };

  const updateInvite = (index, field, value) => {
    const newInvites = [...invites];
    newInvites[index][field] = value;
    setInvites(newInvites);
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
          <Link to="/onboarding/gmail" className="back-arrow"><FiArrowLeft /></Link>
          <span className="step-counter">4 of 5</span>
        </div>

        <div className="onboarding-content centered">
          <h1 className="onboarding-heading">Invite your team</h1>
          <p className="onboarding-desc">Work together, keep everyone updated.</p>

          <div className="invite-form">
            {invites.map((invite, index) => (
              <div className="invite-row" key={index}>
                <input
                  type="email"
                  className="form-control"
                  placeholder="colleague@company.com"
                  value={invite.email}
                  onChange={(e) => updateInvite(index, 'email', e.target.value)}
                />
                <select
                  className="form-select role-select"
                  value={invite.role}
                  onChange={(e) => updateInvite(index, 'role', e.target.value)}
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                </select>
              </div>
            ))}

            <button type="button" className="add-another-btn" onClick={addInvite}>
              <FiPlus /> Add another
            </button>
          </div>

          <button type="button" className="send-invites-btn">Send Invites</button>

          <div className="onboarding-nav">
            <Link to="/onboarding/gmail" className="nav-back">Back</Link>
            <div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
