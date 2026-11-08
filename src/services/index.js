import { createBookService } from './book.service.js';
import { createReaderService } from './reader.service.js';

/**
 * Створює всі сервіси з реєстру DAO. Викликається один раз при старті:
 *   const services = createServices(getDaos());
 */
export function createServices(daos) {
  return Object.freeze({
    bookService: createBookService(daos),
    readerService: createReaderService(daos),
  });
}
