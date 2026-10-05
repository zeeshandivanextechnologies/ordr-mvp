import { useState, useEffect, useRef, useCallback } from 'react';
import { FiMenu, FiBell, FiSearch, FiUser, FiSettings, FiLogOut, FiChevronDown, FiChevronUp, FiBox, FiTruck, FiX } from 'react-icons/fi';
import { IoIosNotifications } from 'react-icons/io';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import notificationService from '../../services/notificationService';
import api from '../../services/api';
import {
  notificationStyle,
  timeAgo,
  notifyNotificationsChanged,
  onNotificationsChanged,
} from '../../utils/notificationDisplay';

const NOTIFICATION_POLL_MS = 60 * 1000;
// Module 25: header search waits until typing pauses, and needs at least 2 characters
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_CHARS = 2;
const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SAR: 'SAR ' };

const formatValue = (value, currency) => {
  const v = Number(value);
  if (value === null || value === undefined || !Number.isFinite(v) || v <= 0) return null;
  const symbol = currency ? (CURRENCY_SYMBOLS[currency] ?? `${currency} `) : '₹';
  return `${symbol}${v.toLocaleString('en-IN')}`;
};

export default function Header({ toggleSidebar }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const notifRef = useRef(null);
  // Phones: the search box is hidden in the header and opens as a full-width bar from the search icon
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
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

  // Search results from the backend: orders and shipments of this company
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < SEARCH_MIN_CHARS) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      api
        .get('/search', { params: { q } })
        .then((res) => {
          if (!active) return;
          const orders = (res.data.orders || []).map((o) => ({
            type: 'order',
            key: `order-${o.id}`,
            name: o.party_name || '—',
            po: o.po_number || '—',
            lr: o.material || null,
            value: formatValue(o.total_value, o.currency),
            status: o.status || 'received',
            link: `/app/orders/${o.id}`,
          }));
          const shipments = (res.data.shipments || []).map((sh) => {
            const tracking = sh.lr_number ? `LR ${sh.lr_number}` : sh.awb_number ? `AWB ${sh.awb_number}` : sh.gr_number ? `GR ${sh.gr_number}` : null;
            return {
              type: 'shipment',
              key: `shipment-${sh.id}`,
              name: sh.shipment_number || 'Shipment',
              po: sh.po_number || '—',
              material: sh.material || null,
              lr: tracking,
              route: sh.origin || sh.destination ? `${sh.origin || '—'} → ${sh.destination || '—'}` : null,
              status: sh.status || 'dispatched',
              link: `/app/shipments/${sh.id}`,
            };
          });
          setSearchResults([...orders, ...shipments]);
        })
        .catch(() => {
          if (active) setSearchResults([]);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const filteredResults = searchResults;

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
        setMobileSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Mobile search bar: focus it when opened, close it on page change
  useEffect(() => {
    if (mobileSearchOpen) searchInputRef.current?.focus();
  }, [mobileSearchOpen]);
  useEffect(() => {
    setMobileSearchOpen(false);
  }, [pathname]);

  const closeMobileSearch = () => {
    setMobileSearchOpen(false);
    setShowSearchResults(false);
    setSearchQuery('');
  };

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
        <div className={`header-search-container${mobileSearchOpen ? ' mobile-open' : ''}`} ref={searchRef}>
          <FiSearch className="header-search-icon" />
          <input 
            ref={searchInputRef}
            type="text" 
            placeholder="Search orders, PO, shipments..." 
            className="header-search-input"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={handleSearchFocus}
          />
          {mobileSearchOpen && (
            <FiX className="mobile-search-close" onClick={closeMobileSearch} aria-label="Close search" />
          )}
          {showSearchResults && (
            <div className="search-results-dropdown">
              {searchQuery.trim().length < SEARCH_MIN_CHARS ? (
                <div className="search-results-empty">
                  <p>Type at least {SEARCH_MIN_CHARS} characters to search</p>
                </div>
              ) : searching ? (
                <div className="search-results-empty">
                  <p>Searching...</p>
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="search-results-empty">
                  <p>No results found for "{searchQuery}"</p>
                </div>
              ) : (
                <>
                  <div className="search-results-header">
                    <span>{filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} found</span>
                  </div>
                  {filteredResults.map((item) => (
                    <Link
                      key={item.key}
                      to={item.link}
                      className="search-result-item"
                      onClick={() => { setSearchQuery(''); setShowSearchResults(false); setMobileSearchOpen(false); }}
                    >
                      <div className={`search-result-icon ${item.type}`}>
                        {item.type === 'order' ? <FiBox /> : <FiTruck />}
                      </div>
                      <div className="search-result-info">
                        <span className="search-result-name">{item.name}</span>
                        <span className="search-result-meta">
                          {item.type === 'order' ? 'Order' : 'Shipment'} • {item.po}
                          {item.material && ` • ${item.material}`}
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
        {/* Phones only (hidden on larger screens by CSS) */}
        <FiSearch
          className="mobile-search-toggle"
          onClick={() => setMobileSearchOpen(true)}
          aria-label="Search"
        />
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
