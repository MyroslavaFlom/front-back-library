import { api, fetchAll } from './client.js';

export const readersApi = {
  list: (query) => api.get('/readers', query),
  listAll: (query) => fetchAll('/readers', query),
  get: (id) => api.get(`/readers/${id}`),
  create: (data) => api.post('/readers', data),
  replace: (id, data) => api.put(`/readers/${id}`, data),
  remove: (id) => api.delete(`/readers/${id}`),
};
