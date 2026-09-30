import { useState, useEffect } from 'react';
import { FiPlus, FiAlertTriangle, FiClock, FiPackage, FiTruck, FiAlertCircle, FiCheckCircle, FiDownload, FiPrinter } from 'react-icons/fi';
import { exportToCSV, printPage, printReport, exportSectionsToCSV } from '../../utils/exportUtils';
import '../../styles/member.css';
import { NavLink, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { useAuth } from '../../components/AuthProvider';

const currencySymbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SAR: 'SAR ' };

// ₹82.4L / ₹1.2Cr style for the KPI card
const formatCompact = (value) => {
  const v = Number(value) || 0;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1).replace(/\.0$/, '')}L`;
  return `₹${v.toLocaleString('en-IN')}`;
};

const formatMoney = (value, currency) => {
  const sym = currencySymbols[currency] ?? (currency ? `${currency} ` : '₹');
  return `${sym}${(Number(value) || 0).toLocaleString('en-IN')}`;
};

const formatDate = (d) => {
  if (!d) return '—';
  const date = new Date(String(d).length === 10 ? `${d}T00:00:00` : d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const toStatusKey = (value) => {
  const slug = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  return slug === 'ready' || slug === 'ready-for-dispatch' ? 'ready-dispatch' : slug;
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
};

// Needs Attention rule -> existing dot style and icon
const attentionStyle = {
  overdue: { dot: 'overdue', icon: <FiAlertCircle size={18} color="#c62828" /> },
  'due-soon': { dot: 'partial', icon: <FiClock size={18} color="#f57f17" /> },
  partial: { dot: 'partial', icon: <FiAlertTriangle size={18} color="#f57f17" /> },
  'no-update': { dot: 'no-update', icon: <FiClock size={18} color="#1565c0" /> },
  'missing-tracking': { dot: 'overdue', icon: <FiTruck size={18} color="#c62828" /> },
  'ai-review': { dot: 'no-update', icon: <FiPackage size={18} color="#1565c0" /> },
};

export default function Dashboard() {
  const [orderType, setOrderType] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Excel export is not part of the Basic plan (Growth and above, and the trial), same as Orders
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
    let mounted = true;
    setLoading(true);
    api
      .get('/dashboard', { params: { order_type: orderType } })
      .then((res) => {
        if (mounted) setData(res.data);
      })
      .catch(() => {
        if (mounted) toast.error('Failed to load dashboard');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [orderType]);

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const k = data?.kpis;
  const show = (v) => (loading && !data ? '—' : v);
  const deliveredChange = () => {
    if (!k) return '';
    if (!k.deliveredLastMonth) return k.deliveredThisMonth ? 'This month' : 'None yet this month';
    const pct = Math.round(((k.deliveredThisMonth - k.deliveredLastMonth) / k.deliveredLastMonth) * 100);
    return `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct)}% vs last month`;
  };

  const kpis = [
    { label: 'Open Orders', value: show(k?.openOrders ?? 0), sub: k ? `${k.newToday} new today` : '', icon: <FiPackage />, color: '#2D4735' },
    { label: 'Order Value', value: show(formatCompact(k?.valueThisMonth)), sub: 'This month', icon: <FiTruck />, color: '#1565c0' },
    { label: 'Due This Week', value: show(k?.dueThisWeek ?? 0), sub: k ? `${k.overdue} overdue` : '', icon: <FiClock />, color: '#e65100' },
    { label: 'In Transit', value: show(k?.inTransit ?? 0), sub: k ? `${k.shipmentsInTransit} shipment${k.shipmentsInTransit === 1 ? '' : 's'} on the way` : '', icon: <FiTruck />, color: '#0277bd' },
    { label: 'Delayed', value: show(k?.delayed ?? 0), sub: k ? (k.delayedAvgDays ? `Avg ${k.delayedAvgDays} day${k.delayedAvgDays === 1 ? '' : 's'} late` : 'Needs follow-up') : '', icon: <FiAlertCircle />, color: '#c62828' },
    { label: 'Delivered This Month', value: show(k?.deliveredThisMonth ?? 0), sub: deliveredChange(), icon: <FiCheckCircle />, color: '#2e7d32' },
  ];

  // Already filtered by the selected tab on the server
  const filteredOrders = (data?.recentOrders || []).map((o) => ({
    id: o.id,
    customer: o.party_name || '—',
    po: o.po_number || '—',
    value: formatMoney(o.total_value, o.currency),
    due: formatDate(o.required_delivery_date),
    status: toStatusKey(o.status),
    type: o.order_type,
  }));

  const attentionItems = (data?.needsAttention || []).map((item) => ({
    ...item,
    type: attentionStyle[item.type]?.dot || 'no-update',
    icon: attentionStyle[item.type]?.icon || <FiClock size={18} color="#1565c0" />,
  }));
  // The dashboard shows the most urgent few; the rest are on the Alerts page
  const attentionMore = Math.max((data?.needsAttentionTotal ?? attentionItems.length) - attentionItems.length, 0);

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

  // Dashboard report (what is on screen for the selected tab): summary cards, recent orders, needs attention
  const typeLabel = orderType === 'all' ? 'All Orders' : orderType === 'sales' ? 'Sales Orders' : 'Purchase Orders';
  const reportRows = () => ({
    summary: kpis.map((kpi) => ({ 'Metric': kpi.label, 'Value': kpi.value, 'Details': kpi.sub })),
    orders: filteredOrders.map((o, i) => ({
      'Sr. No.': i + 1,
      'Customer/Supplier': o.customer,
      'PO': o.po,
      'Value': o.value,
      'Due Date': o.due,
      'Status': statusLabels[o.status] || o.status,
    })),
    attention: attentionItems.map((item) => ({ 'Item': item.title, 'Details': item.desc })),
  });

  const handleExport = () => {
    if (planId === 'basic') {
      toast.info('Excel export is available on the Growth plan and above. Upgrade your plan in Billing.');
      return;
    }
    if (!data) {
      toast.info('The dashboard is still loading');
      return;
    }
    const rows = reportRows();
    exportSectionsToCSV([
      { title: `Dashboard Summary (${typeLabel}) - ${today}`, rows: rows.summary },
      { title: 'Recent Orders', rows: rows.orders },
      { title: 'Needs Attention', rows: rows.attention },
    ], `dashboard_${orderType}`);
  };

  const attentionColors = { overdue: '#c62828', partial: '#f57f17', 'no-update': '#1565c0' };
  const handlePrint = () => {
    if (!data) {
      toast.info('The dashboard is still loading');
      return;
    }
    const rows = reportRows();
    const statusSlugs = Object.fromEntries(Object.entries(statusLabels).map(([slug, label]) => [label, slug]));
    printReport('Dashboard Report', {
      meta: [typeLabel, today],
      kpis: kpis.map((kpi) => ({ label: kpi.label, value: kpi.value, sub: kpi.sub, color: kpi.color })),
      sections: [
        {
          title: 'Recent Orders',
          rows: rows.orders,
          empty: 'No orders yet',
          tableOptions: { badgeColumn: 'Status', badgeOf: (label) => statusSlugs[label], strongColumns: ['PO'] },
        },
        {
          title: 'Needs Attention',
          items: attentionItems.map((item) => ({ title: item.title, desc: item.desc, color: attentionColors[item.type] })),
          empty: 'All caught up - nothing needs attention right now',
        },
      ],
    });
  };

  // While the dashboard loads, one loader takes the place of the whole page content
  // if (loading) {
  //   return (
  //     <div className="d-flex justify-content-center align-items-center" style={{ height: '70vh' }} role="status">
  //       <div className="spinner-border" style={{ width: '2.5rem', height: '2.5rem', color: 'var(--primary-color)' }}>
  //         <span className="visually-hidden">Loading...</span>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <>
     <div className='row'>
      <div className='col-lg-12'>
         <div className="member-page-header">
        <div>
          <h2>{greeting()}{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}</h2>
          <p>{today}</p>
        </div>
        <div className="d-flex gap-2">
          {/* <button className="thm-btn outline fz-14 p-2" onClick={handleExport}>
            <FiDownload /> Export
          </button>
          <button className="thm-btn outline fz-14 p-2" onClick={() => printPage('Dashboard Report')}>
            <FiPrinter /> Print
          </button> */}
          <button className="thm-btn outline fz-14 p-2" onClick={handleExport}>
            <FiDownload /> Export
          </button>
          <button className="thm-btn outline fz-14 p-2" onClick={handlePrint}>
            <FiPrinter /> Print
          </button>
          <NavLink to="/app/orders/add" className="thm-btn p-2 fz-14">
            <FiPlus /> Add Order
          </NavLink>
        </div>
      </div>

      </div>

     </div>

      {/* While the dashboard loads, one loader takes the place of the page content below the header */}
      {loading ? (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '70vh' }} role="status">
          <div className="spinner-border" style={{ width: '2.5rem', height: '2.5rem', color: 'var(--primary-color)' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
      <>
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
        <div className="col-md-6 col-sm-12 col-lg-6 mb-3">
          <div className="member-card">
            <div className="member-card-header">
              <h5>Recent Orders</h5>

              <div>
                <NavLink to="/app/orders" className="view-all-btn">View All</NavLink>
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
                  {!loading && filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-secondary">No orders yet</td>
                    </tr>
                  )}
                  {filteredOrders.map((order, idx) => (
                    <tr key={order.id}>
                      <td>{idx + 1}</td>
                      <td>{order.customer}</td>
                      <td ><Link to={`/app/orders/${order.id}`} className="po-number">{order.po}</Link></td>
                      <td>{order.value}</td>
                      <td>{order.due}</td>
                      <td>
                        <span className={`status-badge ${order.status}`}>
                          {statusLabels[order.status] || order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-sm-12 col-lg-6">
          <div className="member-card">
            <div className="member-card-header">
              <h5>Needs Attention</h5>

              <div>
                <NavLink to="/app/alerts" className="view-all-btn">View All</NavLink>
              </div>
            </div>
            <div className="member-card-body py-0">
              {!loading && attentionItems.length === 0 && (
                <div className="attention-item">
                  <div className="attention-dot no-update">
                    <FiCheckCircle size={18} color="#2e7d32" />
                  </div>
                  <div className="attention-info">
                    <h6>All caught up</h6>
                    <p>Nothing needs attention right now</p>
                  </div>
                </div>
              )}
              {attentionItems.map((item, idx) => {
                const content = (
                  <>
                    <div className={`attention-dot ${item.type}`}>
                      {item.icon}
                    </div>
                    <div className="attention-info">
                      <h6>{item.title}</h6>
                      <p>{item.desc}</p>
                    </div>
                  </>
                );
                // Each entry opens the order / shipment / inbox it is about
                return item.link ? (
                  <Link to={item.link} className="attention-item attention-link" key={idx}>
                    {content}
                  </Link>
                ) : (
                  <div className="attention-item" key={idx}>
                    {content}
                  </div>
                );
              })}
              {attentionMore > 0 && (
                <div className="attention-more">
                  +{attentionMore} more - <Link to="/app/alerts" className="view-all-btn fz-14">View all alerts</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </>
  );
}
