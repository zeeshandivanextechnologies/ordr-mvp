import '../styles/member.css';

export default function PageLoader() {
  return (
    <div className="page-loader">
      <div className="loader-content">
        <div className="loader-circle">
          <div className="loader-circle-segment"></div>
          <div className="loader-circle-segment"></div>
          <div className="loader-circle-segment"></div>
        </div>
        <div className="loader-brand">
          {/* <span className="loader-logo">O</span>
          <span className="loader-dash">—</span> */}
          <span className="loader-name">ORDR</span>
        </div>
      </div>
    </div>
  );
}
