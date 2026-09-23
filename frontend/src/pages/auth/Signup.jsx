import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiUser } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { toast } from 'react-toastify';
import { useAuth } from '../../components/AuthProvider';
import useGoogleSignIn from '../../hooks/useGoogleSignIn';
import '../../styles/auth.css';

export default function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSuccess = (result) => {
    if (result?.isNew) {
      toast.success('Account created successfully!');
      navigate('/onboarding/company');
    } else {
      toast.success('Login successful!');
      navigate('/app/dashboard');
    }
  };

  const { handleGoogleSignIn, loading: googleLoading } = useGoogleSignIn(handleGoogleSuccess);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signup(fullName, email, password);
      toast.success('Account created successfully!');
      navigate('/onboarding/company');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Signup failed. Please try again.');
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
              <h2 className="heroSubtitle">Join the smartest<br />B2B platform.</h2>
              <p className="heroTagline">Track. Manage. Deliver. Grow.</p>
              
              <form onSubmit={handleSubmit}>
                <div className="custom-frm-bx">
                  <label>Full Name</label>
                  <div className="position-relative">
                    <FiUser className="inputIcon" />
                    <input 
                      type="text" 
                      className="form-control auth-input-with-icon" 
                      placeholder="Full Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="custom-frm-bx">
                  <label>Work Email</label>
                  <div className="position-relative">
                    <FiMail className="inputIcon" />
                    <input 
                      type="email" 
                      className="form-control auth-input-with-icon" 
                      placeholder="Work email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <div className="custom-frm-bx">
                  <label>Password</label>
                  <div className="position-relative">
                    <FiLock className="inputIcon" />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      className="form-control auth-input-with-icon" 
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button 
                      type="button" 
                      className="inputIconRight border-0 bg-transparent p-0 d-flex align-items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                </div>
                
                <div className="custom-checkbox mb-4 mt-3">
                  <input 
                    type="checkbox" 
                    id="terms"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    required
                  />
                  <label htmlFor="terms">I agree to the <Link to="#" className="auth-forgot-btn  fz-14">Terms & Conditions</Link></label>
                </div>

              <div className='mb-2'>
                  <button type="submit" className="thm-lg-btn w-100 text-center" disabled={loading}>
                    {loading ? 'Creating Account...' : 'Sign Up'}
                  </button>
              </div> 
                
                <div className="divider">or</div>
                
                <button type="button" className="googleBtn" onClick={handleGoogleSignIn} disabled={loading || googleLoading}>
                  <FcGoogle size={20} /> {googleLoading ? 'Connecting...' : 'Continue with Google'}
                </button>
              </form>
              
              <div className="text-center mt-3">
                <p className="fz-16 fw-500 mb-0">
                  Already have an account? <Link to="/login" className="auth-forgot-btn">Log in</Link>
                </p>
              </div>
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
