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

  // Публічний список жанрів: [{ genre, booksCount }], за алфавітом (українська колація). Книжки без жанру не враховуються.
  async genreCounts() {
    return this.collection
      .aggregate(
        [
          { $match: { genre: { $type: 'string', $ne: '' } } },
          { $group: { _id: '$genre', booksCount: { $sum: 1 } } },
          { $project: { _id: 0, genre: '$_id', booksCount: 1 } },
          { $sort: { genre: 1 } },
        ],
        { collation: { locale: 'uk' } },
      )
      .toArray();
  }

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
