import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiUser, FiMail, FiLock, FiBell, FiLink, FiSave, FiHome, FiUsers, FiPlus, FiTrash2, FiEye, FiEyeOff, FiUserCheck, FiUserX, FiUpload } from 'react-icons/fi';
import { LuChevronDown } from 'react-icons/lu';
import { toast } from 'react-toastify';
import authService from '../../services/authService';
import companyService from '../../services/companyService';
import notificationService from '../../services/notificationService';
import integrationService from '../../services/integrationService';
import teamService from '../../services/teamService';
import { countries } from '../../utils/countries';
import { timezones } from '../../utils/timezones';
import { useAuth } from '../../components/AuthProvider';
import '../../styles/member.css';

function TabLoader() {
  return (
    <div className="d-flex justify-content-center align-items-center" style={{height : "200px"}}  role="status">
      <div className="spinner-border" style={{ width: '2.5rem', height: '2.5rem', color: 'var(--primary-color)' }}>
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('profile');
  const { updateUser } = useAuth();

  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    designation: '',
    gstNumber: '',
    avatarUrl: '',
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
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

  const [notifications, setNotifications] = useState({
    email_notifications: true,
    shipment_alerts: true,
    ai_order_detection: false,
    delivery_reminders: false,
  });
  const [savingNotifications, setSavingNotifications] = useState(false);

  const [gmailStatus, setGmailStatus] = useState({ connected: false, connections: [] });
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [connectedLoading, setConnectedLoading] = useState(true);

  const [company, setCompany] = useState({
    name: '',
    industry: '',
    country: '',
    timezone: '',
  });
  const [companyLoading, setCompanyLoading] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (activeTab === 'company') {
      (async () => {
        setCompanyLoading(true);
        try {
          const res = await companyService.getCompany();
          const c = res.company || {};
          if (!mounted) return;
          setCompany({
            name: c.name || '',
            industry: c.industry || '',
            country: c.country || '',
            timezone: c.timezone || '',
          });
        } catch {
          if (mounted) toast.error('Failed to load company details');
        } finally {
          if (mounted) setCompanyLoading(false);
        }
      })();
    }
    return () => { mounted = false; };
  }, [activeTab]);

  const handleCompanyChange = (field, value) => {
    setCompany((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    setSavingCompany(true);
    try {
      await companyService.updateCompany({
        name: company.name,
        industry: company.industry,
        country: company.country,
        timezone: company.timezone,
      });
      updateUser({ company_name: company.name });
      toast.success('Company details updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update company');
    } finally {
      setSavingCompany(false);
    }
  };

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

  const notificationLabels = {
    email_notifications: 'Email notifications',
    shipment_alerts: 'Shipment alerts',
    ai_order_detection: 'AI order detection',
    delivery_reminders: 'Delivery reminders',
  };

  const handleNotificationsChange = (field, value) => {
    setNotifications((prev) => ({ ...prev, [field]: value }));
    toast.info(`${notificationLabels[field] || field} ${value ? 'enabled' : 'disabled'}`);
  };

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    try {
      await notificationService.updatePreferences(notifications);
      toast.success('Notification preferences saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save notification preferences');
    } finally {
      setSavingNotifications(false);
    }
  };

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
      await companyService.updateCompany({ name: profile.companyName });
      updateUser({
        full_name: res.user.full_name,
        email: res.user.email,
        company_name: profile.companyName,
      });
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const [teamMembers, setTeamMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const [invites, setInvites] = useState([{ email: '', role: 'Member' }]);
  const [sendingInvites, setSendingInvites] = useState(false);

  const [openAction, setOpenAction] = useState(null);
  const actionRef = useRef(null);

  useEffect(() => {
    if (openAction === null) return undefined;
    const closeOnOutsideClick = (e) => {
      if (actionRef.current && !actionRef.current.contains(e.target)) {
        setOpenAction(null);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [openAction]);

  const applyTeamData = (res) => {
    setTeamMembers(
      (res.members || []).map((m) => ({
        id: m.id,
        name: m.full_name,
        email: m.email,
        role: m.role === 'admin' ? 'Admin' : 'Member',
        status: m.is_active ? 'Active' : 'Inactive',
      }))
    );
    setPendingInvites(
      (res.invitations || []).map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role === 'admin' ? 'Admin' : 'Member',
      }))
    );
  };

  useEffect(() => {
    let mounted = true;
    if (activeTab === 'users') {
      (async () => {
        setUsersLoading(true);
        try {
          const res = await teamService.getMembers();
          if (mounted) applyTeamData(res);
        } catch {
          if (mounted) toast.error('Failed to load team members');
        } finally {
          if (mounted) setUsersLoading(false);
        }
      })();
    }
    return () => { mounted = false; };
  }, [activeTab]);

  const handleRemoveMember = async (userId) => {
    try {
      await teamService.removeMember(userId);
      setTeamMembers((prev) => prev.filter((m) => m.id !== userId));
      toast.success('Member removed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleToggleStatus = async (user) => {
    const nextActive = user.status !== 'Active';
    try {
      await teamService.updateMemberStatus(user.id, nextActive);
      const newStatus = nextActive ? 'Active' : 'Inactive';
      setTeamMembers((prev) => prev.map((m) => (m.id === user.id ? { ...m, status: newStatus } : m)));
      toast.success(nextActive ? 'Member activated' : 'Member deactivated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update member status');
    }
  };

  const handleRevokeInvite = async (inviteId) => {
    try {
      await teamService.revokeInvitation(inviteId);
      setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
      toast.success('Invitation revoked');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to revoke invitation');
    }
  };

  const handleSendInvites = async () => {
    const validInvites = invites.filter((inv) => inv.email).map((inv) => ({ email: inv.email, role: inv.role.toLowerCase() }));
    if (validInvites.length === 0) {
      toast.error('Add at least one email');
      return;
    }
    setSendingInvites(true);
    try {
      const res = await teamService.inviteMembers(validInvites);
      if (res.success?.length) toast.success(`Invited: ${res.success.join(', ')}`);
      (res.failed || []).forEach((f) => toast.error(`${f.email}: ${f.reason}`));
      setInvites([{ email: '', role: 'Member' }]);
      const fresh = await teamService.getMembers();
      applyTeamData(fresh);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send invites');
    } finally {
      setSendingInvites(false);
    }
  };

  const addInvite = () => setInvites([...invites, { email: '', role: 'Member' }]);
  const handleAddAnother = () => {
    addInvite();
    toast.success('Invite row added');
  };
  const removeInvite = (index) => {
    setInvites(invites.filter((_, i) => i !== index));
    toast.error('Invite row removed');
  };
  const updateInvite = (index, field, value) => {
    const updated = [...invites];
    updated[index][field] = value;
    setInvites(updated);
  };

  return (
    <>
      <div className="row">
        <div className="col-lg-12">
          <div className="member-page-header">
            <div>
              <h2>Settings</h2>
              <p>Manage your account and company preferences</p>
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
            <button className={`tab-btn d-flex align-items-center gap-2 ${activeTab === 'company' ? 'active' : ''}`} onClick={() => setActiveTab('company')}>
              <FiHome /> Company
            </button>
            <button className={`tab-btn d-flex align-items-center gap-2 ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
              <FiUsers /> Users
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
                        <input type="text" className="form-control" value={profile.fullName} onChange={(e) => handleProfileChange('fullName', e.target.value)} disabled={profileLoading} required />
                      </div>
                    </div>
                    <div className="col-lg-6 col-md-6 col-sm-12">
                      <div className="custom-frm-bx">
                        <label>Email</label>
                        <input type="email" className="form-control" value={profile.email} onChange={(e) => handleProfileChange('email', e.target.value)} disabled={profileLoading} required />
                      </div>
                    </div>
                    <div className="col-lg-6 col-md-6 col-sm-12">
                      <div className="custom-frm-bx">
                        <label>Phone</label>
                        <input type="tel" className="form-control" value={profile.phone} onChange={(e) => handleProfileChange('phone', e.target.value)} disabled={profileLoading} />
                      </div>
                    </div>
                    <div className="col-lg-6 col-md-6 col-sm-12">
                      <div className="custom-frm-bx">
                        <label>Company Name</label>
                        <input type="text" className="form-control" value={profile.companyName} onChange={(e) => handleProfileChange('companyName', e.target.value)} disabled={profileLoading} />
                      </div>
                    </div>
                    <div className="col-lg-6 col-md-6 col-sm-12">
                      <div className="custom-frm-bx">
                        <label>Designation</label>
                        <input type="text" className="form-control" value={profile.designation} onChange={(e) => handleProfileChange('designation', e.target.value)} disabled={profileLoading} />
                      </div>
                    </div>
                    <div className="col-lg-6 col-md-6 col-sm-12">
                      <div className="custom-frm-bx">
                        <label>GST Number</label>
                        <input type="text" className="form-control" value={profile.gstNumber} onChange={(e) => handleProfileChange('gstNumber', e.target.value)} disabled={profileLoading} />
                      </div>
                    </div>
                    <div className="col-lg-12 text-end">
                      <button type="submit" className="thm-btn" disabled={savingProfile || profileLoading}><FiSave /> {savingProfile ? 'Saving...' : 'Save Changes'}</button>
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

              {activeTab === 'company' && (
                companyLoading ? <TabLoader /> :
                <form onSubmit={handleSaveCompany}>
                  <div className="row">
                    <div className="col-lg-6 col-md-6 col-sm-12">
                      <div className="custom-frm-bx">
                        <label>Company Name</label>
                        <input type="text" className="form-control" value={company.name} onChange={(e) => handleCompanyChange('name', e.target.value)} disabled={companyLoading} required />
                      </div>
                    </div>
                    <div className="col-lg-6 col-md-6 col-sm-12">
                      <div className="custom-frm-bx">
                        <label>Industry</label>
                        <select className="form-select" value={company.industry} onChange={(e) => handleCompanyChange('industry', e.target.value)} disabled={companyLoading}>
                          <option value="">Select industry</option>
                          <option value="manufacturing">Manufacturing</option>
                          <option value="trading">Trading</option>
                          <option value="logistics">Logistics</option>
                          <option value="retail">Retail</option>
                          <option value="chemicals">Chemicals</option>
                          <option value="electronics">Electronics</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div className="col-lg-6 col-md-6 col-sm-12">
                      <div className="custom-frm-bx">
                        <label>Country</label>
                        <select className="form-select" value={company.country} onChange={(e) => handleCompanyChange('country', e.target.value)} disabled={companyLoading}>
                          <option value="">Select country</option>
                          {countries.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="col-lg-6 col-md-6 col-sm-12">
                      <div className="custom-frm-bx">
                        <label>Timezone</label>
                        <select className="form-select" value={company.timezone} onChange={(e) => handleCompanyChange('timezone', e.target.value)} disabled={companyLoading}>
                          <option value="">Select timezone</option>
                          {timezones.map((tz) => (
                            <option key={tz.value} value={tz.value}>{tz.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="col-lg-12 text-end">
                      <button type="submit" className="thm-btn" disabled={savingCompany || companyLoading}><FiSave /> {savingCompany ? 'Saving...' : 'Save Changes'}</button>
                    </div>
                  </div>
                </form>
              )}

              {activeTab === 'users' && (
                usersLoading ? <TabLoader /> :
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0" style={{ fontSize: 16, fontWeight: 600 }}>Team Members</h5>
                    <button className="thm-btn outline py-2" onClick={handleAddAnother}>
                      <FiPlus size={14} /> Invite Member
                    </button>
                  </div>

                  <div className="table-responsive">
                    <table className="member-table">
                      <thead>
                        <tr>
                          <th>Sr. No.</th>
                          <th>User</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamMembers.map((user, idx) => (
                          <tr key={user.id}>
                            <td>{idx + 1}</td>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <div className="user-avatar" >
                                  {user.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <span style={{ fontWeight: 500 }}>{user.name}</span>
                              </div>
                            </td>
                            <td>{user.email}</td>
                            <td>
                              <span className={`status-badge ${user.role === 'Admin' ? 'confirmed' : 'dispatched'}`}>
                                {user.role}
                              </span>
                            </td>
                            <td>
                              <span className={`status-badge ${user.status === 'Active' ? 'delivered' : 'processing'}`}>
                                {user.status}
                              </span>
                            </td>
                            <td>
                              {user.role !== 'Admin' && (
                                <div className="position-relative" ref={openAction === idx ? actionRef : null}>
                                  <button
                                    className="action-dropdown-btn"
                                    onClick={(e) => { e.stopPropagation(); setOpenAction(openAction === idx ? null : idx); }}
                                  >
                                    Edit <LuChevronDown />
                                  </button>
                                  {openAction === idx && (
                                    <div className="order-dropdown-menu" style={{ right: 0, left: 'auto' }}>
                                      {/* <Link to="#" className="order-dropdown-item" onClick={(e) => { e.preventDefault(); setOpenAction(null); handleEditMember(); }}>
                                        <FiEdit2 /> Edit
                                      </Link> */}
                                      <Link to="#" className="order-dropdown-item" onClick={(e) => { e.preventDefault(); setOpenAction(null); handleToggleStatus(user); }}>
                                        {user.status === 'Active' ? <FiUserX /> : <FiUserCheck />} {user.status === 'Active' ? 'Mark as Inactive' : 'Mark as Active'}
                                      </Link>
                                      <Link to="#" className="order-dropdown-item text-danger" onClick={(e) => { e.preventDefault(); setOpenAction(null); handleRemoveMember(user.id); }}>
                                        <FiTrash2 /> Delete
                                      </Link>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                        {teamMembers.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center text-muted py-3">No team members yet</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {pendingInvites.length > 0 && (
                    <div className="mt-3">
                      <h5 className="mb-3" style={{ fontSize: 16, fontWeight: 600 }}>Pending Invites</h5>
                      {pendingInvites.map((inv, idx) => (
                        <div key={idx} className="d-flex align-items-center gap-3 mb-2">
                          <span style={{ fontSize: 16, fontWeight : 500 }}>{inv.email}</span>
                          <span className="status-badge processing">{inv.role}</span>
                          <button className="remove-line-btn" style={{ width: 28, height: 28 }} onClick={() => handleRevokeInvite(inv.id)}>
                            <FiTrash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3">
                    <h5 className="mb-3" style={{ fontSize: 16, fontWeight: 600 }}>Send New Invites</h5>
                    {invites.map((inv, idx) => (
                      <div key={idx} className="d-flex align-items-center gap-3 mb-2">
                        <div className="custom-frm-bx mb-0 flex-grow-1">
                          <input
                            type="email"
                            className="form-control"
                            placeholder="Enter email address"
                            value={inv.email}
                            onChange={(e) => updateInvite(idx, 'email', e.target.value)}
                          />
                        </div>
                        <div className="custom-frm-bx mb-0" style={{ minWidth: 120 }}>
                          <select
                            className="form-select"
                            value={inv.role}
                            onChange={(e) => updateInvite(idx, 'role', e.target.value)}
                          >
                            <option value="Admin">Admin</option>
                            <option value="Member">Member</option>
                          </select>
                        </div>
                        {invites.length > 1 && (
                          <button className="remove-line-btn" style={{ width: 35, height: 35 }} onClick={() => removeInvite(idx)}>
                            <FiTrash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button className="thm-btn outline py-2 mt-2" onClick={handleAddAnother}>
                      <FiPlus size={14} /> Add Another
                    </button>
                    <div className="text-end mt-3">
                      <button className="thm-btn" onClick={handleSendInvites} disabled={sendingInvites}><FiMail /> {sendingInvites ? 'Sending...' : 'Send Invites'}</button>
                    </div>
                  </div>
                </div>
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
                       <div className="d-flex justify-content-between align-items-center">
                          <div className='details-box'>
                            <h5 className='mb-2'>{item.label}</h5>
                            <h6 className="mb-0">{item.desc}</h6>
                          </div>
                          <div className="theme-switch">
                            <input type="checkbox" id={`admin-switch-${idx}`} checked={notifications[item.key]} onChange={(e) => handleNotificationsChange(item.key, e.target.checked)} disabled={savingNotifications} />
                            <label className="switch-slider" htmlFor={`admin-switch-${idx}`}></label>
                          </div>
                        </div>
                    </div>
                  ))}
                  <div className="col-lg-12 text-end">
                    <button className="thm-btn" onClick={handleSaveNotifications} disabled={savingNotifications}><FiSave /> {savingNotifications ? 'Saving...' : 'Save Preferences'}</button>
                  </div>
                </div>
              )}

              {activeTab === 'connected' && (
                connectedLoading ? <TabLoader /> :
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <div className=" connected-box">
                        <div className="connected-details">
                          <div className="kpi-icon" style={{ background: '#e3f2fd', color: '#1565c0' }}>
                            <FiMail />
                          </div>
                          <div className='details-box'>
                            <h5 className="">Gmail</h5>
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
                  <div className="col-md-6 mb-3">
                   <div className=" connected-box">
                        <div className="connected-details">
                          <div className="kpi-icon" style={{ background: '#f5f5f5', color: '#9e9e9e' }}>
                            <FiMail />
                          </div>
                          <div className='details-box'>
                            <h5 className="">Outlook</h5>
                            <h6 className="mb-0">Not connected</h6>
                          </div>
                        </div>
                        <button className="thm-btn outline">Connect</button>
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
