import { FiMail, FiAlertCircle, FiPackage, FiClock, FiCheckCircle, FiTruck } from 'react-icons/fi';

// Icon and colour per notification type (same palette as the original design)
const TYPE_STYLES = {
  new_order_detected: { icon: FiMail, color: '#1565c0' },
  ai_review_required: { icon: FiPackage, color: '#2D4735' },
  order_update_detected: { icon: FiTruck, color: '#1565c0' },
  delivery_due_soon: { icon: FiClock, color: '#e65100' },
  order_delayed: { icon: FiAlertCircle, color: '#c62828' },
  shipment_delivered: { icon: FiCheckCircle, color: '#2e7d32' },
  partial_balance_pending: { icon: FiTruck, color: '#f57f17' },
};

export const notificationStyle = (type) => {
  const style = TYPE_STYLES[type] || { icon: FiMail, color: '#1565c0' };
  const Icon = style.icon;
  return { icon: <Icon />, color: style.color };
};

// "just now", "5 min ago", "3 hours ago", "2 days ago", then a date
export const timeAgo = (value) => {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (!Number.isFinite(diff)) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Keeps the header bell and the Notifications page in sync
const EVENT = 'ordr:notifications-changed';
export const notifyNotificationsChanged = () => window.dispatchEvent(new Event(EVENT));
export const onNotificationsChanged = (handler) => {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
};
