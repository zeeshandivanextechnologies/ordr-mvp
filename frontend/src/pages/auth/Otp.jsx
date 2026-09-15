import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiLock } from 'react-icons/fi';
import '../../styles/auth.css';

export default function Otp() {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  const handleChange = (index, value) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }
    
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = pastedData.split('').concat(Array(6 - pastedData.length).fill(''));
    setOtp(newOtp.slice(0, 6));
    
    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const otpValue = otp.join('');
    console.log('OTP:', otpValue);
  };

  const handleResend = () => {
    console.log('Resend OTP');
  };

  return (
    <div className="authWrapper">
      <div className="container-fluid p-0">
        <div className="row g-0">
        
          <div className="col-lg-6 col-md-12 col-sm-12">
            <div className="authFormSection">
              <h1 className="brandTitle">ORDR</h1>
              <h2 className="heroSubtitle">Verify your email</h2>
              <p className="heroTagline">We've sent a 6-digit code to your email address.</p>
              
              <form onSubmit={handleSubmit}>
                <div className="custom-frm-bx mb-4">
                  <label>Verification Code</label>
                  <div className="position-relative">
                    <div className="otp-inputs">
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => (inputRefs.current[index] = el)}
                          type="text"
                          maxLength="1"
                          className='form-control text-center auth-input-with-icon px-2'
                          value={digit}
                          onChange={(e) => handleChange(index, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          onPaste={handlePaste}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className=''>
                  <button type="submit" className="thm-lg-btn w-100 text-center">Verify OTP</button>
                </div>
                
                <div className="text-center mt-3">
                  <p className="fz-16 fw-500 mb-2">
                    Didn't receive the code? <button type="button" className="auth-forgot-btn" onClick={handleResend}>Resend</button>
                  </p>
                  <Link to="/login" className="auth-forgot-btn text-decoration-none">Back to Login</Link>
                </div>
              </form>
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
