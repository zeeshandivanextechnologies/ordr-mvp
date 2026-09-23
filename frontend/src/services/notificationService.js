import api from './api';

const notificationService = {
  getPreferences: async () => {
    const res = await api.get('/notifications');
    return res.data;
  },

  updatePreferences: async (data) => {
    const res = await api.patch('/notifications', data);
    return res.data;
  },
};

export default notificationService;