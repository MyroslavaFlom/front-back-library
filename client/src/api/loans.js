import { api, fetchAll } from './client.js';

export const loansApi = {
  list: (query) => api.get('/loans', query),
  listAll: (query) => fetchAll('/loans', query),
  create: (data) => api.post('/loans', data),
  return: (id) => api.post(`/loans/${id}/return`),
  extend: (id) => api.post(`/loans/${id}/extend`),
};
