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
}
