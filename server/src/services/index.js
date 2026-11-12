import { createBookService } from './book.service.js';
import { createReaderService } from './reader.service.js';
import { createLoanService } from './loan.service.js';
import { createStatsService } from './stats.service.js';

export function createServices(daos, { nodeEnv = 'development' } = {}) {
  return Object.freeze({
    bookService: createBookService(daos),
    readerService: createReaderService(daos),
    loanService: createLoanService(daos, { allowBackdatedLoans: nodeEnv !== 'production' }),
    statsService: createStatsService(daos),
  });
}
