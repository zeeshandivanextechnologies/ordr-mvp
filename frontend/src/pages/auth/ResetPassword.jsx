import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { toast } from 'react-toastify';
import authService from '../../services/authService';
import '../../styles/auth.css';

export default function ResetPassword() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  const email = location.state?.email;
  const otp = location.state?.otp;

  useEffect(() => {
    if (!email || !otp) {
      navigate('/forgot-password');
    }
  }, [email, otp, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(email, otp, password);
      toast.success('Password reset successful!');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  if (!email || !otp) return null;

  return (
    <div className="authWrapper">
      <div className="container-fluid p-0">
        <div className="row g-0">
        
          <div className="col-lg-6 col-md-12 col-sm-12">
            <div className="authFormSection">
              <h1 className="brandTitle">ORDR</h1>
              <h2 className="heroSubtitle">Set New Password</h2>
              <p className="heroTagline">Please enter your new password below.</p>
              
              <form onSubmit={handleSubmit}>
                <div className="custom-frm-bx mb-3">
                  <label>New Password</label>
                  <div className="position-relative">
                    <FiLock className="inputIcon" />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      className="form-control auth-input-with-icon" 
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError('');
                      }}
                      required
                    />
                    <button 
                      type="button" 
                      className="inputIconRight border-0 bg-transparent p-0 d-flex align-items-center"
                      style={{ zIndex: 100 }}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <FiEyeOff size={18} color="#666" /> : <FiEye size={18} color="#666" />}
                    </button>
                  </div>
                </div>

                <div className="custom-frm-bx mb-2">
                  <label>Confirm Password</label>
                  <div className="position-relative">
                    <FiLock className="inputIcon" />
                    <input 
                      type={showConfirmPassword ? "text" : "password"} 
                      className="form-control auth-input-with-icon" 
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordError('');
                      }}
                      required
                    />
                    <button 
                      type="button" 
                      className="inputIconRight border-0 bg-transparent p-0 d-flex align-items-center"
                      style={{ zIndex: 100 }}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <FiEyeOff size={18} color="#666" /> : <FiEye size={18} color="#666" />}
                    </button>
                  </div>
                  {passwordError && (
                    <small className="text-danger mt-1 d-block">{passwordError}</small>
                  )}
                </div>
                
                <div className='mt-3'>
                  <button type="submit" className="thm-lg-btn w-100 text-center" disabled={loading}>
                    {loading ? 'Saving...' : 'Save Password'}
                  </button>
                </div>
                
                <div className="text-center mt-3">
                  <Link to="/login" className="auth-forgot-btn text-decoration-none">Back to Login</Link>
                </div>
              </form>
            </div>
          </div>
          
          <div className="col-lg-6 col-md-12 col-sm-12 d-none d-md-block">
            <div className="authImage">
              <div className="imageOverlayText">
                  <p>More control. <span className='d-lg-block d-sm-inline'>Smoother business.</span></p>
              </div>
              <div className="statsBar">
                <div className="statItem">
                  <p>Businesses</p>
                  <h4>500+</h4>
                </div>
                <div className="statItem">
                  <p>Orders Tracked</p>
                  <h4>1M+</h4>
                </div>
                <div className="statItem">
                  <p>On-time Deliveries</p>
                  <h4>98%</h4>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
