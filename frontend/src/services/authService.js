import api from './api';

const authService = {
  signup: async (data) => {
    const res = await api.post('/auth/signup', data);
    return res.data;
  },

  login: async (data) => {
    const res = await api.post('/auth/login', data);
    return res.data;
  },

  logout: async () => {
    const res = await api.post('/auth/logout');
    return res.data;
  },

  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },

  forgotPassword: async (email) => {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  },

  verifyOtp: async (email, otp) => {
    const res = await api.post('/auth/verify-otp', { email, otp });
    return res.data;
  },

  resendOtp: async (email) => {
    const res = await api.post('/auth/resend-otp', { email });
    return res.data;
  },

  resetPassword: async (email, otp, password) => {
    const res = await api.post('/auth/reset-password', { email, otp, password });
    return res.data;
  },

  googleCallback: async (data) => {
    const res = await api.post('/auth/google/callback', data);
    return res.data;
  },
};

export default authService;
