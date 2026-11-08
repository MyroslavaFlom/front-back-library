import { HttpError } from '../utils/HttpError.js';
import { validateLoanCreate } from '../validators/loan.validator.js';
import { parseLoanListQuery, totalPages } from '../validators/query.validator.js';

export const DEFAULT_LOAN_DAYS = 14;
export const MAX_ACTIVE_LOANS = 3;
export const EXTENSION_DAYS = 7;
export const FINE_PER_DAY_UAH = 5;

const DAY_MS = 24 * 60 * 60 * 1000;
const SORTABLE = ['loanDate', 'dueDate', 'returnDate', 'createdAt'];

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

/** Кількість днів прострочення: будь-яка неповна доба рахується як повна. */
function overdueDays(dueDate, until) {
  const ms = until.getTime() - dueDate.getTime();
  return ms > 0 ? Math.ceil(ms / DAY_MS) : 0;
}

/**
 * Додає до видачі обчислювані поля (у базі не зберігаються):
 *   isOverdue   — status "active" і dueDate < now;
 *   daysOverdue, fine — якщо видача прострочена (для активної — станом на зараз,
 *                       для повернутої — на момент повернення).
 */
function present(loan, now = new Date()) {
  const isOverdue = loan.status === 'active' && loan.dueDate < now;
  const until = loan.status === 'returned' ? loan.returnDate : now;
  const days = overdueDays(loan.dueDate, until);
  const result = { ...loan, extended: loan.extended ?? false, isOverdue };
  if (days > 0) {
    result.daysOverdue = days;
    result.fine = days * FINE_PER_DAY_UAH;
  }
  return result;
}

/** Фільтр статусу для запиту до БД; "overdue" обчислюється за dueDate. */
function statusFilter(status, now) {
  switch (status) {
    case 'active':
      return { status: 'active', dueDate: { $gte: now } };
    case 'overdue':
      return { status: 'active', dueDate: { $lt: now } };
    case 'returned':
      return { status: 'returned' };
    default:
      return {};
  }
}

/**
 * @param {{ bookDao: import('../dao/book.dao.js').BookDao,
 *           readerDao: import('../dao/reader.dao.js').ReaderDao,
 *           loanDao: import('../dao/loan.dao.js').LoanDao,
 *           withTransaction: typeof import('../dao/transaction.js').withTransaction }} deps
 * @param {{ allowBackdatedLoans?: boolean }} [options] — дозволити loanDate у POST (лише не в production)
 */
export function createLoanService(
  { bookDao, readerDao, loanDao, withTransaction },
  { allowBackdatedLoans = false } = {},
) {
  async function getExisting(id, session) {
    const loan = await loanDao.findById(id, { session });
    if (!loan) throw HttpError.notFound(`Loan with id "${id}" not found`);
    return loan;
  }

  async function list(query) {
    const now = new Date();
    const { page, limit, skip, sort, status, readerId, bookId } = parseLoanListQuery(query, {
      sortable: SORTABLE,
      defaultSort: { loanDate: -1 },
    });

    const filter = statusFilter(status, now);
    if (readerId) filter.readerId = readerId;
    if (bookId) filter.bookId = bookId;

    const [items, total] = await Promise.all([
      loanDao.findAll(filter, { sort, skip, limit }),
      loanDao.count(filter),
    ]);
    return {
      items: items.map((loan) => present(loan, now)),
      total,
      page,
      limit,
      totalPages: totalPages(total, limit),
    };
  }

  return {
    /** @param {{ status?, readerId?, bookId?, page?, limit?, sort? }} query */
    getAll(query = {}) {
      return list(query);
    },

    /** Історія видач читача (з тими самими фільтрами й пагінацією). */
    async getByReader(readerId, query = {}) {
      if (!(await readerDao.findById(readerId))) {
        throw HttpError.notFound(`Reader with id "${readerId}" not found`);
      }
      return list({ ...query, readerId });
    },

    async getById(id) {
      return present(await getExisting(id));
    },

    /**
     * Видача книжки. Усі перевірки, зменшення availableCopies і створення видачі —
     * в одній транзакції:
     *   - книжка: $inc з умовою availableCopies >= 1 (атомарно, без від'ємних значень);
     *   - читач: lock(), щоб конкурентні видачі тому самому читачу та його видалення
     *     конфліктували й виконувались послідовно (ліміт 3 і перевірки не обходяться).
     */
    async create(input) {
      const { bookId, readerId, days = DEFAULT_LOAN_DAYS, loanDate: givenLoanDate } =
        validateLoanCreate(input, { allowLoanDate: allowBackdatedLoans });

      let loan;
      try {
        loan = await withTransaction(async (session) => {
          const now = new Date();

          if (!(await bookDao.findById(bookId, { session }))) {
            throw HttpError.notFound(`Book with id "${bookId}" not found`);
          }
          if (!(await readerDao.lock(readerId, { session }))) {
            throw HttpError.notFound(`Reader with id "${readerId}" not found`);
          }

          const active = await loanDao.findAll({ readerId, status: 'active' }, { session });

          if (active.some((l) => l.bookId === bookId)) {
            throw HttpError.conflict('Reader already has an active loan of this book');
          }
          if (active.length >= MAX_ACTIVE_LOANS) {
            throw HttpError.unprocessable(
              `Reader has reached the limit of ${MAX_ACTIVE_LOANS} active loans`,
              [{ field: 'readerId', message: `active loans: ${active.length}` }],
            );
          }
          const overdue = active.filter((l) => l.dueDate < now);
          if (overdue.length > 0) {
            throw HttpError.unprocessable(
              'Reader has overdue loans; return them before borrowing new books',
              overdue.map((l) => ({ field: 'readerId', message: `overdue loan ${l.id}` })),
            );
          }

          if (!(await bookDao.adjustAvailableCopies(bookId, -1, { session }))) {
            throw HttpError.conflict('Немає вільних примірників');
          }

          const loanDate = givenLoanDate ?? now;
          return loanDao.create(
            {
              bookId,
              readerId,
              loanDate,
              dueDate: addDays(loanDate, days),
              returnDate: null,
              status: 'active',
              extended: false,
            },
            { session },
          );
        });
      } catch (err) {
        // Захисна сітка: частковий унікальний індекс (bookId, readerId) для активних видач.
        if (err?.code === 11000) {
          throw HttpError.conflict('Reader already has an active loan of this book');
        }
        throw err;
      }
      return present(loan);
    },

    /** Повернення: status → returned, returnDate = now, availableCopies + 1 — атомарно. */
    async returnLoan(id) {
      const loan = await withTransaction(async (session) => {
        const existing = await getExisting(id, session);
        if (existing.status === 'returned') {
          throw HttpError.conflict('Loan has already been returned');
        }

        const updated = await loanDao.update(
          id,
          { status: 'returned', returnDate: new Date() },
          { session, filter: { status: 'active' } },
        );
        if (!updated) throw HttpError.conflict('Loan has already been returned');

        await bookDao.adjustAvailableCopies(existing.bookId, 1, { session });
        return updated;
      });
      return present(loan);
    },

    /** Продовження на 7 днів: лише один раз і лише якщо видача не прострочена. */
    async extend(id) {
      const now = new Date();
      const loan = await getExisting(id);

      if (loan.status === 'returned') {
        throw HttpError.conflict('Returned loan cannot be extended');
      }
      if (loan.extended) {
        throw HttpError.unprocessable('Loan has already been extended once');
      }
      if (loan.dueDate < now) {
        throw HttpError.unprocessable('Overdue loan cannot be extended');
      }

      // Атомарне умовне оновлення: ті самі умови перевіряються ще раз у запиті до БД.
      const updated = await loanDao.update(
        id,
        { dueDate: addDays(loan.dueDate, EXTENSION_DAYS), extended: true },
        { filter: { status: 'active', extended: { $ne: true }, dueDate: { $gte: now } } },
      );
      if (!updated) {
        throw HttpError.conflict('Loan was modified concurrently, please retry');
      }
      return present(updated);
    },
  };
}
