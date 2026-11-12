import { MongoClient } from 'mongodb';
import { config } from './env.js';

// Singleton: один MongoClient (з власним пулом з'єднань) на весь процес.
let client = null;
let db = null;

const CLIENT_OPTIONS = Object.freeze({
  // Не чекати стандартні 30 с, якщо кластер недоступний.
  serverSelectionTimeoutMS: 10_000,
});

function redact(text) {
  return String(text ?? '')
    .split(config.mongoUri)
    .join('<MONGO_URI>')
    .replace(/(mongodb(?:\+srv)?:\/\/)[^@/\s]*@/gi, '$1<credentials>@');
}

function hintsFor(err) {
  const message = String(err?.message ?? '');
  const code = err?.code;

  if (err?.name === 'MongoParseError' || /unescaped|URI must|Invalid scheme|percent-encod/i.test(message)) {
    return [
      'Рядок MONGO_URI має неправильний формат.',
      'Спецсимволи в логіні/паролі (@ : / ? # [ ] %) треба закодувати через encodeURIComponent,',
      '  напр. "p@ss" → "p%40ss".',
      'Формат: mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority',
    ];
  }

  if (code === 18 || code === 8000 || /auth(entication)? failed|bad auth/i.test(message)) {
    return [
      'Помилка автентифікації: неправильний логін або пароль.',
      'Перевірте користувача в Atlas → Database Access (це НЕ логін від акаунта Atlas).',
      'Якщо пароль містить спецсимволи — закодуйте їх (encodeURIComponent).',
    ];
  }

  if (/querySrv|ENOTFOUND|EAI_AGAIN|ECONNREFUSED/i.test(message)) {
    return [
      'Не вдалося знайти/досягти хост кластера.',
      'Перевірте адресу кластера в MONGO_URI та інтернет/DNS (деякі мережі блокують SRV-запити).',
    ];
  }

  if (err?.name === 'MongoServerSelectionError' || /Server selection timed out/i.test(message)) {
    return [
      'Не вдалося підключитися до кластера за відведений час.',
      'Найчастіша причина: ваш IP не додано в Atlas → Network Access (IP Access List).',
      'Також перевірте, чи кластер не на паузі, і чи не блокує порт 27017 фаєрвол/VPN.',
      'Якщо пароль містить спецсимволи — переконайтеся, що вони закодовані.',
    ];
  }

  return [
    'Перевірте: IP у Atlas → Network Access, логін/пароль у Database Access,',
    'та що спецсимволи в паролі закодовані (encodeURIComponent).',
  ];
}

export class DbConnectionError extends Error {
  constructor(cause) {
    const hints = hintsFor(cause);
    super(
      [
        `Не вдалося підключитися до MongoDB: ${cause?.name ?? 'Error'}: ${redact(cause?.message)}`,
        'Можливі причини:',
        ...hints.map((h) => `  • ${h}`),
      ].join('\n'),
    );
    this.name = 'DbConnectionError';
  }
}

export async function connectDb() {
  if (db) return db;

  try {
    client = new MongoClient(config.mongoUri, CLIENT_OPTIONS);
    await client.connect();
    db = client.db(config.dbName);
    return db;
  } catch (err) {
    await closeDb().catch(() => {});
    // Оригінальну помилку не прокидаємо як cause — у ній можуть бути деталі URI.
    throw new DbConnectionError(err);
  }
}

export function getDb() {
  if (!db) {
    throw new Error('Database is not connected. Call connectDb() first.');
  }
  return db;
}

export function getClient() {
  if (!client || !db) {
    throw new Error('Database is not connected. Call connectDb() first.');
  }
  return client;
}

export async function pingDb() {
  await getDb().command({ ping: 1 });
}

export async function closeDb() {
  if (client) {
    const c = client;
    client = null;
    db = null;
    await c.close();
  }
}
