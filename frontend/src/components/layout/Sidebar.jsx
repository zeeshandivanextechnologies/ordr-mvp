import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiHome, FiBox, FiTruck, FiMail, FiLink, FiBell, FiAlertTriangle, FiCreditCard, FiX, FiSettings } from 'react-icons/fi';
import { useAuth } from '../../Router';
import '../../styles/member.css';
import { MdLogout } from 'react-icons/md';

export default function Sidebar({ isOpen, toggleSidebar }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const navLinks = [
    { path: '/app/dashboard', label: 'Dashboard', icon: <FiHome /> },
    { path: '/app/ai-inbox', label: 'AI Order Inbox', icon: <FiMail /> },
    { path: '/app/orders', label: 'Orders', icon: <FiBox /> },
    { path: '/app/tracking', label: 'Tracking', icon: <FiTruck /> },
    { path: '/app/integrations', label: 'Integrations', icon: <FiLink /> },
    { path: '/app/notifications', label: 'Notifications', icon: <FiBell /> },
    { path: '/app/alerts', label: 'Alerts', icon: <FiAlertTriangle /> },
    { path: '/app/settings', label: 'Settings', icon: <FiSettings /> },
  ];

  const adminLinks = [
    { path: '/app/billing', label: 'Billing', icon: <FiCreditCard /> },
  ];

  const handleLogoutClick = (e) => {
    e.preventDefault();
    setShowLogoutModal(true);
  };

  const handleLogout = () => {
    setShowLogoutModal(false);
    navigate('/login');
  };

  const allLinks = role === 'admin' ? [...navLinks, ...adminLinks] : navLinks;

  return (
    <>
      {isOpen && (
        <div
          className="d-lg-none position-fixed top-0 start-0 w-100 h-100 bg-dark"
          style={{ opacity: 0.5, zIndex: 999 }}
          onClick={toggleSidebar}
        ></div>
      )}

      <div className={`sidebar ${isOpen ? 'show' : 'closed'}`}>
        <div className="sidebar-header d-flex justify-content-between align-items-center w-100">
          <Link to="/app/dashboard" className="sidebar-brand">ORDR</Link>
          <FiX className="d-lg-none fs-4 text-secondary" style={{ cursor: 'pointer' }} onClick={toggleSidebar} />
        </div>

        <div className="sidebar-menu">
          {allLinks.map((link, index) => (
            <Link
              key={index}
              to={link.path}
              className={`sidebar-link text-decoration-none ${location.pathname.startsWith(link.path) ? 'active' : ''}`}
              onClick={() => { if (window.innerWidth < 992) toggleSidebar(); }}
            >
              <span className="sidebar-link-icon">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          ))}
          <a
            href="#"
            className="sidebar-link text-decoration-none"
            onClick={handleLogoutClick}
          >
            <span className="sidebar-link-icon"><MdLogout /></span>
            <span>Logout</span>
          </a>
        </div>
      </div>

      {showLogoutModal && (
        <div className="modal-backdrop fade show" onClick={() => setShowLogoutModal(false)}></div>
      )}
      <div className={`modal fade ${showLogoutModal ? 'show d-block' : ''}`} tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content logout-modal">
            <div className="modal-body text-center  py-4">
              <div className="logout-modal-icon mx-auto mb-3">
                <MdLogout />
              </div>
              <h5 className="modal-title mb-2">Confirm Logout</h5>
              <p className="text-muted mb-0">Are you sure you want to logout from ORDR?</p>

              <div className="d-flex gap-2 justify-content-center mt-4">
              <button type="button" className="thm-btn outline" onClick={() => setShowLogoutModal(false)}>Cancel</button>
              <button type="button" className="thm-btn" onClick={handleLogout}>Logout</button>
            </div>

            </div>
            
          </div>
        </div>
      </div>
    </>
  );
}
