import { FiBell, FiMail, FiAlertCircle, FiPackage, FiClock, FiCheckCircle, FiTruck } from 'react-icons/fi';
import '../../styles/member.css';

export default function Notifications() {
const notifications = [
  {
    id: 1,
    icon: <FiMail />,
    title: 'New Order Detected',
    description: 'New purchase order detected. Review and confirm.',
    time: '5 minutes ago',
    unread: true,
    color: '#1565c0',
  },
  {
    id: 2,
    icon: <FiClock />,
    title: 'Delivery Due Tomorrow',
    description: 'Shipment SHP-2026-4821 is due tomorrow.',
    time: '1 hour ago',
    unread: true,
    color: '#e65100',
  },
  {
    id: 3,
    icon: <FiAlertCircle />,
    title: 'Shipment Delayed',
    description: 'Shipment SHP-2026-4823 has been delayed.',
    time: '3 hours ago',
    unread: false,
    color: '#c62828',
  },
  {
    id: 4,
    icon: <FiPackage />,
    title: 'AI Review Required',
    description: '2 orders are waiting for your review.',
    time: '5 hours ago',
    unread: false,
    color: '#2D4735',
  },
];

  return (
    <>
      <div className="row">
        <div className="col-lg-12">
          <div className="member-page-header">
            <div>
              <h2>Notifications</h2>
              <p>Stay updated with your orders and shipments</p>
            </div>
            <button className="thm-btn outline">Mark All Read</button>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-12 mb-3">
          <div className="member-card">
            <div className="member-card-body">
              <div className="notifications-list">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${notification.unread ? 'unread' : ''}`}
                  >
                    <div className="d-flex align-items-start gap-3">
                      <div className="kpi-icon" style={{ background: `${notification.color}14`, color: notification.color }}>
                        {notification.icon}
                      </div>
                      <div className="flex-grow-1 notification-member-box">
                        <h6 className="">{notification.title}</h6>
                        <h5 className="">{notification.description}</h5>
                        <p className="">{notification.time}</p>
                      </div>
                      {notification.unread && (
                        <span className="notification-dot"></span>
                      )}
                    </div>
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
