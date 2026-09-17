import { useState, useEffect, useRef } from 'react';
import { FiMenu, FiBell, FiSearch, FiUser, FiSettings, FiLogOut, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { Link } from 'react-router-dom';

export default function Header({ toggleSidebar }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="top-header">
      <div className="header-left">
        <FiMenu className="menu-toggle-btn" onClick={toggleSidebar} />
        <div className="header-search-container">
          <FiSearch className="header-search-icon" />
          <input 
            type="text" 
            placeholder="Search orders, PO, shipments..." 
            className="header-search-input"
          />
        </div>
      </div>
      
      <div className="header-right">      
        <div className="notification-wrapper">
          <FiBell className="notification-icons" />
          <span className="notification-badge pulse"></span>
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
              <Link to="/member/settings" className="order-dropdown-item">
                <FiUser /> Profile
              </Link>
              <Link to="/member/settings" className="order-dropdown-item">
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
