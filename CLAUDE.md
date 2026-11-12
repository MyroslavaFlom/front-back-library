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
- `npm run seed` — очищує books/readers/loans і заповнює демо-даними (`server/src/scripts/seed.js`).
- Конфіг сервера — `server/.env` (шаблон `server/.env.example`): `PORT`, `MONGO_URI`, `DB_NAME`. `.env` читається з поточного каталогу, тож серверні скрипти запускаються з `server/` (workspace-скрипти так і роблять).
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
| config | `server/src/config/` | `env.js` — завантаження й перевірка `.env`; `db.js` — singleton `MongoClient` (`connectDb`, `getDb`, `pingDb`, `closeDb`). |
| validators | `server/src/validators/` | Валідація й нормалізація вхідних даних (`validate.js` + схеми сутностей, `query.validator.js`). Викликаються з сервісів; помилка → `HttpError` 400 з `details: [{ field, message }]`. |
| middlewares | `server/src/middlewares/` | Наскрізні middleware: `notFound`, `errorHandler` тощо. |
| utils | `server/src/utils/` | Допоміжні утиліти (`HttpError` тощо). |

`server/src/app.js` — збирає Express-застосунок (`createApp({ services })`), без підключення до БД і без `listen`; у production додає статику `client/dist` і SPA-fallback (регулярний вираз, що виключає `/api`).
Зв'язування залежностей — один раз у `server.js`: `getDaos()` → `createServices(daos)` → `createApp({ services })` → `createApiRouter(services)` → `create<Entity>Controller(service)` → `create<Entity>Routes(controller)`.
`server/src/server.js` — підключає БД, запускає HTTP-сервер, graceful shutdown (SIGINT/SIGTERM → закрити сервер → `closeDb()`).

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

## Клієнт: архітектура

```
pages → hooks / components → src/api → fetch → /api
```

| Каталог | Відповідальність |
|---|---|
| `client/src/api/` | Єдиний шар доступу до REST API. `client.js` — обгортка над `fetch` (`request`, `api.get/post/put/patch/delete`, `fetchAll` для всіх сторінок списку): JSON, `credentials: "include"`, помилка API → `ApiError { status, message, details }`. По модулю на ресурс (`books.js`, `readers.js`, `loans.js`, `stats.js`), реекспорт з `index.js`. |
| `client/src/pages/` | Сторінки маршрутів (`/books`, `/readers`, `/loans`, `/stats`); маршрути — в `App.jsx`. |
| `client/src/components/` | Перевикористовувані компоненти (`ErrorAlert`, `Notice`, `Pager`, `Loading`). |
| `client/src/hooks/` | `useAsync(fn, deps)` → `{ data, error, loading, reload }`. |
| `client/src/format.js` | Форматування дат/грошей, `toBody()` — значення форми → тіло запиту. |

### Правила клієнта

- **Компоненти й сторінки не викликають `fetch` напряму** — лише функції з `src/api/`. Новий ендпоінт → нова функція у відповідному модулі `src/api/`.
- Запити йдуть на відносний `/api` (у dev — через проксі Vite, у production — той самий origin), тож базовий URL не хардкодимо.
- Помилки API показуємо на сторінці через `ErrorAlert` (повідомлення + `details`).
- UI будуємо з компонентів `react-bootstrap` і утилітарних класів Bootstrap; власний CSS — лише за потреби.
