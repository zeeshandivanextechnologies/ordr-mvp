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

  // In-app notifications of the logged-in user: { notifications, unreadCount }
  getInbox: async (limit = 50) => {
    const res = await api.get('/notifications/inbox', { params: { limit } });
    return res.data;
  },

  markRead: async (id) => {
    const res = await api.patch(`/notifications/inbox/${id}/read`);
    return res.data;
  },

  markAllRead: async () => {
    const res = await api.post('/notifications/inbox/read-all');
    return res.data;
  },
};

export default notificationService;