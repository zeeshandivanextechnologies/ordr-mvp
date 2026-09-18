import { useState, useEffect, useRef } from 'react';
import { FiMenu, FiBell, FiSearch, FiUser, FiSettings, FiLogOut, FiChevronDown, FiChevronUp, FiBox, FiTruck, FiMail, FiClock, FiAlertCircle, FiPackage } from 'react-icons/fi';
import { IoIosNotifications } from 'react-icons/io';
import { Link } from 'react-router-dom';

export default function Header({ toggleSidebar }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const notifRef = useRef(null);

  const notifications = [
    { id: 1, icon: <FiMail />, title: 'New order detected from ABC Industries', time: '5 min ago', unread: true, color: '#1565c0' },
    { id: 2, icon: <FiClock />, title: 'Delivery due tomorrow for PO-8192', time: '1 hour ago', unread: true, color: '#e65100' },
    { id: 3, icon: <FiAlertCircle />, title: 'Shipment delayed for PO-8195', time: '3 hours ago', unread: false, color: '#c62828' },
    { id: 4, icon: <FiPackage />, title: 'AI review required for 2 orders', time: '5 hours ago', unread: false, color: '#2D4735' },
    { id: 5, icon: <FiAlertCircle />, title: 'Shipment delayed for PO-8195', time: '3 hours ago', unread: false, color: '#c62828' },
    { id: 6, icon: <FiPackage />, title: 'AI review required for 2 orders', time: '5 hours ago', unread: false, color: '#2D4735' },
  ];

  const unreadCount = notifications.filter(n => n.unread).length;

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
                {notifications.map((notif) => (
                  <div key={notif.id} className={`notification-dropdown-item ${notif.unread ? 'unread' : ''}`}>
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
              RS
            </div>
            <div className="user-info ">
              <h6 className="user-name">Rahul</h6>
              <p className="user-role">Member</p>
            </div>
            {isDropdownOpen ? (
              <FiChevronUp className="text-black " />
            ) : (
              <FiChevronDown className="text-black " />
            )}
          </div>
          
          {isDropdownOpen && (
            <div className="order-dropdown-menu">
              <Link to="/app/settings" className="order-dropdown-item">
                <FiUser /> Profile
              </Link>
              <Link to="/app/settings" className="order-dropdown-item">
                <FiSettings /> Settings
              </Link>
              <hr className="dropdown-divider" />
              <Link to="/login" className="order-dropdown-item text-danger">
                <FiLogOut /> Logout
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
