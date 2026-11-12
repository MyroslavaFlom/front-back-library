import { HttpError } from '../utils/HttpError.js';
import { toConflict } from '../utils/mongoErrors.js';
import { validateBook, validateBookPatch } from '../validators/book.validator.js';
import { EVENT_TYPES, noopEvents } from '../events/index.js';
import {
  parseBookListQuery,
  optionalString,
  escapeRegex,
  totalPages,
} from '../validators/query.validator.js';

const SORTABLE = ['title', 'author', 'year', 'rating', 'pages', 'createdAt'];

// Події публікуються після успішного commit (не всередині колбека транзакції, який драйвер може повторити).
export function createBookService({ bookDao, loanDao, withTransaction, events = noopEvents }) {
  async function getExisting(id, session) {
    const book = await bookDao.findById(id, { session });
    if (!book) throw HttpError.notFound(`Книжку з id "${id}" не знайдено`);
    return book;
  }

  function countActiveLoans(bookId, session) {
    return loanDao.count({ bookId, status: 'active' }, { session });
  }

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
        `totalCopies (${total}) не може бути меншим за кількість примірників на руках (${active})`,
        [{ field: 'totalCopies', message: `має бути не менше ${active} (активні видачі)` }],
      );
    }

    const maxAvailable = total - active;
    if (availableGiven) {
      if (changes.availableCopies > maxAvailable) {
        throw HttpError.unprocessable(
          `availableCopies (${changes.availableCopies}) перевищує кількість примірників не на руках (${maxAvailable})`,
          [{ field: 'availableCopies', message: `має бути не більше ${maxAvailable} (totalCopies мінус активні видачі)` }],
        );
      }
      return changes;
    }

    return { ...changes, availableCopies: maxAvailable };
  }

  async function inTransaction(fn) {
    try {
      return await withTransaction(fn);
    } catch (err) {
      throw toConflict(err, 'Книжка');
    }
  }

  return {
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

    genres() {
      return bookDao.genreCounts();
    },

    async create(input) {
      const data = validateBook(input);
      data.availableCopies ??= data.totalCopies;
      let book;
      try {
        book = await bookDao.create(data);
      } catch (err) {
        throw toConflict(err, 'Книжка');
      }
      events.publish(EVENT_TYPES.BOOK_CREATED, { book });
      return book;
    },

    async replace(id, input) {
      const data = validateBook(input);
      const book = await inTransaction(async (session) => {
        const existing = await getExisting(id, session);
        const toSave = await reconcileCopies(existing, data, session, { replace: true });
        return (await bookDao.replace(id, toSave, { session })) ?? getExisting(id, session);
      });
      events.publish(EVENT_TYPES.BOOK_UPDATED, { book });
      return book;
    },

    async patch(id, input) {
      const changes = validateBookPatch(input);
      const book = await inTransaction(async (session) => {
        const existing = await getExisting(id, session);

        // availableCopies без totalCopies у тілі — перевіряємо проти збереженого totalCopies.
        if (changes.availableCopies !== undefined && changes.totalCopies === undefined
            && changes.availableCopies > existing.totalCopies) {
          throw HttpError.badRequest('Помилка валідації', [
            { field: 'availableCopies', message: `має бути не більше totalCopies (${existing.totalCopies})` },
          ]);
        }

        const toSave = await reconcileCopies(existing, changes, session);
        return (await bookDao.update(id, toSave, { session })) ?? getExisting(id, session);
      });
      events.publish(EVENT_TYPES.BOOK_UPDATED, { book });
      return book;
    },

    async delete(id) {
      await withTransaction(async (session) => {
        await getExisting(id, session);
        const active = await countActiveLoans(id, session);
        if (active > 0) {
          throw HttpError.conflict(`Книжку не можна видалити: активних видач — ${active}`);
        }
        if (!(await bookDao.delete(id, { session }))) {
          throw HttpError.notFound(`Книжку з id "${id}" не знайдено`);
        }
      });
      events.publish(EVENT_TYPES.BOOK_DELETED, { id });
    },
  };
}
