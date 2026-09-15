import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import '../../styles/auth.css';

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Login:', { email, password, rememberMe });
  };

  return (
    <div className="authWrapper">
      <div className="container-fluid p-0">
        <div className="row g-0">
        
          <div className="col-lg-6 col-md-12 col-sm-12">
            <div className="authFormSection">
              <h1 className="brandTitle">ORDR</h1>
              <h2 className="heroSubtitle">Every business order.<br />One place.</h2>
              <p className="heroTagline">Track. Manage. Deliver. Grow.</p>
              
              <form onSubmit={handleSubmit}>
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
                
                <div className="d-flex justify-content-between align-items-center my-2">
                  <div className="custom-checkbox">
                    <input 
                      type="checkbox" 
                      id="rememberMe"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <label htmlFor="rememberMe">Remember me</label>
                  </div>
                  <Link to="/forgot-password" className="auth-forgot-btn">Forgot password?</Link>
                </div>
                
               <div className='my-3'>
                  <button type="submit" className="thm-lg-btn w-100 text-center">Sign In</button>
               </div>
                
                <div className="divider">or</div>
                
                <button type="button" className="googleBtn">
                  <FcGoogle size={20} /> Continue with Google
                </button>
              </form>
              
              <div className="text-center mt-3">
                <p className="fz-16 fw-500">
                  Don't have an account? <Link to="/signup" className="auth-forgot-btn ">Create one</Link>
                </p>
              </div>
            </div>
          </div>

          <div className="col-lg-6 col-md-12 col-sm-12 d-none d-md-block">
            <div className="authImage">
              <div className="imageOverlayText">
                More<br/>control.<br/>Smoother<br/>business.
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
