import { useEffect, useState } from 'react';
import api from '../services/api';

// Contact details for the website (Contact Us page, footer), from GET /api/contact/info.
// Shown straight away with these defaults, then replaced by the server's values.
export const DEFAULT_CONTACT_INFO = {
  email: 'hello@ordr.in',
  phone: '+91 98765 43210',
  phoneLink: 'tel:+919876543210',
  address: 'Mumbai, India',
  hours: 'Mon – Sat, 10:00 AM – 7:00 PM IST',
  topics: ['General question', 'Sales & pricing', 'Product demo', 'Support', 'Billing', 'Partnership', 'Other'],
};

// Loaded once per visit and shared by every component that uses it
let cached = null;
let pending = null;

const loadContactInfo = () => {
  if (!pending) {
    pending = api
      .get('/contact/info')
      .then((res) => {
        cached = { ...DEFAULT_CONTACT_INFO, ...res.data };
        return cached;
      })
      .catch(() => {
        pending = null; // try again next time
        return DEFAULT_CONTACT_INFO;
      });
  }
  return pending;
};

export default function useContactInfo() {
  const [info, setInfo] = useState(cached || DEFAULT_CONTACT_INFO);
  useEffect(() => {
    let mounted = true;
    if (!cached) loadContactInfo().then((data) => mounted && setInfo(data));
    return () => {
      mounted = false;
    };
  }, []);
  return info;
}
