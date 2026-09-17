import { FiBell, FiMail, FiAlertCircle, FiPackage, FiClock, FiCheckCircle, FiTruck } from 'react-icons/fi';
import '../../styles/member.css';

export default function Notifications() {
  const notifications = [
    {
      id: 1,
      icon: <FiMail />,
      title: 'New order detected from ABC Industries',
      description: 'AI has identified a new purchase order from your Gmail inbox. Review and confirm.',
      time: '5 minutes ago',
      unread: true,
      color: '#1565c0',
    },
    {
      id: 2,
      icon: <FiClock />,
      title: 'Delivery due tomorrow for PO-8192',
      description: 'Shipment SHP-2026-4821 is scheduled for delivery tomorrow. Ensure all documents are ready.',
      time: '1 hour ago',
      unread: true,
      color: '#e65100',
    },
    {
      id: 3,
      icon: <FiAlertCircle />,
      title: 'Shipment delayed for PO-8195',
      description: 'Shipment SHP-2026-4823 has been delayed. New ETA: 22 Sep 2026. Customer has been notified.',
      time: '3 hours ago',
      unread: false,
      color: '#c62828',
    },
    {
      id: 4,
      icon: <FiPackage />,
      title: 'AI review required for 2 orders',
      description: '2 orders require your review before processing. AI suggestions are ready for your approval.',
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
