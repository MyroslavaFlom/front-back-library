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
}
