import { api, fetchAll } from './client.js';

export const readersApi = {
  list: (query) => api.get('/readers', query),
  listAll: (query) => fetchAll('/readers', query),
  get: (id) => api.get(`/readers/${id}`),
  create: (data) => api.post('/readers', data),
  remove: (id) => api.delete(`/readers/${id}`),
  loans: (id, query) => api.get(`/readers/${id}/loans`, query),
  recommendations: (id, query) => api.get(`/readers/${id}/recommendations`, query),
};
