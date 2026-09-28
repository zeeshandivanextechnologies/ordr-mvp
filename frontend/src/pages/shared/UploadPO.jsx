import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiUploadCloud, FiFile, FiX } from 'react-icons/fi';
import api from '../../services/api';
import { toast } from 'react-toastify';
import '../../styles/member.css';

const supportedFormats = ['PDF', 'XLSX', 'CSV', 'JPG', 'PNG'];
const MAX_SIZE = 10 * 1024 * 1024;

export default function UploadPO() {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  // Saved document whose AI extraction failed because the AI was busy (can be retried)
  const [pendingDoc, setPendingDoc] = useState(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const handleFile = (selected) => {
    if (selected && selected.length > 0) {
      setFile(selected[0]);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
    setPendingDoc(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }
    const ext = file.name.split('.').pop().toLowerCase();
    const allowedExts = ['pdf', 'xlsx', 'csv', 'jpg', 'jpeg', 'png'];
    if (!allowedExts.includes(ext)) {
      toast.error('Unsupported file type. Allowed: PDF, XLSX, CSV, JPG, PNG');
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error('File too large (max 10MB)');
      return;
    }
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/orders/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      handleResult(data);
    } catch (err) {
      handleError(err, 'Failed to upload PO');
    } finally {
      setLoading(false);
    }
  };

  // Shared by upload and "Try Again"
  const handleResult = (data) => {
    if (data?.extracted) {
      setPendingDoc(null);
      toast.success(
        data.extractCount > 1
          ? `${data.extractCount} orders found in this file. Review them in the AI Order Inbox.`
          : 'PO uploaded successfully. Review it in the AI Order Inbox.'
      );
      if (data.skippedByPlanLimit > 0) {
        toast.warning(`${data.skippedByPlanLimit} more order(s) in this file were not added because your plan's AI extraction limit was reached. Upgrade in Billing to add them.`);
      }
      navigate('/app/ai-inbox');
    } else if (data?.aiBusy) {
      // File is saved; stay here so the user can retry without uploading again
      setPendingDoc(data.document);
      toast.warning('PO saved, but the AI service is busy right now. Click "Try Again" in a minute.');
    } else {
      setPendingDoc(null);
      toast.warning('PO saved, but order details could not be read from this file. Please add the order manually.');
    }
  };

  const handleError = (err, fallback) => {
    const data = err.response?.data;
    if (err.response?.status === 409 && data?.existingExtractId) {
      // Same file uploaded before: open its existing AI Inbox entry
      toast.info(data.message);
      navigate(`/app/ai-inbox/${data.existingExtractId}/review`);
      return;
    }
    toast.error(data?.message || fallback);
  };

  const handleRetry = async () => {
    if (!pendingDoc) return;
    try {
      setLoading(true);
      const { data } = await api.post(`/orders/documents/${pendingDoc.id}/reprocess`);
      handleResult(data);
    } catch (err) {
      handleError(err, 'Failed to process the document');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className='row'>
        <div className='col-lg-12'>
          <div className="member-page-header">
            <div className="d-flex align-items-center gap-3">
              <button className="back-btn" onClick={() => navigate('/app/orders')}><FiArrowLeft /> <span className='back-mobile-hide'>Back</span> </button>
              <div>
                <h2>Upload PO</h2>
                <p>Upload purchase order documents for AI extraction</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='row'>
        <div className='col-lg-12'>
          <div className="member-card">
            <div className="member-card-body">
              {!file ? (
                <div
                  className={`upload-area ${dragActive ? 'drag-active' : ''}`}
                  onClick={() => inputRef.current.click()}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    className="d-none"
                    accept=".pdf,.xlsx,.csv,.jpg,.jpeg,.png"
                    onChange={handleChange}
                  />
                  <div className="upload-icon">
                    <FiUploadCloud />
                  </div>
                  <h5>Drag & drop your file here or click to browse</h5>
                  <p>Upload your purchase order document and let AI extract the details</p>
                  <div className="upload-formats">
                    {supportedFormats.map((format) => (
                      <span key={format} className="format-tag">{format}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="uploaded-file">
                  <div className="uploaded-file-info">
                    <div className="uploaded-file-icon">
                      <FiFile />
                    </div>
                    <div className="uploaded-file-details">
                      <span className="uploaded-file-name">{file.name}</span>
                      <span className="uploaded-file-size">{formatSize(file.size)}</span>
                    </div>
                  </div>
                  <button className="uploaded-file-remove" onClick={removeFile}>
                    <FiX />
                  </button>
                </div>
              )}

              <div className="mt-3 text-center support-format-box">
                <p className="text-secondary mb-0">
                  Supported formats: PDF, Excel (XLSX), CSV, JPG, PNG — Max file size: 10MB
                </p>
              </div>

              <div className="text-end mt-3">
                {pendingDoc ? (
                  <button className="thm-btn" onClick={handleRetry} disabled={loading}>
                    {loading ? 'Processing...' : 'Try Again'}
                  </button>
                ) : (
                  <button className="thm-btn" onClick={handleUpload} disabled={loading}>
                    {loading ? 'Uploading...' : 'Upload Document'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
