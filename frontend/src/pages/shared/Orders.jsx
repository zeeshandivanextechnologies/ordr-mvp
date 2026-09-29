import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiSearch, FiChevronDown, FiUpload, FiEdit2, FiEye, FiTrash2, FiDownload, FiPrinter } from 'react-icons/fi';
import { exportToCSV, printPage } from '../../utils/exportUtils';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../../components/AuthProvider';
import { preferredOrderType } from '../../utils/trackingPreference';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import BootstrapPagination from '../../components/BootstrapPagination';
import '../../styles/member.css';
import { LuChevronDown } from 'react-icons/lu';

const currencySymbols = { INR: '₹', USD: '$', AED: 'AED', SAR: 'SAR' };
// Orders are loaded from the server one page at a time (Module 34: large companies)
const PAGE_SIZE = 10;

export default function Orders() {
  const { role, user } = useAuth();
  const isAdmin = role === 'admin';
  const [activeTab, setActiveTab] = useState(() => preferredOrderType(user) || 'sales');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAction, setOpenAction] = useState(null);
  const dropdownRef = useRef(null);
  const actionRef = useRef(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [typeCounts, setTypeCounts] = useState({ sales: 0, purchase: 0 });
  const [reloadKey, setReloadKey] = useState(0);
  const search = useDebouncedValue(searchTerm.trim(), 300);

  // Tab, status filter and search are applied on the server; a change starts again at page 1
  const listParams = { type: activeTab, status: filter, q: search || undefined };
  const [lastQuery, setLastQuery] = useState(JSON.stringify(listParams));
  if (JSON.stringify(listParams) !== lastQuery) {
    setLastQuery(JSON.stringify(listParams));
    setOffset(0);
  }

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .get('/orders', { params: { ...JSON.parse(lastQuery), limit: PAGE_SIZE, offset } })
      .then((res) => {
        if (!mounted) return;
        setOrders(res.data.orders || []);
        setTotal(res.data.total || 0);
        setTypeCounts(res.data.typeCounts || { sales: 0, purchase: 0 });
      })
      .catch(() => {
        if (mounted) toast.error('Failed to load orders');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [lastQuery, offset, reloadKey]);

  // Excel export is not part of the Basic plan (Growth and above, and the trial)
  const [planId, setPlanId] = useState(null);
  useEffect(() => {
    let mounted = true;
    api
      .get('/billing')
      .then((res) => {
        if (mounted) setPlanId(res.data?.subscription?.plan || null);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (actionRef.current && !actionRef.current.contains(e.target)) {
        setOpenAction(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Every status the order status engine can set, so no order is hidden by the filter
  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'received', label: 'Received' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'processing', label: 'Processing' },
    { value: 'ready-dispatch', label: 'Ready for Dispatch' },
    { value: 'partially-dispatched', label: 'Partially Dispatched' },
    { value: 'dispatched', label: 'Dispatched' },
    { value: 'in-transit', label: 'In Transit' },
    { value: 'delayed', label: 'Delayed' },
    { value: 'partially-delivered', label: 'Partially Delivered' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const statusLabels = {
    received: 'Received',
    confirmed: 'Confirmed',
    processing: 'Processing',
    'ready-dispatch': 'Ready for Dispatch',
    'partially-dispatched': 'Partially Dispatched',
    dispatched: 'Dispatched',
    'in-transit': 'In Transit',
    'partially-delivered': 'Partially Delivered',
    delayed: 'Delayed',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };

  const formatMoney = (value, currency) => {
    const sym = currencySymbols[currency] || currency || '';
    return `${sym}${(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(d + (String(d).length === 10 ? 'T00:00:00' : ''));
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const toDisplayOrder = (o) => {
    // Status slug, also for older values like "In Transit"
    const status = String(o.status || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
    const qty = Number(o.total_qty) || 0;
    const itemCount = Number(o.item_count) || 0;
    // Quantities in different units cannot be added up
    const mixedUnits = Number(o.unit_count) > 1;
    return {
      id: o.id,
      customer: o.party_name || '—',
      po: o.po_number || '—',
      material: o.material ? `${o.material}${itemCount > 1 ? ` +${itemCount - 1} more` : ''}` : '—',
      qty: mixedUnits
        ? `${itemCount} items`
        : qty > 0 ? `${qty.toLocaleString()}${o.material_unit ? ' ' + o.material_unit : ''}` : '—',
      searchText: [o.party_name, o.po_number, o.materials, o.tracking_numbers]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
      value: formatMoney(o.total_value, o.currency),
      due: formatDate(o.required_delivery_date),
      status,
      type: o.order_type,
    };
  };

  // The server already applied the tab, status filter and search (customer, PO, material, LR / tracking no.)
  const filteredOrders = orders.map(toDisplayOrder);
  const salesCount = typeCounts.sales;
  const purchaseCount = typeCounts.purchase;

  // Export covers every matching order, not only the page on screen
  const handleExport = async () => {
    if (planId === 'basic') {
      toast.info('Excel export is available on the Growth plan and above. Upgrade your plan in Billing.');
      return;
    }
    let allOrders;
    try {
      const res = await api.get('/orders', { params: JSON.parse(lastQuery) });
      allOrders = (res.data.orders || []).map(toDisplayOrder);
    } catch {
      toast.error('Failed to export orders');
      return;
    }
    const data = allOrders.map((o, i) => ({
      'Sr No.': i + 1,
      'Customer/Supplier': o.customer,
      'PO': o.po,
      'Material': o.material,
      'Quantity': o.qty,
      'Order Value': o.value,
      'Due Date': o.due,
      'Status': statusLabels[o.status],
    }));
    exportToCSV(data, `${activeTab}_orders`);
  };

  const handleDelete = async (orderId, label) => {
    if (!window.confirm(`Delete order ${label}? This cannot be undone.`)) return;
    setOpenAction(null);
    try {
      await api.delete(`/orders/${orderId}`);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      // Reload so the page, totals and tab counts stay correct
      setReloadKey((k) => k + 1);
      toast.success('Order deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete order');
    }
  };

  return (
    <>
      <div className='row'>
        <div className='col-lg-12'>
          <div className="member-page-header mb-2">
        <div>
          <h2>Orders</h2>
          <p>Manage your sales and purchase orders</p>
        </div>
        <div className="d-flex gap-2">
          {/* <button className="thm-btn outline fz-14 p-2" onClick={handleExport}>
            <FiDownload /> Export
          </button>
          <button className="thm-btn outline fz-14 p-2" onClick={() => printPage(`${activeTab === 'sales' ? 'Sales' : 'Purchase'} Orders`, '.member-card .table-responsive')}>
            <FiPrinter /> Print
          </button> */}

          <button className="thm-btn outline fz-14 p-2" onClick={handleExport}>
            <FiDownload /> Export
          </button>
          <button className="thm-btn outline fz-14 p-2" >
            <FiPrinter /> Print
          </button>

          <div className="position-relative" ref={actionRef}>
            <button className="thm-btn fz-14 p-2" onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }}>
              <FiPlus /> New Order <FiChevronDown />
            </button>
            {showDropdown && (
              <div className="order-dropdown-menu">
                <Link to="/app/orders/add" className="order-dropdown-item" onClick={() => setShowDropdown(false)}>
                  <FiEdit2 /> Add Manually
                </Link>
                <Link to="/app/orders/upload" className="order-dropdown-item" onClick={() => setShowDropdown(false)}>
                  <FiUpload /> Upload PO
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

        </div>

      </div>

      <div className='row'>
        <div className='col-lg-12'>
          <div className="member-tabs">
        <button
          className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          Sales Orders ({salesCount})
        </button>
        <button
          className={`tab-btn ${activeTab === 'purchase' ? 'active' : ''}`}
          onClick={() => setActiveTab('purchase')}
        >
          Purchase Orders ({purchaseCount})
        </button>
      </div>

        </div>

      </div>

      <div className='row'>
        <div className='col-lg-12'>
          <div className="search-filter-bar">
        <div className="custom-frm-bx flex-grow-1">
          <input type="text" className='form-control' placeholder="Search by customer, PO, material, LR / tracking no..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                <th>Material</th>
                <th>Quantity</th>
                <th>Order Value</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center py-4">
                    <div className="d-flex justify-content-center align-items-center" style={{height : "200px"}}  role="status">
      <div className="spinner-border" style={{ width: '2.5rem', height: '2.5rem', color: 'var(--primary-color)' }}>
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-4">No orders found</td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => (
                <tr key={order.id}>
                  <td>{offset + idx + 1}</td>
                  <td>{order.customer}</td>
                  <td className="po-number">{order.po}</td>
                  <td>{order.material}</td>
                  <td>{order.qty}</td>
                  <td>{order.value}</td>
                  <td>{order.due}</td>
                  <td>
                    <span className={`status-badge ${order.status}`}>
                      {statusLabels[order.status]}
                    </span>
                  </td>
                  <td>
        <div className="position-relative" ref={dropdownRef}>
                      <button
                        className="action-dropdown-btn"
                        onClick={(e) => { e.stopPropagation(); setOpenAction(openAction === idx ? null : idx); }}
                      >
                        Edit <LuChevronDown />
                      </button>
                      {openAction === idx && (
                        <div className="order-dropdown-menu" style={{ right: 0, left: 'auto' }}>
                          <Link to={`/app/orders/${order.id}`} className="order-dropdown-item" onClick={() => setOpenAction(null)}>
                            <FiEye /> View Details
                          </Link>
                          {isAdmin && (
                            <>
                              <Link to="/app/orders/add" state={{ editId: order.id }} className="order-dropdown-item" onClick={() => setOpenAction(null)}>
                                <FiEdit2 /> Edit
                              </Link>
                              <Link to="#" className="order-dropdown-item text-danger" onClick={(e) => { e.preventDefault(); handleDelete(order.id, order.po); }}>
                                <FiTrash2 /> Delete
                              </Link>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <BootstrapPagination total={total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} disabled={loading} />
      </div>

       </div>
      </div>
    </>
  );
}
