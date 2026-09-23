import { useState, useEffect, useRef } from 'react';
import { FiUser, FiMail, FiLock, FiBell, FiLink, FiSave, FiEye, FiEyeOff, FiUpload, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import authService from '../../services/authService';
import companyService from '../../services/companyService';
import notificationService from '../../services/notificationService';
import integrationService from '../../services/integrationService';
import { useAuth } from '../../components/AuthProvider';
import '../../styles/member.css';

function TabLoader() {
  return (
    <div className="d-flex justify-content-center align-items-center py-5" role="status">
      <div className="spinner-border" style={{ width: '2.5rem', height: '2.5rem', color: 'var(--primary-color)' }}>
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
}

export default function MemberSettings() {
  const [activeTab, setActiveTab] = useState('profile');
  const { role, updateUser } = useAuth();

  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    designation: '',
    gstNumber: '',
    avatarUrl: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      setProfileLoading(true);
      try {
        const meRes = await authService.getMe();
        const user = meRes.user || {};
        const compRes = await companyService.getCompany();
        if (!mounted) return;
        setProfile({
          fullName: user.full_name || '',
          email: user.email || '',
          phone: user.phone || '',
          companyName: compRes.company?.name || user.company_name || '',
          designation: user.designation || '',
          gstNumber: user.gst_number || '',
          avatarUrl: user.avatar_url || '',
        });
      } catch {
        if (mounted) toast.error('Failed to load profile');
      } finally {
        if (mounted) setProfileLoading(false);
      }
    };
    loadProfile();
    return () => { mounted = false; };
  }, []);

  const handleProfileChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('Image too large (max 3MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setUploadingAvatar(true);
      try {
        const res = await authService.updateAvatar(reader.result);
        setProfile((prev) => ({ ...prev, avatarUrl: res.user.avatar_url }));
        updateUser({ avatar_url: res.user.avatar_url });
        toast.success('Avatar updated');
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to upload avatar');
      } finally {
        setUploadingAvatar(false);
      }
    };
    reader.onerror = () => toast.error('Failed to read image');
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const res = await authService.updateAvatar(null);
      setProfile((prev) => ({ ...prev, avatarUrl: res.user.avatar_url || '' }));
      updateUser({ avatar_url: null });
      toast.success('Avatar removed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await authService.updateProfile({
        full_name: profile.fullName,
        email: profile.email,
        phone: profile.phone,
        designation: profile.designation,
        gst_number: profile.gstNumber,
      });
      if (role === 'admin') {
        await companyService.updateCompany({ name: profile.companyName });
      }
      updateUser({
        full_name: res.user.full_name,
        email: res.user.email,
      });
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handlePasswordChange = (field, value) => {
    setPasswordData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('New password and confirm password do not match');
      return;
    }
    setSavingPassword(true);
    try {
      await authService.changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      });
      toast.success('Password updated successfully');
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  const [notifications, setNotifications] = useState({
    email_notifications: true,
    shipment_alerts: true,
    ai_order_detection: false,
    delivery_reminders: false,
  });
  const [notifLoaded, setNotifLoaded] = useState(false);
  const [notifLoading, setNotifLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadNotifications = async () => {
      setNotifLoading(true);
      try {
        const res = await notificationService.getPreferences();
        const p = res.preferences || {};
        if (!mounted) return;
        setNotifications({
          email_notifications: p.email_notifications ?? true,
          shipment_alerts: p.shipment_alerts ?? true,
          ai_order_detection: p.ai_order_detection ?? false,
          delivery_reminders: p.delivery_reminders ?? false,
        });
        setNotifLoaded(true);
      } catch {
        if (mounted) toast.error('Failed to load notification preferences');
      } finally {
        if (mounted) setNotifLoading(false);
      }
    };
    if (activeTab === 'notifications' && !notifLoaded) {
      loadNotifications();
    }
    return () => { mounted = false; };
  }, [activeTab, notifLoaded]);

  const notificationLabels = {
    email_notifications: 'Email notifications',
    shipment_alerts: 'Shipment alerts',
    ai_order_detection: 'AI order detection',
    delivery_reminders: 'Delivery reminders',
  };

  const handleNotificationsChange = async (field, value) => {
    const next = { ...notifications, [field]: value };
    setNotifications(next);
    toast.info(`${notificationLabels[field] || field} ${value ? 'enabled' : 'disabled'}`);
    try {
      await notificationService.updatePreferences(next);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save preference');
    }
  };

  const [gmailStatus, setGmailStatus] = useState({ connected: false, connections: [] });
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [connectedLoading, setConnectedLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (activeTab === 'connected') {
      (async () => {
        setConnectedLoading(true);
        try {
          const res = await integrationService.getGmailStatus();
          if (mounted) setGmailStatus(res);
        } catch {
          if (mounted) toast.error('Failed to load connection status');
        } finally {
          if (mounted) setConnectedLoading(false);
        }
      })();
    }
    return () => { mounted = false; };
  }, [activeTab]);

  const handleConnectGmail = async () => {
    setConnectingGmail(true);
    try {
      const res = await integrationService.getGmailConnectUrl();
      if (res.url) {
        window.location.href = res.url;
      }
    } catch {
      toast.error('Failed to start connection process');
      setConnectingGmail(false);
    }
  };

  return (
    <>
      <div className="row">
        <div className="col-lg-12">
          <div className="member-page-header">
            <div>
              <h2>Settings</h2>
              <p>Manage your account preferences</p>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-12">
          <div className="member-tabs">
            <button className={`tab-btn d-flex align-items-center gap-2 ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
              <FiUser /> Profile
            </button>
            <button className={`tab-btn d-flex align-items-center gap-2 ${activeTab === 'password' ? 'active' : ''}`} onClick={() => setActiveTab('password')}>
              <FiLock /> Password
            </button>
            <button className={`tab-btn d-flex align-items-center gap-2 ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
              <FiBell /> Notifications
            </button>
            <button className={`tab-btn d-flex align-items-center gap-2 ${activeTab === 'connected' ? 'active' : ''}`} onClick={() => setActiveTab('connected')}>
              <FiLink /> Connected Accounts
            </button>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-12">
          <div className="member-card">
            <div className="member-card-body">
              {activeTab === 'profile' && (
                profileLoading ? <TabLoader /> :
                <form onSubmit={handleSaveProfile}>
                  <div className="row">
                    <div className="col-lg-12">
                      <div className="d-flex flex-column align-items-center mb-4">
                        <div className="user-avatar" style={{ width: 90, height: 90, fontSize: 30 }}>
                          {profile.avatarUrl ? (
                            <img src={profile.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            getInitials(profile.fullName)
                          )}
                        </div>
                        <div className="d-flex gap-2 mt-3">
                          <button type="button" className="thm-btn outline py-2" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}>
                            <FiUpload size={14} /> {uploadingAvatar ? 'Uploading...' : 'Upload Avatar'}
                          </button>
                          {profile.avatarUrl && (
                            <button type="button" className="thm-btn outline py-2" onClick={handleRemoveAvatar} disabled={uploadingAvatar}>
                              <FiTrash2 size={14} /> Remove Photo
                            </button>
                          )}
                        </div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleAvatarChange}
                        />
                      </div>
                    </div>
                    <div className="col-lg-6 col-md-6 col-sm-12">
                      <div className="custom-frm-bx">
                        <label>Full Name</label>
                        <input type="text" className="form-control" value={profile.fullName} onChange={(e) => handleProfileChange('fullName', e.target.value)} disabled={savingProfile} required />
                      </div>
                    </div>
                    <div className="col-lg-6 col-md-6 col-sm-12">
                      <div className="custom-frm-bx">
                        <label>Email</label>
                        <input type="email" className="form-control" value={profile.email} onChange={(e) => handleProfileChange('email', e.target.value)} disabled={savingProfile} required />
                      </div>
                    </div>
                    <div className="col-lg-6 col-md-6 col-sm-12">
                      <div className="custom-frm-bx">
                        <label>Phone</label>
                        <input type="tel" className="form-control" value={profile.phone} onChange={(e) => handleProfileChange('phone', e.target.value)} disabled={savingProfile} />
                      </div>
                    </div>
                    <div className="col-lg-6 col-md-6 col-sm-12">
                      <div className="custom-frm-bx">
                        <label>Company Name</label>
                        <input type="text" className="form-control" value={profile.companyName} onChange={(e) => handleProfileChange('companyName', e.target.value)} disabled={savingProfile} readOnly />
                      </div>
                    </div>
                    <div className="col-lg-6 col-md-6 col-sm-12">
                      <div className="custom-frm-bx">
                        <label>Designation</label>
                        <input type="text" className="form-control" value={profile.designation} onChange={(e) => handleProfileChange('designation', e.target.value)} disabled={savingProfile} />
                      </div>
                    </div>
                    <div className="col-lg-6 col-md-6 col-sm-12">
                      <div className="custom-frm-bx">
                        <label>GST Number</label>
                        <input type="text" className="form-control" value={profile.gstNumber} onChange={(e) => handleProfileChange('gstNumber', e.target.value)} disabled={savingProfile} />
                      </div>
                    </div>
                    <div className="col-lg-12 text-end">
                      <button type="submit" className="thm-btn" disabled={savingProfile}><FiSave /> {savingProfile ? 'Saving...' : 'Save Changes'}</button>
                    </div>
                  </div>
                </form>
              )}

              {activeTab === 'password' && (
                <form onSubmit={handleSavePassword}>
                  <div className="row">
                    <div className="col-lg-6 col-md-6 col-sm-12">
                      <div className="custom-frm-bx">
                        <label>Current Password</label>
                        <div className="position-relative">
                          <input
                            type={showCurrent ? 'text' : 'password'}
                            className="form-control password-input"
                            placeholder="Enter current password"
                            value={passwordData.current_password}
                            onChange={(e) => handlePasswordChange('current_password', e.target.value)}
                            disabled={savingPassword}
                            required
                          />
                          <button
                            type="button"
                            className="password-eye-btn"
                            onClick={() => setShowCurrent(!showCurrent)}
                          >
                            {showCurrent ? <FiEyeOff /> : <FiEye />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="col-lg-6 col-md-6 col-sm-12">
                      <div className="custom-frm-bx">
                        <label>New Password</label>
                        <div className="position-relative">
                          <input
                            type={showNew ? 'text' : 'password'}
                            className="form-control password-input"
                            placeholder="Enter new password"
                            value={passwordData.new_password}
                            onChange={(e) => handlePasswordChange('new_password', e.target.value)}
                            disabled={savingPassword}
                            required
                          />
                          <button
                            type="button"
                            className="password-eye-btn"
                            onClick={() => setShowNew(!showNew)}
                          >
                            {showNew ? <FiEyeOff /> : <FiEye />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="col-lg-6 col-md-6 col-sm-12">
                      <div className="custom-frm-bx">
                        <label>Confirm New Password</label>
                        <div className="position-relative">
                          <input
                            type={showConfirm ? 'text' : 'password'}
                            className="form-control password-input"
                            placeholder="Confirm new password"
                            value={passwordData.confirm_password}
                            onChange={(e) => handlePasswordChange('confirm_password', e.target.value)}
                            disabled={savingPassword}
                            required
                          />
                          <button
                            type="button"
                            className="password-eye-btn"
                            onClick={() => setShowConfirm(!showConfirm)}
                          >
                            {showConfirm ? <FiEyeOff /> : <FiEye />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="col-lg-12 text-end">
                      <button type="submit" className="thm-btn" disabled={savingPassword}><FiSave /> {savingPassword ? 'Updating...' : 'Update Password'}</button>
                    </div>
                  </div>
                </form>
              )}

              {activeTab === 'notifications' && (
                notifLoading ? <TabLoader /> :
                <div className="row">
                  {[
                    { key: 'email_notifications', label: 'Email Notifications', desc: 'Receive order updates via email' },
                    { key: 'shipment_alerts', label: 'Shipment Alerts', desc: 'Get notified when shipment status changes' },
                    { key: 'ai_order_detection', label: 'AI Order Detection', desc: 'Notify when new order detected from email' },
                    { key: 'delivery_reminders', label: 'Delivery Reminders', desc: 'Reminder before delivery due date' },
                  ].map((item, idx) => (
                    <div className="col-md-6 mb-3" key={idx}>
                      <div className="details-box">
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <h5 className='mb-2'>{item.label}</h5>
                            <h6 className="text-muted">{item.desc}</h6>
                          </div>
                          <div className="theme-switch">
                            <input type="checkbox" id={`member-switch-${idx}`} checked={notifications[item.key]} onChange={(e) => handleNotificationsChange(item.key, e.target.checked)} />
                            <label className="switch-slider" htmlFor={`member-switch-${idx}`}></label>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'connected' && (
                connectedLoading ? <TabLoader /> :
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <div className="details-box">
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-3">
                          <div className="kpi-icon" style={{ background: '#e3f2fd', color: '#1565c0' }}>
                            <FiMail />
                          </div>
                          <div>
                            <h5 className="mb-0">Gmail</h5>
                            <h6 className="mb-0">{gmailStatus.connected ? (gmailStatus.connections[0]?.email || 'Connected') : 'Not connected'}</h6>
                          </div>
                        </div>
                        {gmailStatus.connected ? (
                          <span className="status-badge dispatched">Connected</span>
                        ) : (
                          <button className="thm-btn outline" onClick={handleConnectGmail} disabled={connectingGmail}>{connectingGmail ? 'Connecting...' : 'Connect'}</button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 mb-3">
                    <div className="details-box">
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-3">
                          <div className="kpi-icon" style={{ background: '#f5f5f5', color: '#9e9e9e' }}>
                            <FiMail />
                          </div>
                          <div>
                            <h5 className="mb-0">Outlook</h5>
                            <h6 className="mb-0">Not connected</h6>
                          </div>
                        </div>
                        <button className="thm-btn outline">Connect</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
