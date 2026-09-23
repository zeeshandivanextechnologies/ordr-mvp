import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiMail, FiCpu, FiTruck, FiCheckCircle, FiChevronDown, FiUpload, FiEdit3, FiFileText, FiUsers, FiBarChart2, FiShield, FiZap, FiClock, FiStar, FiTwitter, FiLinkedin, FiGithub, FiInstagram, FiPhone, FiMapPin } from 'react-icons/fi';
import Splide from '@splidejs/splide';
import '@splidejs/splide/css';
import useCounter from '../hooks/useCounter';
import { useAuth } from '../components/AuthProvider';
import '../styles/landing.css';

function StatCounter({ end, suffix = '', duration = 2000 }) {
  const { count, ref } = useCounter(end, duration);
  return <span ref={ref}>{count}{suffix}</span>;
}

export default function Home() {
  const { user, loading } = useAuth();
  const splideRef = useRef(null);

  useEffect(() => {
    if (splideRef.current) {
      const splide = new Splide(splideRef.current, {
        type: 'loop',
        perPage: 3,
        perMove: 1,
        gap: '24px',
        focus: 'center',
        autoplay: true,
        interval: 4000,
        pauseOnHover: true,
        arrows: false,
        pagination: true,
        breakpoints: {
          991: {
            perPage: 2,
            focus: 'center',
          },
          767: {
            perPage: 1,
            focus: 'center',
          },
        },
      });

      splide.mount();

      return () => {
        splide.destroy();
      };
    }
  }, []);

  const faqData = [
    {
      id: 'faq1',
      question: 'What is ORDR and how does it work?',
      answer: 'ORDR is a B2B order-tracking platform that helps businesses manage sales orders, purchase orders, shipments, and deliveries from a single dashboard. Simply connect your Gmail, and our AI will automatically detect and extract order details from incoming emails.'
    },
    {
      id: 'faq2',
      question: 'Is my email data secure with ORDR?',
      answer: 'Yes, absolutely. We use industry-standard encryption and OAuth to connect to your Gmail. We only request read-only access and scan emails that match order-related criteria. Your personal communications are never stored or accessed.'
    },
    {
      id: 'faq3',
      question: 'How does the AI order extraction work?',
      answer: 'Our AI reads your order emails and automatically extracts key information like PO numbers, items, quantities, delivery dates, and order values. You review the extracted data before confirming — AI never creates orders without your approval.'
    },
    {
      id: 'faq4',
      question: 'Can I upload PDF or Excel files instead of connecting Gmail?',
      answer: 'Yes! ORDR supports multiple order input methods. You can upload PDF, Excel, CSV, JPG, or PNG files. Our AI will extract order data from these documents just like it does with emails. You can also add orders manually.'
    },
    {
      id: 'faq5',
      question: 'Does it integrate with my ERP or Tally?',
      answer: 'Currently, ORDR is a standalone B2B tracking platform designed for simplicity in Phase 1. ERP, SAP, Tally, WhatsApp, and logistics integrations are on our roadmap for upcoming phases.'
    },
    {
      id: 'faq6',
      question: 'Can I invite my team members?',
      answer: 'Yes! During onboarding or anytime from Settings, you can invite your warehouse managers, sales team, and support staff. Admins can manage user roles and control access levels.'
    },
    {
      id: 'faq7',
      question: 'What is partial shipment tracking?',
      answer: 'ORDR supports partial shipments out of the box. If you order 10 MT and ship 6 MT first, the system automatically tracks dispatched quantity, balance, and updates order status accordingly. You can add multiple shipments per order.'
    },
    {
      id: 'faq8',
      question: 'How does the 14-day free trial work?',
      answer: 'You get full access to all core features for 14 days — including Gmail integration, AI extraction, order tracking, and team collaboration. No credit card required. After trial, choose a plan that fits your business.'
    },
    {
      id: 'faq9',
      question: 'What happens if I exceed my plan limits?',
      answer: 'We\'ll notify you before you reach your limits. You can upgrade your plan anytime from Settings. Your data is never deleted — you just won\'t be able to create new orders until you upgrade or wait for the next billing cycle.'
    },
    {
      id: 'faq10',
      question: 'Can I track shipments in real-time?',
      answer: 'Yes! ORDR provides real-time shipment tracking with LR/AWB numbers, route information, ETA, and status updates. You\'ll also get smart alerts for delays, overdue deliveries, and missing tracking information.'
    }
  ];

  const testimonialsData = [
    {
      id: 1,
      name: 'Rajesh Kumar',
      role: 'Operations Manager',
      company: 'TechSupply Co.',
      image: 'https://randomuser.me/api/portraits/men/32.jpg',
      rating: 5,
      text: 'Before ORDR, we had 3 people just reading emails and typing orders into Excel. Now, the AI does it instantly. '
    },
    {
      id: 2,
      name: 'Priya Sharma',
      role: 'Founder',
      company: 'BuildFast Logistics',
      image: 'https://randomuser.me/api/portraits/women/44.jpg',
      rating: 5,
      text: 'The Gmail integration is flawless. We never miss an order from our B2B clients anymore. Tracking everything in one dashboard is a game changer.'
    },
    {
      id: 3,
      name: 'Amit Patel',
      role: 'Supply Chain Head',
      company: 'ChemTrade Ltd.',
      image: 'https://randomuser.me/api/portraits/men/45.jpg',
      rating: 5,
      text: 'Partial shipment tracking was a nightmare before ORDR. Now the system automatically calculates dispatched vs balance quantities.'
    },
    {
      id: 4,
      name: 'Neha Gupta',
      role: 'Director',
      company: 'Vertex Distributors',
      image: 'https://randomuser.me/api/portraits/women/68.jpg',
      rating: 5,
      text: 'The alerts for overdue orders and missing tracking numbers have reduced our delivery delays by 40%. '
    },
    {
      id: 5,
      name: 'Vikram Singh',
      role: 'Logistics Manager',
      company: 'Pacific Exports',
      image: 'https://randomuser.me/api/portraits/men/75.jpg',
      rating: 5,
      text: 'We switched from a complicated ERP to ORDR. The simplicity and AI-powered extraction saves us hours every day. '
    },
    {
      id: 6,
      name: 'Meera Joshi',
      role: 'Procurement Head',
      company: 'Star Industries',
      image: 'https://randomuser.me/api/portraits/women/33.jpg',
      rating: 5,
      text: 'Managing 200+ supplier orders monthly was chaotic. ORDR brought everything to one place. The dashboard  into all open orders.'
    }
  ];

  return (
    <div className="landing-wrapper">
      <nav className="landing-nav">
        <div className="container d-flex justify-content-between align-items-center">
          <Link to="/" className="brandTitle text-decoration-none">ORDR</Link>
          <div className="d-none d-md-flex align-items-center gap-3">
            <a href="#features" className="nav-link-custom ">Features</a>
            <a href="#how-it-works" className="nav-link-custom ">How It Works</a>
            <a href="#pricing" className="nav-link-custom">Pricing</a>
            <a href="#faq" className="nav-link-custom">FAQ</a>
          </div>
          <div className="d-flex gap-3">
            {loading ? null : user ? (
              <Link to="/app/dashboard" className="thm-btn">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="thm-btn outline  ">Login</Link>
                <Link to="/signup" className="thm-btn ">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </nav>


      <section className="hero-section">
        <div className="container">
        <div className='row'>
          <div className='col-lg-12'>
              <div className="hero-badge">
            <FiZap className="hero-badge-icon" />
            <span>Trusted by 500+ B2B businesses</span>
          </div>
          <h1 className="hero-title">Every business order.<br/><span>One place.</span></h1>
          <p className="hero-subtitle">Automate your order tracking. Connect your Gmail, let AI extract the details, and manage everything seamlessly from dispatch to delivery.</p>
          <div className="hero-btn-group">
            <Link to="/signup" className="thm-btn">Start for Free</Link>
            <a href="#features" className="thm-btn outline ">Learn More</a>
          </div>

          </div>

        </div>



          <div className="stats-wrapper">
          <div className="row text-center">
            <div className="col-md-4 stat-box">
              <h3><StatCounter end={500} suffix="+" /></h3>
              <p>Businesses Onboarded</p>
            </div>
            <div className="col-md-4 stat-box">
              <h3><StatCounter end={1} suffix="M+" duration={1500} /></h3>
              <p>Orders Tracked</p>
            </div>
            <div className="col-md-4 stat-box">
              <h3><StatCounter end={98} suffix="%" duration={1800} /></h3>
              <p>On-time Deliveries</p>
            </div>
          </div>
        </div>


        </div>


        


      </section>



      {/* Order Input Methods */}
      <section className="input-methods-section">
        <div className="container">
          <div className="text-center">
            <h2 className="new-section-title">3 Ways to Get Your Orders In</h2>
            <p className="section-subtitle">Choose the method that works best for your business.</p>
          </div>
          <div className="row g-4">
            <div className="col-lg-4 col-md-6">
              <div className="input-method-card">
                <div className="input-method-icon"><FiMail /></div>
                <h4>Gmail Integration</h4>
                <p>Connect your work email and let AI automatically detect and extract order details from incoming emails.</p>
                <div className="input-method-tag">Recommended</div>
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="input-method-card">
                <div className="input-method-icon"><FiUpload /></div>
                <h4>Upload Documents</h4>
                <p>Upload PDF, Excel, CSV, or images. Our AI reads and extracts all order information automatically.</p>
                <div className="input-method-tag">PDF, XLSX, CSV, JPG, PNG</div>
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="input-method-card">
                <div className="input-method-icon"><FiEdit3 /></div>
                <h4>Manual Entry</h4>
                <p>Add orders manually with our simple form. Perfect for phone orders or one-time purchases.</p>
                <div className="input-method-tag">Full Control</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="container">
          <div className="text-center">
            <h2 className="new-section-title">How ORDR Works</h2>
            <p className="section-subtitle">A seamless workflow designed to eliminate manual data entry.</p>
          </div>
          <div className="row g-4">
            <div className="col-lg-3 col-md-6">
              <div className="feature-card">
                <div className="feature-icon"><FiMail /></div>
                <h4>1. Connect Gmail</h4>
                <p>Simply connect your work email. ORDR automatically scans for incoming order receipts and invoices.</p>
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="feature-card">
                <div className="feature-icon"><FiCpu /></div>
                <h4>2. AI Extraction</h4>
                <p>Our smart AI reads the emails and instantly extracts PO numbers, items, quantities, and dates.</p>
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="feature-card">
                <div className="feature-icon"><FiCheckCircle /></div>
                <h4>3. Review & Confirm</h4>
                <p>Quickly review the extracted data. Confirm or edit details before they become official tracking orders.</p>
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="feature-card">
                <div className="feature-icon"><FiTruck /></div>
                <h4>4. Track Delivery</h4>
                <p>Monitor shipments in real-time. Keep your clients updated and ensure smooth, on-time deliveries.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Detailed Features */}
      <section id="how-it-works" className="detailed-features-section">
        <div className="container">
          <div className="text-center">
            <h2 className="new-section-title">Everything You Need to Manage Orders</h2>
            <p className="section-subtitle">Powerful features designed for B2B businesses.</p>
          </div>
          <div className="row g-4">
            <div className="col-lg-4 col-md-6">
              <div className="detail-feature-card">
                <div className="detail-feature-icon"><FiCpu /></div>
                <h5>AI-Powered Extraction</h5>
                <p>Smart AI reads emails and documents, extracting PO numbers, items, quantities, and delivery dates with high accuracy.</p>
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="detail-feature-card">
                <div className="detail-feature-icon"><FiBarChart2 /></div>
                <h5>Executive Dashboard</h5>
                <p>Real-time KPIs: open orders, order value, delayed shipments, and due-this-week alerts at a glance.</p>
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="detail-feature-card">
                <div className="detail-feature-icon"><FiTruck /></div>
                <h5>Partial Shipment Tracking</h5>
                <p>Track multiple shipments per order. System automatically calculates dispatched, delivered, and balance quantities.</p>
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="detail-feature-card">
                <div className="detail-feature-icon"><FiClock /></div>
                <h5>Smart Alerts</h5>
                <p>Automated notifications for overdue orders, stale shipments, missing tracking numbers, and delivery deadlines.</p>
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="detail-feature-card">
                <div className="detail-feature-icon"><FiUsers /></div>
                <h5>Team Collaboration</h5>
                <p>Invite your warehouse managers, sales team, and support staff. Control who sees what with admin and member roles.</p>
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="detail-feature-card">
                <div className="detail-feature-icon"><FiShield /></div>
                <h5>Secure & Private</h5>
                <p>Your data is isolated and encrypted. Each company only sees their own orders. Read-only Gmail access.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="pricing-section">
        <div className="container">
          <div className="text-center mb-lg-5 mb-0">
            <h2 className="new-section-title">Simple, Transparent Pricing</h2>
            <p className="section-subtitle">Start free for 14 days. No credit card required.</p>
          </div>
          <div className="row justify-content-center">
            <div className="col-lg-3 col-md-6 mb-3">
              <div className="pricing-card-new">
              <div>
                  <div className="pricing-card-icon-new">
                  <FiMail />
                </div>
                <h5 className="pricing-plan-name-new">Starter</h5>
                <div className="pricing-amount-new">
                  <span className="pricing-free-new">Free</span>
                  <span className="pricing-period-new">forever</span>
                </div>
                <p className="pricing-desc-new">Perfect for exploring business engagement</p>
                <ul className="pricing-features-new">
                  <li><FiCheckCircle className="pricing-check-new" /> 2 users</li>
                  <li><FiCheckCircle className="pricing-check-new" /> 50 orders/month</li>
                  <li><FiCheckCircle className="pricing-check-new" /> 1 Gmail inbox</li>
                  <li><FiCheckCircle className="pricing-check-new" /> 25 AI extractions</li>
                  <li><FiCheckCircle className="pricing-check-new" /> 3 months history</li>
                </ul>
              </div>
                <div>
                  <Link to="/signup" className="thm-btn outline w-100">Get Started Free</Link>
                </div>
              </div>
            </div>
            <div className="col-lg-3 col-md-6 mb-3">
              <div className="pricing-card-new pricing-popular-new">
               <div>
                 <div className="pricing-badge-new">Most Popular</div>
                <div className="pricing-card-icon-new">
                  <FiZap />
                </div>
                <h5 className="pricing-plan-name-new">Professional</h5>
                <div className="pricing-amount-new">
                  <span className="pricing-currency-new">₹</span>
                  <span className="pricing-value-new">999</span>
                  <span className="pricing-period-new">/month</span>
                </div>
                <p className="pricing-desc-new">For growing businesses</p>
                <ul className="pricing-features-new">
                  <li><FiCheckCircle className="pricing-check-new" /> 5 users</li>
                  <li><FiCheckCircle className="pricing-check-new" /> 200 orders/month</li>
                  <li><FiCheckCircle className="pricing-check-new" /> 1 Gmail inbox</li>
                  <li><FiCheckCircle className="pricing-check-new" /> 150 AI extractions</li>
                  <li><FiCheckCircle className="pricing-check-new" /> 12 months history</li>
                  <li><FiCheckCircle className="pricing-check-new" /> Excel export</li>
                </ul>
               </div>
                <div>
                  <Link to="/signup" className="thm-btn w-100">Start Free Trial</Link>
                </div>
              </div>
            </div>

            <div className="col-lg-3 col-md-6 mb-3">
              <div className="pricing-card-new">
                <div>
                  <div className="pricing-card-icon-new">
                  <FiBarChart2 />
                </div>
                <h5 className="pricing-plan-name-new">Growth</h5>
                <div className="pricing-amount-new">
                  <span className="pricing-currency-new">₹</span>
                  <span className="pricing-value-new">2,499</span>
                  <span className="pricing-period-new">/month</span>
                </div>
                <p className="pricing-desc-new">For scaling operations</p>
                <ul className="pricing-features-new">
                  <li><FiCheckCircle className="pricing-check-new" /> 10 users</li>
                  <li><FiCheckCircle className="pricing-check-new" /> 750 orders/month</li>
                  <li><FiCheckCircle className="pricing-check-new" /> 3 Gmail inboxes</li>
                  <li><FiCheckCircle className="pricing-check-new" /> 600 AI extractions</li>
                  <li><FiCheckCircle className="pricing-check-new" /> 24 months history</li>
                  <li><FiCheckCircle className="pricing-check-new" /> Priority support</li>
                </ul>
                </div>
                <div>
                  <Link to="/signup" className="thm-btn outline w-100">Get Started</Link>
                </div>
              </div>
            </div>
            <div className="col-lg-3 col-md-6 mb-3">
              <div className="pricing-card-new">
               <div>
                 <div className="pricing-card-icon-new">
                  <FiUsers />
                </div>
                <h5 className="pricing-plan-name-new">Enterprise</h5>
                <div className="pricing-amount-new">
                  <span className="pricing-value-new">Custom</span>
                </div>
                <p className="pricing-desc-new">For large-scale operations</p>
                <ul className="pricing-features-new">
                  <li><FiCheckCircle className="pricing-check-new" /> 25 users</li>
                  <li><FiCheckCircle className="pricing-check-new" /> 2,000 orders/month</li>
                  <li><FiCheckCircle className="pricing-check-new" /> 5 Gmail inboxes</li>
                  <li><FiCheckCircle className="pricing-check-new" /> 1,500 AI extractions</li>
                  <li><FiCheckCircle className="pricing-check-new" /> Unlimited history</li>
                  <li><FiCheckCircle className="pricing-check-new" /> Priority support</li>
                </ul>
               </div>
                <div>
                  <Link to="/signup" className="thm-btn outline w-100">Contact Sales</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="testimonials-section">
        <div className="container">
          <div className="text-center">
            <h2 className="new-section-title">Trusted by Fast-Growing Businesses</h2>
            <p className="section-subtitle">See what our users are saying about ORDR.</p>
          </div>
          <div className="splide" ref={splideRef}>
            <div className="splide__track">
              <ul className="splide__list">
                {testimonialsData.map((testimonial) => (
                  <li className="splide__slide" key={testimonial.id}>
                    <div className="testimonial-card">
                      
                      <div className="testimonial-rating">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <FiStar key={i} className="star-icon filled" />
                        ))}
                      </div>
                      <p className="testimonial-text">{testimonial.text}</p>
                      <div className="testimonial-author">
                        <div className="author-img" style={{ backgroundImage: `url(${testimonial.image})`, backgroundSize: 'cover' }}></div>
                        <div className="author-info">
                          <h6>{testimonial.name}</h6>
                          <p>{testimonial.role}, {testimonial.company}</p>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="faq-section">
        <div className="container">
          <div className="text-center">
            <h2 className="new-section-title">Frequently Asked Questions</h2>
            <p className="section-subtitle">Everything you need to know about getting started.</p>
          </div>
          <div className="row justify-content-center">
            <div className="col-lg-10">
              <div className="accordion" id="faqAccordion">
                {faqData.map((faq, index) => (
                  <div className="accordion-item" key={faq.id}>
                    <h2 className="accordion-header" id={`heading${faq.id}`}>
                      <button
                        className={`accordion-button ${index !== 0 ? 'collapsed' : ''}`}
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target={`#collapse${faq.id}`}
                        aria-expanded={index === 0 ? 'true' : 'false'}
                        aria-controls={`collapse${faq.id}`}
                      >
                        <span className="faq-number">{String(index + 1).padStart(2, '0')}</span>
                        {faq.question}
                      </button>
                    </h2>
                    <div
                      id={`collapse${faq.id}`}
                      className={`accordion-collapse collapse ${index === 0 ? 'show' : ''}`}
                      aria-labelledby={`heading${faq.id}`}
                      data-bs-parent="#faqAccordion"
                    >
                      <div className="accordion-body">
                        {faq.answer}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className='row'>
            <div className='col-lg-12'>
              <div className="cta-content text-center">
            <h2>Ready to Transform Your Order Management?</h2>
            <p>Join 500+ businesses already using ORDR to track and manage their <span className="d-lg-inline d-sm-block">
  B2B orders. Start your free 14-day trial today.
</span></p>
            <div className="d-flex justify-content-center gap-3">
              <Link to="/signup" className="thm-lg-btn text-decoration-none">Start Free Trial</Link>
              <a href="#pricing" className="thm-lg-btn outline text-decoration-none" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>View Pricing</a>
            </div>
          </div>

            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
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
                <li><a href="#">Contact</a></li>
              </ul>
            </div>
            <div className="col-lg-2 col-md-6 col-6 mb-4 mb-lg-0">
              <h5 className="footer-title">Legal</h5>
              <ul className="footer-links list-unstyled">
                <li><a href="#">Terms of Service</a></li>
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="#">Cookie Policy</a></li>
                <li><a href="#">Refund Policy</a></li>
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
              <div className="col-md-6 text-center text-md-end mt-3 mt-md-0">
                <p className="mb-0 footer-trial-text">Start your <strong>14-day free trial</strong> today. No credit card required.</p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
