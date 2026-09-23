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

  getMembers: async () => {
    const res = await api.get('/team/members');
    return res.data;
  },

  removeMember: async (userId) => {
    const res = await api.delete(`/team/members/${userId}`);
    return res.data;
  },

  updateMemberStatus: async (userId, isActive) => {
    const res = await api.patch(`/team/members/${userId}/status`, { is_active: isActive });
    return res.data;
  },

  revokeInvitation: async (inviteId) => {
    const res = await api.delete(`/team/invitations/${inviteId}`);
    return res.data;
  },

  acceptInvite: async (token, data) => {
    const res = await api.post(`/team/invitations/${token}/accept`, data);
    return res.data;
  }
};

export default teamService;
