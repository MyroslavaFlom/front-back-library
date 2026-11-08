import { BookDao } from './book.dao.js';
import { ReaderDao } from './reader.dao.js';
import { LoanDao } from './loan.dao.js';

/**
 * Фабрика реєстру DAO. Сервіси отримують потрібні DAO як залежність:
 *
 *   export function createBookService({ bookDao }) { ... }
 *   const bookService = createBookService(getDaos());
 *
 * У тестах можна передати власні (mock) реалізації замість getDaos().
 */
export function createDaoRegistry() {
  return Object.freeze({
    bookDao: new BookDao(),
    readerDao: new ReaderDao(),
    loanDao: new LoanDao(),
  });
}

let registry = null;

/** Спільний для процесу реєстр DAO (створюється ліниво). */
export function getDaos() {
  registry ??= createDaoRegistry();
  return registry;
}

/** Ідемпотентно створює індекси для всіх колекцій. Викликати після connectDb(). */
export async function ensureIndexes(daos = getDaos()) {
  await Promise.all(Object.values(daos).map((dao) => dao.ensureIndexes()));
}
