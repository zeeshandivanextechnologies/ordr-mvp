import { useState, useEffect } from 'react';
import { FiAlertTriangle, FiAlertCircle, FiInfo, FiCheck, FiX } from 'react-icons/fi';
import '../../styles/member.css';

export default function Alerts() {
  const [activeTab, setActiveTab] = useState('all');
  const [filter, setFilter] = useState('all');

const alerts = [
  {
    id: 1,
    type: 'overdue',
    severity: 'critical',
    title: 'Overdue Order',
    description: 'PO-8192 is 2 days overdue. 5 MT still pending.',
    order: 'PO-8192',
    customer: 'ABC Industries',
    time: '2 hours ago',
    status: 'open',
  },
  {
    id: 2,
    type: 'partial',
    severity: 'warning',
    title: 'Partial Fulfilment',
    description: '6 MT dispatched, 4 MT still pending for PO-8195.',
    order: 'PO-8195',
    customer: 'MediCorp Solutions',
    time: '5 hours ago',
    status: 'open',
  },
  {
    id: 3,
    type: 'stale',
    severity: 'warning',
    title: 'Stale Order - No Update',
    description: 'PO-8193 has no update for 5 days.',
    order: 'PO-8193',
    customer: 'XYZ Chemicals',
    time: '1 day ago',
    status: 'open',
  },
  {
    id: 4,
    type: 'due-soon',
    severity: 'info',
    title: 'Delivery Due Soon',
    description: 'PO-8197 is due tomorrow. Shipment is in transit.',
    order: 'PO-8197',
    customer: 'FreshMart Supplies',
    time: '1 day ago',
    status: 'open',
  },
  {
    id: 5,
    type: 'missing-tracking',
    severity: 'warning',
    title: 'Missing Tracking Number',
    description: 'SHP-2026-4821 is dispatched but tracking is missing.',
    order: 'PO-8192',
    customer: 'ABC Industries',
    time: '2 days ago',
    status: 'open',
  },
  {
    id: 6,
    type: 'ai-pending',
    severity: 'info',
    title: 'AI Review Pending',
    description: '3 orders have been pending review for 24+ hours.',
    order: '-',
    customer: '-',
    time: '3 days ago',
    status: 'resolved',
  },
  {
    id: 7,
    type: 'overdue',
    severity: 'critical',
    title: 'Overdue Order',
    description: 'PO-8194 is 1 day overdue. Packaging delivery pending.',
    order: 'PO-8194',
    customer: 'Global Pharma Ltd',
    time: '3 days ago',
    status: 'dismissed',
  },
];
  const tabs = [
    { key: 'all', label: 'All Alerts' },
    { key: 'open', label: 'Open' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'dismissed', label: 'Dismissed' },
  ];

  const severityFilters = [
    { value: 'all', label: 'All Severity' },
    { value: 'critical', label: 'Critical' },
    { value: 'warning', label: 'Warning' },
    { value: 'info', label: 'Info' },
  ];

  const severityConfig = {
    critical: { icon: <FiAlertTriangle />, color: '#c62828', bg: '#ffebee' },
    warning: { icon: <FiAlertCircle />, color: '#e65100', bg: '#fff3e0' },
    info: { icon: <FiInfo />, color: '#1565c0', bg: '#e3f2fd' },
  };

  const filteredAlerts = alerts.filter((a) => {
    const matchesTab = activeTab === 'all' || a.status === activeTab;
    const matchesSeverity = filter === 'all' || a.severity === filter;
    return matchesTab && matchesSeverity;
  });

  const openCount = alerts.filter((a) => a.status === 'open').length;

  return (
    <>
      <div className="row">
        <div className="col-lg-12">
          <div className="member-page-header">
            <div>
              <h2>Alerts</h2>
              <p>Stay on top of overdue orders, partial shipments, and pending reviews</p>
            </div>
            {openCount > 0 && (
              <button className="thm-btn outline">
                <FiCheck /> Mark All Resolved
              </button>
            )}
          </div>
        </div>
      </div>

      <div className='row'>
        <div className='col-lg-12'>
          <div className="member-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {tab.key === 'open' && openCount > 0 && (
                  <span className="alert-count-badge">{openCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className='row'>
        <div className='col-lg-12'>
          <div className="search-filter-bar">
            <div className="custom-frm-bx flex-grow-1">
              <input type="text" className='form-control' placeholder="Search alerts..." />
            </div>
            <div className='custom-frm-bx'>
              <select
                className="form-select"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                {severityFilters.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-12">
          <div className="member-card">
            {filteredAlerts.length === 0 ? (
              <div className="member-empty-state">
                <div className="empty-icon"><FiCheck /></div>
                <h4>No alerts</h4>
                <p>You're all caught up! No alerts to show.</p>
              </div>
            ) : (
              <div className="alert-list">
                {filteredAlerts.map((alert) => {
                  const sev = severityConfig[alert.severity];
                  return (
                    <div key={alert.id} className={`alert-item ${alert.status}`}>
                      <div className="alert-icon" style={{ background: sev.bg, color: sev.color }}>
                        {sev.icon}
                      </div>
                      <div className="alert-content">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <h6 className="alert-title">{alert.title}</h6>
                            <p className="alert-desc">{alert.description}</p>
                          </div>
                          <span className={`alert-severity-badge ${alert.severity}`}>
                            {alert.severity}
                          </span>
                        </div>
                        <div className="alert-meta">
                          <span>{alert.order !== '-' ? alert.order : ''}</span>
                          {alert.order !== '-' && alert.customer !== '-' && <span className="mx-2">|</span>}
                          <span>{alert.customer !== '-' ? alert.customer : ''}</span>
                          <span className="mx-2">|</span>
                          <span>{alert.time}</span>
                        </div>
                        {alert.status === 'open' && (
                          <div className="alert-actions mt-2">
                            <button className="thm-btn outline py-1 px-3" style={{ fontSize: 14 }}>
                              <FiCheck /> Resolve
                            </button>
                            <button className="alert-dismiss-btn">
                              <FiX /> Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
