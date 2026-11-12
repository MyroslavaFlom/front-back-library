import { HttpError } from '../utils/HttpError.js';
import { validateLoanCreate } from '../validators/loan.validator.js';
import { parseLoanListQuery, totalPages } from '../validators/query.validator.js';
import { calculateFine } from './fine.js';

export { FINE_PER_DAY_UAH } from './fine.js';
export const DEFAULT_LOAN_DAYS = 14;
export const MAX_ACTIVE_LOANS = 3;
export const EXTENSION_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
const SORTABLE = ['loanDate', 'dueDate', 'returnDate', 'createdAt'];

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

function present(loan, now = new Date()) {
  const isOverdue = loan.status === 'active' && loan.dueDate < now;
  const until = loan.status === 'returned' ? loan.returnDate : now;
  const { daysOverdue, fine } = calculateFine(loan.dueDate, until);
  const result = { ...loan, extended: loan.extended ?? false, isOverdue };
  if (daysOverdue > 0) {
    result.daysOverdue = daysOverdue;
    result.fine = fine;
  }
  return result;
}

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

export function createLoanService(
  { bookDao, readerDao, loanDao, withTransaction },
  { allowBackdatedLoans = false } = {},
) {
  async function getExisting(id, session) {
    const loan = await loanDao.findById(id, { session });
    if (!loan) throw HttpError.notFound(`Видачу з id "${id}" не знайдено`);
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
    getAll(query = {}) {
      return list(query);
    },

    async getByReader(readerId, query = {}) {
      if (!(await readerDao.findById(readerId))) {
        throw HttpError.notFound(`Читача з id "${readerId}" не знайдено`);
      }
      return list({ ...query, readerId });
    },

    async getById(id) {
      return present(await getExisting(id));
    },

    async create(input) {
      const { bookId, readerId, days = DEFAULT_LOAN_DAYS, loanDate: givenLoanDate } =
        validateLoanCreate(input, { allowLoanDate: allowBackdatedLoans });

      let loan;
      try {
        loan = await withTransaction(async (session) => {
          const now = new Date();

          if (!(await bookDao.findById(bookId, { session }))) {
            throw HttpError.notFound(`Книжку з id "${bookId}" не знайдено`);
          }
          if (!(await readerDao.lock(readerId, { session }))) {
            throw HttpError.notFound(`Читача з id "${readerId}" не знайдено`);
          }

          const active = await loanDao.findAll({ readerId, status: 'active' }, { session });

          if (active.some((l) => l.bookId === bookId)) {
            throw HttpError.conflict('Читач уже має активну видачу цієї книжки');
          }
          if (active.length >= MAX_ACTIVE_LOANS) {
            throw HttpError.unprocessable(
              `Читач досяг ліміту активних видач (${MAX_ACTIVE_LOANS})`,
              [{ field: 'readerId', message: `активних видач: ${active.length}` }],
            );
          }
          const overdue = active.filter((l) => l.dueDate < now);
          if (overdue.length > 0) {
            throw HttpError.unprocessable(
              'Читач має прострочені видачі; поверніть їх, перш ніж брати нові книжки',
              overdue.map((l) => ({ field: 'readerId', message: `прострочена видача ${l.id}` })),
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
          throw HttpError.conflict('Читач уже має активну видачу цієї книжки');
        }
        throw err;
      }
      return present(loan);
    },

    async returnLoan(id) {
      const loan = await withTransaction(async (session) => {
        const existing = await getExisting(id, session);
        if (existing.status === 'returned') {
          throw HttpError.conflict('Видачу вже повернено');
        }

        const updated = await loanDao.update(
          id,
          { status: 'returned', returnDate: new Date() },
          { session, filter: { status: 'active' } },
        );
        if (!updated) throw HttpError.conflict('Видачу вже повернено');

        await bookDao.adjustAvailableCopies(existing.bookId, 1, { session });
        return updated;
      });
      return present(loan);
    },

    async extend(id) {
      const now = new Date();
      const loan = await getExisting(id);

      if (loan.status === 'returned') {
        throw HttpError.conflict('Повернену видачу не можна продовжити');
      }
      if (loan.extended) {
        throw HttpError.unprocessable('Видачу вже продовжували один раз');
      }
      if (loan.dueDate < now) {
        throw HttpError.unprocessable('Прострочену видачу не можна продовжити');
      }

      // Атомарне умовне оновлення: ті самі умови перевіряються ще раз у запиті до БД.
      const updated = await loanDao.update(
        id,
        { dueDate: addDays(loan.dueDate, EXTENSION_DAYS), extended: true },
        { filter: { status: 'active', extended: { $ne: true }, dueDate: { $gte: now } } },
      );
      if (!updated) {
        throw HttpError.conflict('Видачу одночасно змінили, повторіть спробу');
      }
      return present(updated);
    },
  };
}
