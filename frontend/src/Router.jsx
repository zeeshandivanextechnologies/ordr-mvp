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


export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} /> 
        <Route path="/reset-password" element={<ResetPassword />} /> 
        <Route path="/otp" element={<Otp />} /> 
        <Route path="/onboarding/company" element={<CompanyDetails />} />
        <Route path="/onboarding/track" element={<TrackSelection />} />
        <Route path="/onboarding/gmail" element={<ConnectGmail />} />
        <Route path="/onboarding/team" element={<InviteTeam />} />
        <Route path="/onboarding/dashboard" element={<GoToDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
