import { Link } from 'react-router-dom';
import { FiHome, FiAlertTriangle } from 'react-icons/fi';
import '../styles/member.css';

export default function NotFound() {
  return (
    <div className="error-page">
      <div className="text-center">
        <div className="error-icon mb-4">
          <FiAlertTriangle />
        </div>
        <h1 className="error-code">404</h1>
        <h3 className="mb-2">Page Not Found</h3>
        <p className="text-muted mb-4">The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/member/dashboard" className="thm-btn">
          <FiHome /> Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
