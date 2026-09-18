import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiSearch, FiChevronDown, FiUpload, FiEdit2, FiEye, FiTrash2, FiDownload, FiPrinter } from 'react-icons/fi';
import { exportToCSV, printPage } from '../../utils/exportUtils';
import '../../styles/member.css';
import { LuChevronDown } from 'react-icons/lu';

export default function Orders() {
  const [activeTab, setActiveTab] = useState('sales');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filter, setFilter] = useState('all');
  const [openAction, setOpenAction] = useState(null);
  const dropdownRef = useRef(null);
  const actionRef = useRef(null);

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

  const orders = [
    { customer: 'ABC Industries', po: 'PO-8192', material: 'Industrial Valves', qty: '250 pcs', value: '₹6,20,000', due: '22 Sep 2026', status: 'processing', type: 'sales' },
    { customer: 'XYZ Chemicals', po: 'PO-8193', material: 'Chemical Drums', qty: '500 units', value: '₹1,45,000', due: '18 Sep 2026', status: 'in-transit', type: 'purchase' },
    { customer: 'Global Pharma Ltd', po: 'PO-8194', material: 'Packaging Material', qty: '10,000 sets', value: '₹3,80,000', due: '25 Sep 2026', status: 'ready-dispatch', type: 'sales' },
    { customer: 'MediCorp Solutions', po: 'PO-8195', material: 'Medical Gloves', qty: '20,000 pcs', value: '₹92,000', due: '17 Sep 2026', status: 'delayed', type: 'purchase' },
    { customer: 'TechParts India', po: 'PO-8196', material: 'Steel Fasteners', qty: '5,000 kg', value: '₹2,15,000', due: '20 Sep 2026', status: 'delivered', type: 'sales' },
    { customer: 'FreshMart Supplies', po: 'PO-8197', material: 'Corrugated Boxes', qty: '3,000 pcs', value: '₹78,000', due: '23 Sep 2026', status: 'dispatched', type: 'purchase' },
  ];

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'processing', label: 'Processing' },
    { value: 'ready-dispatch', label: 'Ready for Dispatch' },
    { value: 'dispatched', label: 'Dispatched' },
    { value: 'in-transit', label: 'In Transit' },
    { value: 'delayed', label: 'Delayed' },
    { value: 'delivered', label: 'Delivered' },
  ];

  const statusLabels = {
    processing: 'Processing',
    'ready-dispatch': 'Ready for Dispatch',
    dispatched: 'Dispatched',
    'in-transit': 'In Transit',
    delayed: 'Delayed',
    delivered: 'Delivered',
  };

  const salesCount = orders.filter(o => o.type === 'sales').length;
  const purchaseCount = orders.filter(o => o.type === 'purchase').length;

  const filteredOrders = orders.filter((o) => {
    const matchesTab = activeTab === 'all' || o.type === activeTab;
    const matchesFilter = filter === 'all' || o.status === filter;
    return matchesTab && matchesFilter;
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
          <input type="text" className='form-control' placeholder="Search by customer, PO number..." />
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
              {filteredOrders.map((order, idx) => (
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
                          <Link to={`/app/orders/${idx + 1}`} className="order-dropdown-item" onClick={() => setOpenAction(null)}>
                            <FiEye /> View Details
                          </Link>
                          <Link to="#" className="order-dropdown-item">
                            <FiEdit2 /> Edit Details
                          </Link>
                          <Link to="#" className="order-dropdown-item text-danger">
                            <FiTrash2 /> Delete
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
