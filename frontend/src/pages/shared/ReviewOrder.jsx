import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiMail, FiFileText, FiEdit2, FiCheck, FiX, FiDownload, FiRotateCcw } from 'react-icons/fi';
import api from '../../services/api';
import documentService from '../../services/documentService';
import { toast } from 'react-toastify';
import { confidenceLevel, confidenceLabel, isLowConfidence } from '../../utils/confidence';
import '../../styles/member.css';


const currencySymbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SAR: 'SAR ' };
const currencyOptions = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SAR'];

const formatMoney = (value, currency) => {
  const v = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(v) || v <= 0) return '—';
  const sym = currency ? (currencySymbols[currency] ?? `${currency} `) : '₹';
  return sym + v.toLocaleString('en-IN');
};

const formatNumber = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const v = Number(value);
  return Number.isFinite(v) ? v.toLocaleString('en-IN') : '—';
};

// Per-field AI confidence badge; nothing is shown when the AI gave no score
const FieldConfidence = ({ value }) => {
  if (value === null || value === undefined) return null;
  const level = confidenceLevel(value);
  return (
    <span className={`confidence-tag ${level}`} title={`AI confidence ${value}%`}>
      {confidenceLabel(value)}
    </span>
  );
};

const emptyLine = { product: '', sku: '', quantity: '', unit: '', unit_price: '', total: '' };

const buildForm = (extract) => ({
  order_type: extract.order_type || 'Purchase',
  customer_name: extract.customer_name || '',
  po_number: extract.po_number || '',
  items: extract.items || '',
  approx_value: extract.approx_value ?? '',
  confidence: extract.confidence ?? '',
  order_date: extract.order_date || '',
  required_delivery_date: extract.required_delivery_date || '',
  delivery_location: extract.delivery_location || '',
  currency: extract.currency || '',
  line_items: Array.isArray(extract.line_items)
    ? extract.line_items.map((i) => ({
        product: i.product ?? '',
        sku: i.sku ?? '',
        quantity: i.quantity ?? '',
        unit: i.unit ?? '',
        unit_price: i.unit_price ?? '',
        total: i.total ?? '',
      }))
    : [],
});

const formatDate = (value) => {
  if (!value) return '—';
  // Plain YYYY-MM-DD dates are calendar dates, not UTC midnight
  const d = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
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
          setForm(buildForm(res.data.extract));
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

  // Preview of the source document (PDF / image) for side-by-side review
  const [docPreview, setDocPreview] = useState({ url: null, sheets: null, loading: false, error: '' });
  const documentId = extract?.po_document_id || null;
  const attachmentExt = String(extract?.attachment_name || '').split('.').pop().toLowerCase();
  const previewKind = attachmentExt === 'pdf'
    ? 'pdf'
    : ['jpg', 'jpeg', 'png'].includes(attachmentExt)
      ? 'image'
      : ['csv', 'xlsx'].includes(attachmentExt)
        ? 'table'
        : null;

  useEffect(() => {
    if (!documentId || !previewKind) return undefined;
    let objectUrl = null;
    let active = true;
    setDocPreview({ url: null, sheets: null, loading: true, error: '' });
    const request = previewKind === 'table'
      ? documentService.getTablePreview(documentId).then((data) => ({ sheets: data.sheets || [] }))
      : documentService.getPreviewUrl(documentId).then((url) => {
          objectUrl = url;
          return { url };
        });
    request
      .then((result) => {
        if (active) setDocPreview({ url: null, sheets: null, ...result, loading: false, error: '' });
        else if (objectUrl) URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active) setDocPreview({ url: null, sheets: null, loading: false, error: 'Document preview is not available' });
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, previewKind]);

  const handleDownloadDocument = async () => {
    try {
      await documentService.download(documentId, extract?.attachment_name);
    } catch {
      toast.error('Failed to download document');
    }
  };

  const isClosed = extract && (extract.status === 'Confirmed' || extract.status === 'Ignored');

  const handleInputChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLineChange = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      line_items: prev.line_items.map((line, i) => (i === index ? { ...line, [field]: value } : line)),
    }));
  };

  const addLine = () => setForm((prev) => ({ ...prev, line_items: [...prev.line_items, { ...emptyLine }] }));
  const removeLine = (index) =>
    setForm((prev) => ({ ...prev, line_items: prev.line_items.filter((_, i) => i !== index) }));

  const cancelEdit = () => {
    setForm(buildForm(extract));
    setEditMode(false);
  };

  const startEdit = () => {
    // Structured entries with no items yet get one empty row to fill in
    if (Array.isArray(extract?.line_items) && form.line_items.length === 0) addLine();
    setEditMode(true);
  };

  const handleBack = () => {
    navigate('/app/ai-inbox');
  };

  // Ignored entries can be brought back for review
  const handleRestore = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/ai-inbox/${id}`, { status: 'Needs Review' });
      setExtract(data.extract);
      setForm(buildForm(data.extract));
      toast.success('Entry restored to Needs Review');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore entry');
    } finally {
      setSaving(false);
    }
  };

  const handleIgnore = async () => {
    if (!window.confirm('Ignore this detection? It will move to the Ignored tab. You can restore it later.')) return;
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
      const payload = {
        order_type: form.order_type,
        customer_name: form.customer_name,
        po_number: form.po_number,
        approx_value: form.approx_value,
        order_date: form.order_date || null,
        required_delivery_date: form.required_delivery_date || null,
        delivery_location: form.delivery_location,
        currency: form.currency || null,
      };
      // Entries with structured items save the item rows; older entries keep the text field
      if (hasLineItems) payload.line_items = form.line_items;
      else payload.items = form.items;
      const { data } = await api.patch(`/ai-inbox/${id}`, payload);
      setExtract(data.extract);
      setForm(buildForm(data.extract));
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
  const fieldConf = extract?.field_confidence || {};
  // Adds the highlight class to a field box when the AI's confidence for it is low (view mode only)
  const lowClass = (key, override) =>
    !editMode && isLowConfidence(override ?? fieldConf[key]) ? ' low-confidence' : '';
  // Newer entries have structured line items (null for entries created before this)
  const hasLineItems = Array.isArray(extract?.line_items);
  const lines = editMode ? form.line_items || [] : extract?.line_items || [];
  const singleLine = lines.length <= 1;
  const firstLine = lines[0] || null;
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
                          {documentId && (
                            <button type="button" className="thm-btn outline fz-14 p-2 ms-auto" onClick={handleDownloadDocument}>
                              <FiDownload /> Download
                            </button>
                          )}
                        </div>
                        {documentId && previewKind && (
                          <div className="mt-3">
                            {docPreview.loading && <div className="text-secondary fz-14">Loading preview...</div>}
                            {docPreview.error && <div className="text-secondary fz-14">{docPreview.error}</div>}
                            {docPreview.url && previewKind === 'pdf' && (
                              <iframe
                                src={docPreview.url}
                                title="Source document"
                                style={{ width: '100%', height: '400px', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                              />
                            )}
                            {docPreview.url && previewKind === 'image' && (
                              <img
                                src={docPreview.url}
                                alt={extract.attachment_name || 'Source document'}
                                style={{ maxWidth: '100%', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                              />
                            )}
                            {docPreview.sheets && previewKind === 'table' && docPreview.sheets.map((sheet, sIdx) => (
                              <div key={sIdx} className="mb-2">
                                {docPreview.sheets.length > 1 && <div className="fz-14 fw-semibold mb-1">{sheet.name}</div>}
                                {sheet.rows.length === 0 ? (
                                  <div className="text-secondary fz-14">Empty sheet</div>
                                ) : (
                                  <div className="table-responsive" style={{ maxHeight: '480px', overflowY: 'auto' }}>
                                    <table className="member-table">
                                      <tbody>
                                        {sheet.rows.map((row, rIdx) => (
                                          <tr key={rIdx}>
                                            {row.map((cell, cIdx) => <td key={cIdx}>{cell}</td>)}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                                {sheet.truncated && <div className="text-secondary fz-14 mt-1">Showing the first 200 rows. Download the file to see everything.</div>}
                              </div>
                            ))}
                          </div>
                        )}
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
                  {extract.duplicate_warning && extract.status !== 'Confirmed' && (
                    <div className="alert alert-warning fz-14 mb-3">{extract.duplicate_warning}</div>
                  )}
                  <div className="row">
                    <div className="col-md-6">
                      <div className={`custom-frm-bx details-box${lowClass('order_type')}`}>
                        <label>Order Type</label>
                        {editMode ? (
                          <select className="form-control" name="order_type" value={form.order_type} onChange={handleInputChange}>
                            <option value="Purchase">Purchase</option>
                            <option value="Sales">Sales</option>
                          </select>
                        ) : (
                          <h5 className='d-flex align-items-center gap-2'>{extract.order_type || '—'} <FieldConfidence value={fieldConf.order_type} /></h5>
                        )}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="details-box custom-frm-bx">
                        <label>AI Confidence</label>
                        <h5 className="d-flex align-items-center gap-2">
                          {Number.isFinite(Number(extract.confidence)) ? `${Number(extract.confidence)}%` : '—'}
                          <span className={`confidence-tag ${confidenceLevel(extract.confidence)}`}>{confidenceLabel(extract.confidence)}</span>
                        </h5>
                      </div>
                    </div>
                    <div className="col-lg-6">
                      <div className={`details-box custom-frm-bx${lowClass('party_name')}`}>
                        <label>Customer / Supplier</label>
                        {editMode ? (
                          <input type="text" className="form-control" name="customer_name" value={form.customer_name} onChange={handleInputChange} />
                        ) : (
                          <h5 className='d-flex align-items-center gap-2'>{extract.customer_name || '—'} <FieldConfidence value={fieldConf.party_name} /></h5>
                        )}
                      </div>
                    </div>
                    <div className="col-lg-6">
                      <div className={`details-box custom-frm-bx${lowClass('po_number')}`}>
                        <label>PO Number</label>
                        {editMode ? (
                          <input type="text" className="form-control" name="po_number" value={form.po_number} onChange={handleInputChange} />
                        ) : (
                          <h5 className='d-flex align-items-center gap-2'>{extract.po_number || '—'} <FieldConfidence value={fieldConf.po_number} /></h5>
                        )}
                      </div>
                    </div>
                    <div className="col-lg-6">
                      <div className={`details-box custom-frm-bx${lowClass('order_date')}`}>
                        <label>Order Date</label>
                        {editMode ? (
                          <input type="date" className="form-control" name="order_date" value={form.order_date} onChange={handleInputChange} />
                        ) : (
                          <h5 className='d-flex align-items-center gap-2'>{formatDate(extract.order_date || sourceDate)} <FieldConfidence value={fieldConf.order_date} /></h5>
                        )}
                      </div>
                    </div>
                    <div className="col-lg-6">
                      <div className={`details-box custom-frm-bx${lowClass('total_value')}`}>
                        <label>Order Value</label>
                        {editMode ? (
                          <div className="d-flex gap-2">
                            <input type="number" className="form-control" name="approx_value" min="0" value={form.approx_value} onChange={handleInputChange} />
                            {(
                              <select className="form-control w-auto" name="currency" value={form.currency} onChange={handleInputChange}>
                                <option value="">—</option>
                                {currencyOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            )}
                          </div>
                        ) : (
                          <h5 className='d-flex align-items-center gap-2'>{formatMoney(extract.approx_value, extract.currency)} <FieldConfidence value={fieldConf.total_value} /></h5>
                        )}
                      </div>
                    </div>

                    {(!hasLineItems || singleLine) && (
                      <>
                        <div className="col-lg-12">
                          <div className={`details-box custom-frm-bx${hasLineItems ? lowClass('items', firstLine?.confidence) : ''}`}>
                            <label>Product</label>
                            {!hasLineItems ? (
                              editMode ? (
                                <input type="text" className="form-control" name="items" value={form.items} onChange={handleInputChange} />
                              ) : (
                                <h5>{extract.items || '—'}</h5>
                              )
                            ) : editMode ? (
                              <input type="text" className="form-control" value={firstLine?.product ?? ''} onChange={(e) => handleLineChange(0, 'product', e.target.value)} />
                            ) : (
                              <h5 className='d-flex align-items-center gap-2'>{firstLine?.product || '—'} <FieldConfidence value={firstLine?.confidence ?? fieldConf.items} /></h5>
                            )}
                          </div>
                        </div>

                        <div className="col-lg-4 col-md-4 col-sm-12">
                          <div className={`details-box custom-frm-bx${!editMode && firstLine && (firstLine.quantity === null || firstLine.quantity === '') ? ' low-confidence' : ''}`}>
                            <label>Quantity</label>
                            {hasLineItems && editMode ? (
                              <input type="number" className="form-control" min="0" value={firstLine?.quantity ?? ''} onChange={(e) => handleLineChange(0, 'quantity', e.target.value)} />
                            ) : (
                              <h5 className='d-flex align-items-center gap-2'>
                                {formatNumber(firstLine?.quantity)}
                                {firstLine && (firstLine.quantity === null || firstLine.quantity === '') && <span className='confidence-tag low'>Missing</span>}
                              </h5>
                            )}
                          </div>
                        </div>

                        <div className="col-lg-4 col-md-4 col-sm-12">
                          <div className="details-box custom-frm-bx">
                            <label>Unit</label>
                            {hasLineItems && editMode ? (
                              <input type="text" className="form-control" value={firstLine?.unit ?? ''} onChange={(e) => handleLineChange(0, 'unit', e.target.value)} />
                            ) : (
                              <h5>{firstLine?.unit || '—'}</h5>
                            )}
                          </div>
                        </div>

                        <div className="col-lg-4 col-md-4 col-sm-12">
                          <div className="details-box custom-frm-bx">
                            <label>Unit Price</label>
                            {hasLineItems && editMode ? (
                              <input type="number" className="form-control" min="0" value={firstLine?.unit_price ?? ''} onChange={(e) => handleLineChange(0, 'unit_price', e.target.value)} />
                            ) : (
                              <h5>{formatMoney(firstLine?.unit_price, extract.currency)}</h5>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {hasLineItems && !singleLine && (
                      <div className="col-lg-12">
                        <div className={`details-box custom-frm-bx${lowClass('items')}`}>
                          <label className='d-flex align-items-center gap-2'>Items ({lines.length}) <FieldConfidence value={fieldConf.items} /></label>
                          <div className="table-responsive">
                            <table className="member-table">
                              <thead>
                                <tr>
                                  <th>Product</th>
                                  <th>SKU</th>
                                  <th>Qty</th>
                                  <th>Unit</th>
                                  <th>Unit Price</th>
                                  {editMode ? <th></th> : <th>Total</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {lines.map((line, idx) => (
                                  <tr key={idx}>
                                    {editMode ? (
                                      <>
                                        <td><input type="text" className="form-control" value={line.product ?? ''} onChange={(e) => handleLineChange(idx, 'product', e.target.value)} /></td>
                                        <td><input type="text" className="form-control" value={line.sku ?? ''} onChange={(e) => handleLineChange(idx, 'sku', e.target.value)} /></td>
                                        <td><input type="number" className="form-control" min="0" value={line.quantity ?? ''} onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)} /></td>
                                        <td><input type="text" className="form-control" value={line.unit ?? ''} onChange={(e) => handleLineChange(idx, 'unit', e.target.value)} /></td>
                                        <td><input type="number" className="form-control" min="0" value={line.unit_price ?? ''} onChange={(e) => handleLineChange(idx, 'unit_price', e.target.value)} /></td>
                                        <td><button type="button" className="thm-btn outline fz-14 p-2" onClick={() => removeLine(idx)} aria-label="Remove item"><FiX /></button></td>
                                      </>
                                    ) : (
                                      <>
                                        <td>
                                          <span className='d-inline-flex align-items-center gap-2'>
                                            {line.product || '—'}
                                            {isLowConfidence(line.confidence) && <FieldConfidence value={line.confidence} />}
                                          </span>
                                        </td>
                                        <td>{line.sku || '—'}</td>
                                        <td>
                                          {line.quantity === null || line.quantity === undefined
                                            ? <span className='confidence-tag low'>Missing</span>
                                            : formatNumber(line.quantity)}
                                        </td>
                                        <td>{line.unit || '—'}</td>
                                        <td>{formatMoney(line.unit_price, extract.currency)}</td>
                                        <td>{formatMoney(line.total, extract.currency)}</td>
                                      </>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {hasLineItems && editMode && (
                      <div className="col-lg-12 mb-3">
                        <button type="button" className="thm-btn outline fz-14 p-2" onClick={addLine}>+ Add Item</button>
                      </div>
                    )}

                    <div className="col-lg-6 col-md-6 col-sm-12">
                      <div className={`details-box custom-frm-bx${lowClass('delivery_location')}`}>
                        <label>Delivery Location</label>
                        {editMode ? (
                          <input type="text" className="form-control" name="delivery_location" value={form.delivery_location} onChange={handleInputChange} />
                        ) : (
                          <h5 className='d-flex align-items-center gap-2'>{extract.delivery_location || '—'} <FieldConfidence value={fieldConf.delivery_location} /></h5>
                        )}
                      </div>
                    </div>
                    <div className="col-lg-6 col-md-6 col-sm-12">
                      <div className={`details-box custom-frm-bx${lowClass('required_delivery_date')}`}>
                        <label>Required Date</label>
                        {editMode ? (
                          <input type="date" className="form-control" name="required_delivery_date" value={form.required_delivery_date} onChange={handleInputChange} />
                        ) : (
                          <h5 className='d-flex align-items-center gap-2'>{formatDate(extract.required_delivery_date)} <FieldConfidence value={fieldConf.required_delivery_date} /></h5>
                        )}
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
                    <button className="thm-btn outline fz-14" onClick={cancelEdit} disabled={saving}><FiX /> Cancel</button>
                    <button className="thm-btn fz-14" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving...' : <><FiCheck /> Save Changes</>}
                    </button>
                  </>
                ) : (
                  <>
                    {extract.status === 'Ignored' ? (
                      <button className="thm-btn outline fz-14" onClick={handleRestore} disabled={saving || confirming}><FiRotateCcw /> Restore</button>
                    ) : (
                      <button className="thm-btn outline fz-14" onClick={handleIgnore} disabled={saving || confirming || isClosed}><FiX /> Ignore</button>
                    )}
                    <button className="thm-btn outline fz-14" onClick={startEdit} disabled={saving || confirming || isClosed}><FiEdit2 /> Edit</button>
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