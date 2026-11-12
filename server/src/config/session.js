import session from 'express-session';
import MongoStore from 'connect-mongo';
import { config } from './env.js';
import { getClient } from './db.js';

export const SESSION_COOKIE = 'library.sid';
export const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 години

export const sessionCookieOptions = Object.freeze({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.cookieSecure,
  path: '/',
});

// Сховище сесій у тій самій БД (колекція sessions, TTL-індекс). Викликати після connectDb().
export function createSessionStore() {
  return MongoStore.create({
    client: getClient(),
    dbName: config.dbName,
    collectionName: 'sessions',
    ttl: SESSION_TTL_MS / 1000,
  });
}

export function createSessionMiddleware(store) {
  return session({
    name: SESSION_COOKIE,
    secret: config.sessionSecret,
    store,
    resave: false,
    saveUninitialized: false,
    // Кожна відповідь продовжує сесію ще на 2 години від останньої активності.
    rolling: true,
    cookie: { ...sessionCookieOptions, maxAge: SESSION_TTL_MS },
  });
}
