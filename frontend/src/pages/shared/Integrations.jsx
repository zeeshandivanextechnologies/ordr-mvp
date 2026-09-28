import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiMail, FiRefreshCw, FiMessageSquare, FiTruck, FiGrid, FiBriefcase } from 'react-icons/fi';
import { toast } from 'react-toastify';
import integrationService from '../../services/integrationService';
import api from '../../services/api';
import { useAuth } from '../../components/AuthProvider';
import '../../styles/member.css';

const formatLastScan = (value) => {
  if (!value) return 'Never scanned';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function Integrations() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [gmailConnected, setGmailConnected] = useState(false);
  const [connection, setConnection] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [autoScanMinutes, setAutoScanMinutes] = useState(null);
  // All connected inboxes (Business / Pro plans allow several) and the plan's inbox limit
  const [allConnections, setAllConnections] = useState([]);
  const [inboxLimit, setInboxLimit] = useState(null);
  const loadedRef = useRef(false);

  const applyStatus = (res) => {
    const conn = res.connection || null;
    setGmailConnected(res.connected);
    setConnection(conn);
    setLastScan(conn?.last_scan_at || null);
    setAllConnections(res.connections || (conn ? [conn] : []));
    setAutoScanMinutes(res.autoScanMinutes || null);
  };

  const reloadStatus = () =>
    integrationService
      .getGmailStatus()
      .then(applyStatus)
      .catch(() => toast.error('Failed to load integration status'));

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const params = new URLSearchParams(location.search);
    if (params.get('success')) {
      toast.success('Gmail connected successfully!');
      navigate('/app/integrations', { replace: true });
    } else if (params.get('error')) {
      toast.error(params.get('error') || 'Failed to connect Gmail');
      navigate('/app/integrations', { replace: true });
    }

    reloadStatus().finally(() => setStatusLoading(false));
    api
      .get('/billing')
      .then((res) => setInboxLimit(res.data?.limits?.gmailInboxes ?? null))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, navigate]);

  // null limit = unlimited (e.g. during the trial)
  const canConnectMore = inboxLimit === null || allConnections.length < inboxLimit;
  const otherConnections = allConnections.filter((c) => c.id !== connection?.id);

  const handleDisconnectOne = async (conn) => {
    if (!window.confirm(`Disconnect Gmail (${conn.email})? Emails already collected will be kept.`)) return;
    try {
      await integrationService.disconnectGmail(conn.id);
      toast.success(`${conn.email} disconnected`);
      await reloadStatus();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to disconnect Gmail');
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await integrationService.getGmailConnectUrl('/app/integrations');
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start connection process');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    if (!window.confirm(`Disconnect Gmail (${connection.email})? Emails already collected will be kept.`)) return;
    try {
      await integrationService.disconnectGmail(connection.id);
      toast.success('Gmail disconnected');
      await reloadStatus();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to disconnect Gmail');
    }
  };

  const handleScan = async () => {
    if (!gmailConnected) return;
    setScanning(true);
    try {
      const res = await integrationService.scanInbox();
      setLastScan(res.connection?.last_scan_at || new Date().toISOString());
      if (Array.isArray(res.connections)) setAllConnections(res.connections);
      // Inboxes that could not be scanned (e.g. access removed) while others worked
      (res.errors || []).forEach((e) => toast.warning(`${e.email}: ${e.message}`));
      if (res.potentialOrders > 0) {
        toast.success(
          `Scan complete: ${res.potentialOrders} potential order${res.potentialOrders > 1 ? 's' : ''} detected. AI is reviewing them; results will appear in the AI Order Inbox shortly.`
        );
      } else if (res.newMessages > 0) {
        toast.success(`Scan complete: ${res.newMessages} new email${res.newMessages > 1 ? 's' : ''} found`);
      } else {
        toast.info(`Scan complete: no new emails (${res.scanned} already up to date)`);
      }
      if (res.hasMore) {
        toast.info('More emails are waiting. Click "Scan Now" again to continue.');
      }
    } catch (err) {
      if (err.response?.data?.code === 'GMAIL_RECONNECT_REQUIRED') {
        // Backend marked the connection inactive; refresh so the Connect button shows again
        reloadStatus();
      }
      toast.error(err.response?.data?.error || 'Failed to scan inbox');
    } finally {
      setScanning(false);
    }
  };

  const comingSoonIntegrations = [
    { name: 'Outlook', icon: <FiMail />, description: 'Email integration with Microsoft Outlook' },
    { name: 'WhatsApp', icon: <FiMessageSquare />, description: 'Messaging integration with WhatsApp Business' },
    { name: 'Logistics', icon: <FiTruck />, description: 'Direct logistics partner integrations' },
    { name: 'Tally', icon: <FiGrid />, description: 'Accounting integration with Tally ERP' },
    { name: 'ERP', icon: <FiBriefcase />, description: 'Enterprise resource planning system integration' },
  ];

  return (
    <>
      <div className="row">
        <div className="col-lg-12">
          <div className="member-page-header">
            <div>
              <h2>Integrations</h2>
              <p>Connect your email and other services</p>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-6 mb-3">
          <div className="member-card">
            <div className="member-card-header">
              <h5>Gmail Integration</h5>
              <span className={`status-badge ${gmailConnected ? 'dispatched' : ''}`}>
                {statusLoading ? 'Checking...' : gmailConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <div className="member-card-body">
              <div className="row">
                <div className="col-lg-12">
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <div className="kpi-icon" style={{ background: '#e3f2fd', color: '#1565c0' }}>
                      <FiMail />
                    </div>
                    <div className='integration-box'>
                      <h6 className="">Gmail</h6>
                      <p className="">Sync emails and detect orders automatically</p>
                    </div>
                  </div>
                </div>
                {gmailConnected && connection && (
                  <div className="col-lg-12 mb-3">
                    <div className="row">
                      <div className="col-md-6 mb-3 mb-md-0">
                        <div className="details-box">
                          <h6>Connected Email</h6>
                          <h5>{connection.email || '—'}</h5>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="details-box">
                          <h6>Last Scan</h6>
                          <h5>{lastScan ? formatLastScan(lastScan) : 'Never scanned'}</h5>
                          {autoScanMinutes && (
                            <small className="text-muted">Auto-scans every {autoScanMinutes} min</small>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {otherConnections.length > 0 && (
                  <div className="col-lg-12 mb-3">
                    <h6 className="mb-2">Other connected inboxes</h6>
                    {otherConnections.map((c) => (
                      <div key={c.id} className="details-box d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                        <div>
                          <h5 className="mb-0">{c.email}</h5>
                          <small className="text-muted">Last scan: {c.last_scan_at ? formatLastScan(c.last_scan_at) : 'Never scanned'}</small>
                        </div>
                        {isAdmin && (
                          <button className="thm-btn outline py-1 px-3" style={{ fontSize: 14 }} onClick={() => handleDisconnectOne(c)}>
                            Disconnect
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="col-12">
                  {isAdmin ? (
                    <div className="d-flex gap-2 flex-wrap">
                      <button className={`thm-btn ${gmailConnected ? 'outline' : ''}`} onClick={gmailConnected ? handleDisconnect : handleConnect} disabled={connecting || statusLoading}>
                        {connecting ? 'Connecting...' : (gmailConnected ? 'Disconnect' : 'Connect')}
                      </button>
                      <button
                        className="thm-btn outline"
                        onClick={handleScan}
                        disabled={!gmailConnected || scanning || statusLoading}
                      >
                        <FiRefreshCw className={scanning ? 'spinning' : ''} />
                        {scanning ? ' Scanning...' : ' Scan Now'}
                      </button>
                      {gmailConnected && canConnectMore && (
                        <button className="thm-btn outline" onClick={handleConnect} disabled={connecting || statusLoading}>
                          {connecting ? 'Connecting...' : '+ Connect another Gmail'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="mb-0 text-muted">Only admins can connect, disconnect or scan Gmail.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-6 mb-3">
          <div className="member-card disabled-card">
            <div className="member-card-header">
              <h5>Outlook Integration</h5>
              <span className="coming-soon-badge">Coming Soon</span>
            </div>
            <div className="member-card-body">
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="kpi-icon" style={{ background: '#e8eaf6', color: '#5c6bc0' }}>
                  <FiMail />
                </div>
                <div className='integration-box'>
                  <h6 className="">Outlook</h6>
                  <p className="">Sync emails from Microsoft Outlook</p>
                </div>
              </div>
              <button className="thm-btn" disabled>Connect</button>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-12 mb-3">
          <h5>More Integrations</h5>
        </div>
      </div>

      <div className="row">
        {comingSoonIntegrations.map((integration, index) => (
          <div key={index} className="col-lg-4 col-md-6 mb-3">
            <div className="member-card h-100 disabled-card">
              <div className="member-card-body">
                <div className="d-flex align-items-start gap-3">
                  <div className="kpi-icon" style={{ background: '#201d6a14', color: '#201d6a' }}>
                    {integration.icon}
                  </div>
                  <div className='integration-box'>
                    <h6 className="">{integration.name}</h6>
                    <p className="mb-0">{integration.description}</p>
                  </div>
                  <span className="coming-soon-badge ms-auto">Coming Soon</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}