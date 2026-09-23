import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiDownload, FiFile, FiShoppingBag, FiTruck, FiCheckCircle, FiBox, FiPlus, FiPrinter } from 'react-icons/fi';
import { printPage } from '../../utils/exportUtils';
import '../../styles/member.css';

export default function OrderDetail() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <>
      <div className="row">
        <div className="col-lg-12">
          <div className="member-page-header">
            <div className="d-flex align-items-center gap-3">
              <button className="back-btn"><FiArrowLeft /> <span className='back-mobile-hide'> Back</span> </button>
              <div>
                <h2 className="mb-1">ABC Industries</h2>
                <p className="mb-0">PO-8192</p>
              </div>
            </div>
            <div className="d-flex align-items-center gap-3">
              <span className="order-value">₹6,20,000</span>
              <span className="status-badge partially-dispatched">Partially Dispatched</span>
              {/* <button className="thm-btn outline fz-14 p-2" onClick={() => printPage('Order Detail - PO-8192')}>
                <FiPrinter /> Print
              </button> */}
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        {[
          { label: 'Ordered', value: '10 MT', icon: <FiShoppingBag />, color: '#2D4735' },
          { label: 'Dispatched', value: '6 MT', icon: <FiTruck />, color: '#1565c0' },
          { label: 'Delivered', value: '6 MT', icon: <FiCheckCircle />, color: '#2e7d32' },
          { label: 'Balance', value: '4 MT', icon: <FiBox />, color: '#e65100' },
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
              {activeTab === 'overview' && (
                <div className="row ">
                  {[
                    { label: 'Order Type', value: 'Sales Order' },
                    { label: 'PO Number', value: 'PO-8192' },
                    { label: 'Order Date', value: '05 Sep 2026' },
                    { label: 'Required Delivery Date', value: '25 Sep 2026' },
                    { label: 'Delivery Address', value: 'Plot 14, MIDC Industrial Area, Pune 411018' },
                    { label: 'Currency', value: 'INR (₹)' },
                  ].map((item, idx) => (
                    <div className="col-md-6 mb-3" key={idx}>
                      <div className='details-box'>
                        <h6 >{item.label}</h6>
                      <h5>{item.value}</h5>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'shipments' && (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="fz-20 mb-0">Shipments</h6>
                    <Link to="/app/orders/1/shipments/add" className="thm-btn p-2 fz-14">
                      <FiPlus /> Add Shipment
                    </Link>
                  </div>
                  {[
                    { id: 'SHP-2201', qty: '3 MT', transporter: 'VRL Logistics', lr: 'LR-44219', status: 'dispatched', date: '10 Sep 2026', color: '#1565c0' },
                    { id: 'SHP-2202', qty: '3 MT', transporter: 'Safexpress', lr: 'LR-55023', status: 'in-transit', date: '12 Sep 2026', color: '#0277bd' },
                  ].map((s, idx) => (
                    <div className="shipment-card" key={idx}>
                      <div className="shipment-header">
                        <div className="d-flex align-items-center gap-3">
                          <div className="kpi-icon" style={{ background: `${s.color}14`, color: s.color }}>
                            <FiTruck />
                          </div>
                         <div>
                           <span className="shipment-id">{s.id}</span>

                           <div className="shipment-meta">
                        <span>Qty: {s.qty}</span>
                        <span>Transporter: {s.transporter}</span>
                        <span>LR: {s.lr}</span>
                        <span>Date: {s.date}</span>
                      </div>
                         </div>

                        </div>
                        <span className={`status-badge ${s.status}`}>{s.status === 'dispatched' ? 'Dispatched' : 'In Transit'}</span>
                      </div>
                     
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'updates' && (
                <div className="timeline">
                  {[
                    { date: '05 Sep 2026, 10:30 AM', text: 'Order Received' },
                    { date: '06 Sep 2026, 09:15 AM', text: 'Order Confirmed' },
                    { date: '08 Sep 2026, 02:00 PM', text: 'Processing Started' },
                    { date: '10 Sep 2026, 11:45 AM', text: 'Shipment Created' },
                    { date: '10 Sep 2026, 05:30 PM', text: 'Partially Dispatched (3 MT)' },
                    { date: '12 Sep 2026, 08:20 AM', text: 'In Transit' },
                  ].map((e, idx) => (
                    <div className="timeline-item" key={idx}>
                      <div className="timeline-date">{e.date}</div>
                      <div className="timeline-text">{e.text}</div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'documents' && (
                <div>
                  {[
                    { name: 'PO Document', type: 'PDF', size: '245 KB' },
                    { name: 'Email Thread', type: 'EML', size: '128 KB' },
                    { name: 'Invoice Draft', type: 'PDF', size: '89 KB' },
                  ].map((doc, idx) => (
                    <div className="document-item" key={idx}>
                      <div className="document-info">
                        <div className="document-icon"><FiFile /></div>
                        <div>
                          <div className="document-name">{doc.name}</div>
                          <div className="document-meta">{doc.type} • {doc.size}</div>
                        </div>
                      </div>
                      <button className="thm-btn outline p-2 fz-14"><FiDownload /> Download</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>




    






    </>
  );
}
