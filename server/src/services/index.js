import { createBookService } from './book.service.js';
import { createReaderService } from './reader.service.js';
import { createLoanService } from './loan.service.js';
import { createStatsService } from './stats.service.js';
import { createAuthService } from './auth.service.js';
import { createEventService } from './event.service.js';
import { noopEvents } from '../events/index.js';

export function createServices(daos, { nodeEnv = 'development', events = noopEvents } = {}) {
  const deps = { ...daos, events };
  return Object.freeze({
    bookService: createBookService(deps),
    readerService: createReaderService(deps),
    loanService: createLoanService(deps, { allowBackdatedLoans: nodeEnv !== 'production' }),
    statsService: createStatsService(deps),
    authService: createAuthService(deps),
    eventService: createEventService(events),
  });
}
