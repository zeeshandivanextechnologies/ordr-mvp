import api from './api';

const integrationService = {
  getGmailStatus: async () => {
    const res = await api.get('/integration/status');
    return res.data;
  },

  getGmailConnectUrl: async (redirect) => {
    const res = await api.get('/integration/gmail/connect', { params: { redirect } });
    return res.data;
  },

  scanInbox: async () => {
    const res = await api.post('/integration/gmail/scan');
    return res.data;
  },

  disconnectGmail: async (id) => {
    const res = await api.delete(`/integration/gmail/${id}`);
    return res.data;
  },
};

export default integrationService;