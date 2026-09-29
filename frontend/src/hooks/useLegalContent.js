import { useEffect, useState } from 'react';
import api from '../services/api';
import { DEFAULT_LEGAL_CONTENT, mergeLegalContent } from '../content/legalContent';

// Content of a legal page (privacy / terms / refund): the admin-edited version from
// Website Content > CMS, or the built-in default. Defaults show until the server answers.
const cache = {};
const pending = {};

const load = (page) => {
  if (!pending[page]) {
    pending[page] = api
      .get(`/site-content/legal/${page}`)
      .then((res) => {
        cache[page] = mergeLegalContent(page, res.data.content);
        return cache[page];
      })
      .catch(() => {
        delete pending[page];
        return mergeLegalContent(page, null);
      });
  }
  return pending[page];
};

// After an admin saves, the page loads the new version next time it is opened
export const clearLegalContentCache = (page) => {
  delete cache[page];
  delete pending[page];
};

export default function useLegalContent(page) {
  const [content, setContent] = useState(cache[page] || mergeLegalContent(page, null) || DEFAULT_LEGAL_CONTENT[page]);
  useEffect(() => {
    let mounted = true;
    if (!cache[page]) load(page).then((data) => mounted && setContent(data));
    return () => {
      mounted = false;
    };
  }, [page]);
  return content;
}
