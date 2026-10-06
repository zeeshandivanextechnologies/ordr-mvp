import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiCheckCircle, FiZap, FiStar } from 'react-icons/fi';
import Splide from '@splidejs/splide';
import '@splidejs/splide/css';
import useCounter from '../../hooks/useCounter';
import useLandingContent from '../../hooks/useLandingContent';
import { useAuth } from '../../components/AuthProvider';
import { PLAN_IDS, formatPlanPrice, landingIcon, planLimitBullets, safeUrl } from '../../content/landingContent';
import Footer from './Footer';
import '../../styles/landing.css';

function StatCounter({ end, suffix = '', duration = 2000 }) {
  const { count, ref } = useCounter(end, duration);
  return <span ref={ref}>{count}{suffix}</span>;
}

// Card icon chosen in Website Content (stored by name)
function CardIcon({ name, fallback }) {
  return React.createElement(landingIcon(name, fallback));
}

export default function Home() {
  const { user } = useAuth();
  // All text and lists come from Website Content (admin); defaults are shown until it loads
  const { content, plans, ready } = useLandingContent();
  const { hero, stats, inputMethods, features, howItWorks, pricing, testimonials, faq, cta } = content;
  const splideRef = useRef(null);

  // The carousel is rebuilt when the saved testimonials arrive (the list below gets a new key)
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
  }, [ready]);

  const pricingPlans = PLAN_IDS
    .map((id) => ({ ...(plans.find((p) => p.id === id) || {}), id, card: pricing.plans[id] }))
    .filter((plan) => plan.name);

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


      <section className="hero-section">
        <div className="container">
        <div className='row'>
          <div className='col-lg-12'>
              {hero.badge && (
              <div className="hero-badge">
            <FiZap className="hero-badge-icon" />
            <span>{hero.badge}</span>
          </div>
              )}
          <h1 className="hero-title">{hero.titleLine1}{hero.titleHighlight && <><br/><span>{hero.titleHighlight}</span></>}</h1>
          <p className="hero-subtitle">{hero.subtitle}</p>
          <div className="hero-btn-group">
            <Link to="/signup" className="thm-btn">{hero.primaryButton}</Link>
            {hero.secondaryButton && <a href="#features" className="thm-btn outline ">{hero.secondaryButton}</a>}
          </div>

          </div>

        </div>



          {stats.items.length > 0 && (
          <div className="stats-wrapper">
          <div className="row text-center">
            {stats.items.map((stat, index) => (
            <div className="col-md-4 stat-box" key={index}>
              <h3><StatCounter end={Number(stat.value) || 0} suffix={stat.suffix || ''} duration={Number(stat.duration) || 2000} /></h3>
              <p>{stat.label}</p>
            </div>
            ))}
          </div>
        </div>
          )}


        </div>

      </section>



      {/* Order Input Methods */}
      <section className="input-methods-section">
        <div className="container">
          <div className="text-center">
            <h2 className="new-section-title">{inputMethods.title}</h2>
            <p className="section-subtitle">{inputMethods.subtitle}</p>
          </div>
          <div className="row g-4">
            {inputMethods.items.map((item, index) => (
            <div className="col-lg-4 col-md-6" key={index}>
              <div className="input-method-card">
                <div className="input-method-icon"><CardIcon name={item.icon} fallback="mail" /></div>
                <h4>{item.title}</h4>
                <p>{item.text}</p>
                {item.tag && <div className="input-method-tag">{item.tag}</div>}
              </div>
            </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="container">
          <div className="text-center">
            <h2 className="new-section-title">{features.title}</h2>
            <p className="section-subtitle">{features.subtitle}</p>
          </div>
          <div className="row ">
            {features.items.map((item, index) => (
            <div className="col-lg-3 col-md-6 mb-3" key={index}>
              <div className="feature-card">
                <div className="feature-icon"><CardIcon name={item.icon} fallback="check" /></div>
                <h4>{item.title}</h4>
                <p>{item.text}</p>
              </div>
            </div>
            ))}
          </div>
        </div>
      </section>

      {/* Detailed Features */}
      <section id="how-it-works" className="detailed-features-section">
        <div className="container">
          <div className="text-center">
            <h2 className="new-section-title">{howItWorks.title}</h2>
            <p className="section-subtitle">{howItWorks.subtitle}</p>
          </div>
          <div className="row g-4">
            {howItWorks.items.map((item, index) => (
            <div className="col-lg-4 col-md-6" key={index}>
              <div className="detail-feature-card">
                <div className="detail-feature-icon"><CardIcon name={item.icon} fallback="cpu" /></div>
                <h5>{item.title}</h5>
                <p>{item.text}</p>
              </div>
            </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing: prices and limits come from the real plans, card text from Website Content */}
      <section id="pricing" className="pricing-section">
        <div className="container">
          <div className="text-center mb-lg-5 mb-0">
            <h2 className="new-section-title">{pricing.title}</h2>
            <p className="section-subtitle">{pricing.subtitle}</p>
          </div>
          <div className="row justify-content-center">
            {pricingPlans.map((plan) => {
              const popular = Boolean(plan.card.badge);
              const bullets = [...planLimitBullets(plan.limits), ...(plan.card.extraFeatures || []).filter(Boolean)];
              return (
            <div className="col-lg-3 col-md-6 mb-3" key={plan.id}>
              <div className={`pricing-card-new${popular ? ' pricing-popular-new' : ''}`}>
              <div>
                  {popular && <div className="pricing-badge-new">{plan.card.badge}</div>}
                  <div className="pricing-card-icon-new">
                  <CardIcon name={plan.card.icon} fallback="check" />
                </div>
                <h5 className="pricing-plan-name-new">{plan.name}</h5>
                <div className="pricing-amount-new">
                  <span className="pricing-currency-new">₹</span>
                  <span className="pricing-value-new">{formatPlanPrice(plan.price)}</span>
                  <span className="pricing-period-new">/month</span>
                </div>
                <p className="pricing-desc-new">{plan.card.description}</p>
                <ul className="pricing-features-new">
                  {bullets.map((bullet, index) => (
                  <li key={index}><FiCheckCircle className="pricing-check-new" /> {bullet}</li>
                  ))}
                </ul>
              </div>
                <div>
                  <Link to="/signup" className={`thm-btn${popular ? '' : ' outline'} w-100`}>{plan.card.buttonText || 'Start Free Trial'}</Link>
                </div>
              </div>
            </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="testimonials-section">
        <div className="container">
          <div className="text-center">
            <h2 className="new-section-title">{testimonials.title}</h2>
            <p className="section-subtitle">{testimonials.subtitle}</p>
          </div>
          <div className="splide" ref={splideRef} key={ready ? 'saved' : 'default'}>
            <div className="splide__track">
              <ul className="splide__list">
                {testimonials.items.map((testimonial, index) => (
                  <li className="splide__slide" key={index}>
                    <div className="testimonial-card">

                      <div className="testimonial-rating">
                        {[...Array(Math.min(Math.max(Number(testimonial.rating) || 0, 0), 5))].map((_, i) => (
                          <FiStar key={i} className="star-icon filled" />
                        ))}
                      </div>
                      <p className="testimonial-text">{testimonial.text}</p>
                      <div className="testimonial-author">
                        <div className="author-img" style={{ backgroundImage: safeUrl(testimonial.image, '') ? `url("${safeUrl(testimonial.image, '')}")` : undefined, backgroundSize: 'cover' }}></div>
                        <div className="author-info">
                          <h6>{testimonial.name}</h6>
                          <p>{[testimonial.role, testimonial.company].filter(Boolean).join(', ')}</p>
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
            <h2 className="new-section-title">{faq.title}</h2>
            <p className="section-subtitle">{faq.subtitle}</p>
          </div>
          <div className="row justify-content-center">
            <div className="col-lg-10">
              <div className="accordion" id="faqAccordion">
                {faq.items.map((item, index) => {
                  const id = `faq${index + 1}`;
                  return (
                  <div className="accordion-item" key={id}>
                    <h2 className="accordion-header" id={`heading${id}`}>
                      <button
                        className={`accordion-button ${index !== 0 ? 'collapsed' : ''}`}
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target={`#collapse${id}`}
                        aria-expanded={index === 0 ? 'true' : 'false'}
                        aria-controls={`collapse${id}`}
                      >
                        <span className="faq-number">{String(index + 1).padStart(2, '0')}</span>
                        {item.question}
                      </button>
                    </h2>
                    <div
                      id={`collapse${id}`}
                      className={`accordion-collapse collapse ${index === 0 ? 'show' : ''}`}
                      aria-labelledby={`heading${id}`}
                      data-bs-parent="#faqAccordion"
                    >
                      <div className="accordion-body">
                        {item.answer}
                      </div>
                    </div>
                  </div>
                  );
                })}
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
            <h2>{cta.title}</h2>
            <p>{cta.textStart} <span className="d-lg-inline d-sm-block">
  {cta.textEnd}
</span></p>
            <div className="d-flex justify-content-center gap-3">
              <Link to="/signup" className="thm-lg-btn text-decoration-none">{cta.primaryButton}</Link>
              {cta.secondaryButton && <a href="#pricing" className="thm-lg-btn outline text-decoration-none" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>{cta.secondaryButton}</a>}
            </div>
          </div>

            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
