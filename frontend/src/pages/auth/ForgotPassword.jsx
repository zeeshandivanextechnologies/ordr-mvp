import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail } from 'react-icons/fi';
import { toast } from 'react-toastify';
import authService from '../../services/authService';
import useLandingContent from '../../hooks/useLandingContent';
import useCounter from '../../hooks/useCounter';
import '../../styles/auth.css';

function StatCounter({ end, suffix = '', duration = 2000 }) {
  const { count, ref } = useCounter(end, duration);
  return <span ref={ref}>{count}{suffix}</span>;
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { content } = useLandingContent();
  const stats = content?.stats;

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      toast.success('OTP sent to your email');
      navigate('/otp', { state: { email } });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authWrapper">
      <div className="container-fluid p-0">
        <div className="row g-0">
        
          <div className="col-lg-6 col-md-12 col-sm-12">
            <div className="authFormSection">
              <h1 className="brandTitle">ORDR</h1>
              
              <h2 className="heroSubtitle">Reset Password</h2>
              <p className="heroTagline">Enter your email and we'll send you an OTP.</p>
              
              <form onSubmit={handleSendOtp}>
                <div className="custom-frm-bx">
                  <label>Work Email</label>
                  <div className="position-relative">
                    <input 
                      type="email" 
                      className="form-control auth-input-with-icon" 
                      placeholder="Work email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <FiMail className="inputIcon" />
                  </div>
                </div>
                
                <div className='mt-3'>
                  <button type="submit" className="thm-lg-btn w-100 text-center" disabled={loading}>
                    {loading ? 'Sending OTP...' : 'Send OTP'}
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
                {stats?.items?.length > 0 ? (
                  stats.items.slice(0, 3).map((stat, index) => (
                    <div className="statItem" key={index}>
                      <p>{stat.label}</p>
                      <h4><StatCounter end={Number(stat.value) || 0} suffix={stat.suffix || ''} duration={Number(stat.duration) || 2000} /></h4>
                    </div>
                  ))
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
