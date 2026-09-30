import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiAlertTriangle, FiAlertCircle, FiInfo, FiCheck, FiX } from 'react-icons/fi';
import api from '../../services/api';
import { timeAgo } from '../../utils/notificationDisplay';
import '../../styles/member.css';

export default function Alerts() {
  const [activeTab, setActiveTab] = useState('all');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/alerts');
      setRows(res.data.alerts || []);
    } catch {
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const alerts = rows.map((a) => ({
    id: a.id,
    type: a.type,
    severity: a.severity,
    title: a.title,
    description: a.description,
    order: a.po_number || '-',
    customer: a.party_name || '-',
    time: timeAgo(a.created_at),
    status: a.status,
    link: a.link,
  }));

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

  const term = searchTerm.trim().toLowerCase();
  const filteredAlerts = alerts.filter((a) => {
    const matchesTab = activeTab === 'all' || a.status === activeTab;
    const matchesSeverity = filter === 'all' || a.severity === filter;
    const matchesSearch =
      !term ||
      [a.title, a.description, a.order, a.customer].some((v) => String(v || '').toLowerCase().includes(term));
    return matchesTab && matchesSeverity && matchesSearch;
  });

  const openCount = alerts.filter((a) => a.status === 'open').length;
  // Tab counts are for all alerts (not narrowed by search / severity), same as the Orders tabs
  const tabCounts = {
    all: alerts.length,
    open: openCount,
    resolved: alerts.filter((a) => a.status === 'resolved').length,
    dismissed: alerts.filter((a) => a.status === 'dismissed').length,
  };

  const updateStatus = async (alertId, action) => {
    setBusyId(alertId);
    try {
      await api.post(`/alerts/${alertId}/${action}`);
      setRows((prev) => prev.map((a) => (a.id === alertId ? { ...a, status: action === 'dismiss' ? 'dismissed' : 'resolved' } : a)));
      toast.success(action === 'dismiss' ? 'Alert dismissed' : 'Alert resolved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update alert');
    } finally {
      setBusyId(null);
    }
  };

  const resolveAll = async () => {
    if (!window.confirm(`Mark all ${openCount} open alerts as resolved?`)) return;
    setBusyId('all');
    try {
      await api.post('/alerts/resolve-all');
      setRows((prev) => prev.map((a) => (a.status === 'open' ? { ...a, status: 'resolved' } : a)));
      toast.success('All open alerts resolved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resolve alerts');
    } finally {
      setBusyId(null);
    }
  };

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
              <button className="thm-btn outline" onClick={resolveAll} disabled={busyId === 'all'}>
                <FiCheck /> {busyId === 'all' ? 'Resolving...' : 'Mark All Resolved'}
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
                {tab.label} ({tabCounts[tab.key]})
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className='row'>
        <div className='col-lg-12'>
          <div className="search-filter-bar">
            <div className="custom-frm-bx flex-grow-1">
              <input
                type="text"
                className='form-control'
                placeholder="Search alerts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
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
            {loading ? (
               <div className="d-flex justify-content-center align-items-center" style={{height : "200px"}}  role="status">
      <div className="spinner-border" style={{ width: '2.5rem', height: '2.5rem', color: 'var(--primary-color)' }}>
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="member-empty-state">
                <div className="empty-icon"><FiCheck /></div>
                <h4>No alerts</h4>
                <p>You're all caught up! No alerts to show.</p>
              </div>
            ) : (
              <div className="alert-list">
                {filteredAlerts.map((alert) => {
                  const sev = severityConfig[alert.severity] || severityConfig.info;
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
                          <span>
                            {alert.order !== '-'
                              ? (alert.link ? <Link to={alert.link}>{alert.order}</Link> : alert.order)
                              : ''}
                          </span>
                          {alert.order !== '-' && alert.customer !== '-' && <span className="mx-2">|</span>}
                          <span>{alert.customer !== '-' ? alert.customer : ''}</span>
                          <span className="mx-2">|</span>
                          <span>{alert.time}</span>
                        </div>
                        {alert.status === 'open' && (
                          <div className="alert-actions mt-2">
                            <button
                              className="thm-btn outline py-1 px-3"
                              style={{ fontSize: 14 }}
                              onClick={() => updateStatus(alert.id, 'resolve')}
                              disabled={busyId === alert.id}
                            >
                              <FiCheck /> Resolve
                            </button>
                            <button
                              className="alert-dismiss-btn"
                              onClick={() => updateStatus(alert.id, 'dismiss')}
                              disabled={busyId === alert.id}
                            >
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
