import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  FiSave,
  FiRotateCcw,
  FiExternalLink,
  FiPlus,
  FiTrash2,
  FiArrowUp,
  FiArrowDown,
  FiUpload,
  FiUser,
} from "react-icons/fi";
import api from "../../services/api";
import {
  DEFAULT_LANDING_CONTENT,
  DEFAULT_PLANS,
  LANDING_ICONS,
  PLAN_IDS,
  formatPlanPrice,
  mergeLandingContent,
  planLimitBullets,
  safeUrl,
} from "../../content/landingContent";
import { clearLandingContentCache } from "../../hooks/useLandingContent";
import CmsLegalPages from "./CmsLegalPages";
import "../../styles/member.css";

// Admin: edit the landing page (Home) section by section. Unsaved sections keep the default text.
const iconField = { key: "icon", label: "Icon", type: "icon" };
const TABS = [
  {
    key: "hero",
    label: "Hero",
    help: "The first thing visitors see at the top of the website.",
    fields: [
      { key: "badge", label: "Badge text (leave empty to hide)" },
      { key: "titleLine1", label: "Title - first line" },
      { key: "titleHighlight", label: "Title - highlighted second line" },
      { key: "subtitle", label: "Subtitle", type: "textarea" },
      { key: "primaryButton", label: "Main button text (opens Sign up)" },
      {
        key: "secondaryButton",
        label: "Second button text (scrolls to Features, empty to hide)",
      },
    ],
  },
  {
    key: "stats",
    label: "Stats",
    help: "Animated numbers under the hero.",
    fields: [
      {
        key: "items",
        label: "Stats",
        type: "list",
        itemLabel: "Stat",
        max: 6,
        newItem: { value: 0, suffix: "+", label: "", duration: 2000 },
        fields: [
          // One box for the whole number, e.g. 500+, 1M+ or 98% (split into number + text on save)
          { key: "value", label: "Number (e.g. 500+, 1M+, 98%)", type: "stat" },
          { key: "label", label: "Label" },
        ],
      },
    ],
  },
  {
    key: "inputMethods",
    label: "Order Input Methods",
    help: 'The 3 Ways to Get Your Orders In" cards.',
    fields: [
      { key: "title", label: "Section title" },
      { key: "subtitle", label: "Section subtitle" },
      {
        key: "items",
        label: "Cards",
        type: "list",
        itemLabel: "Card",
        max: 6,
        newItem: { icon: "mail", title: "", text: "", tag: "" },
        fields: [
          iconField,
          { key: "title", label: "Title" },
          { key: "text", label: "Description", type: "textarea" },
          { key: "tag", label: "Tag (small label, optional)" },
        ],
      },
    ],
  },
  {
    key: "features",
    label: "Features",
    help: 'The "How ORDR Works" steps (Features menu link).',
    fields: [
      { key: "title", label: "Section title" },
      { key: "subtitle", label: "Section subtitle" },
      {
        key: "items",
        label: "Steps",
        type: "list",
        itemLabel: "Step",
        max: 8,
        newItem: { icon: "check", title: "", text: "" },
        fields: [
          iconField,
          { key: "title", label: "Title" },
          { key: "text", label: "Description", type: "textarea" },
        ],
      },
    ],
  },
  {
    key: "howItWorks",
    label: "How It Works",
    help: 'The "Everything You Need to Manage Orders" feature cards (How It Works menu link).',
    fields: [
      { key: "title", label: "Section title" },
      { key: "subtitle", label: "Section subtitle" },
      {
        key: "items",
        label: "Feature cards",
        type: "list",
        itemLabel: "Card",
        max: 12,
        newItem: { icon: "check", title: "", text: "" },
        fields: [
          iconField,
          { key: "title", label: "Title" },
          { key: "text", label: "Description", type: "textarea" },
        ],
      },
    ],
  },
  {
    key: "pricing",
    label: "Pricing",
    help: "Prices and plan limits come from the real plans (the same as Billing). Here you can change the text on each card.",
    fields: [
      { key: "title", label: "Section title" },
      { key: "subtitle", label: "Section subtitle" },
      { key: "plans", label: "Plan cards", type: "plans" },
    ],
  },
  {
    key: "testimonials",
    label: "Testimonials",
    help: "Customer quotes shown in the carousel.",
    fields: [
      { key: "title", label: "Section title" },
      { key: "subtitle", label: "Section subtitle" },
      {
        key: "items",
        label: "Testimonials",
        type: "list",
        itemLabel: "Testimonial",
        max: 20,
        newItem: {
          name: "",
          role: "",
          company: "",
          image: "",
          rating: 5,
          text: "",
        },
        fields: [
          { key: "name", label: "Name" },
          { key: "role", label: "Role" },
          { key: "company", label: "Company" },
          {
            key: "image",
            label: "Photo (upload, or paste a https:// link)",
            type: "image",
          },
          {
            key: "rating",
            label: "Stars (1-5)",
            type: "number",
            min: 1,
            max: 5,
          },
          { key: "text", label: "Quote", type: "textarea" },
        ],
      },
    ],
  },
  {
    key: "faq",
    label: "FAQ",
    help: "Frequently asked questions. The first one opens by default.",
    fields: [
      { key: "title", label: "Section title" },
      { key: "subtitle", label: "Section subtitle" },
      {
        key: "items",
        label: "Questions",
        type: "list",
        itemLabel: "Question",
        max: 30,
        newItem: { question: "", answer: "" },
        fields: [
          { key: "question", label: "Question" },
          { key: "answer", label: "Answer", type: "textarea" },
        ],
      },
    ],
  },
  {
    key: "cta",
    label: "CTA",
    help: 'The dark "Ready to Transform..." banner near the bottom.',
    fields: [
      { key: "title", label: "Title" },
      { key: "textStart", label: "Text - first part", type: "textarea" },
      {
        key: "textEnd",
        label: "Text - second part (new line on small screens)",
        type: "textarea",
      },
      { key: "primaryButton", label: "Main button text (opens Sign up)" },
      {
        key: "secondaryButton",
        label: "Second button text (scrolls to Pricing, empty to hide)",
      },
    ],
  },
  {
    key: "footer",
    label: "Footer",
    help: "Shown on the website and on the Contact, Privacy, Terms and Refund pages. Email, phone and address come from the Contact settings.",
    fields: [
      { key: "description", label: "Description", type: "textarea" },
      { key: "twitter", label: "Twitter / X link (empty to hide)" },
      { key: "linkedin", label: "LinkedIn link (empty to hide)" },
      { key: "instagram", label: "Instagram link (empty to hide)" },
      { key: "github", label: "GitHub link (empty to hide)" },
      { key: "copyright", label: "Copyright line" },
    ],
  },
  // Legal pages (Privacy, Terms, Refund) with sub-tabs and the rich-text editor
  { key: "cms", label: "CMS", cms: true, fields: [] },
];

const clone = (value) => JSON.parse(JSON.stringify(value));

// "500+" -> { value: 500, suffix: '+' }; the number part is animated on the website
const parseStat = (text) => {
  const match = String(text).match(/^\s*(\d+)([\s\S]*)$/);
  return match
    ? { value: Number(match[1]), suffix: match[2] }
    : { value: "", suffix: String(text) };
};
const statText = (item) => `${item.value ?? ""}${item.suffix ?? ""}`;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// Photo: upload a file (saved on the server) or paste a link; small round preview
function ImageField({ field, value, onChange, id }) {
  const [uploading, setUploading] = useState(false);
  const preview = safeUrl(value, "");

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      toast.error("Please choose a JPG, PNG or WEBP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("The photo must be 2 MB or smaller.");
      return;
    }
    const form = new FormData();
    form.append("image", file);
    setUploading(true);
    try {
      const res = await api.post("/site-content/images", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // Full link to the photo on the API server, so the website can show it
      onChange(
        `${String(api.defaults.baseURL || "/api").replace(/\/+$/, "")}${res.data.path}`,
      );
      toast.success('Photo uploaded. Click "Save changes" to publish it.');
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload the photo");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="custom-frm-bx">
      <label htmlFor={id}>{field.label}</label>
      <div className="website-content-photo">
        <div className="website-content-photo-preview">
          {preview ? <img src={preview} alt="" /> : <FiUser />}
        </div>
        <input
          id={id}
          type="text"
          className="form-control"
          value={value ?? ""}
          placeholder="https://..."
          onChange={(e) => onChange(e.target.value)}
        />
        <label
          className={`thm-btn outline fz-14 p-2 website-content-photo-btn${uploading ? " disabled" : ""}`}
        >
          <FiUpload /> {uploading ? "Uploading..." : "Upload"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            disabled={uploading}
            onChange={handleFile}
          />
        </label>
      </div>
      <div className="fz-14 text-secondary mt-1">
        JPG, PNG or WEBP, up to 2 MB. A square photo looks best.
      </div>
    </div>
  );
}

function Field({ field, value, onChange, idPrefix }) {
  const id = `${idPrefix}-${field.key}`;
  if (field.type === "image") {
    return (
      <ImageField field={field} value={value} onChange={onChange} id={id} />
    );
  }
  if (field.type === "textarea") {
    return (
      <div className="custom-frm-bx">
        <label htmlFor={id}>{field.label}</label>
        <textarea
          id={id}
          className="form-control"
          rows={3}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }
  if (field.type === "number") {
    return (
      <div className="custom-frm-bx">
        <label htmlFor={id}>{field.label}</label>
        <input
          id={id}
          type="number"
          className="form-control"
          value={value ?? ""}
          min={field.min}
          max={field.max}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
        />
      </div>
    );
  }
  if (field.type === "icon") {
    return (
      <div className="custom-frm-bx">
        <label htmlFor={id}>{field.label}</label>
        <select
          id={id}
          className="form-select"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        >
          {Object.entries(LANDING_ICONS).map(([name, { label }]) => (
            <option key={name} value={name}>
              {label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <div className="custom-frm-bx">
      <label htmlFor={id}>{field.label}</label>
      <input
        id={id}
        type="text"
        className="form-control"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ListField({ field, items, onChange, idPrefix }) {
  const list = Array.isArray(items) ? items : [];
  const update = (index, key, value) =>
    onChange(
      list.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  const move = (index, step) => {
    const next = [...list];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    onChange(next);
  };
  return (
    <div className="website-content-list">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0">
          {field.label} ({list.length})
        </h6>
        <button
          type="button"
          className="thm-btn outline fz-14 p-2"
          disabled={field.max && list.length >= field.max}
          onClick={() => onChange([...list, clone(field.newItem)])}
        >
          <FiPlus /> Add {field.itemLabel.toLowerCase()}
        </button>
      </div>
      {list.length === 0 && (
        <div className="text-secondary fz-14 mb-2">
          Nothing here yet. This part of the page is hidden until you add one.
        </div>
      )}
      {list.map((item, index) => (
        <div className="website-content-item" key={index}>
          <div className="website-content-item-head">
            <span>
              {field.itemLabel} {index + 1}
            </span>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="website-content-icon-btn"
                title="Move up"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <FiArrowUp />
              </button>
              <button
                type="button"
                className="website-content-icon-btn"
                title="Move down"
                disabled={index === list.length - 1}
                onClick={() => move(index, 1)}
              >
                <FiArrowDown />
              </button>
              <button
                type="button"
                className="website-content-icon-btn danger"
                title="Delete"
                onClick={() => onChange(list.filter((_, i) => i !== index))}
              >
                <FiTrash2 />
              </button>
            </div>
          </div>
          <div className="row">
            {field.fields.map((sub) => (
              <div
                className={sub.type === "textarea" ? "col-12" : "col-md-6"}
                key={sub.key}
              >
                {sub.type === "stat" ? (
                  <Field
                    field={{ ...sub, type: "text" }}
                    value={statText(item)}
                    onChange={(text) =>
                      onChange(
                        list.map((it, i) =>
                          i === index ? { ...it, ...parseStat(text) } : it,
                        ),
                      )
                    }
                    idPrefix={`${idPrefix}-${index}`}
                  />
                ) : (
                  <Field
                    field={sub}
                    value={item[sub.key]}
                    onChange={(v) => update(index, sub.key, v)}
                    idPrefix={`${idPrefix}-${index}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlansField({ plans, value, onChange, idPrefix }) {
  const update = (id, key, v) =>
    onChange({ ...value, [id]: { ...value[id], [key]: v } });
  return (
    <div className="website-content-list">
      <h6 className="mb-2">Plan cards</h6>
      {PLAN_IDS.map((id) => {
        const plan = plans.find((p) => p.id === id);
        const card = value[id] || {};
        if (!plan) return null;
        return (
          <div className="website-content-item" key={id}>
            <div className="website-content-item-head">
              <span>
                {plan.name} &middot; ₹{formatPlanPrice(plan.price)}/month
              </span>
            </div>
            <div className="fz-14 text-secondary mb-2">
              From the plan: {planLimitBullets(plan.limits).join(" · ")}
            </div>
            <div className="row">
              <div className="col-md-6">
                <Field
                  field={iconField}
                  value={card.icon}
                  onChange={(v) => update(id, "icon", v)}
                  idPrefix={`${idPrefix}-${id}`}
                />
              </div>
              <div className="col-md-6">
                <Field
                  field={{
                    key: "badge",
                    label: "Badge (e.g. Most Popular, empty = none)",
                  }}
                  value={card.badge}
                  onChange={(v) => update(id, "badge", v)}
                  idPrefix={`${idPrefix}-${id}`}
                />
              </div>
              <div className="col-md-6">
                <Field
                  field={{ key: "description", label: "Short description" }}
                  value={card.description}
                  onChange={(v) => update(id, "description", v)}
                  idPrefix={`${idPrefix}-${id}`}
                />
              </div>
              <div className="col-md-6">
                <Field
                  field={{ key: "buttonText", label: "Button text" }}
                  value={card.buttonText}
                  onChange={(v) => update(id, "buttonText", v)}
                  idPrefix={`${idPrefix}-${id}`}
                />
              </div>
              <div className="col-12">
                <div className="custom-frm-bx">
                  <label htmlFor={`${idPrefix}-${id}-extra`}>
                    Extra features (one per line, shown after the plan limits)
                  </label>
                  <textarea
                    id={`${idPrefix}-${id}-extra`}
                    className="form-control"
                    rows={3}
                    value={(card.extraFeatures || []).join("\n")}
                    onChange={(e) =>
                      update(id, "extraFeatures", e.target.value.split("\n"))
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function WebsiteContent() {
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const [draft, setDraft] = useState(null);
  const [customized, setCustomized] = useState({});
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get("/site-content/landing"),
      api.get("/site-content/plans").catch(() => null),
    ])
      .then(([content, planRes]) => {
        if (!mounted) return;
        const sections = content.data.sections || {};
        setDraft(clone(mergeLandingContent(sections)));
        setCustomized(
          Object.fromEntries(Object.keys(sections).map((k) => [k, true])),
        );
        if (planRes?.data?.plans) setPlans(planRes.data.plans);
      })
      .catch(() => {
        if (mounted) {
          toast.error("Failed to load website content");
          setDraft(clone(DEFAULT_LANDING_CONTENT));
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const tab = TABS.find((t) => t.key === activeTab);
  const section = draft?.[activeTab] || {};
  const setField = (key, value) =>
    setDraft((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], [key]: value },
    }));

  // Tidy up before saving: numbers stay numbers, empty extra-feature lines are dropped
  const prepare = (content) => {
    const data = clone(content);
    if (activeTab === "pricing") {
      for (const id of PLAN_IDS) {
        if (data.plans?.[id])
          data.plans[id].extraFeatures = (data.plans[id].extraFeatures || [])
            .map((f) => f.trim())
            .filter(Boolean);
      }
    }
    if (activeTab === "testimonials") {
      data.items = data.items.map((t) => ({
        ...t,
        rating: Math.min(Math.max(Number(t.rating) || 5, 1), 5),
      }));
    }
    if (activeTab === "stats") {
      data.items = data.items.map((s) => ({
        ...s,
        value: Number(s.value) || 0,
      }));
    }
    return data;
  };

  const handleSave = async () => {
    // Every stat must start with a number so the website can count up to it
    if (activeTab === "stats") {
      const bad = (section.items || []).findIndex(
        (item) => item.value === "" || !Number.isFinite(Number(item.value)),
      );
      if (bad !== -1) {
        toast.error(
          `Stat ${bad + 1}: the number must start with digits, e.g. 500+, 1M+ or 98%.`,
        );
        return;
      }
    }
    setBusy(true);
    try {
      const content = prepare(section);
      await api.put(`/site-content/landing/${activeTab}`, { content });
      setDraft((prev) => ({ ...prev, [activeTab]: content }));
      setCustomized((prev) => ({ ...prev, [activeTab]: true }));
      clearLandingContentCache();
      toast.success(
        `${tab.label} saved. The website now shows the new content.`,
      );
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (
      !window.confirm(
        `Reset "${tab.label}" to the default content? Your changes to this section will be lost.`,
      )
    )
      return;
    setBusy(true);
    try {
      await api.delete(`/site-content/landing/${activeTab}`);
      setDraft((prev) => ({
        ...prev,
        [activeTab]: clone(DEFAULT_LANDING_CONTENT[activeTab]),
      }));
      setCustomized((prev) => ({ ...prev, [activeTab]: false }));
      clearLandingContentCache();
      toast.success(`${tab.label} reset to the default content.`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reset");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="row">
        <div className="col-lg-12">
          <div className="member-page-header mb-2">
            <div>
              <h2>Website Content</h2>
              <p>Edit the text on your public website, section by section</p>
            </div>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="thm-btn outline fz-14 p-2"
            >
              <FiExternalLink /> View website
            </a>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-12">
          <div className="member-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`tab-btn ${activeTab === t.key ? "active" : ""}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-12">
          {tab.cms ? (
            <CmsLegalPages />
          ) : (
            <div className="member-card website-content">
              <div className="member-card-header">
                <div>
                  <h5 className="mb-0">{tab.label}</h5>
                  <div className="fz-14 text-secondary">{tab.help}</div>
                </div>
                <span
                  className={`status-badge ${customized[activeTab] ? "confirmed" : "cancelled"}`}
                >
                  {customized[activeTab] ? "Customised" : "Default"}
                </span>
              </div>
              <div className="member-card-body">
                {loading || !draft ? (
                  <div
                    className="d-flex justify-content-center align-items-center"
                    style={{ height: "200px" }}
                    role="status"
                  >
                    <div
                      className="spinner-border"
                      style={{
                        width: "2.5rem",
                        height: "2.5rem",
                        color: "var(--primary-color)",
                      }}
                    >
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row">
                      {tab.fields
                        .filter((f) => !["list", "plans"].includes(f.type))
                        .map((field) => (
                          <div
                            className={
                              field.type === "textarea" ? "col-12" : "col-md-6"
                            }
                            key={field.key}
                          >
                            <Field
                              field={field}
                              value={section[field.key]}
                              onChange={(v) => setField(field.key, v)}
                              idPrefix={`wc-${activeTab}`}
                            />
                          </div>
                        ))}
                    </div>
                    {tab.fields
                      .filter((f) => f.type === "list")
                      .map((field) => (
                        <ListField
                          key={field.key}
                          field={field}
                          items={section[field.key]}
                          onChange={(v) => setField(field.key, v)}
                          idPrefix={`wc-${activeTab}`}
                        />
                      ))}
                    {tab.fields
                      .filter((f) => f.type === "plans")
                      .map((field) => (
                        <PlansField
                          key={field.key}
                          plans={plans}
                          value={section.plans || {}}
                          onChange={(v) => setField("plans", v)}
                          idPrefix={`wc-${activeTab}`}
                        />
                      ))}

                    <div className="d-flex justify-content-end gap-2 mt-3 flex-wrap">
                      <button
                        type="button"
                        className="thm-btn outline fz-14"
                        onClick={handleReset}
                        disabled={busy || !customized[activeTab]}
                      >
                        <FiRotateCcw /> Reset to default
                      </button>
                      <button
                        type="button"
                        className="thm-btn fz-14"
                        onClick={handleSave}
                        disabled={busy}
                      >
                        <FiSave /> {busy ? "Saving..." : "Save changes"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
