import { ObjectId } from 'mongodb';
import { BaseDao, toObjectId } from './base.dao.js';

const REF_FIELDS = ['bookId', 'readerId'];

export class LoanDao extends BaseDao {
  static fields = [
    'bookId',
    'readerId',
    'loanDate',
    'dueDate',
    'returnDate',
    'status',
    'extended',
  ];

  static indexes = [
    { key: { bookId: 1 }, name: 'bookId_1' },
    { key: { readerId: 1 }, name: 'readerId_1' },
    { key: { status: 1 }, name: 'status_1' },
    // Захисна сітка на рівні БД: один читач — не більше однієї активної видачі тієї самої книжки.
    {
      key: { bookId: 1, readerId: 1 },
      name: 'book_reader_active_unique',
      unique: true,
      partialFilterExpression: { status: 'active' },
    },
  ];

  constructor() {
    super('loans');
  }

  /** bookId/readerId зберігаються як ObjectId. Невалідне посилання записати не можна. */
  toDb(data) {
    const doc = { ...data };
    for (const field of REF_FIELDS) {
      if (doc[field] === undefined) continue;
      const oid = toObjectId(doc[field]);
      if (!oid) throw new TypeError(`Invalid ObjectId in field "${field}"`);
      doc[field] = oid;
    }
    return doc;
  }

  /** У результатах посилання повертаються рядками, як і id. */
  fromDb(entity) {
    const result = { ...entity };
    for (const field of REF_FIELDS) {
      if (result[field] instanceof ObjectId) result[field] = result[field].toHexString();
    }
    return result;
  }

  /** У фільтрі рядкові bookId/readerId конвертуються в ObjectId; невалідні не збігаються ні з чим. */
  toDbFilter(filter) {
    const result = { ...filter };
    for (const field of REF_FIELDS) {
      if (typeof result[field] === 'string') {
        result[field] = toObjectId(result[field]) ?? { $exists: false };
      }
    }
    return result;
  }

  // ---------- Аналітика (aggregation pipeline) ----------

  /**
   * Топ книжок за кількістю видач. Період [from, toExclusive) — за loanDate (необов'язковий).
   * Видачі вже видалених книжок не враховуються ($unwind без preserve).
   * @returns {Promise<Array<{ bookId, title, author, genre, loansCount }>>}
   */
  async popularBooks({ limit, from, toExclusive } = {}) {
    const loanDate = {};
    if (from) loanDate.$gte = from;
    if (toExclusive) loanDate.$lt = toExclusive;

    return this.collection
      .aggregate([
        ...(Object.keys(loanDate).length > 0 ? [{ $match: { loanDate } }] : []),
        { $group: { _id: '$bookId', loansCount: { $sum: 1 } } },
        { $sort: { loansCount: -1, _id: 1 } },
        {
          $lookup: {
            from: 'books',
            localField: '_id',
            foreignField: '_id',
            pipeline: [{ $project: { title: 1, author: 1, genre: 1 } }],
            as: 'book',
          },
        },
        { $unwind: '$book' },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            bookId: { $toString: '$_id' },
            title: '$book.title',
            author: '$book.author',
            genre: { $ifNull: ['$book.genre', null] },
            loansCount: 1,
          },
        },
      ])
      .toArray();
  }

  /**
   * Найактивніші читачі за кількістю видач (за весь час).
   * @returns {Promise<Array<{ readerId, name, email, loansCount, activeLoans, lastLoanDate }>>}
   */
  async topReaders({ limit } = {}) {
    return this.collection
      .aggregate([
        {
          $group: {
            _id: '$readerId',
            loansCount: { $sum: 1 },
            activeLoans: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            lastLoanDate: { $max: '$loanDate' },
          },
        },
        { $sort: { loansCount: -1, lastLoanDate: -1, _id: 1 } },
        {
          $lookup: {
            from: 'readers',
            localField: '_id',
            foreignField: '_id',
            pipeline: [{ $project: { name: 1, email: 1 } }],
            as: 'reader',
          },
        },
        { $unwind: '$reader' },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            readerId: { $toString: '$_id' },
            name: '$reader.name',
            email: '$reader.email',
            loansCount: 1,
            activeLoans: 1,
            lastLoanDate: 1,
          },
        },
      ])
      .toArray();
  }

  /**
   * Активні видачі з dueDate < now разом із даними книжки й читача.
   * Відсортовано за dueDate зростанням — тобто за кількістю днів прострочення спадно.
   * (daysOverdue/штраф обчислює сервіс спільною функцією calculateFine.)
   */
  async findOverdueWithDetails(now) {
    return this.collection
      .aggregate([
        { $match: { status: 'active', dueDate: { $lt: now } } },
        { $sort: { dueDate: 1, _id: 1 } },
        {
          $lookup: {
            from: 'books',
            localField: 'bookId',
            foreignField: '_id',
            pipeline: [{ $project: { _id: 0, id: { $toString: '$_id' }, title: 1, author: 1, isbn: 1, genre: 1 } }],
            as: 'book',
          },
        },
        {
          $lookup: {
            from: 'readers',
            localField: 'readerId',
            foreignField: '_id',
            pipeline: [{ $project: { _id: 0, id: { $toString: '$_id' }, name: 1, email: 1, phone: 1 } }],
            as: 'reader',
          },
        },
        {
          $project: {
            _id: 0,
            id: { $toString: '$_id' },
            loanDate: 1,
            dueDate: 1,
            extended: { $ifNull: ['$extended', false] },
            book: { $ifNull: [{ $first: '$book' }, null] },
            reader: { $ifNull: [{ $first: '$reader' }, null] },
          },
        },
      ])
      .toArray();
  }

  /** Кількість активних (усіх, включно з простроченими) і прострочених видач станом на now. */
  async countByStatus(now) {
    const [result] = await this.collection
      .aggregate([
        { $match: { status: 'active' } },
        {
          $group: {
            _id: null,
            active: { $sum: 1 },
            overdue: { $sum: { $cond: [{ $lt: ['$dueDate', now] }, 1, 0] } },
          },
        },
      ])
      .toArray();
    return { active: result?.active ?? 0, overdue: result?.overdue ?? 0 };
  }

  /**
   * Вподобання читача за історією видач (усі статуси):
   *   genres/authors — до topN найчастіших (за кількістю видач, далі за алфавітом);
   *   bookIds        — усі книжки, які читач уже брав (ObjectId), для виключення.
   * Якщо історії немає — порожні масиви.
   */
  async readerPreferences(readerId, { topN = 3 } = {}) {
    const _id = toObjectId(readerId);
    if (!_id) return { genres: [], authors: [], bookIds: [] };

    const topBy = (field) => [
      { $match: { [`book.${field}`]: { $nin: [null, ''] } } },
      { $group: { _id: `$book.${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: topN },
    ];

    const [result] = await this.collection
      .aggregate([
        { $match: { readerId: _id } },
        {
          $lookup: {
            from: 'books',
            localField: 'bookId',
            foreignField: '_id',
            pipeline: [{ $project: { genre: 1, author: 1 } }],
            as: 'book',
          },
        },
        { $unwind: { path: '$book', preserveNullAndEmptyArrays: true } },
        {
          $facet: {
            genres: topBy('genre'),
            authors: topBy('author'),
            books: [{ $group: { _id: null, ids: { $addToSet: '$bookId' } } }],
          },
        },
      ])
      .toArray();

    return {
      genres: result.genres.map((g) => ({ genre: g._id, loansCount: g.count })),
      authors: result.authors.map((a) => ({ author: a._id, loansCount: a.count })),
      bookIds: result.books[0]?.ids ?? [],
    };
  }
}
