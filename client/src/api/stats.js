import { api } from './client.js';

export const statsApi = {
  summary: () => api.get('/stats/summary'),
  popularBooks: (query) => api.get('/stats/popular-books', query),
  genres: () => api.get('/stats/genres'),
  overdue: () => api.get('/stats/overdue'),
  topReaders: (query) => api.get('/stats/top-readers', query),
};
