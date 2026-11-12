import { api, setCsrfToken } from './client.js';

// 401 тут — очікувана відповідь (не увійшли / невірний пароль), тож без редіректу на /login.
const quiet = { redirectOnUnauthorized: false };

export const authApi = {
  async me() {
    const { user } = await api.get('/auth/me', undefined, quiet);
    return user;
  },

  async login(credentials) {
    const { user, csrfToken } = await api.post('/auth/login', credentials, quiet);
    setCsrfToken(csrfToken);
    return user;
  },

  async logout() {
    try {
      await api.post('/auth/logout', undefined, quiet);
    } finally {
      setCsrfToken(null);
    }
  },
};
