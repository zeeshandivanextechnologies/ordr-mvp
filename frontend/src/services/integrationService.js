import api from './api';

const integrationService = {
  getGmailStatus: async () => {
    const res = await api.get('/integration/status');
    return res.data;
  },
  
  getGmailConnectUrl: async () => {
    const res = await api.get('/integration/gmail/connect');
    return res.data;
  }
};

export default integrationService;
