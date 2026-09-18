import { useState } from 'react';
import { FiPlus, FiAlertTriangle, FiClock, FiPackage, FiTruck, FiAlertCircle, FiCheckCircle, FiDownload, FiPrinter } from 'react-icons/fi';
import { exportToCSV, printPage } from '../../utils/exportUtils';
import '../../styles/member.css';
import { NavLink } from 'react-router-dom';

export default function Dashboard() {
  const [orderType, setOrderType] = useState('all');

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const kpis = [
    { label: 'Open Orders', value: '47', sub: '12 new today', icon: <FiPackage />, color: '#2D4735' },
    { label: 'Order Value', value: '₹82.4L', sub: 'This month', icon: <FiTruck />, color: '#1565c0' },
    { label: 'Due This Week', value: '18', sub: '5 urgent', icon: <FiClock />, color: '#e65100' },
    { label: 'In Transit', value: '12', sub: '3 delayed', icon: <FiTruck />, color: '#0277bd' },
    { label: 'Delayed', value: '4', sub: 'Avg 3 days', icon: <FiAlertCircle />, color: '#c62828' },
    { label: 'Delivered This Month', value: '63', sub: '↑ 12% vs last', icon: <FiCheckCircle />, color: '#2e7d32' },
  ];

  const recentOrders = [
    { customer: 'ABC Industries', po: 'PO-8192', value: '₹6,20,000', due: '22 Sep 2026', status: 'processing', type: 'sales' },
    { customer: 'XYZ Chemicals', po: 'PO-8193', value: '₹1,45,000', due: '18 Sep 2026', status: 'in-transit', type: 'purchase' },
    { customer: 'Global Pharma Ltd', po: 'PO-8194', value: '₹3,80,000', due: '25 Sep 2026', status: 'ready-dispatch', type: 'sales' },
    { customer: 'MediCorp Solutions', po: 'PO-8195', value: '₹92,000', due: '17 Sep 2026', status: 'delayed', type: 'purchase' },
    { customer: 'TechParts India', po: 'PO-8196', value: '₹2,15,000', due: '20 Sep 2026', status: 'delivered', type: 'sales' },
  ];

  const filteredOrders = orderType === 'all' ? recentOrders : recentOrders.filter((o) => o.type === orderType);

  const attentionItems = [
    { type: 'overdue', title: '3 orders overdue', desc: 'PO-8195, PO-8188, PO-8182 past due date', icon: <FiAlertCircle size={18} color="#c62828" /> },
    { type: 'partial', title: '2 partial fulfilments', desc: 'PO-8190, PO-8187 awaiting balance stock', icon: <FiAlertTriangle size={18} color="#f57f17" /> },
    { type: 'no-update', title: '5 orders no update', desc: 'No status change in last 7 days', icon: <FiClock size={18} color="#1565c0" /> },
  ];

  const statusLabels = {
    processing: 'Processing',
    'in-transit': 'In Transit',
    'ready-dispatch': 'Ready for Dispatch',
    delayed: 'Delayed',
    delivered: 'Delivered',
  };

  const handleExport = () => {
    const data = filteredOrders.map((o, i) => ({
      'Sr. No.': i + 1,
      'Customer/Supplier': o.customer,
      'PO': o.po,
      'Value': o.value,
      'Due Date': o.due,
      'Status': statusLabels[o.status],
    }));
    exportToCSV(data, 'dashboard_orders');
  };

  return (
    <>
     <div className='row'>
      <div className='col-lg-12'>
         <div className="member-page-header">
        <div>
          <h2>Good Morning, Rahul</h2>
          <p>{today}</p>
        </div>
        <div className="d-flex gap-2">
          {/* <button className="thm-btn outline fz-14 p-2" onClick={handleExport}>
            <FiDownload /> Export
          </button>
          <button className="thm-btn outline fz-14 p-2" onClick={() => printPage('Dashboard Report')}>
            <FiPrinter /> Print
          </button> */}
          <NavLink to="/app/orders/add" className="thm-btn">
            <FiPlus /> Add Order
          </NavLink>
        </div>
      </div>

      </div>

     </div>

      <div className="row">
        {kpis.map((kpi, idx) => (
          <div className="col-lg-4 col-md-6 col-sm-12 mb-3" key={idx}>
            <div className="kpi-card">
              <div className="d-flex justify-content-between align-items-start ">
                <div className="kpi-label">{kpi.label}</div>
                <div className="kpi-icon" style={{ background: `${kpi.color}14`, color: kpi.color }}>
                  {kpi.icon}
                </div>
              </div>
              <div className="kpi-value">{kpi.value}</div>
              <div className="kpi-sub">{kpi.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="d-flex justify-content-between align-items-center">
        <div className="member-tabs">
          {['all', 'sales', 'purchase'].map((type) => (
            <button
              key={type}
              className={`tab-btn ${orderType === type ? 'active' : ''}`}
              onClick={() => setOrderType(type)}
            >
              {type === 'all' ? 'All' : type === 'sales' ? 'Sales Orders' : 'Purchase Orders'}
            </button>
          ))}
        </div>
      </div>

      <div className="row ">
        <div className="col-12 col-lg-6 mb-3">
          <div className="member-card">
            <div className="member-card-header">
              <h5>Recent Orders</h5>

              <div>
                <NavLink to="#" className="view-all-btn">View All</NavLink>
              </div>

            </div>
            <div className="table-responsive">
              <table className="member-table">
                <thead>
                  <tr>
                    <th>Sr. No.</th>
                    <th>Customer/Supplier</th>
                    <th>PO</th>
                    <th>Value</th>
                    <th>Due Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>{order.customer}</td>
                      <td className="po-number">{order.po}</td>
                      <td>{order.value}</td>
                      <td>{order.due}</td>
                      <td>
                        <span className={`status-badge ${order.status}`}>
                          {statusLabels[order.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="member-card">
            <div className="member-card-header">
              <h5>Needs Attention</h5>
              
              <div>
                <NavLink to="#" className="view-all-btn">View All</NavLink>
              </div>
            </div>
            <div className="member-card-body py-0">
              {attentionItems.map((item, idx) => (
                <div className="attention-item" key={idx}>
                  <div className={`attention-dot ${item.type}`}>
                    {item.icon}
                  </div>
                  <div className="attention-info">
                    <h6>{item.title}</h6>
                    <p>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
