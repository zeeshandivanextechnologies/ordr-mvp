import api from './api';

const companyService = {
  getCompany: async () => {
    const res = await api.get('/company');
    return res.data;
  },

  updateCompany: async (data) => {
    const res = await api.patch('/company', data);
    return res.data;
  }
};

export default companyService;
