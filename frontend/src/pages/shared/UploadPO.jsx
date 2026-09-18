import { useState, useRef } from 'react';
import { FiArrowLeft, FiUploadCloud, FiFile, FiX } from 'react-icons/fi';
import '../../styles/member.css';

const supportedFormats = ['PDF', 'XLSX', 'CSV', 'JPG', 'PNG'];

export default function UploadPO() {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

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
    if (inputRef.current) inputRef.current.value = '';
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <>
      <div className='row'>
        <div className='col-lg-12'>
          <div className="member-page-header">
            <div className="d-flex align-items-center gap-3">
              <button className="back-btn"><FiArrowLeft /> Back</button>
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
