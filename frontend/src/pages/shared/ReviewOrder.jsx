import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiMail, FiFileText, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import api from '../../services/api';
import { toast } from 'react-toastify';
import '../../styles/member.css';

const confidenceLevel = (value) => {
  const v = Number(value);
  if (!Number.isFinite(v)) return 'low';
  if (v >= 75) return 'high';
  if (v >= 40) return 'medium';
  return 'low';
};

const formatMoney = (value) => {
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return '—';
  return '₹' + v.toLocaleString('en-IN');
};

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function ReviewOrder() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [extract, setExtract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    let mounted = true;
    api
      .get(`/ai-inbox/${id}`)
      .then((res) => {
        if (mounted) {
          setExtract(res.data.extract);
          setForm({
            order_type: res.data.extract.order_type || 'Purchase',
            customer_name: res.data.extract.customer_name || '',
            po_number: res.data.extract.po_number || '',
            items: res.data.extract.items || '',
            approx_value: res.data.extract.approx_value ?? '',
            confidence: res.data.extract.confidence ?? '',
          });
        }
      })
      .catch((err) => {
        if (mounted) setError(err.response?.data?.message || 'Failed to load entry');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  const isClosed = extract && (extract.status === 'Confirmed' || extract.status === 'Ignored');

  const handleInputChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleBack = () => {
    navigate('/app/ai-inbox');
  };

  const handleIgnore = async () => {
    setSaving(true);
    try {
      await api.patch(`/ai-inbox/${id}`, { status: 'Ignored' });
      toast.success('Entry ignored');
      navigate('/app/ai-inbox');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to ignore entry');
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/ai-inbox/${id}`, {
        order_type: form.order_type,
        customer_name: form.customer_name,
        po_number: form.po_number,
        items: form.items,
        approx_value: form.approx_value,
        confidence: form.confidence,
      });
      setExtract(data.extract);
      setForm({
        order_type: data.extract.order_type || 'Purchase',
        customer_name: data.extract.customer_name || '',
        po_number: data.extract.po_number || '',
        items: data.extract.items || '',
        approx_value: data.extract.approx_value ?? '',
        confidence: data.extract.confidence ?? '',
      });
      setEditMode(false);
      toast.success('Changes saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!form.customer_name || !form.customer_name.trim() || form.customer_name.trim() === 'Unknown') {
      toast.error('Customer/Supplier name must be set before confirming');
      return;
    }
    if (!form.po_number || !form.po_number.trim() || form.po_number.trim() === 'Unknown') {
      toast.error('PO / Order number must be set before confirming');
      return;
    }
    setConfirming(true);
    try {
      const { data } = await api.post(`/ai-inbox/${id}/confirm`);
      toast.success('Order confirmed and created');
      navigate(`/app/orders/${data.order.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm order');
      setConfirming(false);
    }
  };

  const sourceDate = extract?.email_date || extract?.created_at;
  const badgeClass = extract?.status === 'Confirmed'
    ? 'confirmed'
    : extract?.status === 'Ignored'
      ? 'cancelled'
      : 'processing';

  return (
    <>
      <div className="row">
        <div className="col-lg-12">
          <div className="member-page-header">
            <div className="d-flex align-items-center gap-3">
              <button className="back-btn" onClick={handleBack}><FiArrowLeft /> <span className='back-mobile-hide'> Back</span> </button>
              <div>
                <h2 className="mb-1">Review Order</h2>
                <p className="mb-0">Verify and confirm AI-extracted order data</p>
              </div>
            </div>
            {extract && <span className={`status-badge ${badgeClass}`}>{extract.status}</span>}
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

      {!loading && !error && extract && (
        <>
          <div className="row">
            <div className="col-lg-6 mb-3">
              <div className="member-card h-100">
                <div className="member-card-header">
                  <h5><FiMail className="me-2" /> Original Source</h5>
                </div>
                <div className="member-card-body">
                  <div className="row">
                    <div className="col-12 mb-3">
                      <div className="details-box">
                        <h6>From</h6>
                        <h5>{extract.source_email || '—'}</h5>
                      </div>
                    </div>
                    <div className="col-12 mb-3">
                      <div className="details-box">
                        <h6>Subject</h6>
                        <h5>{extract.source_subject || '—'}</h5>
                      </div>
                    </div>
                    <div className="col-12 mb-3">
                      <div className="details-box">
                        <h6>Date</h6>
                        <h5>{sourceDate ? new Date(sourceDate).toLocaleString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</h5>
                      </div>
                    </div>
                    <div className="col-12 mb-3">
                      <div className="details-box">
                        <h6>Email Body Preview</h6>
                        <div className="email-preview-box" style={{ whiteSpace: 'pre-line' }}>
                          {extract.source_body || 'No email body available'}
                        </div>
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="details-box">
                        <h6>Attachment</h6>
                        <div className="d-flex align-items-center gap-2">
                          <FiFileText /> {extract.attachment_name || '—'}
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
                  <h5><FiEdit2 className="me-2" /> Extracted Data</h5>
                </div>
                <div className="member-card-body">
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <div className="custom-frm-bx details-box">
                        <h6>Order Type</h6>
                        {editMode ? (
                          <select className="form-control" name="order_type" value={form.order_type} onChange={handleInputChange}>
                            <option value="Purchase">Purchase</option>
                            <option value="Sales">Sales</option>
                          </select>
                        ) : (
                          <h5>{extract.order_type || '—'}</h5>
                        )}
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <div className="details-box">
                        <h6>AI Confidence</h6>
                        {editMode ? (
                          <input
                            type="number"
                            className="form-control"
                            name="confidence"
                            min="0"
                            max="100"
                            value={form.confidence}
                            onChange={handleInputChange}
                          />
                        ) : (
                          <h5 className="d-flex align-items-center gap-2">
                            {Number.isFinite(Number(extract.confidence)) ? `${Number(extract.confidence)}%` : '—'}
                            <span className={`confidence-tag ${confidenceLevel(extract.confidence)}`}>{confidenceLevel(extract.confidence) === 'high' ? 'High' : confidenceLevel(extract.confidence) === 'medium' ? 'Medium' : 'Low'}</span>
                          </h5>
                        )}
                      </div>
                    </div>
                    <div className="col-12 mb-3">
                      <div className="details-box">
                        <h6>Customer / Supplier</h6>
                        {editMode ? (
                          <input type="text" className="form-control" name="customer_name" value={form.customer_name} onChange={handleInputChange} />
                        ) : (
                          <h5>{extract.customer_name || '—'}</h5>
                        )}
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <div className="details-box">
                        <h6>PO Number</h6>
                        {editMode ? (
                          <input type="text" className="form-control" name="po_number" value={form.po_number} onChange={handleInputChange} />
                        ) : (
                          <h5>{extract.po_number || '—'}</h5>
                        )}
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <div className="details-box">
                        <h6>Order Date</h6>
                        <h5>{formatDate(sourceDate)}</h5>
                      </div>
                    </div>
                    <div className="col-12 mb-3">
                      <div className="details-box">
                        <h6>Order Value</h6>
                        {editMode ? (
                          <input type="number" className="form-control" name="approx_value" min="0" value={form.approx_value} onChange={handleInputChange} />
                        ) : (
                          <h5>{formatMoney(extract.approx_value)}</h5>
                        )}
                      </div>
                    </div>
                    <div className="col-12 mb-3">
                      <div className="details-box">
                        <h6>Product</h6>
                        {editMode ? (
                          <input type="text" className="form-control" name="items" value={form.items} onChange={handleInputChange} />
                        ) : (
                          <h5>{extract.items || '—'}</h5>
                        )}
                      </div>
                    </div>
                    <div className="col-md-4 mb-3">
                      <div className="details-box">
                        <h6>Quantity</h6>
                        <h5>—</h5>
                      </div>
                    </div>

                    <div className="col-md-4 mb-3">
                      <div className="details-box">
                        <h6>Unit</h6>
                        <h5>—</h5>
                      </div>
                    </div>

                    <div className="col-md-4 mb-3">
                      <div className="details-box">
                        <h6>Unit Price</h6>
                        <h5 className='d-flex align-items-center gap-2'>—
                          <span className='confidence-tag low'>Low</span>
                        </h5>
                      </div>
                    </div>
                    
                    <div className="col-md-6 mb-3">
                      <div className="details-box">
                        <h6>Delivery Location</h6>
                        <h5>—</h5>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="details-box">
                        <h6>Required Date</h6>
                        <h5 className='d-flex align-items-center gap-2'>—
                          <span className='confidence-tag low'>Low</span>
                        </h5>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-lg-12">
              <div className="review-box">
                {editMode ? (
                  <>
                    <button className="thm-btn outline fz-14" onClick={() => setEditMode(false)} disabled={saving}><FiX /> Cancel</button>
                    <button className="thm-btn fz-14" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving...' : <><FiCheck /> Save Changes</>}
                    </button>
                  </>
                ) : (
                  <>
                    <button className="thm-btn outline fz-14" onClick={handleIgnore} disabled={saving || confirming || isClosed}><FiX /> Ignore</button>
                    <button className="thm-btn outline fz-14" onClick={() => setEditMode(true)} disabled={saving || confirming || isClosed}><FiEdit2 /> Edit</button>
                    <button className="thm-btn fz-14" onClick={handleConfirm} disabled={saving || confirming || isClosed}>
                      {confirming ? 'Confirming...' : <><FiCheck /> Confirm Order</>}
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