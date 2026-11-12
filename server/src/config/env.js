import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function list(value, fallback) {
  const items = (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return items.length > 0 ? items : fallback;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

const sessionSecret = required('SESSION_SECRET');
if (isProduction && sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters long in production');
}

export const config = Object.freeze({
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT ?? 3000),
  mongoUri: required('MONGO_URI'),
  dbName: required('DB_NAME'),
  sessionSecret,
  // Звідки дозволені крос-доменні запити з cookie (CORS). Кілька — через кому.
  clientOrigins: list(process.env.CLIENT_ORIGIN, ['http://localhost:5173']),
  // Cookie сесії з прапорцем Secure: за замовчуванням лише в production.
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProduction,
  // Кількість довірених reverse-proxy перед сервером (для req.ip, req.secure). 0 — без проксі.
  trustProxy: Number(process.env.TRUST_PROXY ?? 0),
  adminUsername: process.env.ADMIN_USERNAME,
  adminPassword: process.env.ADMIN_PASSWORD,
});
