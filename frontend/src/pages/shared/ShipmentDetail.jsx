import { useState } from 'react';
import { FiArrowLeft, FiTruck, FiCheckCircle, FiAlertCircle, FiClock, FiPackage } from 'react-icons/fi';
import '../../styles/member.css';

export default function ShipmentDetail() {
  const [currentStatus, setCurrentStatus] = useState('in-transit');

  const shipment = {
    shipmentNumber: 'SHP-2026-4821',
    orderPO: 'PO-8192',
    quantity: '240 units',
    transporter: 'BlueDart Express',
    lrAwbNumber: 'LR-2234',
    vehicleNumber: 'MH-12-AB-1234',
    origin: 'Mumbai, Maharashtra',
    destination: 'Delhi, NCR',
    dispatchDate: '14 Sep 2026',
    expectedDeliveryDate: '18 Sep 2026',
  };

  const timeline = [
    { date: '12 Sep 2026, 09:00 AM', text: 'Order Placed' },
    { date: '13 Sep 2026, 02:30 PM', text: 'Ready for Dispatch' },
    { date: '14 Sep 2026, 08:15 AM', text: 'Dispatched' },
    { date: '15 Sep 2026, 11:45 AM', text: 'In Transit' },
    { date: '18 Sep 2026 (Expected)', text: 'Out for Delivery' },
  ];

  const statusLabels = {
    'in-transit': 'In Transit',
    dispatched: 'Dispatched',
    delivered: 'Delivered',
    delayed: 'Delayed',
    cancelled: 'Cancelled',
  };

  return (
    <>
      <div className="row">
        <div className="col-lg-12">
          <div className="member-page-header">
            <div className="d-flex align-items-center gap-3">
              <button className="back-btn"><FiArrowLeft /> <span className='back-mobile-hide'> Back</span> </button>
              <div>
                <h2 className="mb-1">{shipment.shipmentNumber}</h2>
                <p className="mb-0">PO: {shipment.orderPO}</p>
              </div>
            </div>
            <div className="d-flex align-items-center gap-3">
              <span className={`status-badge ${currentStatus}`}>
                {statusLabels[currentStatus]}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        {[
          { label: 'Quantity', value: shipment.quantity, icon: <FiPackage />, color: '#2D4735' },
          { label: 'Transporter', value: shipment.transporter, icon: <FiTruck />, color: '#1565c0' },
          { label: 'Dispatch Date', value: shipment.dispatchDate, icon: <FiClock />, color: '#e65100' },
          { label: 'Expected Delivery', value: shipment.expectedDeliveryDate, icon: <FiCheckCircle />, color: '#2e7d32' },
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
                  { label: 'Shipment Number', value: shipment.shipmentNumber },
                  { label: 'Order PO', value: shipment.orderPO },
                  { label: 'Quantity', value: shipment.quantity },
                  { label: 'Transporter', value: shipment.transporter },
                  { label: 'LR / AWB / GR Number', value: shipment.lrAwbNumber },
                  { label: 'Vehicle Number', value: shipment.vehicleNumber },
                  { label: 'Origin', value: shipment.origin },
                  { label: 'Destination', value: shipment.destination },
                  { label: 'Dispatch Date', value: shipment.dispatchDate },
                  { label: 'Expected Delivery Date', value: shipment.expectedDeliveryDate },
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
                <button className={`status-action-btn ready ${currentStatus === 'ready' ? 'active' : ''}`} onClick={() => setCurrentStatus('ready')}>
                  <FiCheckCircle /> Mark Ready {currentStatus === 'ready' && <span className="status-action-badge">Active</span>}
                </button>
                <button className={`status-action-btn dispatched ${currentStatus === 'dispatched' ? 'active' : ''}`} onClick={() => setCurrentStatus('dispatched')}>
                  <FiTruck /> Mark Dispatched {currentStatus === 'dispatched' && <span className="status-action-badge">Active</span>}
                </button>
                <button className={`status-action-btn in-transit ${currentStatus === 'in-transit' ? 'active' : ''}`} onClick={() => setCurrentStatus('in-transit')}>
                  <FiClock /> Mark In Transit {currentStatus === 'in-transit' && <span className="status-action-badge">Active</span>}
                </button>
                <button className={`status-action-btn delivered ${currentStatus === 'delivered' ? 'active' : ''}`} onClick={() => setCurrentStatus('delivered')}>
                  <FiCheckCircle /> Mark Delivered {currentStatus === 'delivered' && <span className="status-action-badge">Active</span>}
                </button>
                <button className={`status-action-btn delayed ${currentStatus === 'delayed' ? 'active' : ''}`} onClick={() => setCurrentStatus('delayed')}>
                  <FiAlertCircle /> Mark Delayed {currentStatus === 'delayed' && <span className="status-action-badge">Active</span>}
                </button>
                <button className={`status-action-btn cancelled ${currentStatus === 'cancelled' ? 'active' : ''}`} onClick={() => setCurrentStatus('cancelled')}>
                  <FiAlertCircle /> Cancel {currentStatus === 'cancelled' && <span className="status-action-badge">Active</span>}
                </button>
              </div>
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
                {timeline.map((item, idx) => (
                  <div className="timeline-item" key={idx}>
                    <div className="timeline-date">{item.date}</div>
                    <div className="timeline-text">{item.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
