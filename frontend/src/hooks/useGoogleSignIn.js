import { useRef, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useAuth } from '../components/AuthProvider';

let gsiPromise = null;
let cachedClientId = null;

function loadGsiScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiPromise) return gsiPromise;

  gsiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id) {
        resolve();
      } else {
        reject(new Error('Google Identity Services failed to load'));
      }
    };
    script.onerror = () => reject(new Error('Could not load Google Identity Services'));
    document.head.appendChild(script);
  });

  return gsiPromise;
}

async function fetchGoogleClientId() {
  if (cachedClientId) return cachedClientId;
  const res = await api.get('/config/google');
  if (!res.data?.clientId) throw new Error('Google login is not configured');
  cachedClientId = res.data.clientId;
  return cachedClientId;
}

function decodeCredential(credential) {
  try {
    const payload = credential.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(normalized)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const data = JSON.parse(json);
    return {
      googleId: data.sub,
      email: data.email,
      fullName: data.name,
      avatarUrl: data.picture || null,
    };
  } catch {
    throw new Error('Could not read Google profile');
  }
}

export default function useGoogleSignIn(onSuccess) {
  const { googleLogin } = useAuth();
  const [loading, setLoading] = useState(false);
  const resetTimerRef = useRef(null);

  const finish = () => {
    clearTimeout(resetTimerRef.current);
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    resetTimerRef.current = setTimeout(finish, 30000);

    try {
      await loadGsiScript();
      const clientId = await fetchGoogleClientId();

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'email profile',
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            toast.error('Google sign-in cancelled or failed.');
            finish();
            return;
          }
          try {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });
            const userInfo = await userInfoRes.json();

            const payload = {
              googleId: userInfo.sub,
              email: userInfo.email,
              fullName: userInfo.name,
              avatarUrl: userInfo.picture || null,
            };

            const result = await googleLogin(payload);
            onSuccess?.(result);
          } catch (err) {
            toast.error(err.response?.data?.error || 'Google sign-in failed. Please try again.');
          } finally {
            finish();
          }
        },
      });
      client.requestAccessToken();
    } catch (err) {
      toast.error(err.message || 'Google sign-in is currently unavailable.');
      finish();
    }
  };

  return { handleGoogleSignIn, loading };
}