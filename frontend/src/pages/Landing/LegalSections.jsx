import { useNavigate } from 'react-router-dom';
import { cleanLegalHtml, sectionId } from '../../content/legalContent';

// Numbered sections of a legal page. Bodies are HTML from the CMS editor, always cleaned first.
export default function LegalSections({ sections }) {
  const navigate = useNavigate();

  // Links to other ORDR pages (e.g. /privacy-policy) open inside the app, without a reload
  const handleClick = (e) => {
    const link = e.target.closest('a');
    const href = link?.getAttribute('href') || '';
    if (link && href.startsWith('/') && !link.target && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      navigate(href);
    }
  };

  return sections.map((section, index) => (
    <section key={index} id={sectionId(section.title, index)} className="legal-section">
      <h2 className="legal-section-title">
        <span className="legal-section-number">{index + 1}</span>
        {section.title}
      </h2>
      <div
        className="legal-section-body"
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: cleanLegalHtml(section.html) }}
      />
    </section>
  ));
}
