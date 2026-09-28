import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiChevronDown, FiEye, FiFileText } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../../services/api';
import '../../styles/member.css';

const formatDate = (d) => {
  if (!d) return '—';
  const date = new Date(String(d).length === 10 ? d + 'T00:00:00' : d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const timeAgo = (d) => {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  if (!Number.isFinite(diff)) return '—';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function Tracking() {
  const [activeTab, setActiveTab] = useState('all');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAction, setOpenAction] = useState(null);
  const actionRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    api
      .get('/shipments')
      .then((res) => {
        if (!mounted) return;
        setShipments(
          (res.data.shipments || []).map((s) => ({
            id: s.id,
            orderId: s.order_id,
            customer: s.party_name || '—',
            po: s.po_number || '—',
            lrAwb: s.lr_number || s.awb_number || s.gr_number || '—',
            searchText: [s.party_name, s.po_number, s.lr_number, s.awb_number, s.gr_number, s.shipment_number]
              .filter(Boolean)
              .join(' ')
              .toLowerCase(),
            route: s.origin || s.destination ? `${s.origin || '—'} → ${s.destination || '—'}` : '—',
            eta: formatDate(s.expected_delivery_date),
            status: s.status,
            lastUpdated: timeAgo(s.updated_at || s.created_at),
          }))
        );
      })
      .catch(() => {
        if (mounted) toast.error('Failed to load shipments');
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
    { value: 'all', label: 'All' },
    { value: 'in-transit', label: 'In Transit' },
    { value: 'delayed', label: 'Delayed' },
    { value: 'delivered', label: 'Delivered' },
  ];

  const statusLabels = {
    'ready-dispatch': 'Ready for Dispatch',
    dispatched: 'Dispatched',
    'in-transit': 'In Transit',
    delivered: 'Delivered',
    delayed: 'Delayed',
    cancelled: 'Cancelled',
  };

  const tabs = [
    { key: 'all', label: 'All', count: shipments.length },
    { key: 'in-transit', label: 'In Transit', count: shipments.filter(s => s.status === 'in-transit').length },
    { key: 'delayed', label: 'Delayed', count: shipments.filter(s => s.status === 'delayed').length },
    { key: 'delivered', label: 'Delivered', count: shipments.filter(s => s.status === 'delivered').length },
  ];

  const term = searchTerm.trim().toLowerCase();
  const filteredShipments = shipments.filter((s) => {
    const matchesTab = activeTab === 'all' || s.status === activeTab;
    const matchesFilter = filter === 'all' || s.status === filter;
    const matchesSearch = !term || s.searchText.includes(term);
    return matchesTab && matchesFilter && matchesSearch;
  });

  return (
    <>
      <div className='row'>
        <div className='col-lg-12'>
          <div className="member-page-header mb-2">
            <div>
              <h2>Tracking</h2>
              <p>Track all your shipments in one place</p>
            </div>
            <div className="d-flex gap-2">
            </div>
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
                placeholder="Search by customer, PO, LR/AWB..."
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
                    <th>PO</th>
                    <th>LR/AWB</th>
                    <th>Route</th>
                    <th>ETA</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={9} className="text-center py-4">Loading shipments...</td>
                    </tr>
                  )}
                  {!loading && filteredShipments.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-4 text-secondary">No shipments found</td>
                    </tr>
                  )}
                  {!loading && filteredShipments.map((shipment, idx) => (
                    <tr key={shipment.id}>
                      <td>{idx + 1}</td>
                      <td>{shipment.customer}</td>
                      <td className="po-number">{shipment.po}</td>
                      <td>{shipment.lrAwb}</td>
                      <td>{shipment.route}</td>
                      <td>{shipment.eta}</td>
                      <td>
                        <span className={`status-badge ${shipment.status}`}>
                          {statusLabels[shipment.status] || shipment.status}
                        </span>
                      </td>
                      <td>{shipment.lastUpdated}</td>
                      <td>
                        <div className="position-relative" ref={openAction === idx ? actionRef : null}>
                          <button
                            className="action-dropdown-btn"
                            onClick={(e) => { e.stopPropagation(); setOpenAction(openAction === idx ? null : idx); }}
                          >
                            View <FiChevronDown />
                          </button>
                          {openAction === idx && (
                            <div className="order-dropdown-menu" style={{  minWidth : "auto" }}>
                              <Link to={`/app/shipments/${shipment.id}`} className="order-dropdown-item" onClick={() => setOpenAction(null)}>
                                <FiEye /> View Details
                              </Link>
                              <Link to={`/app/orders/${shipment.orderId}`} className="order-dropdown-item" onClick={() => setOpenAction(null)}>
                                <FiFileText /> View Order
                              </Link>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
