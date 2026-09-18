import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, createContext, useContext } from 'react';
import Home from './pages/Home';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Otp from './pages/auth/Otp';
import CompanyDetails from './pages/onboarding/CompanyDetails';
import TrackSelection from './pages/onboarding/TrackSelection';
import ConnectGmail from './pages/onboarding/ConnectGmail';
import InviteTeam from './pages/onboarding/InviteTeam';
import GoToDashboard from './pages/onboarding/GoToDashboard';
import AppLayout from './components/layout/AppLayout';

// Shared pages (Admin + Member)
import Dashboard from './pages/shared/Dashboard';
import Orders from './pages/shared/Orders';
import AIOrderInbox from './pages/shared/AIOrderInbox';
import OrderDetail from './pages/shared/OrderDetail';
import AddOrder from './pages/shared/AddOrder';
import UploadPO from './pages/shared/UploadPO';
import ReviewOrder from './pages/shared/ReviewOrder';
import AddShipment from './pages/shared/AddShipment';
import ShipmentDetail from './pages/shared/ShipmentDetail';
import Tracking from './pages/shared/Tracking';
import Integrations from './pages/shared/Integrations';
import Notifications from './pages/shared/Notifications';
import Alerts from './pages/shared/Alerts';

// Admin-only pages
import AdminSettings from './pages/admin/Settings';
import Billing from './pages/admin/Billing';

// Member-only pages
import MemberSettings from './pages/member/Settings';

import NotFound from './components/NotFound';
import PageLoader from './components/PageLoader';

export const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export default function AppRouter() {
  const [role, setRole] = useState('admin');

  const login = (userRole) => {
    setRole(userRole);
  };

  const logout = () => {
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ role, login, logout }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} /> 
          <Route path="/reset-password" element={<ResetPassword />} /> 
          <Route path="/otp" element={<Otp />} /> 
          <Route path="/loader" element={<PageLoader />} /> 
          
          {/* Onboarding Routes */}
          <Route path="/onboarding/company" element={<CompanyDetails />} />
          <Route path="/onboarding/track" element={<TrackSelection />} />
          <Route path="/onboarding/gmail" element={<ConnectGmail />} />
          <Route path="/onboarding/team" element={<InviteTeam />} />
          <Route path="/onboarding/dashboard" element={<GoToDashboard />} />
          
           {/* Shared routes - Both Admin & Member */}
          <Route path="/app" element={<AppLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/add" element={<AddOrder />} />
            <Route path="orders/upload" element={<UploadPO />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="orders/:id/shipments/add" element={<AddShipment />} />
            <Route path="ai-inbox" element={<AIOrderInbox />} />
            <Route path="ai-inbox/:id/review" element={<ReviewOrder />} />
            <Route path="shipments/:id" element={<ShipmentDetail />} />
            <Route path="tracking" element={<Tracking />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="alerts" element={<Alerts />} />
            
            {/* Settings - Role-based */}
            <Route path="settings" element={
              role === 'admin' ? <AdminSettings /> : <MemberSettings />
            } />
            
            {/* Billing - Admin only */}
            <Route path="billing" element={
              role === 'admin' ? <Billing /> : <Navigate to="/app/dashboard" />
            } />
          </Route>
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
