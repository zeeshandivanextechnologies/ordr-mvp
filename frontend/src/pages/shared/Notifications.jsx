import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import notificationService from '../../services/notificationService';
import {
  notificationStyle,
  timeAgo,
  notifyNotificationsChanged,
  onNotificationsChanged,
} from '../../utils/notificationDisplay';
import '../../styles/member.css';

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const data = await notificationService.getInbox(100);
      setItems(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Stay in sync when notifications are read from the header bell
  useEffect(() => onNotificationsChanged(load), [load]);

  const notifications = items.map((n) => {
    const style = notificationStyle(n.type);
    return {
      id: n.id,
      icon: style.icon,
      color: style.color,
      title: n.title,
      description: n.message,
      time: timeAgo(n.created_at),
      unread: !n.read_at,
      link: n.link,
    };
  });

  const handleOpen = async (notification) => {
    if (notification.unread) {
      setItems((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n)));
      setUnreadCount((c) => Math.max(c - 1, 0));
      notificationService
        .markRead(notification.id)
        .then(() => notifyNotificationsChanged())
        .catch(() => {});
    }
    if (notification.link) navigate(notification.link);
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await notificationService.markAllRead();
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || now })));
      setUnreadCount(0);
      notifyNotificationsChanged();
    } catch {
      toast.error('Failed to mark notifications as read');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <>
      <div className="row">
        <div className="col-lg-12">
          <div className="member-page-header">
            <div>
              <h2>Notifications</h2>
              <p>Stay updated with your orders and shipments</p>
            </div>
            <button className="thm-btn outline" onClick={handleMarkAllRead} disabled={markingAll || unreadCount === 0}>
              {markingAll ? 'Marking...' : 'Mark All Read'}
            </button>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-12 mb-3">
          <div className="member-card">
            <div className="member-card-body">
              <div className="notifications-list">
                {loading && 
                
                <div className="d-flex justify-content-center align-items-center" style={{height : "200px"}}  role="status">
      <div className="spinner-border" style={{ width: '2.5rem', height: '2.5rem', color: 'var(--primary-color)' }}>
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
                }
                {!loading && notifications.length === 0 && (
                  <div className="text-center py-4 text-black">You have no notifications yet</div>
                )}
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${notification.unread ? 'unread' : ''}`}
                    onClick={() => handleOpen(notification)}
                    style={notification.link ? { cursor: 'pointer' } : undefined}
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
