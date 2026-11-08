import { getClient } from '../config/db.js';

const TRANSACTION_OPTIONS = Object.freeze({
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
});

/**
 * Виконує fn(session) у транзакції MongoDB (потрібен replica set — Atlas підходить).
 * Драйвер сам повторює fn при TransientTransactionError (зокрема WriteConflict
 * від конкурентної транзакції), тому fn має бути ідемпотентною: лише читання
 * й записи через DAO з переданим session, без побічних ефектів назовні.
 * Помилка, кинута з fn (напр. HttpError), скасовує транзакцію й прокидається далі.
 *
 * Сервіси отримують цю функцію як залежність (getDaos().withTransaction),
 * тому не знають ні про MongoClient, ні про драйвер.
 *
 * @template T
 * @param {(session: import('mongodb').ClientSession) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTransaction(fn) {
  const session = getClient().startSession();
  try {
    return await session.withTransaction(() => fn(session), TRANSACTION_OPTIONS);
  } finally {
    await session.endSession();
  }
}
