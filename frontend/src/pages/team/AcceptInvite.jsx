import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiUser, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../../components/AuthProvider';
import teamService from '../../services/teamService';
import '../../styles/auth.css';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { acceptInvite } = useAuth();

  const [invite, setInvite] = useState(null);
  const [tokenError, setTokenError] = useState('');

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      if (!token) {
        setTokenError('This invitation link is invalid or has expired.');
        return;
      }
      try {
        const res = await teamService.verifyInvite(token);
        if (!active) return;
        setInvite(res.invite);
      } catch (err) {
        if (!active) return;
        setTokenError(err.response?.data?.error || 'This invitation link is invalid or has expired.');
      }
    };

    verify();
    return () => { active = false; };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await acceptInvite(token, { full_name: fullName, password });
      toast.success('Invitation accepted! Welcome to ORDR.');
      navigate('/app/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to accept invitation');
      if (err.response?.status === 409) {
        navigate('/login');
      }
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

              {tokenError ? (
                <>
                  <h2 className="heroSubtitle">Invitation not valid</h2>
                  <p className="heroTagline">{tokenError}</p>
                  <div className="my-3">
                    <Link to="/login" className="thm-lg-btn w-100 text-center d-block text-decoration-none">
                      Go to Login
                    </Link>
                  </div>
                </>
              ) : !invite ? (
                <p className="heroTagline">Checking your invitation...</p>
              ) : (
                <>
                  <h2 className="heroSubtitle">Join your team</h2>
                  <p className="heroTagline">
                    You've been invited to <b>{invite.company_name}</b> by <b>{invite.inviter_name}</b>{' '}
                    as a <b className="text-capitalize">{invite.role}</b>.
                  </p>

                  <form onSubmit={handleSubmit}>
                    <div className="custom-frm-bx">
                      <label>Full Name</label>
                      <div className="position-relative">
                        <FiUser className="inputIcon" />
                        <input
                          type="text"
                          className="form-control auth-input-with-icon"
                          placeholder="Your full name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
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
                          placeholder="Create a password (min 8 characters)"
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

                    <div className="custom-frm-bx">
                      <label>Confirm Password</label>
                      <div className="position-relative">
                        <FiLock className="inputIcon" />
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          className="form-control auth-input-with-icon"
                          placeholder="Re-enter password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="inputIconRight border-0 bg-transparent p-0 d-flex align-items-center"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                    </div>

                    <div className="my-3">
                      <button type="submit" className="thm-lg-btn w-100 text-center" disabled={loading}>
                        {loading ? 'Setting up...' : 'Accept Invitation'}
                      </button>
                    </div>

                    <div className="text-center mt-3">
                      <Link to="/login" className="auth-forgot-btn text-decoration-none">Back to Login</Link>
                    </div>
                  </form>
                </>
              )}
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