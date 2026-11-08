import { BaseDao } from './base.dao.js';

export class ReaderDao extends BaseDao {
  static fields = ['name', 'email', 'phone', 'registeredAt'];

  static indexes = [{ key: { email: 1 }, name: 'email_unique', unique: true }];

  constructor() {
    super('readers');
  }
}
