import { useEffect, useState } from 'react';
import api from '../services/api';
import { DEFAULT_LANDING_CONTENT, DEFAULT_PLANS, mergeLandingContent } from '../content/landingContent';

// Landing page content (admin-edited sections over the defaults) and the real plan prices.
// The page shows the defaults straight away and switches once the server answers.
let cached = null;
let pending = null;

const load = () => {
  if (!pending) {
    pending = Promise.all([
      api.get('/site-content/landing').then((r) => r.data.sections || {}).catch(() => ({})),
      api.get('/site-content/plans').then((r) => r.data.plans || DEFAULT_PLANS).catch(() => DEFAULT_PLANS),
    ]).then(([sections, plans]) => {
      cached = { content: mergeLandingContent(sections), plans, ready: true };
      return cached;
    });
  }
  return pending;
};

// After an admin saves, the next visit to the website loads the new content
export const clearLandingContentCache = () => {
  cached = null;
  pending = null;
};

export default function useLandingContent() {
  const [state, setState] = useState(cached || { content: DEFAULT_LANDING_CONTENT, plans: DEFAULT_PLANS, ready: false });
  useEffect(() => {
    let mounted = true;
    if (!cached) load().then((data) => mounted && setState(data));
    return () => {
      mounted = false;
    };
  }, []);
  return state;
}
