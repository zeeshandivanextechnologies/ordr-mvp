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

// An admin whose company has not finished onboarding (Module 2)
const needsOnboarding = (user) => user?.role === 'admin' && user?.onboarding_completed === false;

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" />;
  if (needsOnboarding(user)) return <Navigate to="/onboarding/company" replace />;

  return children;
}

// Onboarding sets up the company, so only a signed-in admin still onboarding may open it.
// allowCompleted keeps the final "All Set!" step visible right after it marks onboarding done.
export function OnboardingRoute({ children, allowCompleted = false }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'admin') return <Navigate to="/app/dashboard" replace />;
  if (!allowCompleted && !needsOnboarding(user)) return <Navigate to="/app/dashboard" replace />;

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

  // Sign-in responses carry only the basic user; /auth/me adds the company's
  // onboarding state and tracking preference that the route guards need
  const loadFullUser = async (basicUser) => {
    try {
      const me = await authService.getMe();
      return me?.user || basicUser;
    } catch (e) {
      return basicUser;
    }
  };

  const login = async (email, password) => {
    const data = await authService.login({ email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    const fullUser = await loadFullUser(data.user);
    setAuthRedirect(null);
    setUser(fullUser);
    return data;
  };

  const signup = async (full_name, email, password) => {
    const data = await authService.signup({ full_name, email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    const fullUser = await loadFullUser(data.user);
    setAuthRedirect(null);
    setUser(fullUser);
    return data;
  };

  const acceptInvite = async (token, data) => {
    const result = await teamService.acceptInvite(token, data);
    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result.user));
    const fullUser = await loadFullUser(result.user);
    setUser(fullUser);
    return result;
  };

  const googleLogin = async (data) => {
    const result = await authService.googleCallback(data);
    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result.user));
    const fullUser = await loadFullUser(result.user);
    // Set together with user so the route guard redirects new users to onboarding
    setAuthRedirect(result.isNew ? '/onboarding/company' : '/app/dashboard');
    setUser(fullUser);
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
