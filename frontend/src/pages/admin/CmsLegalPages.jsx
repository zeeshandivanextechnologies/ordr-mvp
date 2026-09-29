import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FiSave, FiRotateCcw, FiExternalLink, FiPlus, FiTrash2, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import api from '../../services/api';
import RichTextEditor from '../../components/RichTextEditor';
import { DEFAULT_LEGAL_CONTENT, mergeLegalContent } from '../../content/legalContent';
import { clearLegalContentCache } from '../../hooks/useLegalContent';

// Website Content > CMS: Privacy Policy, Terms & Conditions and Refund Policy,
// each written with the rich-text editor. Unsaved pages keep their built-in text.
const PAGES = [
  { key: 'privacy', label: 'Privacy Policy', path: '/privacy-policy' },
  { key: 'terms', label: 'Terms & Conditions', path: '/terms-and-conditions' },
  { key: 'refund', label: 'Refund Policy', path: '/refund-policy' },
];

let keySeed = 0;
const withKeys = (content) => ({ ...content, sections: content.sections.map((s) => ({ ...s, _key: `s${(keySeed += 1)}` })) });
const withoutKeys = (content) => ({ ...content, sections: content.sections.map(({ title, html }) => ({ title, html })) });

export default function CmsLegalPages() {
  const [activePage, setActivePage] = useState(PAGES[0].key);
  const [drafts, setDrafts] = useState({});
  const [customized, setCustomized] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all(PAGES.map((p) => api.get(`/site-content/legal/${p.key}`).then((r) => r.data.content).catch(() => null)))
      .then((contents) => {
        if (!mounted) return;
        const next = {};
        const flags = {};
        PAGES.forEach((p, i) => {
          next[p.key] = withKeys(mergeLegalContent(p.key, contents[i]));
          flags[p.key] = Boolean(contents[i]);
        });
        setDrafts(next);
        setCustomized(flags);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const page = PAGES.find((p) => p.key === activePage);
  const draft = drafts[activePage];
  const update = (changes) => setDrafts((prev) => ({ ...prev, [activePage]: { ...prev[activePage], ...changes } }));
  const updateSection = (index, changes) =>
    update({ sections: draft.sections.map((s, i) => (i === index ? { ...s, ...changes } : s)) });
  const moveSection = (index, step) => {
    const sections = [...draft.sections];
    [sections[index], sections[index + step]] = [sections[index + step], sections[index]];
    update({ sections });
  };

  const handleSave = async () => {
    if (!draft.title.trim()) {
      toast.error('Please enter a page title.');
      return;
    }
    if (draft.sections.length === 0) {
      toast.error('Add at least one section.');
      return;
    }
    const untitled = draft.sections.findIndex((s) => !s.title.trim());
    if (untitled !== -1) {
      toast.error(`Section ${untitled + 1} needs a title.`);
      return;
    }
    setBusy(true);
    try {
      const res = await api.put(`/site-content/legal/${activePage}`, { content: withoutKeys(draft) });
      // Show exactly what was saved (the server cleans the text and sets "Last updated")
      setDrafts((prev) => ({ ...prev, [activePage]: withKeys(mergeLegalContent(activePage, res.data.content)) }));
      setCustomized((prev) => ({ ...prev, [activePage]: true }));
      clearLegalContentCache(activePage);
      toast.success(`${page.label} saved. The page now shows the new content.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(`Reset "${page.label}" to the default content? Your changes to this page will be lost.`)) return;
    setBusy(true);
    try {
      await api.delete(`/site-content/legal/${activePage}`);
      setDrafts((prev) => ({ ...prev, [activePage]: withKeys(mergeLegalContent(activePage, null)) }));
      setCustomized((prev) => ({ ...prev, [activePage]: false }));
      clearLegalContentCache(activePage);
      toast.success(`${page.label} reset to the default content.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="member-card website-content">
      <div className="member-card-header">
        <div>
          <h5 className="mb-1">CMS</h5>
          <div className="fz-14 text-secondary">Write the Privacy Policy, Terms &amp; Conditions and Refund Policy pages with the editor.</div>
        </div>
        <a href={page.path} target="_blank" rel="noopener noreferrer" className="thm-btn outline fz-14 p-2">
          <FiExternalLink /> View page
        </a>
      </div>
      <div className="member-card-body">
        <div className="member-tabs cms-subtabs">
          {PAGES.map((p) => (
            <button key={p.key} className={`tab-btn ${activePage === p.key ? 'active' : ''}`} onClick={() => setActivePage(p.key)}>
              {p.label}
            </button>
          ))}
        </div>

        {loading || !draft ? (
          <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }} role="status">
            <div className="spinner-border" style={{ width: '2.5rem', height: '2.5rem', color: 'var(--primary-color)' }}>
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
              <div className="fz-14 text-secondary">
                Last updated: <strong>{draft.lastUpdated || DEFAULT_LEGAL_CONTENT[activePage].lastUpdated}</strong> (set automatically when you save)
              </div>
              <span className={`status-badge ${customized[activePage] ? 'confirmed' : 'cancelled'}`}>
                {customized[activePage] ? 'Customised' : 'Default'}
              </span>
            </div>

            <div className="row">
              <div className="col-md-6">
                <div className="custom-frm-bx">
                  <label htmlFor={`cms-${activePage}-title`}>Page title</label>
                  <input id={`cms-${activePage}-title`} type="text" className="form-control" value={draft.title} maxLength={150} onChange={(e) => update({ title: e.target.value })} />
                </div>
              </div>
              <div className="col-md-6">
                <div className="custom-frm-bx">
                  <label htmlFor={`cms-${activePage}-subtitle`}>Subtitle</label>
                  <input id={`cms-${activePage}-subtitle`} type="text" className="form-control" value={draft.subtitle} maxLength={300} onChange={(e) => update({ subtitle: e.target.value })} />
                </div>
              </div>
              <div className="col-md-6">
                <div className="custom-frm-bx">
                  <label htmlFor={`cms-${activePage}-contact`}>Contact box question</label>
                  <input id={`cms-${activePage}-contact`} type="text" className="form-control" value={draft.contactTitle} maxLength={150} onChange={(e) => update({ contactTitle: e.target.value })} />
                </div>
              </div>
              <div className="col-md-6">
                <div className="custom-frm-bx">
                  <label htmlFor={`cms-${activePage}-email`}>Contact box email</label>
                  <input id={`cms-${activePage}-email`} type="email" className="form-control" value={draft.contactEmail} maxLength={200} onChange={(e) => update({ contactEmail: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="website-content-list">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0">Sections ({draft.sections.length})</h6>
                <button
                  type="button" className="thm-btn outline fz-14 p-2"
                  onClick={() => update({ sections: [...draft.sections, { title: '', html: '', _key: `s${(keySeed += 1)}` }] })}
                >
                  <FiPlus /> Add section
                </button>
              </div>
              {draft.sections.map((section, index) => (
                <div className="website-content-item" key={section._key}>
                  <div className="website-content-item-head">
                    <span>Section {index + 1}</span>
                    <div className="d-flex gap-2">
                      <button type="button" className="website-content-icon-btn" title="Move up" disabled={index === 0} onClick={() => moveSection(index, -1)}><FiArrowUp /></button>
                      <button type="button" className="website-content-icon-btn" title="Move down" disabled={index === draft.sections.length - 1} onClick={() => moveSection(index, 1)}><FiArrowDown /></button>
                      <button
                        type="button" className="website-content-icon-btn danger" title="Delete"
                        onClick={() => update({ sections: draft.sections.filter((_, i) => i !== index) })}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                  <div className="custom-frm-bx">
                    <label htmlFor={`cms-${activePage}-${section._key}-title`}>Section title</label>
                    <input
                      id={`cms-${activePage}-${section._key}-title`} type="text" className="form-control" value={section.title} maxLength={200}
                      onChange={(e) => updateSection(index, { title: e.target.value })}
                    />
                  </div>
                  <div className="custom-frm-bx">
                    <label htmlFor={`cms-${activePage}-${section._key}-text`}>Text</label>
                    <RichTextEditor
                      id={`cms-${activePage}-${section._key}-text`}
                      value={section.html}
                      onChange={(html) => updateSection(index, { html })}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="d-flex justify-content-end gap-2 mt-3 flex-wrap">
              <button type="button" className="thm-btn outline fz-14" onClick={handleReset} disabled={busy || !customized[activePage]}>
                <FiRotateCcw /> Reset to default
              </button>
              <button type="button" className="thm-btn fz-14" onClick={handleSave} disabled={busy}>
                <FiSave /> {busy ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
