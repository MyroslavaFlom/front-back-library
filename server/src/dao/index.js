import { BaseDao } from './base.dao.js';
import { BookDao } from './book.dao.js';
import { ReaderDao } from './reader.dao.js';
import { LoanDao } from './loan.dao.js';
import { withTransaction } from './transaction.js';

export function createDaoRegistry() {
  return Object.freeze({
    bookDao: new BookDao(),
    readerDao: new ReaderDao(),
    loanDao: new LoanDao(),
    withTransaction,
  });
}

let registry = null;

export function getDaos() {
  registry ??= createDaoRegistry();
  return registry;
}

export async function ensureIndexes(daos = getDaos()) {
  const all = Object.values(daos).filter((dao) => dao instanceof BaseDao);
  await Promise.all(all.map((dao) => dao.ensureIndexes()));
}
