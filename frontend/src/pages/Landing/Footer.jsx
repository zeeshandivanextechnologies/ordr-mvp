import { FiGithub, FiInstagram, FiLinkedin, FiMail, FiMapPin, FiPhone, FiTwitter } from "react-icons/fi"
import { Link } from "react-router-dom"
import useContactInfo from "../../hooks/useContactInfo"
import useLandingContent from "../../hooks/useLandingContent"
import { safeUrl } from "../../content/landingContent"

function Footer() {
  // Contact details from the server, the same as on the Contact Us page
  const contact = useContactInfo()
  const CONTACT_EMAIL = contact.email
  const CONTACT_PHONE = contact.phone
  const CONTACT_PHONE_LINK = contact.phoneLink
  // Description, social links and copyright from Website Content (Footer tab)
  const { footer } = useLandingContent().content
  const socials = [
    { key: 'twitter', label: 'Twitter', Icon: FiTwitter },
    { key: 'linkedin', label: 'LinkedIn', Icon: FiLinkedin },
    { key: 'instagram', label: 'Instagram', Icon: FiInstagram },
    { key: 'github', label: 'GitHub', Icon: FiGithub },
  ].map((s) => ({ ...s, href: safeUrl(footer[s.key]) })).filter((s) => s.href)

  return (
    <>
    <footer className="landing-footer">
        <div className="container">
          <div className="row">
            <div className="col-lg-4 col-md-6 mb-4 mb-lg-0">
              <h1 className="footer-brand mb-3">ORDR</h1>
              <p className="footer-desc">{footer.description}</p>
              <div className="footer-social">
                {socials.map(({ key, label, Icon, href }) => (
                  <a key={key} href={href} className="social-link" aria-label={label}
                    {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                    <Icon />
                  </a>
                ))}
              </div>
            </div>
            <div className="col-lg-2 col-md-6 col-6 mb-4 mb-lg-0">
              <h5 className="footer-title">Product</h5>
              <ul className="footer-links list-unstyled">
                <li><a href="/#features">Features</a></li>
                <li><a href="/#pricing">Pricing</a></li>
                <li><a href="/#how-it-works">How It Works</a></li>
                <li><a href="/#testimonials">Testimonials</a></li>
                <li><a href="/#faq">FAQ</a></li>
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
                  <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                </li>
                <li className="footer-contact-item">
                  <FiPhone className="footer-contact-icon" />
                  <a href={CONTACT_PHONE_LINK}>{CONTACT_PHONE}</a>
                </li>
                <li className="footer-contact-item">
                  <FiMapPin className="footer-contact-icon" />
                  <span>{contact.address}</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <div className="row align-items-center">
              <div className="col-md-6 text-center text-md-start">
                <p className="mb-0">{footer.copyright}</p>
              </div>
              <div className="col-md-6 text-center text-md-end ">
                <p className="mb-0 footer-trial-text">Start your <strong>14-day free trial</strong> today. No credit card required.</p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}

export default Footer