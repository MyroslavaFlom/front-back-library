export const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('uk-UA') : '—');
export const fmtMoney = (n) => `${n} грн`;
export const dash = (v) => (v === undefined || v === null || v === '' ? '—' : v);

// Значення форми → тіло запиту: порожні поля пропускаються, числові конвертуються.
export function toBody(values, numericFields = []) {
  const body = {};
  for (const [key, raw] of Object.entries(values)) {
    const value = typeof raw === 'string' ? raw.trim() : raw;
    if (value === '' || value === undefined || value === null) continue;
    body[key] = numericFields.includes(key) ? Number(value) : value;
  }
  return body;
}
