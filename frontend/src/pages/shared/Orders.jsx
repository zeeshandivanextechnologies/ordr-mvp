import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiSearch, FiChevronDown, FiUpload, FiEdit2, FiEye, FiTrash2, FiDownload, FiPrinter } from 'react-icons/fi';
import { exportToCSV, printPage } from '../../utils/exportUtils';
import api from '../../services/api';
import { toast } from 'react-toastify';
import '../../styles/member.css';
import { LuChevronDown } from 'react-icons/lu';

const currencySymbols = { INR: '₹', USD: '$', AED: 'AED', SAR: 'SAR' };

export default function Orders() {
  const [activeTab, setActiveTab] = useState('sales');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAction, setOpenAction] = useState(null);
  const dropdownRef = useRef(null);
  const actionRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    api
      .get('/orders')
      .then((res) => {
        if (mounted) setOrders(res.data.orders || []);
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

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'received', label: 'Received' },
    { value: 'processing', label: 'Processing' },
    { value: 'ready-dispatch', label: 'Ready for Dispatch' },
    { value: 'dispatched', label: 'Dispatched' },
    { value: 'in-transit', label: 'In Transit' },
    { value: 'delayed', label: 'Delayed' },
    { value: 'delivered', label: 'Delivered' },
  ];

  const statusLabels = {
    received: 'Received',
    processing: 'Processing',
    'ready-dispatch': 'Ready for Dispatch',
    dispatched: 'Dispatched',
    'in-transit': 'In Transit',
    delayed: 'Delayed',
    delivered: 'Delivered',
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

  const displayOrders = orders.map((o) => {
    const status = String(o.status || '').toLowerCase();
    const qty = Number(o.total_qty) || 0;
    return {
      id: o.id,
      customer: o.party_name,
      po: o.po_number,
      material: o.material || '—',
      qty: qty > 0 ? `${qty.toLocaleString()}${o.material_unit ? ' ' + o.material_unit : ''}` : '—',
      value: formatMoney(o.total_value, o.currency),
      due: formatDate(o.required_delivery_date),
      status,
      type: o.order_type,
    };
  });

  const salesCount = orders.filter((o) => o.order_type === 'sales').length;
  const purchaseCount = orders.filter((o) => o.order_type === 'purchase').length;

  const filteredOrders = displayOrders.filter((o) => {
    const matchesTab = activeTab === 'sales' || activeTab === 'purchase' ? o.type === activeTab : true;
    const matchesFilter = filter === 'all' || o.status === filter;
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      o.customer.toLowerCase().includes(term) ||
      o.po.toLowerCase().includes(term);
    return matchesTab && matchesFilter && matchesSearch;
  });

  const handleExport = () => {
    const data = filteredOrders.map((o, i) => ({
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
          <input type="text" className='form-control' placeholder="Search by customer, PO number..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                <tr key={idx}>
                  <td>{idx + 1}</td>
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
                          <Link to="/app/orders/add" state={{ editId: order.id }} className="order-dropdown-item" onClick={() => setOpenAction(null)}>
                            <FiEdit2 /> Edit
                          </Link>
                          <Link to="#" className="order-dropdown-item text-danger" onClick={(e) => { e.preventDefault(); handleDelete(order.id, order.po); }}>
                            <FiTrash2 /> Delete
                          </Link>
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
      </div>

       </div>
      </div>
    </>
  );
}
