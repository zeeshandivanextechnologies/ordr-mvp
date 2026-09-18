import '../styles/member.css';
import '../styles/loader.css';

export default function PageLoader() {
  return (
    <div className="premium-page-loader">
      <div className="premium-loader-content">
        <div className="premium-loader-ring">
          <div className="premium-inner-dot"></div>
        </div>
        <div className="premium-loader-brand">
          <span className="premium-loader-name">ORDR</span>
        </div>
      </div>
    </div>
  );
}
