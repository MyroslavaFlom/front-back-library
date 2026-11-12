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

export function createReaderService({ readerDao, loanDao, withTransaction }) {
  async function getExisting(id, session) {
    const reader = await readerDao.findById(id, { session });
    if (!reader) throw HttpError.notFound(`Читача з id "${id}" не знайдено`);
    return reader;
  }

  return {
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
        throw toConflict(err, 'Читач');
      }
    },

    async replace(id, input) {
      const existing = await getExisting(id);
      const data = validateReader(input);
      data.registeredAt ??= existing.registeredAt;
      try {
        return (await readerDao.replace(id, data)) ?? (await getExisting(id));
      } catch (err) {
        throw toConflict(err, 'Читач');
      }
    },

    async patch(id, input) {
      await getExisting(id);
      const data = validateReaderPatch(input);
      try {
        return (await readerDao.update(id, data)) ?? (await getExisting(id));
      } catch (err) {
        throw toConflict(err, 'Читач');
      }
    },

    async delete(id) {
      await withTransaction(async (session) => {
        await getExisting(id, session);
        const active = await loanDao.count({ readerId: id, status: 'active' }, { session });
        if (active > 0) {
          throw HttpError.conflict(`Читача не можна видалити: активних видач — ${active}`);
        }
        if (!(await readerDao.delete(id, { session }))) {
          throw HttpError.notFound(`Читача з id "${id}" не знайдено`);
        }
      });
    },
  };
}
