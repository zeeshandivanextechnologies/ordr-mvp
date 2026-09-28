import { useState, useEffect, useRef, useCallback } from 'react';
import { FiMenu, FiBell, FiSearch, FiUser, FiSettings, FiLogOut, FiChevronDown, FiChevronUp, FiBox, FiTruck } from 'react-icons/fi';
import { IoIosNotifications } from 'react-icons/io';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import notificationService from '../../services/notificationService';
import {
  notificationStyle,
  timeAgo,
  notifyNotificationsChanged,
  onNotificationsChanged,
} from '../../utils/notificationDisplay';

const NOTIFICATION_POLL_MS = 60 * 1000;

export default function Header({ toggleSidebar }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Helper to get initials
  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // Latest notifications for the bell (Module 24)
  const [inbox, setInbox] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { pathname } = useLocation();

  const loadNotifications = useCallback(() => {
    notificationService
      .getInbox(6)
      .then((data) => {
        setInbox(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      })
      .catch(() => {});
  }, []);

  // Refresh on page change, every minute, and when notifications are read elsewhere
  useEffect(() => {
    loadNotifications();
  }, [pathname, loadNotifications]);
  useEffect(() => {
    const timer = setInterval(loadNotifications, NOTIFICATION_POLL_MS);
    return () => clearInterval(timer);
  }, [loadNotifications]);
  useEffect(() => onNotificationsChanged(loadNotifications), [loadNotifications]);

  const notifications = inbox.map((n) => {
    const style = notificationStyle(n.type);
    return {
      id: n.id,
      icon: style.icon,
      title: n.title + (n.message ? ` - ${n.message}` : ''),
      time: timeAgo(n.created_at),
      unread: !n.read_at,
      color: style.color,
      link: n.link,
    };
  });

  const openNotification = (notif) => {
    setShowNotifications(false);
    if (notif.unread) {
      setInbox((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n)));
      setUnreadCount((c) => Math.max(c - 1, 0));
      notificationService
        .markRead(notif.id)
        .then(() => notifyNotificationsChanged())
        .catch(() => {});
    }
    if (notif.link) navigate(notif.link);
  };

  const allItems = [
    { type: 'order', name: 'ABC Industries', po: 'PO-8192', value: '₹6,20,000', status: 'processing', link: '/app/orders/1' },
    { type: 'order', name: 'XYZ Chemicals', po: 'PO-8193', value: '₹1,45,000', status: 'in-transit', link: '/app/orders/2' },
    { type: 'order', name: 'Global Pharma Ltd', po: 'PO-8194', value: '₹3,80,000', status: 'ready-dispatch', link: '/app/orders/3' },
    { type: 'order', name: 'MediCorp Solutions', po: 'PO-8195', value: '₹92,000', status: 'delayed', link: '/app/orders/4' },
    { type: 'order', name: 'TechParts India', po: 'PO-8196', value: '₹2,15,000', status: 'delivered', link: '/app/orders/5' },
    { type: 'shipment', name: 'SHP-2026-4821', po: 'PO-8192', lr: 'LR-928721', route: 'Mumbai → Delhi', status: 'in-transit', link: '/app/shipments/1' },
    { type: 'shipment', name: 'SHP-2026-4822', po: 'PO-8193', lr: 'AWB-786543', route: 'Chennai → Pune', status: 'delivered', link: '/app/shipments/2' },
    { type: 'shipment', name: 'SHP-2026-4823', po: 'PO-8195', lr: 'LR-112233', route: 'Delhi → Kolkata', status: 'delayed', link: '/app/shipments/3' },
  ];

  const filteredResults = searchQuery.length > 0
    ? allItems.filter((item) => {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.po.toLowerCase().includes(q) ||
          (item.lr && item.lr.toLowerCase().includes(q)) ||
          (item.route && item.route.toLowerCase().includes(q))
        );
      })
    : [];

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchFocus = () => {
    if (searchQuery.length > 0) {
      setShowSearchResults(true);
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setShowSearchResults(e.target.value.length > 0);
  };

  return (
    <div className="top-header">
      <div className="header-left">
        <FiMenu className="menu-toggle-btn" onClick={toggleSidebar} />
        <div className="header-search-container" ref={searchRef}>
          <FiSearch className="header-search-icon" />
          <input 
            type="text" 
            placeholder="Search orders, PO, shipments..." 
            className="header-search-input"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={handleSearchFocus}
          />
          {showSearchResults && (
            <div className="search-results-dropdown">
              {filteredResults.length === 0 ? (
                <div className="search-results-empty">
                  <p>No results found for "{searchQuery}"</p>
                </div>
              ) : (
                <>
                  <div className="search-results-header">
                    <span>{filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} found</span>
                  </div>
                  {filteredResults.map((item, idx) => (
                    <Link
                      key={idx}
                      to={item.link}
                      className="search-result-item"
                      onClick={() => { setSearchQuery(''); setShowSearchResults(false); }}
                    >
                      <div className={`search-result-icon ${item.type}`}>
                        {item.type === 'order' ? <FiBox /> : <FiTruck />}
                      </div>
                      <div className="search-result-info">
                        <span className="search-result-name">{item.name}</span>
                        <span className="search-result-meta">
                          {item.po}
                          {item.lr && ` • ${item.lr}`}
                          {item.route && ` • ${item.route}`}
                        </span>
                      </div>
                      <div className="search-result-right">
                        {item.value && <span className="search-result-value">{item.value}</span>}
                        <span className={`status-badge ${item.status}`} style={{ fontSize: 11, padding: '2px 8px' }}>
                          {item.status.replace('-', ' ')}
                        </span>
                      </div>
                    </Link>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="header-right">      
        <div className="notification-wrapper" ref={notifRef}>
          <IoIosNotifications className="notification-icons" onClick={() => setShowNotifications(!showNotifications)}/>

          {/* <FiBell className="notification-icons" onClick={() => setShowNotifications(!showNotifications)} /> */}
          {unreadCount > 0 && <span className="notification-badge pulse"></span>}
          {showNotifications && (
            <div className="notification-dropdown">
              <div className="notification-dropdown-header">
                <h6>Notifications</h6>
                {unreadCount > 0 && <span className="notif-unread-count">{unreadCount} new</span>}
              </div>
              <div className="notification-dropdown-list">
                {notifications.length === 0 && (
                  <div className="notification-dropdown-item">
                    <div className="notif-content text-center">
                      <p className="notif-title">No notifications yet</p>
                    </div>
                  </div>
                )}
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`notification-dropdown-item ${notif.unread ? 'unread' : ''}`}
                    onClick={() => openNotification(notif)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="notif-icon" style={{ background: `${notif.color}14`, color: notif.color }}>
                      {notif.icon}
                    </div>
                    <div className="notif-content">
                      <p className="notif-title">{notif.title}</p>
                      <span className="notif-time">{notif.time}</span>
                    </div>
                    {notif.unread && <span className="notif-dot"></span>}
                  </div>
                ))}
              </div>
            <div className='notification-dropdown-footer'>
                <Link to="/app/notifications" className="thm-btn w-100" onClick={() => setShowNotifications(false)}>
                View All Notifications
              </Link>
            </div>
            </div>
          )}
        </div>
        
        <div className="dropdown" ref={dropdownRef}>
          <div 
            className="user-profile dropdown-toggle" 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <div className="user-avatar">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                getInitials(user?.full_name)
              )}
            </div>
            <div className="user-info ">
              <h6 className="user-name">{user?.full_name?.split(' ')[0] || 'User'}</h6>
              <p className="user-role text-capitalize">{user?.role || 'Member'}</p>
            </div>
            {isDropdownOpen ? (
              <FiChevronUp className="text-black " />
            ) : (
              <FiChevronDown className="text-black " />
            )}
          </div>
          
          {isDropdownOpen && (
            <div className="order-dropdown-menu">
              <Link to="/app/settings" className="order-dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                <FiUser /> Profile
              </Link>
              <Link to="/app/settings" className="order-dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                <FiSettings /> Settings
              </Link>
              <hr className="dropdown-divider" />
              <button
                onClick={async () => {
                  setIsDropdownOpen(false);
                  await logout();
                  navigate('/login');
                }}
                className="order-dropdown-item text-danger border-0 bg-transparent w-100 text-start"
              >
                <FiLogOut /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
