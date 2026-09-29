import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiMessageSquare, FiMail, FiPhone, FiMapPin, FiClock, FiSend, FiCheckCircle, FiArrowLeft,
} from 'react-icons/fi';
import api from '../../services/api';
import { useAuth } from '../../components/AuthProvider';
import useContactInfo from '../../hooks/useContactInfo';
import '../../styles/landing.css';
import '../../styles/legal.css';
import Footer from './Footer';

// Empty form; the topic starts on the first topic from the server
const EMPTY_FORM = { name: '', email: '', company: '', phone: '', topic: '', message: '', website: '' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// First problem with the form, so the visitor knows exactly which field to fix
const findFormError = (form) => {
  if (!form.name.trim()) return { field: 'name', message: 'Please enter your name.' };
  if (!form.email.trim()) return { field: 'email', message: 'Please enter your work email.' };
  if (!EMAIL_RE.test(form.email.trim())) return { field: 'email', message: 'Please enter a valid email address, e.g. you@company.com.' };
  if (!form.message.trim()) return { field: 'message', message: 'Please write your message.' };
  return null;
};

export default function ContactUs() {
  const { user } = useAuth();
  // Email, phone, office, hours and topics come from the server (GET /api/contact/info)
  const contact = useContactInfo();
  const TOPICS = contact.topics;
  const CONTACT_EMAIL = contact.email;
  const CONTACT_ITEMS = [
    { icon: <FiMail />, title: 'Email us', text: contact.email, href: `mailto:${contact.email}` },
    { icon: <FiPhone />, title: 'Call us', text: contact.phone, href: contact.phoneLink },
    { icon: <FiMapPin />, title: 'Office', text: contact.address },
    { icon: <FiClock />, title: 'Working hours', text: contact.hours },
  ];
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Start at the top when coming from a long page (e.g. the landing page footer)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Field highlighted in red after a failed send (cleared as soon as it is edited)
  const [invalidField, setInvalidField] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (invalidField === name) setInvalidField(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = findFormError(form);
    if (problem) {
      setInvalidField(problem.field);
      toast.error(problem.message);
      document.getElementById(`contact-${problem.field}`)?.focus();
      return;
    }
    setSending(true);
    try {
      const res = await api.post('/contact', { ...form, topic: form.topic || TOPICS[0] });
      toast.success(res.data.message || 'Thanks! We will get back to you soon.');
      setForm(EMPTY_FORM);
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.message || `Your message could not be sent. Please email us at ${CONTACT_EMAIL}.`);
    } finally {
      setSending(false);
    }
  };

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
          <div className="legal-hero-icon"><FiMessageSquare /></div>
          <h1 className="new-section-title">Contact Us</h1>
          <p className="section-subtitle mb-2">Questions, a product demo or help with your account? We usually reply within one business day.</p>
        </div>
      </header>

      <main className="legal-body">
        <div className="container">
          <div className="row">
            <div className="col-lg-5 col-md-12 mb-3">
              <div className="legal-card h-100">
                <h2 className="legal-section-title">Get in touch</h2>
                <p className="contact-intro">Reach the ORDR team directly, or send us a message and we will get back to you.</p>
                <ul className="contact-info-list list-unstyled mb-0">
                  {CONTACT_ITEMS.map((item) => (
                    <li key={item.title} className="contact-info-item">
                      <span className="contact-info-icon">{item.icon}</span>
                      <div>
                        <div className="contact-info-title">{item.title}</div>
                        {item.href ? <a href={item.href}>{item.text}</a> : <span className="contact-info-text">{item.text}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="legal-contact-box">
                  <FiCheckCircle className="legal-contact-icon" />
                  <div>
                    <div className="legal-contact-title">Already using ORDR?</div>
                    <span className="contact-info-text">For account help, include your company name so we can find you quickly.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-7 col-md-12">
              <div className="legal-card h-100">
                <h2 className="legal-section-title">Send us a message</h2>
                {sent && (
                  <div className="contact-success">
                    <FiCheckCircle /> <span>Thanks! Your message has been sent. We will get back to you soon.</span>
                  </div>
                )}
                <form onSubmit={handleSubmit} noValidate>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="custom-frm-bx">
                        <label htmlFor="contact-name">Full name *</label>
                        <input id="contact-name" name="name" type="text" className={`form-control${invalidField === 'name' ? ' is-invalid' : ''}`} value={form.name} onChange={handleChange} placeholder="Your name" maxLength={100} required />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="custom-frm-bx">
                        <label htmlFor="contact-email">Work email *</label>
                        <input id="contact-email" name="email" type="email" className={`form-control${invalidField === 'email' ? ' is-invalid' : ''}`} value={form.email} onChange={handleChange} placeholder="you@company.com" maxLength={200} required />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="custom-frm-bx">
                        <label htmlFor="contact-company">Company</label>
                        <input id="contact-company" name="company" type="text" className="form-control" value={form.company} onChange={handleChange} placeholder="Company name" maxLength={150} />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="custom-frm-bx">
                        <label htmlFor="contact-phone">Phone</label>
                        <input id="contact-phone" name="phone" type="tel" className="form-control" value={form.phone} onChange={handleChange} placeholder="+91" maxLength={30} />
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="custom-frm-bx">
                        <label htmlFor="contact-topic">Topic</label>
                        <select id="contact-topic" name="topic" className="form-select" value={form.topic || TOPICS[0]} onChange={handleChange}>
                          {TOPICS.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="custom-frm-bx">
                        <label htmlFor="contact-message">Message *</label>
                        <textarea id="contact-message" name="message" className={`form-control${invalidField === 'message' ? ' is-invalid' : ''}`} rows={6} value={form.message} onChange={handleChange} placeholder="How can we help?" maxLength={5000} required />
                      </div>
                    </div>
                    {/* Spam trap: hidden from people, often filled in by bots */}
                    <div className="contact-trap" aria-hidden="true">
                      <label htmlFor="contact-website">Website</label>
                      <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={handleChange} />
                    </div>
                  </div>
                  <button type="submit" className="thm-btn contact-submit" disabled={sending}>
                    <FiSend /> {sending ? 'Sending...' : 'Send Message'}
                  </button>
                  <p className="contact-note">
                    By sending this form you agree to our <Link to="/privacy-policy">Privacy Policy</Link>.
                  </p>
                </form>
              </div>
            </div>
          </div>

          <Link to="/" className="legal-back-link">
            <FiArrowLeft /> Back to home
          </Link>
        </div>
      </main>

      <Footer/>
    </div>
  );
}
