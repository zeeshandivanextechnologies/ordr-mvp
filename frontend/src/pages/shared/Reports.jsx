import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiBarChart2, FiCheckCircle, FiClock, FiTruck, FiCpu, FiLock } from 'react-icons/fi';
import api from '../../services/api';
import { useAuth } from '../../components/AuthProvider';
import '../../styles/member.css';

const statusLabels = {
  accepted: 'Accepted',
  rejected: 'Rejected',
  'in-process': 'In Process',
  dispatched: 'DISPATCHED',
  'in-transit': 'IN TRANSIT',
  delivered: 'DELIVERED',
};

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const monthLabel = (m) => {
  const [y, mo] = String(m).split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

// Advanced reporting (Business / Pro plans)
export default function Reports() {
  const [months, setMonths] = useState(6);
  const [data, setData] = useState(null);
  const [locked, setLocked] = useState(null);
  const [loading, setLoading] = useState(true);
  const { role } = useAuth();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .get('/reports', { params: { months } })
      .then((res) => {
        if (mounted) {
          setData(res.data);
          setLocked(null);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        if (err.response?.status === 402) setLocked(err.response.data.message);
        else toast.error('Failed to load reports');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [months]);

  const totals = (data?.byMonth || []).reduce(
    (acc, m) => ({
      orders: acc.orders + m.salesOrders + m.purchaseOrders,
      sales: acc.sales + m.salesValue,
      purchase: acc.purchase + m.purchaseValue,
    }),
    { orders: 0, sales: 0, purchase: 0 }
  );

  // "Orders by Status" totals (for the Total row and each status's share)
  const statusTotal = (data?.byStatus || []).reduce(
    (acc, s) => ({
      count: acc.count + (Number(s.count) || 0),
      salesOrders: acc.salesOrders + (Number(s.salesOrders) || 0),
      purchaseOrders: acc.purchaseOrders + (Number(s.purchaseOrders) || 0),
      value: acc.value + (Number(s.value) || 0),
    }),
    { count: 0, salesOrders: 0, purchaseOrders: 0, value: 0 }
  );

  const kpis = data
    ? [
      { label: 'Orders', value: totals.orders.toLocaleString('en-IN'), sub: `Last ${months} months`, icon: <FiBarChart2 />, color: '#2D4735' },
      { label: 'On-time Delivery', value: data.delivery.onTimeRate === null ? '—' : `${data.delivery.onTimeRate}%`, sub: `${data.delivery.deliveredOrders} delivered orders`, icon: <FiCheckCircle />, color: '#2e7d32' },
      { label: 'Avg. Delivery Time', value: data.delivery.avgDeliveryDays === null ? '—' : `${data.delivery.avgDeliveryDays} days`, sub: 'Order created to delivered', icon: <FiClock />, color: '#e65100' },
      { label: 'Delayed Shipments', value: `${data.shipments.delayed}`, sub: `of ${data.shipments.total} shipments`, icon: <FiTruck />, color: '#c62828' },
      { label: 'AI Detections Confirmed', value: data.ai.total ? `${Math.round((data.ai.confirmed / data.ai.total) * 100)}%` : '—', sub: `${data.ai.confirmed} of ${data.ai.total} (${data.ai.from_email} from email)`, icon: <FiCpu />, color: '#1565c0' },
      { label: 'Sales / Purchase Value', value: money(totals.sales), sub: `Purchases ${money(totals.purchase)}`, icon: <FiBarChart2 />, color: '#0277bd' },
    ]
    : [];

  return (
    <>
      <div className="row">
        <div className="col-lg-12">
          <div className="member-page-header">
            <div>
              <h2>Reports</h2>
              <p>Order, delivery and AI performance for your business</p>
            </div>
          </div>
        </div>
      </div>

      {!locked && (
        <div className="row">
          <div className="col-lg-12">
            <div className="member-tabs">
              {[3, 6, 12].map((m) => (
                <button key={m} className={`tab-btn ${months === m ? 'active' : ''}`} onClick={() => setMonths(m)}>
                  Last {m} months
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading &&
        <div className="d-flex justify-content-center align-items-center" style={{ height: "200px" }} role="status">
          <div className="spinner-border" style={{ width: '2.5rem', height: '2.5rem', color: 'var(--primary-color)' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      }

      {!loading && locked && (
        <div className="row">
          <div className="col-lg-12">
            <div className="member-card">
              <div className="member-empty-state">
                <div className="empty-icon"><FiLock /></div>
                <h4>Advanced reporting</h4>
                <p>{locked}</p>
                {role === 'admin' && <Link to="/app/billing" className="thm-btn mt-2">View Plans</Link>}
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="row">
            {kpis.map((kpi, idx) => (
              <div className="col-lg-4 col-md-6 col-sm-12 mb-3" key={idx}>
                <div className="kpi-card">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="kpi-label">{kpi.label}</div>
                    <div className="kpi-icon" style={{ background: `${kpi.color}14`, color: kpi.color }}>{kpi.icon}</div>
                  </div>
                  <div className="kpi-value">{kpi.value}</div>
                  <div className="kpi-sub">{kpi.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="row">
            <div className="col-lg-12 mb-3">
              <div className="member-card">
                <div className="member-card-header"><h5>Orders by Month</h5></div>
                <div className="table-responsive">
                  <table className="member-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Sales Orders</th>
                        <th>Sales Value</th>
                        <th>Purchase Orders</th>
                        <th>Purchase Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byMonth.length === 0 && (
                        <tr><td colSpan={5} className="text-center py-4 text-secondary">No orders in this period</td></tr>
                      )}
                      {data.byMonth.map((m) => (
                        <tr key={m.month}>
                          <td>{monthLabel(m.month)}</td>
                          <td>{m.salesOrders}</td>
                          <td>{money(m.salesValue)}</td>
                          <td>{m.purchaseOrders}</td>
                          <td>{money(m.purchaseValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            {[
              { title: 'Top Customers', rows: data.topCustomers },
              { title: 'Top Suppliers', rows: data.topSuppliers },
            ].map((block) => (
              <div className="col-lg-6 mb-3" key={block.title}>
                <div className="member-card h-100">
                  <div className="member-card-header"><h5>{block.title}</h5></div>
                  <div className="table-responsive">
                    <table className="member-table">
                      <thead>
                        <tr><th>Name</th><th>Orders</th><th>Value</th></tr>
                      </thead>
                      <tbody>
                        {block.rows.length === 0 && (
                          <tr><td colSpan={3} className="text-center py-4 text-secondary">No data</td></tr>
                        )}
                        {block.rows.map((r) => (
                          <tr key={r.name}>
                            <td>{r.name}</td>
                            <td>{r.orders}</td>
                            <td>{money(r.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="row">
            <div className="col-lg-12 mb-3">
              <div className="member-card">
                <div className="member-card-header"><h5>Orders by Status</h5></div>
                <div className="table-responsive">
                  <table className="member-table">
                    <thead>
                      <tr>
                        <th>SR. No.</th>
                        <th> Share</th>
                        <th>Orders</th>
                        <th>Sales</th>
                        <th>Purchase</th>
                        <th>Order Value</th>
                        <th style={{ minWidth: 160 }}>Status</th></tr>
                    </thead>
                    <tbody>
                      {data.byStatus.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-4 text-secondary">No orders in this period</td></tr>
                      )}
                      {data.byStatus.map((s, idx) => {
                        const share = statusTotal.count > 0 ? Math.round((s.count / statusTotal.count) * 100) : 0;
                        return (
                          <tr key={s.status}>
                            <td>{idx + 1}</td>
                            <td>{s.count}</td>
                            <td>{s.salesOrders ?? '—'}</td>
                            <td>{s.purchaseOrders ?? '—'}</td>
                            <td>{s.value !== undefined ? money(s.value) : '—'}</td>
                            <td>
                              <div className="usage-bar mb-1" title={`${share}% of all orders in this period`}>
                                <div className="usage-bar-fill" style={{ width: `${share}%` }} />
                              </div>
                              <span className="usage-pct">{share}%</span>
                            </td>

                            <td><span className={`status-badge ${s.status}`}>{statusLabels[s.status] || s.status}</span></td>

                          </tr>
                        );
                      })}
                      {data.byStatus.length > 0 && (
                        <tr>
                      
                          <td><strong>Total</strong></td>
                          <td><strong>{statusTotal.count}</strong></td>
                          <td><strong>{statusTotal.salesOrders}</strong></td>
                          <td><strong>{statusTotal.purchaseOrders}</strong></td>
                          <td><strong>{money(statusTotal.value)}</strong></td>
                          <td><span className="usage-pct"></span></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
