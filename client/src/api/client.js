// Єдина точка доступу до REST API. Компоненти працюють лише з функціями з src/api/*.

const BASE_URL = '/api';
export const MAX_LIMIT = 100; // максимальний limit, який приймає API
const CSRF_HEADER = 'X-CSRF-Token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export class ApiError extends Error {
  constructor(status, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details ?? [];
  }
}

// ---------- CSRF ----------

let csrfToken = null;
let csrfRequest = null;

// Токен від login (сесію регенеровано) або null після logout.
export function setCsrfToken(token) {
  csrfToken = token;
}

async function getCsrfToken({ refresh = false } = {}) {
  if (refresh) csrfToken = null;
  if (csrfToken) return csrfToken;
  // Кілька паралельних змінювальних запитів чекають один запит токена.
  csrfRequest ??= request('/auth/csrf', { redirectOnUnauthorized: false })
    .then((data) => (csrfToken = data.csrfToken))
    .finally(() => (csrfRequest = null));
  return csrfRequest;
}

// ---------- 401 ----------

let unauthorizedHandler = null;

// AuthProvider реєструє реакцію на 401 (скинути користувача й перейти на /login).
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

// ---------- Запит ----------

function buildUrl(path, query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  }
  const qs = params.toString();
  return `${BASE_URL}${path}${qs ? `?${qs}` : ''}`;
}

async function send(path, { method, query, body, signal }) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!SAFE_METHODS.has(method)) headers[CSRF_HEADER] = await getCsrfToken();

  try {
    return await fetch(buildUrl(path, query), {
      method,
      credentials: 'include',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'Сервер недоступний');
  }
}

export async function request(
  path,
  { method = 'GET', query, body, signal, redirectOnUnauthorized = true } = {},
) {
  let res = await send(path, { method, query, body, signal });

  // Токен міг застаріти (сесія закінчилась або змінилась) — оновлюємо й повторюємо один раз.
  if (res.status === 403 && !SAFE_METHODS.has(method)) {
    await getCsrfToken({ refresh: true });
    res = await send(path, { method, query, body, signal });
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Формат помилки API: { error: { status, message, details } }
    const error = data?.error;
    const apiError = new ApiError(res.status, error?.message ?? `Помилка ${res.status}`, error?.details);
    if (res.status === 401 && redirectOnUnauthorized) unauthorizedHandler?.(apiError);
    throw apiError;
  }
  return data;
}

export const api = {
  get: (path, query, options) => request(path, { ...options, query }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
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
