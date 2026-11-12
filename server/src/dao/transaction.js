import { getClient } from '../config/db.js';

const TRANSACTION_OPTIONS = Object.freeze({
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
});

export async function withTransaction(fn) {
  const session = getClient().startSession();
  try {
    return await session.withTransaction(() => fn(session), TRANSACTION_OPTIONS);
  } finally {
    await session.endSession();
  }
}
