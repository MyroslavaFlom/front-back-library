import { BaseDao, toObjectId } from './base.dao.js';

export class BookDao extends BaseDao {
  static fields = [
    'title',
    'author',
    'isbn',
    'genre',
    'year',
    'pages',
    'totalCopies',
    'availableCopies',
    'rating',
  ];

  static indexes = [
    { key: { isbn: 1 }, name: 'isbn_unique', unique: true },
    { key: { title: 'text', author: 'text' }, name: 'title_author_text' },
  ];

  constructor() {
    super('books');
  }

  /**
   * Атомарно змінює availableCopies на delta ($inc) з умовою в тому ж запиті:
   *   delta < 0 — лише якщо availableCopies >= |delta| (не піде в мінус);
   *   delta > 0 — лише якщо availableCopies + delta <= totalCopies.
   * Повертає оновлену книжку або null, якщо книжки немає чи умова не виконалась.
   */
  async adjustAvailableCopies(id, delta, { session } = {}) {
    const _id = toObjectId(id);
    if (!_id || !Number.isInteger(delta) || delta === 0) return null;

    const guard =
      delta < 0
        ? { availableCopies: { $gte: -delta } }
        : { $expr: { $lte: [{ $add: ['$availableCopies', delta] }, '$totalCopies'] } };

    const doc = await this.collection.findOneAndUpdate(
      { _id, ...guard },
      { $inc: { availableCopies: delta }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after', session },
    );
    return this.map(doc);
  }

  // ---------- Аналітика (aggregation pipeline) ----------

  /**
   * Статистика за жанрами: кількість книжок, примірників (усього/доступно), видач
   * (за весь час, $lookup на loans) і частка доступних примірників (0..1, null якщо примірників 0).
   * Книжки без жанру потрапляють у групу genre: null.
   */
  async genreStats() {
    return this.collection
      .aggregate([
        {
          $lookup: {
            from: 'loans',
            localField: '_id',
            foreignField: 'bookId',
            pipeline: [{ $count: 'n' }],
            as: 'loanStats',
          },
        },
        {
          $group: {
            _id: { $ifNull: ['$genre', null] },
            booksCount: { $sum: 1 },
            totalCopies: { $sum: { $ifNull: ['$totalCopies', 0] } },
            availableCopies: { $sum: { $ifNull: ['$availableCopies', 0] } },
            loansCount: { $sum: { $ifNull: [{ $first: '$loanStats.n' }, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            genre: '$_id',
            booksCount: 1,
            totalCopies: 1,
            availableCopies: 1,
            loansCount: 1,
            availableShare: {
              $cond: [
                { $gt: ['$totalCopies', 0] },
                { $round: [{ $divide: ['$availableCopies', '$totalCopies'] }, 3] },
                null,
              ],
            },
          },
        },
        { $sort: { loansCount: -1, genre: 1 } },
      ])
      .toArray();
  }

  /** Загальна кількість книжок і примірників; onLoan = Σ(totalCopies − availableCopies). */
  async copiesSummary() {
    const [result] = await this.collection
      .aggregate([
        {
          $group: {
            _id: null,
            books: { $sum: 1 },
            totalCopies: { $sum: { $ifNull: ['$totalCopies', 0] } },
            availableCopies: { $sum: { $ifNull: ['$availableCopies', 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            books: 1,
            totalCopies: 1,
            availableCopies: 1,
            onLoan: { $subtract: ['$totalCopies', '$availableCopies'] },
          },
        },
      ])
      .toArray();
    return result ?? { books: 0, totalCopies: 0, availableCopies: 0, onLoan: 0 };
  }

  /**
   * Доступні книжки (availableCopies > 0) для рекомендацій.
   *   genres/authors — якщо задано хоча б один, книжка має збігатися за жанром АБО автором;
   *                    якщо обидва порожні — без фільтра (найпопулярніші доступні);
   *   excludeIds     — книжки, які читач уже брав.
   *   orderBy        — 'rating': rating ↓, популярність ↓; 'popularity': популярність ↓, rating ↓
   *                    (популярність — кількість видач за весь час); далі title ↑.
   */
  async findRecommended({ genres = [], authors = [], excludeIds = [], limit, orderBy = 'rating' } = {}) {
    const exclude = excludeIds.map((id) => toObjectId(id)).filter(Boolean);
    const match = { availableCopies: { $gt: 0 } };
    if (exclude.length > 0) match._id = { $nin: exclude };
    if (genres.length > 0 || authors.length > 0) {
      match.$or = [{ genre: { $in: genres } }, { author: { $in: authors } }];
    }

    return this.collection
      .aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'loans',
            localField: '_id',
            foreignField: 'bookId',
            pipeline: [{ $count: 'n' }],
            as: 'loanStats',
          },
        },
        { $addFields: { loansCount: { $ifNull: [{ $first: '$loanStats.n' }, 0] } } },
        {
          $sort:
            orderBy === 'popularity'
              ? { loansCount: -1, rating: -1, title: 1, _id: 1 }
              : { rating: -1, loansCount: -1, title: 1, _id: 1 },
        },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            id: { $toString: '$_id' },
            title: 1,
            author: 1,
            genre: { $ifNull: ['$genre', null] },
            rating: { $ifNull: ['$rating', null] },
            availableCopies: 1,
            loansCount: 1,
            matchedGenre: { $in: [{ $ifNull: ['$genre', null] }, { $literal: genres }] },
            matchedAuthor: { $in: ['$author', { $literal: authors }] },
          },
        },
      ])
      .toArray();
  }
}
