import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthProvider, { useAuth, ProtectedRoute, OnboardingRoute } from './components/AuthProvider';
import Home from './pages/Landing/Home';
import PrivacyPolicy from './pages/Landing/PrivacyPolicy';
import TermsCondition from './pages/Landing/TermsCondition';
import ContactUs from './pages/Landing/ContactUs';
import RefundPolicy from './pages/Landing/RefundPolicy';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Otp from './pages/auth/Otp';
import AcceptInvite from './pages/team/AcceptInvite';
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
import OrderUpdateReview from './pages/shared/OrderUpdateReview';
import AddShipment from './pages/shared/AddShipment';
import ShipmentDetail from './pages/shared/ShipmentDetail';
import Tracking from './pages/shared/Tracking';
import Integrations from './pages/shared/Integrations';
import Notifications from './pages/shared/Notifications';
import Alerts from './pages/shared/Alerts';
import Reports from './pages/shared/Reports';

// Admin-only pages
import AdminSettings from './pages/admin/Settings';
import Billing from './pages/admin/Billing';
import WebsiteContent from './pages/admin/WebsiteContent';

// Member-only pages
import MemberSettings from './pages/member/Settings';

import NotFound from './components/NotFound';

function AppRoutes() {
  const { user, role, authRedirect } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-and-conditions" element={<TermsCondition />} />
      <Route path="/contact-us" element={<ContactUs />} />
      <Route path="/refund-policy" element={<RefundPolicy />} />

      {/* Auth Routes */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to={authRedirect || '/app/dashboard'} />} />
      <Route path="/signup" element={!user ? <Signup /> : <Navigate to={authRedirect || '/onboarding/company'} />} />
      <Route path="/forgot-password" element={<ForgotPassword />} /> 
      <Route path="/reset-password" element={<ResetPassword />} /> 
      <Route path="/otp" element={<Otp />} /> 
      <Route path="/accept-invite" element={<AcceptInvite />} /> 
      
      {/* Onboarding Routes */}
      <Route path="/onboarding/company" element={<OnboardingRoute><CompanyDetails /></OnboardingRoute>} />
      <Route path="/onboarding/track" element={<OnboardingRoute><TrackSelection /></OnboardingRoute>} />
      <Route path="/onboarding/gmail" element={<OnboardingRoute><ConnectGmail /></OnboardingRoute>} />
      <Route path="/onboarding/team" element={<OnboardingRoute><InviteTeam /></OnboardingRoute>} />
      <Route path="/onboarding/dashboard" element={<OnboardingRoute allowCompleted><GoToDashboard /></OnboardingRoute>} />
      
      {/* Shared routes - Both Admin & Member */}
      <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/add" element={<AddOrder />} />
        <Route path="orders/upload" element={<UploadPO />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="orders/:id/shipments/add" element={<AddShipment />} />
        <Route path="ai-inbox" element={<AIOrderInbox />} />
        <Route path="ai-inbox/:id/review" element={<ReviewOrder />} />
        <Route path="ai-inbox/updates/:id" element={<OrderUpdateReview />} />
        <Route path="shipments/:id" element={<ShipmentDetail />} />
        <Route path="shipments/:shipmentId/edit" element={<AddShipment />} />
        <Route path="tracking" element={<Tracking />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="reports" element={<Reports />} />
        
        {/* Settings - Role-based */}
        <Route path="settings" element={
          role === 'admin' ? <AdminSettings /> : <MemberSettings />
        } />
        
        {/* Website Content (landing page) - Admin only */}
        <Route path="website-content" element={
          role === 'admin' ? <WebsiteContent /> : <Navigate to="/app/dashboard" />
        } />
        {/* Billing - Admin only */}
        <Route path="billing" element={
          role === 'admin' ? <Billing /> : <Navigate to="/app/dashboard" />
        } />
      </Route>
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function AppRouter() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
