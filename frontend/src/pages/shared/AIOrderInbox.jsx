import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiEye, FiChevronDown, FiEdit2, FiTrash2 } from 'react-icons/fi';
import api from '../../services/api';
import { toast } from 'react-toastify';
import '../../styles/member.css';

const tabOrder = ['New', 'Needs Review', 'Confirmed', 'Ignored'];

export default function AIOrderInbox() {
  const [activeTab, setActiveTab] = useState('New');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [extracts, setExtracts] = useState([]);
  const [counts, setCounts] = useState({ New: 0, 'Needs Review': 0, Confirmed: 0, Ignored: 0 });
  const [loading, setLoading] = useState(true);
  const [openAction, setOpenAction] = useState(null);
  const actionRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    api
      .get('/ai-inbox')
      .then((res) => {
        if (mounted) {
          setExtracts(res.data.extracts || []);
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
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (actionRef.current && !actionRef.current.contains(e.target)) {
        setOpenAction(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const filterOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'purchase', label: 'Purchase' },
    { value: 'sales', label: 'Sales' },
  ];

  function getConfidenceClass(confidence) {
    if (confidence > 90) return 'high';
    if (confidence >= 70) return 'medium';
    return 'low';
  }

  const formatValue = (value) =>
    value ? `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';

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
    value: formatValue(o.approx_value),
    emailDate: formatDate(o.email_date),
    confidence: Number(o.confidence) || 0,
    status: o.status,
  }));

  const currentOrders = displayExtracts
    .filter((order) => order.status === activeTab)
    .filter((order) => {
      if (filter === 'all') return true;
      return order.type.toLowerCase() === filter;
    })
    .filter((order) => {
      const term = searchTerm.trim().toLowerCase();
      if (!term) return true;
      return (
        order.customer.toLowerCase().includes(term) ||
        order.poNumber.toLowerCase().includes(term)
      );
    });

  const tabs = tabOrder.map((label) => ({ label, count: counts[label] || 0 }));

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
            </div>
          </div>
        </div>
      </div>

      <div className='row'>
        <div className='col-lg-12'>
          <div className="member-card">
            <div className="table-responsive">
              <table className="member-table">
                <thead>
                  <tr>
                    <th>Sr No.</th>
                    <th>Customer/Supplier</th>
                    <th>Order Type</th>
                    <th>PO Number</th>
                    <th>Items</th>
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
                        <td>{idx + 1}</td>
                        <td>{order.customer}</td>
                        <td>
                          <span className={`status-badge ${order.type === 'Purchase' ? 'processing' : 'ready-dispatch'}`}>
                            {order.type}
                          </span>
                        </td>
                        <td className="po-number">{order.poNumber}</td>
                        <td>{order.items}</td>
                        <td>{order.value}</td>
                        <td>{order.emailDate}</td>
                        <td>
                          <span className={`confidence-tag ${getConfidenceClass(order.confidence)}`}>
                            {order.confidence}%
                          </span>
                        </td>
                        <td>
                          <div className="position-relative" ref={openAction === idx ? actionRef : undefined}>
                            <button
                              className="action-dropdown-btn"
                              onClick={(e) => { e.stopPropagation(); setOpenAction(openAction === idx ? null : idx); }}
                            >
                              Edit <FiChevronDown />
                            </button>
                            {openAction === idx && (
                              <div className="order-dropdown-menu" style={{ right: 0, left: 'auto' }}>
                                <Link to={`/app/ai-inbox/${order.id}/review`} className="order-dropdown-item" onClick={() => setOpenAction(null)}>
                                  <FiEye /> Review
                                </Link>
                                <Link to={`/app/ai-inbox/${order.id}/review`} className="order-dropdown-item" onClick={() => setOpenAction(null)}>
                                  <FiEdit2 /> Edit Details
                                </Link>
                                <Link to="#" className="order-dropdown-item text-danger" onClick={(e) => { e.preventDefault(); handleDelete(order.id, order.poNumber); }}>
                                  <FiTrash2 /> Delete
                                </Link>
                              </div>
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
          </div>
        </div>
      </div>
    </>
  );
}