import api from './api';

// Documents are fetched with the auth header (not a plain link) so only the
// user's own company files can be opened.
const documentService = {
  // Returns an object URL for previewing the file; call URL.revokeObjectURL when done
  getPreviewUrl: async (id) => {
    const res = await api.get(`/documents/${id}/file`, { responseType: 'blob' });
    return URL.createObjectURL(res.data);
  },

  // Rows of a CSV / Excel document: { sheets: [{ name, rows, truncated }] }
  getTablePreview: async (id) => {
    const res = await api.get(`/documents/${id}/preview`);
    return res.data;
  },

  download: async (id, fileName) => {
    const res = await api.get(`/documents/${id}/file`, { params: { download: 1 }, responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'document';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export default documentService;
