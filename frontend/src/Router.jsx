import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import Dashboard from './pages/member/Dashboard';
import Orders from './pages/member/Orders';
import AIOrderInbox from './pages/member/AIOrderInbox';
import OrderDetail from './pages/member/OrderDetail';
import AddOrder from './pages/member/AddOrder';
import UploadPO from './pages/member/UploadPO';
import ReviewOrder from './pages/member/ReviewOrder';
import AddShipment from './pages/member/AddShipment';
import ShipmentDetail from './pages/member/ShipmentDetail';
import Tracking from './pages/member/Tracking';
import Integrations from './pages/member/Integrations';
import Notifications from './pages/member/Notifications';
import Settings from './pages/member/Settings';
import NotFound from './components/NotFound';
import PageLoader from './components/PageLoader';

export default function AppRouter() {
  return (
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
        
        {/* Member Panel Routes with AppLayout */}
        <Route path="/member" element={<AppLayout />}>
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
          <Route path="settings" element={<Settings />} />
          
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
