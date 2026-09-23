import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useAuth } from '../components/AuthProvider';

let gsiPromise = null;
let cachedClientId = null;

function loadGsiScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gsiPromise) return gsiPromise;

  gsiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.oauth2) {
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

export default function useGoogleSignIn(onSuccess) {
  const { googleLogin } = useAuth();
  const [loading, setLoading] = useState(false);
  const clientRef = useRef(null);
  const initPromiseRef = useRef(null);
  const resetTimerRef = useRef(null);
  const googleLoginRef = useRef(googleLogin);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    googleLoginRef.current = googleLogin;
  }, [googleLogin]);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const finish = () => {
    clearTimeout(resetTimerRef.current);
    setLoading(false);
  };

  const ensureClient = () => {
    if (clientRef.current) return Promise.resolve(clientRef.current);
    if (initPromiseRef.current) return initPromiseRef.current;

    initPromiseRef.current = (async () => {
      await loadGsiScript();
      const clientId = await fetchGoogleClientId();

      if (!window.google?.accounts?.oauth2) {
        throw new Error('Google sign-in failed to initialize');
      }

      clientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'email profile',
        callback: async (tokenResponse) => {
          if (tokenResponse?.error) {
            toast.error('Google sign-in cancelled or failed.');
            finish();
            return;
          }

          try {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });
            if (!userInfoRes.ok) throw new Error('Could not read Google profile');
            const userInfo = await userInfoRes.json();

            const payload = {
              googleId: userInfo.sub,
              email: userInfo.email,
              fullName: userInfo.name,
              avatarUrl: userInfo.picture || null,
            };

            const result = await googleLoginRef.current(payload);
            onSuccessRef.current?.(result);
          } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Google sign-in failed. Please try again.');
          } finally {
            finish();
          }
        },
      });

      return clientRef.current;
    })();

    initPromiseRef.current.catch(() => {
      initPromiseRef.current = null;
    });

    return initPromiseRef.current;
  };

  useEffect(() => {
    ensureClient().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    resetTimerRef.current = setTimeout(finish, 30000);

    try {
      const client = await ensureClient();
      client.requestAccessToken();
    } catch (err) {
      toast.error(err.message || 'Google sign-in is currently unavailable.');
      finish();
    }
  };

  return { handleGoogleSignIn, loading };
}