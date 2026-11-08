import { HttpError } from '../utils/HttpError.js';
import { toConflict } from '../utils/mongoErrors.js';
import { validateReader, validateReaderPatch } from '../validators/reader.validator.js';
import {
  parseListQuery,
  optionalString,
  escapeRegex,
  totalPages,
} from '../validators/query.validator.js';

const SORTABLE = ['name', 'email', 'registeredAt', 'createdAt'];

/**
 * @param {{ readerDao: import('../dao/reader.dao.js').ReaderDao,
 *           loanDao: import('../dao/loan.dao.js').LoanDao,
 *           withTransaction: typeof import('../dao/transaction.js').withTransaction }} deps
 */
export function createReaderService({ readerDao, loanDao, withTransaction }) {
  async function getExisting(id, session) {
    const reader = await readerDao.findById(id, { session });
    if (!reader) throw HttpError.notFound(`Reader with id "${id}" not found`);
    return reader;
  }

  return {
    /** @param {{ page?, limit?, sort?, search? }} query — пошук за ім'ям або email */
    async getAll(query = {}) {
      const { page, limit, skip, sort } = parseListQuery(query, { sortable: SORTABLE });

      const filter = {};
      const search = optionalString(query.search);
      if (search) {
        const re = { $regex: escapeRegex(search), $options: 'i' };
        filter.$or = [{ name: re }, { email: re }];
      }

      const [items, total] = await Promise.all([
        readerDao.findAll(filter, { sort, skip, limit }),
        readerDao.count(filter),
      ]);
      return { items, total, page, limit, totalPages: totalPages(total, limit) };
    },

    getById(id) {
      return getExisting(id);
    },

    async create(input) {
      const data = validateReader(input);
      data.registeredAt ??= new Date();
      try {
        return await readerDao.create(data);
      } catch (err) {
        throw toConflict(err, 'Reader');
      }
    },

    /** PUT: повна заміна; registeredAt, якщо не передано, зберігається. */
    async replace(id, input) {
      const existing = await getExisting(id);
      const data = validateReader(input);
      data.registeredAt ??= existing.registeredAt;
      try {
        return (await readerDao.replace(id, data)) ?? (await getExisting(id));
      } catch (err) {
        throw toConflict(err, 'Reader');
      }
    },

    async patch(id, input) {
      await getExisting(id);
      const data = validateReaderPatch(input);
      try {
        return (await readerDao.update(id, data)) ?? (await getExisting(id));
      } catch (err) {
        throw toConflict(err, 'Reader');
      }
    },

    /**
     * Видалення заборонене, поки є активні видачі. Перевірка й видалення — в одній
     * транзакції; видача книжки «блокує» документ читача (readerDao.lock), тож
     * конкурентні видача й видалення конфліктують і не можуть пройти обидві.
     */
    async delete(id) {
      await withTransaction(async (session) => {
        await getExisting(id, session);
        const active = await loanDao.count({ readerId: id, status: 'active' }, { session });
        if (active > 0) {
          throw HttpError.conflict(`Reader cannot be deleted: they have ${active} active loan(s)`);
        }
        if (!(await readerDao.delete(id, { session }))) {
          throw HttpError.notFound(`Reader with id "${id}" not found`);
        }
      });
    },
  };
}
