import { HttpError } from '../utils/HttpError.js';
import { parseStatsQuery } from '../validators/query.validator.js';
import { calculateFine } from './fine.js';

/** Скільки улюблених жанрів і авторів читача враховувати в рекомендаціях. */
export const FAVORITES_TOP_N = 3;

/**
 * Аналітика й рекомендації. Усі агрегації виконуються в MongoDB (методи DAO);
 * сервіс лише валідує параметри, складає результати й застосовує спільне
 * правило штрафу (calculateFine), щоб не дублювати його з LoanService.
 *
 * @param {{ bookDao: import('../dao/book.dao.js').BookDao,
 *           readerDao: import('../dao/reader.dao.js').ReaderDao,
 *           loanDao: import('../dao/loan.dao.js').LoanDao }} deps
 */
export function createStatsService({ bookDao, readerDao, loanDao }) {
  return {
    /** @param {{ limit?, from?, to? }} query */
    async popularBooks(query = {}) {
      const { limit, from, toExclusive } = parseStatsQuery(query);
      return loanDao.popularBooks({ limit, from, toExclusive });
    },

    async genres() {
      return bookDao.genreStats();
    },

    /** Прострочені видачі (найбільше прострочення першим) і загальна сума штрафів. */
    async overdue() {
      const now = new Date();
      const loans = await loanDao.findOverdueWithDetails(now);
      const items = loans.map((loan) => ({ ...loan, ...calculateFine(loan.dueDate, now) }));
      return {
        asOf: now,
        count: items.length,
        totalFine: items.reduce((sum, item) => sum + item.fine, 0),
        items,
      };
    },

    /** @param {{ limit? }} query */
    async topReaders(query = {}) {
      const { limit } = parseStatsQuery(query, { period: false });
      return loanDao.topReaders({ limit });
    },

    async summary() {
      const now = new Date();
      const [copies, readers, loans] = await Promise.all([
        bookDao.copiesSummary(),
        readerDao.count(),
        loanDao.countByStatus(now),
      ]);
      return {
        asOf: now,
        books: copies.books,
        readers,
        activeLoans: loans.active,
        overdueLoans: loans.overdue,
        totalCopies: copies.totalCopies,
        availableCopies: copies.availableCopies,
        copiesOnLoan: copies.onLoan,
      };
    },

    /**
     * Рекомендації: доступні книжки улюблених жанрів/авторів читача, яких він ще не брав.
     * Без історії видач — найпопулярніші доступні книжки (strategy: "popular").
     * @param {string} readerId
     * @param {{ limit? }} query
     */
    async recommendations(readerId, query = {}) {
      const { limit } = parseStatsQuery(query, { period: false });
      if (!(await readerDao.findById(readerId))) {
        throw HttpError.notFound(`Читача з id "${readerId}" не знайдено`);
      }

      const prefs = await loanDao.readerPreferences(readerId, { topN: FAVORITES_TOP_N });
      const hasHistory = prefs.bookIds.length > 0;
      const genres = prefs.genres.map((g) => g.genre);
      const authors = prefs.authors.map((a) => a.author);

      const items = hasHistory
        ? await bookDao.findRecommended({ genres, authors, excludeIds: prefs.bookIds, limit })
        : await bookDao.findRecommended({ limit, orderBy: 'popularity' });

      return {
        readerId,
        strategy: hasHistory ? 'preferences' : 'popular',
        basedOn: hasHistory ? { genres: prefs.genres, authors: prefs.authors } : null,
        items,
      };
    },
  };
}
