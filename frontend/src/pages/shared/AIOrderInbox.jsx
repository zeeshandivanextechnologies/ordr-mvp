import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { FiEye, FiChevronDown, FiEdit2, FiTrash2 } from 'react-icons/fi';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../../components/AuthProvider';
import { confidenceLevel } from '../../utils/confidence';
import { UPDATE_TYPE_LABELS, MATCH_LABELS, updateTypeBadge } from '../../utils/orderUpdates';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import BootstrapPagination from '../../components/BootstrapPagination';
import '../../styles/member.css';

const tabOrder = ['New', 'Needs Review', 'Confirmed', 'Ignored'];
// Module 21: emails that update an existing order (dispatch, delivery, ...)
const UPDATES_TAB = 'Order Updates';
const updateStatusOptions = ['Pending', 'Applied', 'Ignored'];
// AI detections are loaded from the server one page at a time (Module 34: large companies)
const PAGE_SIZE = 10;

export default function AIOrderInbox() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.tab === UPDATES_TAB ? UPDATES_TAB : 'New');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [extracts, setExtracts] = useState([]);
  const [counts, setCounts] = useState({ New: 0, 'Needs Review': 0, Confirmed: 0, Ignored: 0 });
  const [loading, setLoading] = useState(true);
  const [openAction, setOpenAction] = useState(null);
  const [actionRect, setActionRect] = useState(null);
  const actionRef = useRef(null);
  const [updates, setUpdates] = useState([]);
  const [updateCounts, setUpdateCounts] = useState({ Pending: 0, Applied: 0, Ignored: 0 });
  const [updatesLoading, setUpdatesLoading] = useState(true);
  const [updateStatus, setUpdateStatus] = useState('Pending');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const search = useDebouncedValue(searchTerm.trim(), 300);

  // Tab (status), type filter and search are applied on the server; a change starts again at page 1
  const listQuery = JSON.stringify({ status: activeTab, type: filter, q: search || undefined });
  const [lastQuery, setLastQuery] = useState(listQuery);
  if (listQuery !== lastQuery) {
    setLastQuery(listQuery);
    setOffset(0);
  }

  useEffect(() => {
    let mounted = true;
    api
      .get('/ai-inbox/updates')
      .then((res) => {
        if (mounted) {
          setUpdates(res.data.updates || []);
          setUpdateCounts(res.data.counts || { Pending: 0, Applied: 0, Ignored: 0 });
        }
      })
      .catch(() => {
        if (mounted) toast.error('Failed to load order updates');
      })
      .finally(() => {
        if (mounted) setUpdatesLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const params = JSON.parse(lastQuery);
    // The Order Updates tab has its own list; tab counts still load for the other tabs
    const isUpdatesTab = params.status === UPDATES_TAB;
    setLoading(true);
    api
      .get('/ai-inbox', { params: isUpdatesTab ? { limit: 1 } : { ...params, limit: PAGE_SIZE, offset } })
      .then((res) => {
        if (mounted) {
          if (!isUpdatesTab) {
            setExtracts(res.data.extracts || []);
            setTotal(res.data.total || 0);
          }
          setCounts(res.data.counts || { New: 0, 'Needs Review': 0, Confirmed: 0, Ignored: 0 });
        }
      })
      .catch(() => {
        if (mounted) toast.error('Failed to load inbox');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [lastQuery, offset, reloadKey]);

  useEffect(() => {
    const handleClickOutside = () => {
      setOpenAction(null);
    };
    const handleScroll = () => {
      setOpenAction(null);
    };
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  const filterOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'purchase', label: 'Purchase' },
    { value: 'sales', label: 'Sales' },
  ];

  // Same thresholds as the Review page (utils/confidence.js)
  const getConfidenceClass = (confidence) => confidenceLevel(confidence);

  const currencySymbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SAR: 'SAR ' };
  const formatValue = (value, currency) =>
    value
      ? `${currency ? (currencySymbols[currency] ?? `${currency} `) : '₹'}${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      : '—';

  const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(d + (String(d).length === 10 ? 'T00:00:00' : ''));
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const displayExtracts = extracts.map((o) => ({
    id: o.id,
    customer: o.customer_name || '—',
    type: o.order_type || '—',
    poNumber: o.po_number || '—',
    items: o.items || '—',
    itemCount: Number(o.item_count) || 0,
    value: formatValue(o.approx_value, o.currency),
    emailDate: formatDate(o.email_date),
    confidence: Number(o.confidence) || 0,
    status: o.status,
  }));

  // The server already applied the tab (status), type filter and search (PO, customer, items)
  const currentOrders = displayExtracts;

  const tabs = [
    ...tabOrder.map((label) => ({ label, count: counts[label] || 0 })),
    { label: UPDATES_TAB, count: updateCounts.Pending || 0 },
  ];
  const showUpdates = activeTab === UPDATES_TAB;

  const matchingUpdates = updates
    .filter((u) => u.status === updateStatus)
    .filter((u) => {
      const term = searchTerm.trim().toLowerCase();
      if (!term) return true;
      const x = u.extracted || {};
      return [u.source_email, u.source_name, u.source_subject, u.order_po_number, u.order_party_name, x.po_number, x.lr_number, x.awb_number, x.party_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });

  // Order Updates are paged on the page itself (same 10 per page); a new filter starts at page 1
  const [updatesOffset, setUpdatesOffset] = useState(0);
  const updatesQuery = `${updateStatus}|${searchTerm.trim().toLowerCase()}`;
  const [lastUpdatesQuery, setLastUpdatesQuery] = useState(updatesQuery);
  if (updatesQuery !== lastUpdatesQuery) {
    setLastUpdatesQuery(updatesQuery);
    setUpdatesOffset(0);
  }
  // Stay on a page that still has rows (e.g. after the last one on it was applied elsewhere)
  const safeUpdatesOffset = updatesOffset >= matchingUpdates.length && updatesOffset > 0
    ? Math.max(Math.floor((matchingUpdates.length - 1) / PAGE_SIZE) * PAGE_SIZE, 0)
    : updatesOffset;
  const currentUpdates = matchingUpdates.slice(safeUpdatesOffset, safeUpdatesOffset + PAGE_SIZE);

  const handleDelete = async (orderId, label) => {
    if (!window.confirm(`Delete "AI extracted order ${label}"? This cannot be undone.`)) return;
    setOpenAction(null);
    try {
      await api.delete(`/ai-inbox/${orderId}`);
      setExtracts((prev) => prev.filter((o) => o.id !== orderId));
      setCounts((prev) => {
        const removed = extracts.find((o) => o.id === orderId);
        const key = removed?.status || 'New';
        const next = { ...prev, [key]: Math.max((prev[key] || 0) - 1, 0) };
        return next;
      });
      // Reload so the page and totals stay correct
      setReloadKey((k) => k + 1);
      toast.success('Entry deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete entry');
    }
  };

  return (
    <>
      <div className='row'>
        <div className='col-lg-12'>
          <div className="member-page-header mb-2">
            <div>
              <h2>AI Order Inbox</h2>
              <p>Review and manage AI-extracted orders from your emails</p>
            </div>
          </div>
        </div>
      </div>

      <div className='row'>
        <div className='col-lg-12'>
          <div className="member-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.label}
                className={`tab-btn ${activeTab === tab.label ? 'active' : ''}`}
                onClick={() => { setActiveTab(tab.label); setOpenAction(null); }}
              >
                {tab.label} ({tab.count})
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
                placeholder="Search by PO, customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className='custom-frm-bx'>
              {showUpdates ? (
                <select
                  className="form-select"
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value)}
                >
                  {updateStatusOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt} ({updateCounts[opt] || 0})
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  className="form-select"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {filterOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className='row'>
        <div className='col-lg-12'>
          <div className="member-card">
            {showUpdates ? (
            <div className="table-responsive">
              <table className="member-table">
                <thead>
                  <tr>
                    <th>Sr No.</th>
                    <th>From</th>
                    <th>Subject</th>
                    <th>Update</th>
                    <th>PO / LR in Email</th>
                    <th>Matched Order</th>
                    <th>Email Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {updatesLoading ? (
                    <tr>
                      <td colSpan="8">
                        <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }} role="status">
                          <div className="spinner-border" style={{ width: '2.5rem', height: '2.5rem', color: 'var(--primary-color)' }}>
                            <span className="visually-hidden">Loading...</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : currentUpdates.length > 0 ? (
                    currentUpdates.map((u, idx) => {
                      const x = u.extracted || {};
                      const refs = [x.po_number && `PO ${x.po_number}`, x.lr_number && `LR ${x.lr_number}`, x.awb_number && `AWB ${x.awb_number}`].filter(Boolean);
                      return (
                        <tr key={u.id}>
                          <td>{safeUpdatesOffset + idx + 1}</td>
                          <td>{u.source_name || u.source_email || '—'}</td>
                          <td title={u.source_subject || undefined}>{u.source_subject || '—'}</td>
                          <td>
                            <span className={`status-badge ${updateTypeBadge(u.update_type)}`}>
                              {UPDATE_TYPE_LABELS[u.update_type] || u.classification}
                            </span>
                          </td>
                          <td>{refs.length ? refs.join(', ') : '—'}</td>
                          <td>
                            {u.order_po_number ? (
                              <span title={u.match_method ? `Matched by ${MATCH_LABELS[u.match_method]}` : undefined}>
                                <span className="po-number">{u.order_po_number}</span> {'—'} {u.order_party_name}
                                {u.match_confidence && (
                                  <span className={`confidence-tag ${u.match_confidence} ms-2`}>{u.match_confidence}</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-secondary">Not matched</span>
                            )}
                          </td>
                          <td>{formatDate(u.email_date)}</td>
                          <td>
                            <Link to={`/app/ai-inbox/updates/${u.id}`} className="action-dropdown-btn text-decoration-none">
                              <FiEye /> Review
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="8" className="text-center py-4">No order updates found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            ) : (
            <div className="table-responsive">
              <table className="member-table">
                <thead>
                  <tr>
                    <th>Sr No.</th>
                    <th>Customer/Supplier</th>
                    <th>Order Type</th>
                    <th>PO Number</th>
                    <th>No. of Items</th>
                    <th>Approx Value</th>
                    <th>Email Date</th>
                    <th>AI Confidence</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="9">
                        <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }} role="status">
                          <div className="spinner-border" style={{ width: '2.5rem', height: '2.5rem', color: 'var(--primary-color)' }}>
                            <span className="visually-hidden">Loading...</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : currentOrders.length > 0 ? (
                    currentOrders.map((order, idx) => (
                      <tr key={order.id}>
                        <td>{offset + idx + 1}</td>
                        <td>{order.customer}</td>
                        <td>
                          <span className={`status-badge ${order.type === 'Purchase' ? 'processing' : 'ready-dispatch'}`}>
                            {order.type}
                          </span>
                        </td>
                        <td className="po-number">{order.poNumber}</td>
                        <td title={order.items !== '—' ? order.items : undefined}>{order.itemCount > 0 ? order.itemCount : '—'}</td>
                        <td>{order.value}</td>
                        <td>{order.emailDate}</td>
                        <td>
                          <span className={`confidence-tag ${getConfidenceClass(order.confidence)}`}>
                            {order.confidence}%
                          </span>
                        </td>
                        <td>
                          <div>
                            <button
                              className="action-dropdown-btn"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                if (openAction === idx) {
                                  setOpenAction(null);
                                } else {
                                  setOpenAction(idx);
                                  setActionRect(e.currentTarget.getBoundingClientRect());
                                }
                              }}
                            >
                              Edit <FiChevronDown />
                            </button>
                            {openAction === idx && actionRect && createPortal(
                              <div 
                                className="order-dropdown-menu portal-dropdown-menu" 
                                style={{ 
                                  top: actionRect.bottom + 5,
                                  right: window.innerWidth - actionRect.right 
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Link to={`/app/ai-inbox/${order.id}/review`} className="order-dropdown-item" onClick={() => setOpenAction(null)}>
                                  <FiEye /> Review
                                </Link>
                                <Link to={`/app/ai-inbox/${order.id}/review`} className="order-dropdown-item" onClick={() => setOpenAction(null)}>
                                  <FiEdit2 /> Edit Details
                                </Link>
                                {isAdmin && (
                                  <Link to="#" className="order-dropdown-item text-danger" onClick={(e) => { e.preventDefault(); handleDelete(order.id, order.poNumber); }}>
                                    <FiTrash2 /> Delete
                                  </Link>
                                )}
                              </div>,
                              document.body
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9" className="text-center py-4">No orders found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            )}
            {showUpdates ? (
              <BootstrapPagination total={matchingUpdates.length} limit={PAGE_SIZE} offset={safeUpdatesOffset} onChange={setUpdatesOffset} disabled={updatesLoading} />
            ) : (
              <BootstrapPagination total={total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} disabled={loading} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}