import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiTruck, FiCheckCircle, FiAlertCircle, FiClock, FiPackage } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../../services/api';
import '../../styles/member.css';

const statusLabels = {
  'ready-dispatch': 'Ready for Dispatch',
  'in-transit': 'In Transit',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  delayed: 'Delayed',
  cancelled: 'Cancelled',
};

// value = status sent to the API, btnClass = existing button style
const statusActions = [
  { value: 'ready-dispatch', btnClass: 'ready', label: 'Mark Ready', icon: <FiCheckCircle /> },
  { value: 'dispatched', btnClass: 'dispatched', label: 'Mark Dispatched', icon: <FiTruck /> },
  { value: 'in-transit', btnClass: 'in-transit', label: 'Mark In Transit', icon: <FiClock /> },
  { value: 'delivered', btnClass: 'delivered', label: 'Mark Delivered', icon: <FiCheckCircle /> },
  { value: 'delayed', btnClass: 'delayed', label: 'Mark Delayed', icon: <FiAlertCircle /> },
  { value: 'cancelled', btnClass: 'cancelled', label: 'Cancel', icon: <FiAlertCircle /> },
];

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
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
};

export default function ShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(null);

  const loadShipment = useCallback(async () => {
    try {
      const res = await api.get(`/shipments/${id}`);
      setShipment(res.data.shipment);
      setTimeline(res.data.trackingEvents || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load shipment');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadShipment();
  }, [loadShipment]);

  const currentStatus = shipment?.status || '';
  const isClosed = currentStatus === 'cancelled' || String(shipment?.order_status || '').toLowerCase() === 'cancelled';

  const handleStatusChange = async (status) => {
    if (!shipment || status === currentStatus || updating || isClosed) return;
    if (status === 'cancelled' && !window.confirm(`Cancel shipment ${shipment.shipment_number}? Its quantity will be released back to the order.`)) {
      return;
    }
    setUpdating(status);
    try {
      await api.post(`/shipments/${id}/status`, { status });
      toast.success(`Shipment marked ${statusLabels[status]}`);
      await loadShipment();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  const shipmentItems = shipment?.shipment_items || [];
  const lineText = (i) => `${i.product} x ${Number(i.quantity).toLocaleString('en-IN')}${i.unit ? ' ' + i.unit : ''}`;
  // Several items (possibly in different units) are listed instead of added up
  const quantity = shipmentItems.length > 1
    ? `${shipmentItems.length} items`
    : shipmentItems.length === 1
      ? `${Number(shipmentItems[0].quantity).toLocaleString('en-IN')}${shipmentItems[0].unit ? ' ' + shipmentItems[0].unit : ''}`
      : shipment?.quantity
        ? `${Number(shipment.quantity).toLocaleString('en-IN')}${shipment.unit ? ' ' + shipment.unit : ''}`
        : '—';
  const trackingNumbers = shipment
    ? [shipment.lr_number && `LR: ${shipment.lr_number}`, shipment.awb_number && `AWB: ${shipment.awb_number}`, shipment.gr_number && `GR: ${shipment.gr_number}`]
        .filter(Boolean)
        .join(' / ') || '—'
    : '—';

  return (
    <>
      <div className="row">
        <div className="col-lg-12">
          <div className="member-page-header">
            <div className="d-flex align-items-center gap-3">
              <button
                className="back-btn"
                onClick={() => (shipment ? navigate(`/app/orders/${shipment.order_id}`) : navigate(-1))}
              >
                <FiArrowLeft /> <span className='back-mobile-hide'> Back</span>
              </button>
              <div>
                <h2 className="mb-1">{shipment?.shipment_number || 'Shipment'}</h2>
                <p className="mb-0">{shipment ? `PO: ${shipment.po_number || '—'}` : ''}</p>
              </div>
            </div>
            {shipment && (
              <div className="d-flex align-items-center gap-3">
                <span className={`status-badge ${currentStatus}`}>
                  {statusLabels[currentStatus] || shipment.status}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading && <div className="text-center py-4">Loading shipment details...</div>}

      {!loading && error && (
        <div className="row">
          <div className="col-lg-12">
            <div className="alert alert-danger">{error}</div>
          </div>
        </div>
      )}

      {!loading && !error && shipment && (
        <>
          <div className="row">
            {[
              { label: 'Quantity', value: quantity, icon: <FiPackage />, color: '#2D4735' },
              { label: 'Transporter', value: shipment.transporter || '—', icon: <FiTruck />, color: '#1565c0' },
              { label: 'Dispatch Date', value: formatDate(shipment.dispatch_date), icon: <FiClock />, color: '#e65100' },
              { label: 'Expected Delivery', value: formatDate(shipment.expected_delivery_date), icon: <FiCheckCircle />, color: '#2e7d32' },
            ].map((item, idx) => (
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
            <div className="col-lg-8">
              <div className="member-card mb-3">
                <div className="member-card-header">
                  <h5>Shipment Details</h5>
                </div>
                <div className="member-card-body">
                  <div className="row">
                    {[
                      { label: 'Shipment Number', value: shipment.shipment_number },
                      { label: 'Customer / Supplier', value: shipment.party_name || '—' },
                      {
                        label: 'Order PO',
                        value: <Link to={`/app/orders/${shipment.order_id}`}>{shipment.po_number || 'View Order'}</Link>,
                      },
                      { label: 'Quantity', value: quantity },
                      { label: 'Items', value: shipmentItems.length > 1 ? shipmentItems.map(lineText).join(', ') : shipment.items || '—' },
                      { label: 'Transporter', value: shipment.transporter || '—' },
                      { label: 'LR / AWB / GR Number', value: trackingNumbers },
                      { label: 'Vehicle Number', value: shipment.vehicle_number || '—' },
                      { label: 'Origin', value: shipment.origin || '—' },
                      { label: 'Destination', value: shipment.destination || '—' },
                      { label: 'Dispatch Date', value: formatDate(shipment.dispatch_date) },
                      { label: 'Expected Delivery Date', value: formatDate(shipment.expected_delivery_date) },
                    ].map((item, idx) => (
                      <div className="col-md-6 col-lg-6 col-sm-12 mb-3" key={idx}>
                        <div className="details-box">
                          <h6>{item.label}</h6>
                          <h5>{item.value}</h5>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="member-card mb-3">
                <div className="member-card-header">
                  <h5>Status Actions</h5>
                </div>
                <div className="member-card-body">
                  <div className="d-flex flex-column gap-2">
                    {statusActions.map((action) => (
                      <button
                        key={action.value}
                        className={`status-action-btn ${action.btnClass} ${currentStatus === action.value ? 'active' : ''}`}
                        onClick={() => handleStatusChange(action.value)}
                        disabled={isClosed || !!updating}
                      >
                        {action.icon} {updating === action.value ? 'Updating...' : action.label}
                        {currentStatus === action.value && <span className="status-action-badge">Active</span>}
                      </button>
                    ))}
                  </div>
                  {isClosed && (
                    <p className="mb-0 mt-2 text-muted fz-14">
                      {currentStatus === 'cancelled' ? 'This shipment is cancelled.' : 'This order is cancelled.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-lg-12">
              <div className="member-card">
                <div className="member-card-header">
                  <h5>Timeline</h5>
                </div>
                <div className="member-card-body">
                  <div className="timeline">
                    {timeline.map((item) => (
                      <div className="timeline-item" key={item.id}>
                        <div className="timeline-date">{formatDateTime(item.created_at)}</div>
                        <div className="timeline-text">{item.description || item.status}</div>
                      </div>
                    ))}
                    {timeline.length === 0 && (
                      <div className="text-center py-4 text-secondary">No updates yet</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
