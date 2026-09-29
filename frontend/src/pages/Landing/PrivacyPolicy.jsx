import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiShield, FiMail, FiArrowLeft, FiTwitter, FiLinkedin, FiInstagram, FiGithub, FiPhone, FiMapPin } from 'react-icons/fi';
import { useAuth } from '../../components/AuthProvider';
import '../../styles/landing.css';
import '../../styles/legal.css';
import useLegalContent from '../../hooks/useLegalContent';
import LegalSections from './LegalSections';

export default function PrivacyPolicy() {
  const { user } = useAuth();
  // Title, sections and contact box from Website Content > CMS (built-in text until edited)
  const content = useLegalContent('privacy');

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
          <div className="legal-hero-icon"><FiShield /></div>
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

      <footer className="landing-footer">
              <div className="container">
                <div className="row">
                  <div className="col-lg-4 col-md-6 mb-4 mb-lg-0">
                    <h1 className="footer-brand mb-3">ORDR</h1>
                    <p className="footer-desc">Every business order. One place. Track, manage, deliver, and grow your B2B operations with ease.</p>
                    <div className="footer-social">
                      <a href="#" className="social-link" aria-label="Twitter"><FiTwitter /></a>
                      <a href="#" className="social-link" aria-label="LinkedIn"><FiLinkedin /></a>
                      <a href="#" className="social-link" aria-label="Instagram"><FiInstagram /></a>
                      <a href="#" className="social-link" aria-label="GitHub"><FiGithub /></a>
                    </div>
                  </div>
                  <div className="col-lg-2 col-md-6 col-6 mb-4 mb-lg-0">
                    <h5 className="footer-title">Product</h5>
                    <ul className="footer-links list-unstyled">
                      <li><a href="#features">Features</a></li>
                      <li><a href="#pricing">Pricing</a></li>
                      <li><a href="#how-it-works">How It Works</a></li>
                      <li><a href="#testimonials">Testimonials</a></li>
                      <li><a href="#faq">FAQ</a></li>
                    </ul>
                  </div>
                  <div className="col-lg-2 col-md-6 col-6 mb-4 mb-lg-0">
                    <h5 className="footer-title">Company</h5>
                    <ul className="footer-links list-unstyled">
                      <li><a href="#">About Us</a></li>
                      <li><a href="#">Careers</a></li>
                      <li><a href="#">Blog</a></li>
                      <li><Link to="/contact-us">Contact</Link></li>
                    </ul>
                  </div>
                  <div className="col-lg-2 col-md-6 col-6 mb-4 mb-lg-0">
                    <h5 className="footer-title">Legal</h5>
                    <ul className="footer-links list-unstyled">
                      <li><Link to="/terms-and-conditions">Terms of Service</Link></li>
                      <li><Link to="/privacy-policy">Privacy Policy</Link></li>
                      <li><a href="#">Cookie Policy</a></li>
                      <li><Link to="/refund-policy">Refund Policy</Link></li>
                    </ul>
                  </div>
                  <div className="col-lg-2 col-md-6 col-6">
                    <h5 className="footer-title">Contact</h5>
                    <ul className="footer-links list-unstyled">
                      <li className="footer-contact-item">
                        <FiMail className="footer-contact-icon" />
                        <a href="mailto:hello@ordr.in">hello@ordr.in</a>
                      </li>
                      <li className="footer-contact-item">
                        <FiPhone className="footer-contact-icon" />
                        <a href="tel:+919876543210">+91 98765 43210</a>
                      </li>
                      <li className="footer-contact-item">
                        <FiMapPin className="footer-contact-icon" />
                        <span>Mumbai, India</span>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="footer-bottom">
                  <div className="row align-items-center">
                    <div className="col-md-6 text-center text-md-start">
                      <p className="mb-0">&copy; 2026 ORDR Technologies. All rights reserved.</p>
                    </div>
                    <div className="col-md-6 text-center text-md-end ">
                      <p className="mb-0 footer-trial-text">Start your <strong>14-day free trial</strong> today. No credit card required.</p>
                    </div>
                  </div>
                </div>
              </div>
            </footer>
    </div>
  );
}
