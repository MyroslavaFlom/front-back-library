import { BaseDao } from './base.dao.js';

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
}
