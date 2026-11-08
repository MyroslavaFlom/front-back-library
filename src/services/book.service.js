import { HttpError } from '../utils/HttpError.js';
import { toConflict } from '../utils/mongoErrors.js';
import { validateBook, validateBookPatch } from '../validators/book.validator.js';
import {
  parseBookListQuery,
  optionalString,
  escapeRegex,
  totalPages,
} from '../validators/query.validator.js';

const SORTABLE = ['title', 'author', 'year', 'rating', 'pages', 'createdAt'];

/**
 * Перевірки активних видач і запис книжки виконуються в одній транзакції:
 * видача (LoanService) теж пише в документ книжки ($inc availableCopies), тож
 * конкурентні операції конфліктують (WriteConflict) і драйвер повторює одну з них
 * уже з актуальними даними.
 *
 * @param {{ bookDao: import('../dao/book.dao.js').BookDao,
 *           loanDao: import('../dao/loan.dao.js').LoanDao,
 *           withTransaction: typeof import('../dao/transaction.js').withTransaction }} deps
 */
export function createBookService({ bookDao, loanDao, withTransaction }) {
  async function getExisting(id, session) {
    const book = await bookDao.findById(id, { session });
    if (!book) throw HttpError.notFound(`Book with id "${id}" not found`);
    return book;
  }

  function countActiveLoans(bookId, session) {
    return loanDao.count({ bookId, status: 'active' }, { session });
  }

  /**
   * Узгоджує totalCopies/availableCopies з активними видачами.
   * Повертає змінені дані з коректним availableCopies (або без нього, якщо він не змінюється).
   */
  async function reconcileCopies(existing, changes, session, { replace = false } = {}) {
    const totalChanged =
      changes.totalCopies !== undefined && changes.totalCopies !== existing.totalCopies;
    const availableGiven = changes.availableCopies !== undefined;

    if (!totalChanged && !availableGiven) {
      // PUT прибирає відсутні поля, тож availableCopies треба зберегти явно.
      return replace ? { ...changes, availableCopies: existing.availableCopies } : changes;
    }

    const total = changes.totalCopies ?? existing.totalCopies;
    const active = await countActiveLoans(existing.id, session);

    if (total < active) {
      throw HttpError.unprocessable(
        `totalCopies (${total}) cannot be less than the number of copies on loan (${active})`,
        [{ field: 'totalCopies', message: `must be >= ${active} (active loans)` }],
      );
    }

    const maxAvailable = total - active;
    if (availableGiven) {
      if (changes.availableCopies > maxAvailable) {
        throw HttpError.unprocessable(
          `availableCopies (${changes.availableCopies}) exceeds copies not on loan (${maxAvailable})`,
          [{ field: 'availableCopies', message: `must be <= ${maxAvailable} (totalCopies - active loans)` }],
        );
      }
      return changes;
    }

    return { ...changes, availableCopies: maxAvailable };
  }

  /** Виконує fn у транзакції, перетворюючи E11000 на 409. */
  async function inTransaction(fn) {
    try {
      return await withTransaction(fn);
    } catch (err) {
      throw toConflict(err, 'Book');
    }
  }

  return {
    /**
     * @param {{ page?, limit?, sort?, search?, genre?, author?, yearFrom?, yearTo?, available? }} query
     *   — сирі значення з query-рядка
     * @returns {{ items, total, page, limit, totalPages }}
     */
    async getAll(query = {}) {
      const { page, limit, skip, sort, yearFrom, yearTo, available } = parseBookListQuery(query, {
        sortable: SORTABLE,
      });

      const filter = {};
      if (yearFrom !== undefined || yearTo !== undefined) {
        filter.year = {};
        if (yearFrom !== undefined) filter.year.$gte = yearFrom;
        if (yearTo !== undefined) filter.year.$lte = yearTo;
      }
      if (available === true) filter.availableCopies = { $gt: 0 };
      if (available === false) filter.availableCopies = 0;

      const search = optionalString(query.search);
      const genre = optionalString(query.genre);
      const author = optionalString(query.author);
      if (search) filter.$text = { $search: search };
      if (genre) filter.genre = { $regex: `^${escapeRegex(genre)}$`, $options: 'i' };
      if (author) filter.author = { $regex: escapeRegex(author), $options: 'i' };

      const [items, total] = await Promise.all([
        bookDao.findAll(filter, { sort, skip, limit }),
        bookDao.count(filter),
      ]);
      return { items, total, page, limit, totalPages: totalPages(total, limit) };
    },

    getById(id) {
      return getExisting(id);
    },

    async create(input) {
      const data = validateBook(input);
      data.availableCopies ??= data.totalCopies;
      try {
        return await bookDao.create(data);
      } catch (err) {
        throw toConflict(err, 'Book');
      }
    },

    /** PUT: повна заміна (усі обов'язкові поля, відсутні необов'язкові видаляються). */
    async replace(id, input) {
      const data = validateBook(input);
      return inTransaction(async (session) => {
        const existing = await getExisting(id, session);
        const toSave = await reconcileCopies(existing, data, session, { replace: true });
        return (await bookDao.replace(id, toSave, { session })) ?? getExisting(id, session);
      });
    },

    /** PATCH: часткове оновлення лише переданих полів. */
    async patch(id, input) {
      const changes = validateBookPatch(input);
      return inTransaction(async (session) => {
        const existing = await getExisting(id, session);

        // availableCopies без totalCopies у тілі — перевіряємо проти збереженого totalCopies.
        if (changes.availableCopies !== undefined && changes.totalCopies === undefined
            && changes.availableCopies > existing.totalCopies) {
          throw HttpError.badRequest('Validation failed', [
            { field: 'availableCopies', message: `must be <= totalCopies (${existing.totalCopies})` },
          ]);
        }

        const toSave = await reconcileCopies(existing, changes, session);
        return (await bookDao.update(id, toSave, { session })) ?? getExisting(id, session);
      });
    },

    /** Видалення заборонене, поки є активні видачі (перевірка й видалення — атомарно). */
    async delete(id) {
      await withTransaction(async (session) => {
        await getExisting(id, session);
        const active = await countActiveLoans(id, session);
        if (active > 0) {
          throw HttpError.conflict(`Book cannot be deleted: it has ${active} active loan(s)`);
        }
        if (!(await bookDao.delete(id, { session }))) {
          throw HttpError.notFound(`Book with id "${id}" not found`);
        }
      });
    },
  };
}
