import { HttpError } from '../utils/HttpError.js';
import { toConflict } from '../utils/mongoErrors.js';
import { validateBook, validateBookPatch } from '../validators/book.validator.js';
import { parseListQuery, optionalString, escapeRegex } from '../validators/query.validator.js';

const SORTABLE = ['title', 'author', 'year', 'rating', 'pages', 'createdAt'];

/**
 * @param {{ bookDao: import('../dao/book.dao.js').BookDao,
 *           loanDao: import('../dao/loan.dao.js').LoanDao }} deps
 */
export function createBookService({ bookDao, loanDao }) {
  async function getExisting(id) {
    const book = await bookDao.findById(id);
    if (!book) throw HttpError.notFound(`Book with id "${id}" not found`);
    return book;
  }

  function countActiveLoans(bookId) {
    return loanDao.count({ bookId, status: 'active' });
  }

  /**
   * Узгоджує totalCopies/availableCopies з активними видачами.
   * Повертає змінені дані з коректним availableCopies (або без нього, якщо він не змінюється).
   */
  async function reconcileCopies(existing, changes, { replace = false } = {}) {
    const totalChanged =
      changes.totalCopies !== undefined && changes.totalCopies !== existing.totalCopies;
    const availableGiven = changes.availableCopies !== undefined;

    if (!totalChanged && !availableGiven) {
      // PUT прибирає відсутні поля, тож availableCopies треба зберегти явно.
      return replace ? { ...changes, availableCopies: existing.availableCopies } : changes;
    }

    const total = changes.totalCopies ?? existing.totalCopies;
    const active = await countActiveLoans(existing.id);

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

  return {
    /**
     * @param {{ page?, limit?, sort?, search?, genre?, author? }} query — сирі значення з query-рядка
     */
    async getAll(query = {}) {
      const { page, limit, skip, sort } = parseListQuery(query, { sortable: SORTABLE });

      const filter = {};
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
      return { items, total, page, limit };
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
      const existing = await getExisting(id);
      const data = await reconcileCopies(existing, validateBook(input), { replace: true });
      try {
        return (await bookDao.replace(id, data)) ?? (await getExisting(id));
      } catch (err) {
        throw toConflict(err, 'Book');
      }
    },

    /** PATCH: часткове оновлення лише переданих полів. */
    async patch(id, input) {
      const existing = await getExisting(id);
      const changes = validateBookPatch(input);

      // availableCopies без totalCopies у тілі — перевіряємо проти збереженого totalCopies.
      if (changes.availableCopies !== undefined && changes.totalCopies === undefined
          && changes.availableCopies > existing.totalCopies) {
        throw HttpError.badRequest('Validation failed', [
          { field: 'availableCopies', message: `must be <= totalCopies (${existing.totalCopies})` },
        ]);
      }

      const data = await reconcileCopies(existing, changes);
      try {
        return (await bookDao.update(id, data)) ?? (await getExisting(id));
      } catch (err) {
        throw toConflict(err, 'Book');
      }
    },

    async delete(id) {
      await getExisting(id);
      const active = await countActiveLoans(id);
      if (active > 0) {
        throw HttpError.conflict(`Book cannot be deleted: it has ${active} active loan(s)`);
      }
      const deleted = await bookDao.delete(id);
      if (!deleted) throw HttpError.notFound(`Book with id "${id}" not found`);
    },
  };
}
