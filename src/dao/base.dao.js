import { ObjectId } from 'mongodb';
import { getDb } from '../config/db.js';

/**
 * Перетворює рядок/ObjectId на ObjectId. Невалідне значення → null (без винятку драйвера).
 */
export function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string' && ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id)) {
    return new ObjectId(id);
  }
  return null;
}

/**
 * Абстрактний DAO поверх однієї колекції MongoDB.
 * Лише доступ до даних: жодних бізнес-правил.
 *
 * Нащадки задають:
 *  - collectionName — назву колекції (через super());
 *  - static fields  — дозволені поля сутності (інші ігноруються при записі);
 *  - static indexes — специфікації індексів для ensureIndexes();
 *  - (опційно) toDb/fromDb/toDbFilter — конвертація специфічних полів.
 */
export class BaseDao {
  static fields = [];
  static indexes = [];

  constructor(collectionName) {
    if (new.target === BaseDao) {
      throw new TypeError('BaseDao is abstract and cannot be instantiated directly');
    }
    if (!collectionName) {
      throw new TypeError('collectionName is required');
    }
    this.collectionName = collectionName;
  }

  /** Колекція береться ліниво, тож DAO можна створити ще до connectDb(). */
  get collection() {
    return getDb().collection(this.collectionName);
  }

  // ---------- Хуки конвертації (перевизначаються в нащадках) ----------

  /** Дані сутності → документ для запису (вже відфільтровані за fields). */
  toDb(data) {
    return data;
  }

  /** Документ із БД → сутність (після заміни _id на id). */
  fromDb(entity) {
    return entity;
  }

  /** Фільтр сутності → фільтр MongoDB (після заміни id на _id). */
  toDbFilter(filter) {
    return filter;
  }

  // ---------- Внутрішні помічники ----------

  pickFields(data = {}) {
    const allowed = this.constructor.fields;
    return Object.fromEntries(
      Object.entries(data).filter(([key, value]) => allowed.includes(key) && value !== undefined),
    );
  }

  map(doc) {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return this.fromDb({ id: _id.toHexString(), ...rest });
  }

  buildFilter(filter = {}) {
    const { id, ...rest } = filter;
    const result = { ...rest };
    if (id !== undefined) {
      // Невалідний id не повинен збігатися ні з чим, але й не кидати виняток.
      result._id = toObjectId(id) ?? { $exists: false };
    }
    return this.toDbFilter(result);
  }

  buildSort(sort) {
    if (!sort) return undefined;
    return Object.fromEntries(Object.entries(sort).map(([k, v]) => [k === 'id' ? '_id' : k, v]));
  }

  // ---------- CRUD ----------

  /**
   * @param {object} filter  фільтр MongoDB (можна використовувати `id`)
   * @param {{ sort?: object, skip?: number, limit?: number, projection?: object }} options
   */
  async findAll(filter = {}, { sort, skip, limit, projection } = {}) {
    let cursor = this.collection.find(this.buildFilter(filter), { projection });
    const dbSort = this.buildSort(sort);
    if (dbSort) cursor = cursor.sort(dbSort);
    if (skip) cursor = cursor.skip(skip);
    if (limit) cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map((doc) => this.map(doc));
  }

  async findById(id) {
    const _id = toObjectId(id);
    if (!_id) return null;
    return this.map(await this.collection.findOne({ _id }));
  }

  async create(entity) {
    const now = new Date();
    const doc = { ...this.toDb(this.pickFields(entity)), createdAt: now, updatedAt: now };
    const { insertedId } = await this.collection.insertOne(doc);
    return this.map({ _id: insertedId, ...doc });
  }

  /** Часткове оновлення ($set). Повертає оновлену сутність або null, якщо не знайдено. */
  async update(id, data) {
    const _id = toObjectId(id);
    if (!_id) return null;
    const changes = { ...this.toDb(this.pickFields(data)), updatedAt: new Date() };
    const doc = await this.collection.findOneAndUpdate(
      { _id },
      { $set: changes },
      { returnDocument: 'after' },
    );
    return this.map(doc);
  }

  /** @returns {Promise<boolean>} true, якщо документ видалено. */
  async delete(id) {
    const _id = toObjectId(id);
    if (!_id) return false;
    const { deletedCount } = await this.collection.deleteOne({ _id });
    return deletedCount === 1;
  }

  async count(filter = {}) {
    return this.collection.countDocuments(this.buildFilter(filter));
  }

  /** Ідемпотентно створює індекси колекції (createIndexes не змінює вже наявні). */
  async ensureIndexes() {
    const { indexes } = this.constructor;
    if (indexes.length === 0) return [];
    try {
      return await this.collection.createIndexes(indexes);
    } catch (err) {
      throw new Error(describeIndexError(this.collectionName, err));
    }
  }
}

function describeIndexError(collectionName, err) {
  const prefix = `Cannot ensure indexes on "${collectionName}"`;
  switch (err?.code) {
    case 85: // IndexOptionsConflict
    case 86: // IndexKeySpecsConflict
      return `${prefix}: an existing index conflicts with the required one (other name/options, or a second text index). ${err.errmsg ?? err.message}`;
    case 11000:
      return `${prefix}: the collection contains duplicate values for a unique index. ${err.errmsg ?? err.message}`;
    default:
      return `${prefix}: ${err?.message ?? err}`;
  }
}
