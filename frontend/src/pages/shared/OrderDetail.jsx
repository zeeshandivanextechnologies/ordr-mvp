import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiDownload, FiFile, FiShoppingBag, FiTruck, FiCheckCircle, FiBox, FiPlus } from 'react-icons/fi';
import api from '../../services/api';
import { toast } from 'react-toastify';
import '../../styles/member.css';

const currencySymbols = { INR: '₹', USD: '$', AED: 'AED', SAR: 'SAR' };

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

export default function OrderDetail() {
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    api
      .get(`/orders/${id}`)
      .then((res) => {
        if (mounted) setData(res.data);
      })
      .catch((err) => {
        if (mounted) setError(err.response?.data?.message || 'Failed to load order');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  const formatMoney = (value, currency) => {
    const sym = currencySymbols[currency] || currency || '';
    return `${sym}${(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(String(d).length === 10 ? d + 'T00:00:00' : d);
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const order = data?.order || null;
  const items = data?.items || [];
  const trackingEvents = data?.trackingEvents || [];
  const documents = data?.documents || [];
  const shipments = data?.shipments || [];

  const qty = (n) => {
    const value = Number(n) || 0;
    return value.toLocaleString('en-IN');
  };

  const orderedQty = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  const dispatchedQty = items.reduce((sum, i) => sum + (Number(i.dispatched) || 0), 0);
  const deliveredQty = items.reduce((sum, i) => sum + (Number(i.delivered) || 0), 0);
  const balanceQty = orderedQty - dispatchedQty;
  const orderUnit = items[0]?.unit || '';

  const showQty = (n) => `${qty(n)}${orderUnit ? ' ' + orderUnit : ''}`;

  const statusKey = order ? String(order.status || '').toLowerCase() : '';
  const statusLabel = statusLabels[statusKey] || order?.status || '';
  const orderTypeLabel = order?.order_type === 'purchase' ? 'Purchase Order' : 'Sales Order';

  const kpis = [
    { label: 'Ordered', value: showQty(orderedQty), icon: <FiShoppingBag />, color: '#2D4735' },
    { label: 'Dispatched', value: showQty(dispatchedQty), icon: <FiTruck />, color: '#1565c0' },
    { label: 'Delivered', value: showQty(deliveredQty), icon: <FiCheckCircle />, color: '#2e7d32' },
    { label: 'Balance', value: showQty(balanceQty), icon: <FiBox />, color: '#e65100' },
  ];

  const overview = order
    ? [
        { label: 'Order Type', value: orderTypeLabel },
        { label: 'PO Number', value: order.po_number || '—' },
        { label: 'Order Date', value: formatDate(order.order_date) },
        { label: 'Required Delivery Date', value: formatDate(order.required_delivery_date) },
        { label: 'Delivery Address', value: order.delivery_address || '—' },
        { label: 'Currency', value: order.currency ? `${order.currency}${currencySymbols[order.currency] && currencySymbols[order.currency] !== order.currency ? ` (${currencySymbols[order.currency]})` : ''}` : '—' },
      ]
    : [];

  return (
    <>
      <div className="row">
        <div className="col-lg-12">
          <div className="member-page-header">
            <div className="d-flex align-items-center gap-3">
              <button className="back-btn" onClick={() => navigate('/app/orders')}><FiArrowLeft /> <span className='back-mobile-hide'> Back</span> </button>
              <div>
                <h2 className="mb-1">{order?.party_name || 'Order'}</h2>
                <p className="mb-0">{order?.po_number || ''}</p>
              </div>
            </div>
            {!loading && order && (
              <div className="d-flex align-items-center gap-3">
                <span className="order-value">{formatMoney(order.total_value, order.currency)}</span>
                <span className={`status-badge ${statusKey}`}>{statusLabel}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="row">
        {!loading && order && kpis.map((item, idx) => (
              <div className="col-lg-3 col-md-6 col-sm-6 col-12 mb-3" key={idx}>
                <div className="kpi-card">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="kpi-label">{item.label}</div>
                    <div className="kpi-icon" style={{ background: `${item.color}14`, color: item.color }}>
                      {item.icon}
                    </div>
                  </div>
                  <div className="kpi-value">{item.value}</div>
                </div>
              </div>
            ))}
      </div>

      <div className="row">
        <div className="col-lg-12">
          <div className="member-tabs">
            {['overview', 'shipments', 'updates', 'documents'].map((tab) => (
              <button
                key={tab}
                className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-12">
          <div className="member-card">
            <div className="member-card-body">
              {loading && <div className="text-center py-4">Loading order details...</div>}

              {!loading && error && (
                <div className="alert alert-danger mb-0">{error}</div>
              )}

              {!loading && !error && order && activeTab === 'overview' && (
                <>
                  <div className="row">
                    {overview.map((item, idx) => (
                      <div className="col-md-6 mb-3" key={idx}>
                        <div className='details-box'>
                          <h6>{item.label}</h6>
                          <h5>{item.value}</h5>
                        </div>
                      </div>
                    ))}
                  </div>

                  {items && items.length > 0 && (
                    <div className="">
                      <h6 className="fz-20 mb-2">Product Lines</h6>
                      <div className="table-responsive">
                        <table className="member-table">
                          <thead>
                            <tr>
                              <th>Sr. No.</th>
                              <th>Product / Material</th>
                              <th>SKU</th>
                              <th>Quantity</th>
                              <th>Unit Price</th>
                              <th>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item, idx) => (
                              <tr key={idx}>
                                <td>{idx + 1}</td>
                                <td>
                                  <div>{item.product}</div>
                                  {item.description && <small className="text-secondary fz-14">{item.description}</small>}
                                </td>
                                <td>{item.sku || '—'}</td>
                                <td>{qty(item.quantity)} {item.unit}</td>
                                <td>{formatMoney(item.unit_price, order.currency)}</td>
                                <td>{formatMoney(item.total, order.currency)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {!loading && !error && order && activeTab === 'shipments' && (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="fz-20 mb-0">Shipments</h6>
                    <Link to={`/app/orders/${order.id}/shipments/add`} className="thm-btn p-2 fz-14">
                      <FiPlus /> Add Shipment
                    </Link>
                  </div>
                  {shipments.map((s, idx) => {
                    const shipStatus = String(s.status || '').toLowerCase();
                    return (
                      <div className="shipment-card" key={idx}>
                        <div className="shipment-header">
                          <div className="d-flex align-items-center gap-3">
                            <div className="kpi-icon" style={{ background: '#1565c014', color: '#1565c0' }}>
                              <FiTruck />
                            </div>
                            <div>
                              <span className="shipment-id">{s.shipment_number}</span>
                              <div className="shipment-meta">
                                <span>Qty: {s.quantity ? qty(s.quantity) + ' ' + (orderUnit || '') : '—'}</span>
                                <span>Transporter: {s.transporter || '—'}</span>
                                <span>LR: {s.lr_number || '—'}</span>
                                <span>Date: {formatDate(s.dispatch_date)}</span>
                              </div>
                              <div className="shipment-meta">
                                <span>{s.origin ? s.origin : '—'} → {s.destination ? s.destination : '—'}</span>
                                {s.vehicle_number && <span>Vehicle: {s.vehicle_number}</span>}
                              </div>
                            </div>
                          </div>
                          <span className={`status-badge ${shipStatus}`}>
                            {statusLabels[shipStatus] || s.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {shipments.length === 0 && (
                    <div className="text-center py-4 text-secondary">No shipments yet</div>
                  )}
                </div>
              )}

              {!loading && !error && order && activeTab === 'updates' && (
                <div className="timeline">
                  {trackingEvents.map((e, idx) => (
                    <div className="timeline-item" key={idx}>
                      <div className="timeline-date">{formatDateTime(e.created_at)}</div>
                      <div className="timeline-text">{e.description || e.status}</div>
                    </div>
                  ))}
                  {trackingEvents.length === 0 && (
                    <div className="text-center py-4 text-secondary">No updates yet</div>
                  )}
                </div>
              )}

              {!loading && !error && order && activeTab === 'documents' && (
                <div>
                  {documents.map((doc, idx) => (
                    <div className="document-item" key={idx}>
                      <div className="document-info">
                        <div className="document-icon"><FiFile /></div>
                        <div>
                          <div className="document-name">{doc.file_name}</div>
                          <div className="document-meta">{(doc.file_type || '').toUpperCase()} • {formatSize(doc.file_size)}</div>
                        </div>
                      </div>
                      <button className="thm-btn outline p-2 fz-14" onClick={() => toast.info('Document download coming soon')}><FiDownload /> Download</button>
                    </div>
                  ))}
                  {documents.length === 0 && (
                    <div className="text-center py-4 text-secondary">No documents yet</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}