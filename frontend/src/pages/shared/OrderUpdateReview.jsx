import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiMail, FiTruck, FiCheck, FiX, FiRotateCcw, FiExternalLink, FiInfo, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { confidenceLevel, confidenceLabel } from '../../utils/confidence';
import { UPDATE_TYPE_LABELS, SHIPMENT_UPDATE_TYPES as SHIPMENT_TYPES, MATCH_LABELS } from '../../utils/orderUpdates';
import '../../styles/member.css';

// Module 21: review an update email and apply it to an existing order / shipment
const MATCH_LEVELS = { high: 'high', medium: 'medium', low: 'low' };

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

export default function OrderUpdateReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [update, setUpdate] = useState(null);
  const [orders, setOrders] = useState([]);
  const [target, setTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    orderId: '',
    updateType: 'dispatched',
    shipmentId: 'new',
    shipmentNumber: '',
    quantity: '',
    lrNumber: '',
    awbNumber: '',
    grNumber: '',
    transporter: '',
    vehicleNumber: '',
    expectedDeliveryDate: '',
  });

  const loadUpdate = async () => {
    const res = await api.get(`/ai-inbox/updates/${id}`);
    const u = res.data.update;
    const x = u.extracted || {};
    setUpdate(u);
    setForm({
      orderId: u.order_missing ? '' : u.order_id || '',
      updateType: u.update_type || 'other',
      shipmentId: u.shipment_id || 'new',
      shipmentNumber: x.lr_number || x.awb_number || x.gr_number || '',
      quantity: x.quantity ?? '',
      lrNumber: x.lr_number || '',
      awbNumber: x.awb_number || '',
      grNumber: x.gr_number || '',
      transporter: x.transporter || '',
      vehicleNumber: x.vehicle_number || '',
      expectedDeliveryDate: x.expected_delivery_date || '',
    });
  };

  useEffect(() => {
    let mounted = true;
    Promise.all([loadUpdate(), api.get('/orders').then((res) => mounted && setOrders(res.data.orders || []))])
      .catch((err) => {
        if (mounted) setError(err.response?.data?.message || 'Failed to load order update');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  // Shipments and remaining quantity of the chosen order
  useEffect(() => {
    if (!form.orderId) {
      setTarget(null);
      return undefined;
    }
    let mounted = true;
    api
      .get(`/ai-inbox/updates/orders/${form.orderId}`)
      .then((res) => {
        if (!mounted) return;
        setTarget(res.data);
        setForm((prev) => {
          const shipmentOk = prev.shipmentId === 'new' || res.data.shipments.some((s) => s.id === prev.shipmentId && s.status !== 'cancelled');
          const next = { ...prev, shipmentId: shipmentOk ? prev.shipmentId : 'new' };
          // Default a new shipment's quantity to what the email says, capped at the balance
          const emailQty = Number(prev.quantity);
          if (res.data.remaining > 0 && (!emailQty || emailQty > res.data.remaining)) next.quantity = res.data.remaining;
          return next;
        });
      })
      .catch(() => {
        if (mounted) setTarget(null);
      });
    return () => {
      mounted = false;
    };
  }, [form.orderId]);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const isPending = update?.status === 'Pending';
  const isShipmentUpdate = SHIPMENT_TYPES.includes(form.updateType);
  const isNewShipment = isShipmentUpdate && form.shipmentId === 'new';
  const activeShipments = (target?.shipments || []).filter((s) => s.status !== 'cancelled');
  const x = update?.extracted || {};
  const selectedOrder = orders.find((o) => o.id === form.orderId);

  const summary = (() => {
    if (!update) return '';
    const orderRef = selectedOrder ? `PO ${selectedOrder.po_number}` : x.po_number ? `PO ${x.po_number}` : 'order';
    const refs = [form.lrNumber && `LR ${form.lrNumber}`, form.awbNumber && `AWB ${form.awbNumber}`, form.grNumber && `GR ${form.grNumber}`].filter(Boolean);
    return `Update ${orderRef} → ${UPDATE_TYPE_LABELS[form.updateType] || form.updateType}${refs.length ? ` · ${refs.join(' · ')}` : ''}`;
  })();

  const handleApply = async () => {
    if (!form.orderId) {
      toast.error('Choose the order this update belongs to');
      return;
    }
    const payload = {
      orderId: form.orderId,
      updateType: form.updateType,
      lrNumber: form.lrNumber,
      awbNumber: form.awbNumber,
      grNumber: form.grNumber,
      transporter: form.transporter,
      vehicleNumber: form.vehicleNumber,
      expectedDeliveryDate: form.expectedDeliveryDate,
      ...(isShipmentUpdate ? { shipmentId: form.shipmentId } : {}),
      ...(isNewShipment ? { shipmentNumber: form.shipmentNumber, quantity: form.quantity } : {}),
    };
    setBusy(true);
    try {
      const res = await api.post(`/ai-inbox/updates/${id}/apply`, payload);
      toast.success(res.data.summary ? `Update applied: ${res.data.summary}` : 'Update applied');
      navigate(`/app/orders/${res.data.orderId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply update');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (action) => {
    setBusy(true);
    try {
      await api.post(`/ai-inbox/updates/${id}/${action}`);
      toast.success(action === 'ignore' ? 'Update ignored' : 'Update restored');
      await loadUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setBusy(false);
    }
  };

  const badgeClass = update?.status === 'Applied' ? 'delivered' : update?.status === 'Ignored' ? 'cancelled' : 'processing';
  const matchLevel = MATCH_LEVELS[update?.match_confidence] || 'low';

  const textField = (name, label, placeholder) => (
    <div className="col-lg-6" key={name}>
      <div className="details-box custom-frm-bx">
        <label>{label}</label>
        {isPending ? (
          <input type="text" className="form-control" name={name} value={form[name]} onChange={handleChange} placeholder={placeholder} />
        ) : (
          <h5>{form[name] || '—'}</h5>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="row">
        <div className="col-lg-12">
          <div className="member-page-header">
            <div className="d-flex align-items-center gap-3">
              <button className="back-btn" onClick={() => navigate('/app/ai-inbox', { state: { tab: 'Order Updates' } })}>
                <FiArrowLeft /> <span className='back-mobile-hide'> Back</span>
              </button>
              <div>
                <h2 className="mb-1">Review Order Update</h2>
                <p className="mb-0">Check the email and apply the update to the right order</p>
              </div>
            </div>
            {update && <span className={`status-badge ${badgeClass}`}>{update.status}</span>}
          </div>
        </div>
      </div>

      {loading && (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border" style={{ color: 'var(--primary-color)' }} />
        </div>
      )}

      {!loading && error && (
        <div className="row">
          <div className="col-lg-12">
            <div className="member-card">
              <div className="member-card-body text-center py-4">{error}</div>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && update && (
        <>
          <div className="row">
            <div className="col-lg-6 mb-3">
              <div className="member-card h-100">
                <div className="member-card-header">
                  <h5><FiMail className="me-2" /> Original Email</h5>
                </div>
                <div className="member-card-body">
                  <div className="row">
                    <div className="col-12 mb-3">
                      <div className="details-box">
                        <h6>From</h6>
                        <h5>{update.source_name ? `${update.source_name} <${update.source_email}>` : update.source_email || '—'}</h5>
                      </div>
                    </div>
                    <div className="col-12 mb-3">
                      <div className="details-box">
                        <h6>Subject</h6>
                        <h5>{update.source_subject || '—'}</h5>
                      </div>
                    </div>
                    <div className="col-12 mb-3">
                      <div className="details-box">
                        <h6>Date</h6>
                        <h5>{formatDateTime(update.email_date)}</h5>
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="details-box">
                        <h6>Email Body Preview</h6>
                        <div className="email-preview-box" style={{ whiteSpace: 'pre-line' }}>
                          {update.source_body || 'No email body available'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-6 mb-3">
              <div className="member-card h-100">
                <div className="member-card-header">
                  <h5><FiTruck className="me-2" /> Suggested Update</h5>
                </div>
                <div className="member-card-body">
                  {update.status === 'Applied' ? (
                    <div className="update-note success"><FiCheckCircle /> <span>Applied: {update.applied_summary || 'Update applied'}</span></div>
                  ) : (
                    <div className="update-note"><FiInfo /> <span>{summary}</span></div>
                  )}
                  {isPending && !update.order_id && (
                    <div className="update-note warning"><FiAlertTriangle /> <span>No matching order was found. Choose the order this email is about.</span></div>
                  )}
                  {isPending && update.order_id && update.match_confidence === 'low' && (
                    <div className="update-note warning"><FiAlertTriangle /> <span>This is a low-confidence match. Check that the order is correct before applying.</span></div>
                  )}

                  <div className="row">
                    <div className="col-md-6">
                      <div className="details-box custom-frm-bx">
                        <label>AI Confidence</label>
                        <h5 className="d-flex align-items-center gap-2">
                          {Number.isFinite(Number(update.confidence)) ? `${Number(update.confidence)}%` : '—'}
                          <span className={`confidence-tag ${confidenceLevel(update.confidence)}`}>{confidenceLabel(update.confidence)}</span>
                        </h5>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="details-box custom-frm-bx">
                        <label>Matched By</label>
                        <h5 className="d-flex align-items-center gap-2">
                          {update.match_method ? MATCH_LABELS[update.match_method] : 'Not matched'}
                          {update.match_method && (
                            <span className={`confidence-tag ${matchLevel}`}>{matchLevel.charAt(0).toUpperCase() + matchLevel.slice(1)}</span>
                          )}
                        </h5>
                      </div>
                    </div>

                    <div className="col-lg-6">
                      <div className="details-box custom-frm-bx">
                        <label>Order</label>
                        {isPending ? (
                          <select className="form-control" name="orderId" value={form.orderId} onChange={handleChange}>
                            <option value="">Choose order...</option>
                            {orders.map((o) => (
                              <option key={o.id} value={o.id}>{`${o.po_number} — ${o.party_name}`}</option>
                            ))}
                          </select>
                        ) : (
                          <h5>{update.order_po_number ? `${update.order_po_number} — ${update.order_party_name}` : '—'}</h5>
                        )}
                      </div>
                    </div>
                    <div className="col-lg-6">
                      <div className="details-box custom-frm-bx">
                        <label>Update</label>
                        {isPending ? (
                          <select className="form-control" name="updateType" value={form.updateType} onChange={handleChange}>
                            {Object.entries(UPDATE_TYPE_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        ) : (
                          <h5>{UPDATE_TYPE_LABELS[update.update_type] || update.update_type || '—'}</h5>
                        )}
                      </div>
                    </div>

                    <div className="col-lg-6">
                      <div className="details-box custom-frm-bx">
                        <label>PO in Email</label>
                        <h5>{x.po_number || '—'}</h5>
                      </div>
                    </div>
                    <div className="col-lg-6">
                      <div className="details-box custom-frm-bx">
                        <label>Customer / Supplier in Email</label>
                        <h5>{x.party_name || '—'}</h5>
                      </div>
                    </div>
                    <div className="col-lg-6">
                      <div className="details-box custom-frm-bx">
                        <label>Product in Email</label>
                        <h5>{x.product || '—'}</h5>
                      </div>
                    </div>
                    <div className="col-lg-6">
                      <div className="details-box custom-frm-bx">
                        <label>Quantity in Email</label>
                        <h5>{x.quantity ? `${Number(x.quantity).toLocaleString('en-IN')}${x.unit ? ` ${x.unit}` : ''}` : '—'}</h5>
                      </div>
                    </div>

                    {isPending && isShipmentUpdate && (
                      <>
                        <div className="col-lg-12">
                          <div className="details-box custom-frm-bx">
                            <label>Shipment</label>
                            <select className="form-control" name="shipmentId" value={form.shipmentId} onChange={handleChange} disabled={!form.orderId}>
                              <option value="new">New shipment</option>
                              {activeShipments.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {`${s.shipment_number} — ${UPDATE_TYPE_LABELS[s.status] || s.status}${s.lr_number ? ` (LR ${s.lr_number})` : ''}`}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        {isNewShipment && (
                          <>
                            {textField('shipmentNumber', 'Shipment Number', 'e.g. SHP-2203')}
                            <div className="col-lg-6">
                              <div className="details-box custom-frm-bx">
                                <label>Quantity{target?.hasItems ? ` (${Number(target.remaining).toLocaleString('en-IN')} ${target.unit || ''} left)` : ''}</label>
                                <input type="number" className="form-control" name="quantity" min="0" step="any" value={form.quantity} onChange={handleChange} />
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {(isPending ? isShipmentUpdate : SHIPMENT_TYPES.includes(update.update_type)) && (
                      <>
                        {textField('lrNumber', 'LR Number', 'LR number')}
                        {textField('awbNumber', 'AWB Number', 'AWB number')}
                        {textField('grNumber', 'GR Number', 'GR number')}
                        {textField('transporter', 'Transporter', 'Transporter name')}
                        {textField('vehicleNumber', 'Vehicle Number', 'Vehicle number')}
                        <div className="col-lg-6">
                          <div className="details-box custom-frm-bx">
                            <label>Expected Delivery Date</label>
                            {isPending ? (
                              <input type="date" className="form-control" name="expectedDeliveryDate" value={form.expectedDeliveryDate} onChange={handleChange} />
                            ) : (
                              <h5>{form.expectedDeliveryDate || '—'}</h5>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-lg-12">
              <div className="review-box">
                {update.order_id && !update.order_missing && (
                  <Link to={`/app/orders/${update.order_id}`} className="thm-btn outline fz-14"><FiExternalLink /> Open Order</Link>
                )}
                {update.status === 'Ignored' && (
                  <button className="thm-btn outline fz-14" onClick={() => changeStatus('restore')} disabled={busy}><FiRotateCcw /> Restore</button>
                )}
                {isPending && (
                  <>
                    <button className="thm-btn outline fz-14" onClick={() => changeStatus('ignore')} disabled={busy}><FiX /> Ignore</button>
                    <button className="thm-btn fz-14" onClick={handleApply} disabled={busy || !form.orderId}>
                      {busy ? 'Applying...' : <><FiCheck /> Apply Update</>}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
