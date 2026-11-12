import { BaseDao } from './base.dao.js';

export const USER_ROLES = Object.freeze(['admin', 'user']);

export class UserDao extends BaseDao {
  static fields = ['username', 'passwordHash', 'role'];

  static indexes = [{ key: { username: 1 }, name: 'username_unique', unique: true }];

  constructor() {
    super('users');
  }

  async findByUsername(username, { session } = {}) {
    return this.map(await this.collection.findOne({ username }, { session }));
  }
}
