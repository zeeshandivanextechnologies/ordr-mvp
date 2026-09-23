import api from './api';

const teamService = {
  inviteMembers: async (invites) => {
    const res = await api.post('/team/invite', { invites });
    return res.data;
  },

  verifyInvite: async (token) => {
    const res = await api.get(`/team/invitations/${token}`);
    return res.data;
  },

  acceptInvite: async (token, data) => {
    const res = await api.post(`/team/invitations/${token}/accept`, data);
    return res.data;
  }
};

export default teamService;
