import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiMoreHorizontal, FiMail } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { toast } from 'react-toastify';
import integrationService from '../../services/integrationService';
import '../../styles/onboarding.css';

export default function ConnectGmail() {
  const [selectedProvider, setSelectedProvider] = useState('gmail');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectLoading, setConnectLoading] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Check URL parameters for OAuth redirect status
    const params = new URLSearchParams(location.search);
    if (params.get('success')) {
      toast.success('Gmail connected successfully!');
      // Clean up URL
      navigate('/onboarding/gmail', { replace: true });
    } else if (params.get('error')) {
      toast.error(params.get('error') || 'Failed to connect Gmail');
      navigate('/onboarding/gmail', { replace: true });
    }

    const checkStatus = async () => {
      try {
        const res = await integrationService.getGmailStatus();
        setIsConnected(res.connected);
      } catch (err) {
        console.error('Failed to fetch status');
      } finally {
        setLoading(false);
      }
    };
    
    checkStatus();
  }, [location, navigate]);

  const handleConnect = async () => {
    setConnectLoading(true);
    try {
      const res = await integrationService.getGmailConnectUrl();
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      toast.error('Failed to start connection process');
      setConnectLoading(false);
    }
  };
  const steps = [
    { num: 1, label: 'Company Details', completed: true },
    { num: 2, label: 'What to Track', completed: true },
    { num: 3, label: 'Connect Inbox', active: true },
    { num: 4, label: 'Invite Team', active: false },
    { num: 5, label: 'All Set!', active: false },
  ];

  return (
    <div className="onboarding-page">
      <div className="container">
        <div className="row">
          <div className="col-lg-12">
            <div className="onboarding-header">
              <div>
                <Link to="/" className="sidebar-brand">ORDR</Link>
              </div>
              <div>
                <button className="header-more-btn"><FiMoreHorizontal /></button>
              </div>
            </div>
          </div>

          <div className="col-lg-3 col-xl-2 onboarding-sidebar">
            <div className="sidebar-steps">
              {steps.map((step, index) => (
                <div key={step.num} className={`sidebar-step ${step.active ? 'active' : ''} ${step.completed ? 'completed' : ''}`}>
                  <div className="step-circle">{step.completed ? '✓' : step.num}</div>
                  <span className="step-label">{step.label}</span>
                  {index < steps.length - 1 && <div className="step-line"></div>}
                </div>
              ))}
            </div>
          </div>

          <div className="col-lg-6 col-xl-7">
            <div className="onboarding-content">
              <h1 className="onboarding-heading">Connect your inbox</h1>
              <p className="onboarding-desc">We'll scan your emails to find orders, confirmations and delivery updates.</p>

              <div className="email-providers">
                <div 
                  className={`provider-card recommended ${selectedProvider === 'gmail' ? 'selected' : ''} ${isConnected ? 'connected-card' : ''}`}
                  onClick={() => setSelectedProvider('gmail')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="provider-logo">
                    <FcGoogle size={40} />
                  </div>
                  <h5>Gmail</h5>
                  {isConnected ? (
                    <span className="provider-badge connected-badge">Connected</span>
                  ) : (
                    <span className="provider-badge recommended-badge">Recommended</span>
                  )}
                  
                  {isConnected ? (
                    <button className="thm-btn w-100" style={{ backgroundColor: '#28a745', border: 'none' }} disabled>
                      Connected ✓
                    </button>
                  ) : (
                    <button 
                      className="thm-btn w-100" 
                      onClick={(e) => { e.stopPropagation(); handleConnect(); }}
                      disabled={loading || connectLoading}
                    >
                      {connectLoading ? 'Connecting...' : 'Connect Gmail'}
                    </button>
                  )}
                </div>

                <div 
                  className={`provider-card coming-soon ${selectedProvider === 'outlook' ? 'selected' : ''}`}
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                >
                  <div className="provider-logo">
                    <FiMail size={40} color="#0078D4" />
                  </div>
                  <h5>Outlook</h5>
                  <span className="provider-badge coming-soon-badge">Coming soon</span>
                  <button className="provider-btn outline" disabled>Notify me</button>
                </div>

              </div> 

              <div className="provider-features">
                <div className="feature-check"><span className="check-icon">✓</span> Secure & read-only</div>
                <div className="feature-check"><span className="check-icon">✓</span> Finds orders automatically</div>
              </div>

              <div className="onboarding-nav">
                <Link to="/onboarding/track" className="nav-back">Back</Link>
                {isConnected ? (
                  <Link to="/onboarding/team" className="thm-btn">Next</Link>
                ) : (
                  <Link to="/onboarding/team" className="nav-skip">Skip for now</Link>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-3 col-xl-3 onboarding-right-side">
            <div className="info-card">
              <div className="info-card-icon">
                <FiMail size={48} color="#201d6a" />
              </div>
              <h4 className="info-card-title">Smart email scanning</h4>
              <ul className="info-card-list">
                <li><span className="check-icon">✓</span> Read-only access</li>
                <li><span className="check-icon">✓</span> AI detects orders</li>
                <li><span className="check-icon">✓</span> Extracts details</li>
                <li><span className="check-icon">✓</span> Secure & private</li>
                <li><span className="check-icon">✓</span> No spam ever</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
