// Єдина точка доступу до REST API. Компоненти працюють лише з функціями з src/api/*.

const BASE_URL = '/api';
export const MAX_LIMIT = 100; // максимальний limit, який приймає API

export class ApiError extends Error {
  constructor(status, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

function buildUrl(path, query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  }
  const qs = params.toString();
  return `${BASE_URL}${path}${qs ? `?${qs}` : ''}`;
}

export async function request(path, { method = 'GET', query, body, signal } = {}) {
  let res;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'Сервер недоступний');
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Формат помилки API: { error: { status, message, details } }
    const error = data?.error;
    throw new ApiError(res.status, error?.message ?? `Помилка ${res.status}`, error?.details ?? []);
  }
  return data;
}

export const api = {
  get: (path, query, options) => request(path, { ...options, query }),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

// Завантажує всі сторінки списку (API віддає щонайбільше MAX_LIMIT записів за раз).
export async function fetchAll(path, query = {}) {
  const first = await api.get(path, { ...query, limit: MAX_LIMIT, page: 1 });
  const items = [...first.items];
  for (let page = 2; page <= first.totalPages; page++) {
    const next = await api.get(path, { ...query, limit: MAX_LIMIT, page });
    items.push(...next.items);
  }
  return items;
}
