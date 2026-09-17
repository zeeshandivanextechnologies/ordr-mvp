import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiEye, FiChevronDown, FiEdit2, FiTrash2 } from 'react-icons/fi';
import '../../styles/member.css';

const allOrders = {
  New: [
    { id: 1, customer: 'ABC Industries', type: 'Purchase', poNumber: 'PO-2024-0891', items: 'Mild Steel Sheets, Bolts', value: '₹1,85,000', emailDate: '15 Sep 2026', confidence: 95 },
    { id: 2, customer: 'XYZ Chemicals', type: 'Sales', poNumber: 'SO-2024-0342', items: 'Industrial Solvents', value: '₹2,40,000', emailDate: '14 Sep 2026', confidence: 78 },
    { id: 3, customer: 'Global Metworks', type: 'Purchase', poNumber: 'PO-2024-0893', items: 'Copper Pipes, Fittings', value: '₹62,500', emailDate: '14 Sep 2026', confidence: 55 },
  ],
  'Needs Review': [
    { id: 4, customer: 'DEF Corp', type: 'Purchase', poNumber: 'PO-2024-0894', items: 'Steel Rods', value: '₹95,000', emailDate: '13 Sep 2026', confidence: 65 },
    { id: 5, customer: 'GHI Industries', type: 'Sales', poNumber: 'SO-2024-0345', items: 'Aluminum Sheets', value: '₹1,20,000', emailDate: '12 Sep 2026', confidence: 42 },
  ],
  Confirmed: [
    { id: 6, customer: 'JKL Steel', type: 'Purchase', poNumber: 'PO-2024-0895', items: 'Iron Ore', value: '₹3,50,000', emailDate: '11 Sep 2026', confidence: 98 },
    { id: 7, customer: 'MNO Chemicals', type: 'Sales', poNumber: 'SO-2024-0346', items: 'Industrial Adhesives', value: '₹75,000', emailDate: '10 Sep 2026', confidence: 92 },
    { id: 8, customer: 'PQR Metals', type: 'Purchase', poNumber: 'PO-2024-0896', items: 'Copper Wire', value: '₹1,50,000', emailDate: '09 Sep 2026', confidence: 96 },
    { id: 9, customer: 'STU Industries', type: 'Sales', poNumber: 'SO-2024-0347', items: 'Steel Tubes', value: '₹2,10,000', emailDate: '08 Sep 2026', confidence: 99 },
    { id: 10, customer: 'VWX Corp', type: 'Purchase', poNumber: 'PO-2024-0897', items: 'Fasteners', value: '₹45,000', emailDate: '07 Sep 2026', confidence: 94 },
  ],
  Ignored: [
    { id: 11, customer: 'YZ Industries', type: 'Sales', poNumber: 'SO-2024-0348', items: 'Misc Items', value: '₹25,000', emailDate: '06 Sep 2026', confidence: 30 },
  ],
};

const tabs = [
  { label: 'New', count: allOrders.New.length },
  { label: 'Needs Review', count: allOrders['Needs Review'].length },
  { label: 'Confirmed', count: allOrders.Confirmed.length },
  { label: 'Ignored', count: allOrders.Ignored.length },
];

export default function AIOrderInbox() {
  const [activeTab, setActiveTab] = useState('New');
  const [filter, setFilter] = useState('all');
  const [openAction, setOpenAction] = useState(null);
  const actionRef = useRef(null);

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

  const currentOrders = allOrders[activeTab].filter((order) => {
    if (filter === 'all') return true;
    return order.type.toLowerCase() === filter;
  });

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
              <input type="text" className='form-control' placeholder="Search by PO, customer..." />
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
                  {currentOrders.length > 0 ? (
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
                                <Link to={`/member/ai-inbox/${order.id}/review`} className="order-dropdown-item" onClick={() => setOpenAction(null)}>
                                  <FiEye /> Review
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
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9" className="text-center">No orders found</td>
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
