import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiChevronDown, FiEye, FiEdit2, FiTrash2 } from 'react-icons/fi';
import '../../styles/member.css';

export default function Tracking() {
  const [activeTab, setActiveTab] = useState('all');
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

  const shipments = [
    { id: 1, customer: 'ABC Industries', po: 'PO-8192', lrAwb: 'LR-2234', route: 'Mumbai → Delhi', eta: '18 Sep 2026', status: 'in-transit', lastUpdated: '2h ago' },
    { id: 2, customer: 'XYZ Corp', po: 'PO-8193', lrAwb: 'AWB-5521', route: 'Chennai → Pune', eta: '17 Sep 2026', status: 'delivered', lastUpdated: '1d ago' },
    { id: 3, customer: 'Global Supplies', po: 'PO-8194', lrAwb: 'LR-3312', route: 'Bangalore → Kolkata', eta: '22 Sep 2026', status: 'delayed', lastUpdated: '5h ago' },
    { id: 4, customer: 'PQR Ltd', po: 'PO-8195', lrAwb: 'AWB-7744', route: 'Hyderabad → Jaipur', eta: '19 Sep 2026', status: 'in-transit', lastUpdated: '30m ago' },
    { id: 5, customer: 'LMN Traders', po: 'PO-8196', lrAwb: 'LR-9901', route: 'Ahmedabad → Lucknow', eta: '21 Sep 2026', status: 'delivered', lastUpdated: '2d ago' },
  ];

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'in-transit', label: 'In Transit' },
    { value: 'delayed', label: 'Delayed' },
    { value: 'delivered', label: 'Delivered' },
  ];

  const statusLabels = {
    'in-transit': 'In Transit',
    delivered: 'Delivered',
    delayed: 'Delayed',
  };

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'in-transit', label: 'In Transit' },
    { key: 'delayed', label: 'Delayed' },
    { key: 'delivered', label: 'Delivered' },
  ];

  const filteredShipments = shipments.filter((s) => {
    const matchesTab = activeTab === 'all' || s.status === activeTab;
    const matchesFilter = filter === 'all' || s.status === filter;
    return matchesTab && matchesFilter;
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
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className='row'>
        <div className='col-lg-12'>
          <div className="search-filter-bar">
            <div className="custom-frm-bx flex-grow-1">
              <input type="text" className='form-control' placeholder="Search by customer, PO, LR/AWB..." />
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
                  {filteredShipments.map((shipment, idx) => (
                    <tr key={shipment.id}>
                      <td>{idx + 1}</td>
                      <td>{shipment.customer}</td>
                      <td className="po-number">{shipment.po}</td>
                      <td>{shipment.lrAwb}</td>
                      <td>{shipment.route}</td>
                      <td>{shipment.eta}</td>
                      <td>
                        <span className={`status-badge ${shipment.status}`}>
                          {statusLabels[shipment.status]}
                        </span>
                      </td>
                      <td>{shipment.lastUpdated}</td>
                      <td>
                        <div className="position-relative" ref={actionRef}>
                          <button
                            className="action-dropdown-btn"
                            onClick={(e) => { e.stopPropagation(); setOpenAction(openAction === idx ? null : idx); }}
                          >
                            Edit <FiChevronDown />
                          </button>
                          {openAction === idx && (
                            <div className="order-dropdown-menu" style={{  minWidth : "auto" }}>
                              <Link to={`/member/shipments/${shipment.id}`} className="order-dropdown-item" onClick={() => setOpenAction(null)}>
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
