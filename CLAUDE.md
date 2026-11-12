# Library

Монорепозиторій на npm workspaces:

- `server/` — RESTful-сервіс «Бібліотека»: Node.js + Express 5 + MongoDB (офіційний драйвер `mongodb`, **без Mongoose**).
- `client/` — «товстий клієнт»: React + Vite (JavaScript, не TypeScript), `react-router-dom`, Bootstrap 5 + `react-bootstrap`.

Обидва пакети — ES-модулі (`"type": "module"`); у серверних імпортах завжди вказуємо розширення `.js`, у клієнтських — `.js`/`.jsx`.

## Запуск (з кореня)

- `npm install` — ставить залежності обох пакетів (єдиний `package-lock.json` у корені).
- `npm run dev` — сервер (nodemon, :3000) і клієнт (Vite, :5173) разом через `concurrently`. Vite проксує `/api` на `http://localhost:3000`.
- `npm run build` — збирає клієнт у `client/dist`.
- `npm start` — сервер у production (`NODE_ENV=production`): віддає `/api` і `client/dist`, а для всіх інших GET-маршрутів — `index.html` (клієнтський роутинг).
- `npm run seed` — очищує books/readers/loans, заповнює демо-даними й створює/оновлює адміна з `ADMIN_USERNAME`/`ADMIN_PASSWORD` (`server/src/scripts/seed.js`; колекцію users не очищує).
- Конфіг сервера — `server/.env` (шаблон `server/.env.example`): `PORT`, `MONGO_URI`, `DB_NAME`, `SESSION_SECRET`, `ADMIN_USERNAME`/`ADMIN_PASSWORD` (для seed); необов'язкові `CLIENT_ORIGIN`, `COOKIE_SECURE`, `TRUST_PROXY`. `.env` читається з поточного каталогу, тож серверні скрипти запускаються з `server/` (workspace-скрипти так і роблять).
- Залежність ставимо у свій пакет: `npm install <pkg> -w server` або `-w client`.

## Сервер: архітектура

Запит проходить шари строго зверху вниз:

```
routes → controllers → services → dao → MongoDB
```

| Шар | Каталог | Відповідальність |
|---|---|---|
| routes | `server/src/routes/` | Мапінг URL + HTTP-методу на контролер, підключення middleware. Без логіки. |
| controllers | `server/src/controllers/` | Читає `req` (params/query/body), викликає сервіс, формує HTTP-відповідь (статус, JSON). |
| services | `server/src/services/` | Бізнес-логіка та валідація правил предметної області. Не знає про `req`/`res`. |
| dao | `server/src/dao/` | Єдине місце роботи з колекціями MongoDB (`getDb().collection(...)`), конвертація `ObjectId`. |
| config | `server/src/config/` | `env.js` — завантаження й перевірка `.env`; `db.js` — singleton `MongoClient` (`connectDb`, `getDb`, `getClient`, `pingDb`, `closeDb`); `session.js` — express-session + connect-mongo. |
| events | `server/src/events/` | Шина доменних подій у процесі (`createEventBus`: `publish`, `subscribe`, `close`), `EVENT_TYPES`. |
| validators | `server/src/validators/` | Валідація й нормалізація вхідних даних (`validate.js` + схеми сутностей, `query.validator.js`). Викликаються з сервісів; помилка → `HttpError` 400 з `details: [{ field, message }]`. |
| middlewares | `server/src/middlewares/` | `auth.js` (`requireAuth`, `requireRole`, `requireAdmin`), `csrf.js`, `sanitize.js` (ключі з `$`/`.`), `rateLimit.js`, `notFound`, `errorHandler`. |
| utils | `server/src/utils/` | Допоміжні утиліти (`HttpError` тощо). |

`server/src/app.js` — збирає Express-застосунок (`createApp({ services })`), без підключення до БД і без `listen`; у production додає статику `client/dist` і SPA-fallback (регулярний вираз, що виключає `/api`).
Зв'язування залежностей — один раз у `server.js`: `getDaos()` → `createServices(daos)` → `createApp({ services })` → `createApiRouter(services)` → `create<Entity>Controller(service)` → `create<Entity>Routes(controller)`.
`server/src/server.js` — підключає БД, створює шину подій і сховище сесій, запускає HTTP-сервер, graceful shutdown (SIGINT/SIGTERM → `events.close()` (закриває SSE) → закрити сервер → `sessionStore.close()` → `closeDb()`).

### Правила сервера

- **Контролери не звертаються до БД напряму** — ні `getDb()`, ні DAO; лише через сервіси.
- **Сервіси не імпортують `mongodb`/`getDb()`** — доступ до даних лише через DAO.
- Кожен шар викликає тільки наступний шар; пропускати шари не можна.
- Помилки з HTTP-статусом кидаємо як `new HttpError(status, message, details)` або `HttpError.badRequest/notFound/conflict/unprocessable(...)`; їх обробляє `errorHandler`. Express 5 сам передає відхилені проміси з async-хендлерів у `errorHandler` — `try/catch` у контролерах не потрібен.
- Сервіси створюються фабриками з DAO у параметрах: `createBookService(getDaos())`. Помилку дубліката (E11000) перетворюємо на 409 через `toConflict()` з `utils/mongoErrors.js`.
- Операції, що змінюють кілька документів або перевіряють інвариант перед записом (видача/повернення, видалення книжки/читача, зміна `totalCopies`), виконуються в транзакції: `withTransaction(async (session) => ...)` з реєстру DAO; усі виклики DAO всередині — з `{ session }`. Колбек має бути ідемпотентним (драйвер повторює його при WriteConflict). Проти write skew документ, на який спирається перевірка, «блокується» записом (`dao.lock(id, { session })`).
- Формат помилки API: `{ "error": { "status", "message", "details" } }`.
- Усі маршрути — під префіксом `/api`, реєструються у `server/src/routes/index.js`.
- Іменування файлів: `<entity>.routes.js`, `<entity>.controller.js`, `<entity>.service.js`, `<entity>.dao.js`.
- Секрети лише в `server/.env` (він у `.gitignore`); нові змінні додаємо також у `server/.env.example` і `server/src/config/env.js`.

### Сесії, доступ і захист

- Користувачі — колекція `users` через `UserDao` (`username`, `passwordHash` bcrypt, `role`: `admin` | `user`). `passwordHash` ніколи не повертається з API: `AuthService` віддає лише `{ id, username, role }`.
- Сесія — express-session + connect-mongo (колекція `sessions`), cookie `library.sid`: httpOnly, sameSite `lax`, secure у production, 2 год (rolling). У сесії — `user` і `csrfToken`.
- `/api/auth`: `GET /csrf` → `{ csrfToken }`; `POST /login` → регенерує сесію, `{ user, csrfToken }` (старий токен недійсний); `POST /logout` → 204; `GET /me` → `{ user }` або 401.
- Доступ: GET `/books`, `/books/genres`, `/books/:id` — публічні; зміни книжок, `/readers`, `/loans`, `/stats` — `requireAdmin` у маршрутах. Без входу → 401, без ролі → 403. Новий захищений маршрут — додавати `requireAdmin`/`requireRole(...)` у файлі маршрутів.
- Порядок на `/api` (`app.js`): `apiLimiter` → `rejectMongoOperators` → `csrfProtection` → маршрути. Тому змінювальний запит без `X-CSRF-Token` отримує 403 ще до перевірки входу.
- Усі POST/PUT/PATCH/DELETE вимагають заголовок `X-CSRF-Token`, рівний токену сесії. Login обмежено 5 невдалими спробами / 15 хв з IP (`loginLimiter`, `skipSuccessfulRequests`).
- helmet, JSON-тіло ≤ 100kb, CORS лише для `CLIENT_ORIGIN` з `credentials`.

### Події (SSE)

- `GET /api/events` — Server-Sent Events, heartbeat кожні 25 с. Типи: `book.created`, `book.updated`, `book.deleted`, `loan.changed` (останній — лише адміністраторам; фільтрує `EventService`).
- Події публікують **лише сервіси** (`events.publish(...)` з `EVENT_TYPES`), **після** успішного commit — не всередині колбека `withTransaction` (його можуть повторити). Контролери й DAO про події не знають; шина передається в сервіси через `createServices(daos, { events })`.
- Зміни видач (видача/повернення) також публікують `book.updated` зі свіжою книжкою — змінилась кількість вільних примірників.

## Клієнт: архітектура

```
pages → hooks / context / components → src/api → fetch / EventSource → /api
```

| Каталог | Відповідальність |
|---|---|
| `client/src/api/` | Єдиний шар доступу до API. `client.js` — обгортка над `fetch` (`request`, `api.get/post/put/patch/delete`, `fetchAll`): JSON, `credentials: "include"`, помилка → `ApiError { status, message, details }`; **CSRF-токен** автоматично додається в POST/PUT/PATCH/DELETE (`X-CSRF-Token`, береться з `/auth/csrf` або з відповіді login; при 403 оновлюється й запит повторюється один раз); **401** → обробник з `setUnauthorizedHandler` (редірект на `/login`), крім запитів з `redirectOnUnauthorized: false` (`me`, `login`). `auth.js`, `events.js` (`subscribeToEvents` — EventSource), по модулю на ресурс; реекспорт з `index.js`. |
| `client/src/context/` | `AuthContext` (`user`, `isAdmin`, `loading`, `me`, `login`, `logout`), `ToastContext` (`showToast(text, { variant, title })`). |
| `client/src/hooks/` | `useAsync(fn, deps)` → `{ data, error, loading, reload }`; `useApiForm(initial)` — стан форми й розкладання `details` помилки API по полях; `useLiveEvents(handlers)` — підписка на SSE, перепідключення при зміні користувача. |
| `client/src/components/` | `AppNavbar`, `ProtectedRoute` (ролі), `Field` (поле з помилкою від API), `ConfirmModal`, `ErrorAlert`, `Pager`, `Loading`. |
| `client/src/pages/` | Публічні: `/` каталог (`CatalogPage`, фільтри в query-рядку), `/books/:id`, `/login`. Адмінка `pages/admin/` під `/admin/*` (`ProtectedRoute` для `admin`): `books`, `readers`, `loans`, `stats`. Маршрути — в `App.jsx`. |

### Правила клієнта

- **Компоненти, сторінки й хуки не викликають `fetch` чи `EventSource` напряму** — лише функції з `src/api/`. Новий ендпоінт → нова функція у відповідному модулі.
- CSRF і 401 обробляє шар `api`; у компонентах про них не думаємо.
- Запити йдуть на відносний `/api` (у dev — через проксі Vite, у production — той самий origin), базовий URL не хардкодимо.
- Форми: `useApiForm` + `Field` — помилки валідації з API (`details[].field`) показуються біля полів, решта — `ErrorAlert` над формою. Успіх дії — `showToast`.
- Живі оновлення — `useLiveEvents({ 'book.created': ... })`: на подію перезавантажуємо дані (`reload()`), а не латаємо стан вручну.
- Жанри для фільтра каталогу — публічний `GET /api/books/genres` (`[{ genre, booksCount }]`); `/stats/genres` — розширена статистика лише для admin.
- UI будуємо з компонентів `react-bootstrap` і утилітарних класів Bootstrap; власний CSS — лише за потреби.
