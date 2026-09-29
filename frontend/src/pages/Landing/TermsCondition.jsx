import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiFileText, FiMail, FiArrowLeft } from 'react-icons/fi';
import { useAuth } from '../../components/AuthProvider';
import '../../styles/landing.css';
import '../../styles/legal.css';
import useLegalContent from '../../hooks/useLegalContent';
import LegalSections from './LegalSections';
import Footer from './Footer';

export default function TermsCondition() {
  const { user } = useAuth();
  // Title, sections and contact box from Website Content > CMS (built-in text until edited)
  const content = useLegalContent('terms');

  // Start at the top when coming from a long page (e.g. the landing page footer)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="landing-wrapper legal-page">
      <nav className="landing-nav">
        <div className="container d-flex justify-content-between align-items-center">
          <Link to="/" className="brandTitle text-decoration-none">ORDR</Link>
          <div className="d-flex gap-3">
            {user ? (
              <Link to="/app/dashboard" className="thm-btn">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="thm-btn outline">Login</Link>
                <Link to="/signup" className="thm-btn">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <header className="legal-hero">
        <div className="container">
          <div className="legal-hero-icon"><FiFileText /></div>
          <h1 className="new-section-title">{content.title}</h1>
          <p className="section-subtitle mb-2">{content.subtitle}</p>
          <span className="legal-updated">Last updated: {content.lastUpdated}</span>
        </div>
      </header>

      <main className="legal-body">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <article className="legal-card">
                <LegalSections sections={content.sections} />

                <div className="legal-contact-box">
                  <FiMail className="legal-contact-icon" />
                  <div>
                    <div className="legal-contact-title">{content.contactTitle}</div>
                    <a href={`mailto:${content.contactEmail}`}>{content.contactEmail}</a>
                  </div>
                </div>
              </article>

              <Link to="/" className="legal-back-link">
                <FiArrowLeft /> Back to home
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer/>
    </div>
  );
}
