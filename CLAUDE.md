# Library Service

RESTful-сервіс «Бібліотека»: Node.js + Express 5 + MongoDB (офіційний драйвер `mongodb`, **без Mongoose**).
ES-модулі (`"type": "module"`), у імпортах завжди вказуємо розширення `.js`.

## Запуск

- `npm run dev` — розробка (nodemon)
- `npm start` — продакшн
- Конфіг у `.env` (шаблон — `.env.example`): `PORT`, `MONGO_URI`, `DB_NAME`.

## Архітектура

Запит проходить шари строго зверху вниз:

```
routes → controllers → services → dao → MongoDB
```

| Шар | Каталог | Відповідальність |
|---|---|---|
| routes | `src/routes/` | Мапінг URL + HTTP-методу на контролер, підключення middleware. Без логіки. |
| controllers | `src/controllers/` | Читає `req` (params/query/body), викликає сервіс, формує HTTP-відповідь (статус, JSON). |
| services | `src/services/` | Бізнес-логіка та валідація правил предметної області. Не знає про `req`/`res`. |
| dao | `src/dao/` | Єдине місце роботи з колекціями MongoDB (`getDb().collection(...)`), конвертація `ObjectId`. |
| config | `src/config/` | `env.js` — завантаження й перевірка `.env`; `db.js` — singleton `MongoClient` (`connectDb`, `getDb`, `pingDb`, `closeDb`). |
| validators | `src/validators/` | Валідація й нормалізація вхідних даних (`validate.js` + схеми сутностей, `query.validator.js`). Викликаються з сервісів; помилка → `HttpError` 400 з `details: [{ field, message }]`. |
| middlewares | `src/middlewares/` | Наскрізні middleware: `notFound`, `errorHandler`, валідація тощо. |
| utils | `src/utils/` | Допоміжні утиліти (`HttpError` тощо). |

`src/app.js` — збирає Express-застосунок (`createApp({ services })`), без підключення до БД і без `listen`.
Зв'язування залежностей — один раз у `server.js`: `getDaos()` → `createServices(daos)` → `createApp({ services })` → `createApiRouter(services)` → `create<Entity>Controller(service)` → `create<Entity>Routes(controller)`.
`src/server.js` — підключає БД, запускає HTTP-сервер, graceful shutdown (SIGINT/SIGTERM → закрити сервер → `closeDb()`).

## Правила

- **Контролери не звертаються до БД напряму** — ні `getDb()`, ні DAO; лише через сервіси.
- **Сервіси не імпортують `mongodb`/`getDb()`** — доступ до даних лише через DAO.
- Кожен шар викликає тільки наступний шар; пропускати шари не можна.
- Помилки з HTTP-статусом кидаємо як `new HttpError(status, message, details)` або `HttpError.badRequest/notFound/conflict/unprocessable(...)`; їх обробляє `errorHandler`. Express 5 сам передає відхилені проміси з async-хендлерів у `errorHandler` — `try/catch` у контролерах не потрібен.
- Сервіси створюються фабриками з DAO у параметрах: `createBookService(getDaos())`. Помилку дубліката (E11000) перетворюємо на 409 через `toConflict()` з `utils/mongoErrors.js`.
- Формат помилки API: `{ "error": { "status", "message", "details" } }`.
- Усі маршрути — під префіксом `/api`, реєструються у `src/routes/index.js`.
- Іменування файлів: `<entity>.routes.js`, `<entity>.controller.js`, `<entity>.service.js`, `<entity>.dao.js`.
- Секрети лише в `.env` (він у `.gitignore`); нові змінні додаємо також у `.env.example` і `src/config/env.js`.
