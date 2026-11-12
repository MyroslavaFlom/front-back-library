import bcrypt from 'bcrypt';
import { HttpError } from '../utils/HttpError.js';
import { validate } from '../validators/validate.js';
import { USER_ROLES } from '../dao/user.dao.js';

const BCRYPT_ROUNDS = 12;
export const MIN_PASSWORD_LENGTH = 8;
const INVALID_CREDENTIALS = 'Невірне ім\'я користувача або пароль';

const loginSchema = {
  username: { type: 'string', required: true, max: 100 },
  password: { type: 'string', required: true, max: 200 },
};

// Хеш для порівняння, коли користувача не знайдено: час відповіді не видає, чи існує логін.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

// Дані користувача для сесії й відповіді API — без passwordHash.
const toPublicUser = ({ id, username, role }) => ({ id, username, role });

export function createAuthService({ userDao }) {
  return {
    async login(input) {
      const { username, password } = validate(loginSchema, input);
      const user = await userDao.findByUsername(username);
      const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
      if (!user || !ok) throw HttpError.unauthorized(INVALID_CREDENTIALS);
      return toPublicUser(user);
    },

    // Актуальні дані користувача сесії (null, якщо його видалили).
    async getUser(id) {
      const user = await userDao.findById(id);
      return user ? toPublicUser(user) : null;
    },

    // Створює користувача або оновлює пароль і роль наявного (для seed).
    async upsertUser({ username, password, role = 'user' }) {
      if (!USER_ROLES.includes(role)) throw new Error(`Unknown role: ${role}`);
      if (!password || password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
      }
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const existing = await userDao.findByUsername(username);
      const user = existing
        ? await userDao.update(existing.id, { passwordHash, role })
        : await userDao.create({ username, passwordHash, role });
      return { user: toPublicUser(user), created: !existing };
    },
  };
}
