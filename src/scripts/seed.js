/**
 * npm run seed — очищує колекції books, readers, loans і заповнює їх демо-даними.
 * Дати видач рахуються відносно поточного моменту, тож прострочені видачі
 * залишаються простроченими незалежно від дня запуску.
 */
import { config } from '../config/env.js';
import { connectDb, closeDb, DbConnectionError } from '../config/db.js';
import { ensureIndexes, getDaos } from '../dao/index.js';
import { DEFAULT_LOAN_DAYS } from '../services/loan.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days) => new Date(Date.now() - days * DAY_MS);

/** ISBN-13 з 12-значної основи: дописує контрольну цифру. */
function isbn13(base12) {
  const sum = [...base12].reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  return base12 + ((10 - (sum % 10)) % 10);
}

const BOOKS = [
  { key: 'dune', title: 'Дюна', author: 'Френк Герберт', genre: 'фантастика', year: 1965, pages: 704, totalCopies: 3, rating: 4.8 },
  { key: 'foundation', title: 'Фундація', author: 'Айзек Азімов', genre: 'фантастика', year: 1951, pages: 320, totalCopies: 2, rating: 4.5 },
  { key: 'robot', title: 'Я, робот', author: 'Айзек Азімов', genre: 'фантастика', year: 1950, pages: 288, totalCopies: 2, rating: 4.2 },
  { key: 'solaris', title: 'Соляріс', author: 'Станіслав Лем', genre: 'фантастика', year: 1961, pages: 256, totalCopies: 1, rating: 4.4 },
  { key: 'orient', title: 'Вбивство в «Східному експресі»', author: 'Агата Крісті', genre: 'детектив', year: 1934, pages: 256, totalCopies: 2, rating: 4.4 },
  { key: 'none', title: 'І не лишилось жодного', author: 'Агата Крісті', genre: 'детектив', year: 1939, pages: 272, totalCopies: 1, rating: 4.7 },
  { key: 'hound', title: 'Собака Баскервілів', author: 'Артур Конан Дойл', genre: 'детектив', year: 1902, pages: 256, totalCopies: 2, rating: 4.3 },
  { key: 'kobzar', title: 'Кобзар', author: 'Тарас Шевченко', genre: 'поезія', year: 1840, pages: 640, totalCopies: 3, rating: 4.9 },
  { key: 'lisova', title: 'Лісова пісня', author: 'Леся Українка', genre: 'поезія', year: 1911, pages: 192, totalCopies: 2, rating: 4.6 },
  { key: 'tiger', title: 'Тигролови', author: 'Іван Багряний', genre: 'роман', year: 1944, pages: 320, totalCopies: 2, rating: 4.7 },
  { key: 'misto', title: 'Місто', author: 'Валер\'ян Підмогильний', genre: 'роман', year: 1928, pages: 304, totalCopies: 1, rating: 4.5 },
  { key: 'voroshylovhrad', title: 'Ворошиловград', author: 'Сергій Жадан', genre: 'роман', year: 2010, pages: 448, totalCopies: 2, rating: 4.3 },
  { key: 'sapiens', title: 'Sapiens. Людина розумна', author: 'Юваль Ной Харарі', genre: 'науково-популярне', year: 2011, pages: 512, totalCopies: 2, rating: 4.6 },
  { key: 'cosmos', title: 'Космос', author: 'Карл Саган', genre: 'науково-популярне', year: 1980, pages: 432, totalCopies: 1, rating: 4.8 },
  { key: 'gene', title: 'Егоїстичний ген', author: 'Річард Докінз', genre: 'науково-популярне', year: 1976, pages: 544, totalCopies: 1 },
].map((book, i) => ({ ...book, isbn: isbn13(`978617${String(100000 + i)}`) }));

const READERS = [
  { key: 'olena', name: 'Олена Коваленко', email: 'olena.kovalenko@example.com', phone: '+380501234567', registeredDaysAgo: 400 },
  { key: 'taras', name: 'Тарас Мельник', email: 'taras.melnyk@example.com', phone: '+380671112233', registeredDaysAgo: 300 },
  { key: 'iryna', name: 'Ірина Шевчук', email: 'iryna.shevchuk@example.com', registeredDaysAgo: 200 },
  { key: 'petro', name: 'Петро Бондаренко', email: 'petro.bondarenko@example.com', phone: '+380931234567', registeredDaysAgo: 120 },
  { key: 'nadia', name: 'Надія Ткаченко', email: 'nadia.tkachenko@example.com', registeredDaysAgo: 10 },
];

// loanDaysAgo — коли видано; returnedDaysAgo — коли повернено (null — активна).
// Активна видача з loanDaysAgo > 14 — прострочена. Надія — без історії (рекомендації за популярністю).
const LOANS = [
  { book: 'dune', reader: 'olena', loanDaysAgo: 60, returnedDaysAgo: 50 },
  { book: 'foundation', reader: 'olena', loanDaysAgo: 40, returnedDaysAgo: 30 },
  { book: 'robot', reader: 'olena', loanDaysAgo: 5, returnedDaysAgo: null },
  { book: 'solaris', reader: 'olena', loanDaysAgo: 30, returnedDaysAgo: null }, // прострочена на 16 днів
  { book: 'orient', reader: 'taras', loanDaysAgo: 50, returnedDaysAgo: 41 },
  { book: 'hound', reader: 'taras', loanDaysAgo: 21, returnedDaysAgo: null }, // прострочена на 7 днів
  { book: 'dune', reader: 'taras', loanDaysAgo: 3, returnedDaysAgo: null },
  { book: 'kobzar', reader: 'iryna', loanDaysAgo: 90, returnedDaysAgo: 80 },
  { book: 'tiger', reader: 'iryna', loanDaysAgo: 7, returnedDaysAgo: null },
  { book: 'none', reader: 'petro', loanDaysAgo: 40, returnedDaysAgo: null }, // прострочена на 26 днів
  { book: 'dune', reader: 'petro', loanDaysAgo: 2, returnedDaysAgo: null },
];

async function seed() {
  await connectDb();
  await ensureIndexes();
  const { bookDao, readerDao, loanDao } = getDaos();

  const [loansDeleted, booksDeleted, readersDeleted] = await Promise.all([
    loanDao.deleteAll(),
    bookDao.deleteAll(),
    readerDao.deleteAll(),
  ]);
  console.log(`Очищено: books ${booksDeleted}, readers ${readersDeleted}, loans ${loansDeleted}`);

  // availableCopies = totalCopies − активні видачі цієї книжки.
  const activeByBook = new Map();
  for (const loan of LOANS) {
    if (loan.returnedDaysAgo === null) {
      activeByBook.set(loan.book, (activeByBook.get(loan.book) ?? 0) + 1);
    }
  }

  const bookIds = {};
  for (const { key, ...book } of BOOKS) {
    const available = book.totalCopies - (activeByBook.get(key) ?? 0);
    if (available < 0) throw new Error(`Seed: забагато активних видач книжки "${key}"`);
    bookIds[key] = (await bookDao.create({ ...book, availableCopies: available })).id;
  }

  const readerIds = {};
  for (const { key, registeredDaysAgo, ...reader } of READERS) {
    readerIds[key] = (await readerDao.create({ ...reader, registeredAt: daysAgo(registeredDaysAgo) })).id;
  }

  for (const { book, reader, loanDaysAgo, returnedDaysAgo } of LOANS) {
    const loanDate = daysAgo(loanDaysAgo);
    const returned = returnedDaysAgo !== null;
    await loanDao.create({
      bookId: bookIds[book],
      readerId: readerIds[reader],
      loanDate,
      dueDate: new Date(loanDate.getTime() + DEFAULT_LOAN_DAYS * DAY_MS),
      returnDate: returned ? daysAgo(returnedDaysAgo) : null,
      status: returned ? 'returned' : 'active',
      extended: false,
    });
  }

  const overdue = LOANS.filter((l) => l.returnedDaysAgo === null && l.loanDaysAgo > DEFAULT_LOAN_DAYS).length;
  const returnedCount = LOANS.filter((l) => l.returnedDaysAgo !== null).length;
  console.log(
    `Додано в "${config.dbName}": books ${BOOKS.length}, readers ${READERS.length}, ` +
      `loans ${LOANS.length} (повернених ${returnedCount}, прострочених ${overdue})`,
  );
}

seed()
  .catch((err) => {
    console.error(err instanceof DbConnectionError ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
