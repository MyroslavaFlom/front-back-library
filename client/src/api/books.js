import { api, fetchAll } from './client.js';

export const booksApi = {
  list: (query) => api.get('/books', query),
  listAll: (query) => fetchAll('/books', query),
  get: (id) => api.get(`/books/${id}`),
  create: (data) => api.post('/books', data),
  replace: (id, data) => api.put(`/books/${id}`, data),
  remove: (id) => api.delete(`/books/${id}`),
};
