import { createContext, useContext, useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import authService from '../services/authService';
import teamService from '../services/teamService';
import PageLoader from './PageLoader';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" />;

  return children;
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Where the /login and /signup guards should send the user right after Google sign-in
  const [authRedirect, setAuthRedirect] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authService.getMe()
        .then((data) => setUser(data.user))
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await authService.login({ email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setAuthRedirect(null);
    setUser(data.user);
    return data;
  };

  const signup = async (full_name, email, password) => {
    const data = await authService.signup({ full_name, email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setAuthRedirect(null);
    setUser(data.user);
    return data;
  };

  const acceptInvite = async (token, data) => {
    const result = await teamService.acceptInvite(token, data);
    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result.user));
    setUser(result.user);
    return result;
  };

  const googleLogin = async (data) => {
    const result = await authService.googleCallback(data);
    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result.user));
    // Set together with user so the route guard redirects new users to onboarding
    setAuthRedirect(result.isNew ? '/onboarding/company' : '/app/dashboard');
    setUser(result.user);
    return result;
  };

  const updateUser = (data) => {
    setUser((prev) => {
      const merged = { ...prev, ...data };
      localStorage.setItem('user', JSON.stringify(merged));
      return merged;
    });
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuthRedirect(null);
    setUser(null);
    toast.success('Logged out successfully');
  };

  const role = user?.role || null;

  return (
    <AuthContext.Provider value={{ user, role, login, signup, acceptInvite, googleLogin, updateUser, logout, loading, authRedirect }}>
      {children}
    </AuthContext.Provider>
  );
}
