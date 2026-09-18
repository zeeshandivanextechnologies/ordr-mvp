import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import TrialBanner from './TrialBanner';
import '../../styles/layout.css';

export default function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 992);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 992) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="app-layout-wrapper">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      
      <div className="main-content-wrapper">
        <Header toggleSidebar={toggleSidebar} />
        <TrialBanner />
        
        <div className="page-content">
          <div className="container-fluid p-0">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
