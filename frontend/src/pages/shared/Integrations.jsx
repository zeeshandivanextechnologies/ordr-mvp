import { useState } from 'react';
import { FiMail, FiRefreshCw, FiCheckCircle, FiClock, FiMessageSquare, FiTruck, FiGrid, FiBriefcase } from 'react-icons/fi';
import '../../styles/member.css';

export default function Integrations() {
  const [gmailConnected, setGmailConnected] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [scanning, setScanning] = useState(false);

  const handleConnect = () => {
    setGmailConnected(!gmailConnected);
  };

  const handleScan = () => {
    if (!gmailConnected) return;
    setScanning(true);
    setTimeout(() => {
      setLastScan('16 Sep 2026, 10:30 AM');
      setScanning(false);
    }, 1500);
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
                {gmailConnected ? 'Connected' : 'Not Connected'}
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
                {gmailConnected && (
                  <div className="col-lg-12 mb-3">
                    <div className="details-box">
                      <h6>Last Scan</h6>
                      <h5>{lastScan || 'Never scanned'}</h5>
                    </div>
                  </div>
                )}
                <div className="col-12">
                  <div className="d-flex gap-2">
                    <button className={`thm-btn ${gmailConnected ? 'outline' : ''}`} onClick={handleConnect}>
                      {gmailConnected ? 'Disconnect' : 'Connect'}
                    </button>
                    <button
                      className="thm-btn outline"
                      onClick={handleScan}
                      disabled={!gmailConnected || scanning}
                    >
                      <FiRefreshCw className={scanning ? 'spinning' : ''} />
                      {scanning ? ' Scanning...' : ' Scan Now'}
                    </button>
                  </div>
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
