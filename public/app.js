// Мінімальний клієнт до /api без фреймворків.

const $ = (sel, root = document) => root.querySelector(sel);
const MAX_LIMIT = 100; // максимальний limit, який приймає API

// ---------- HTTP ----------

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function api(path, { method = 'GET', body, query } = {}) {
  let url = `/api${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, v);
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Сервер недоступний');
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(res.status, err?.message ?? `Помилка ${res.status}`, err?.details);
  }
  return data;
}

// ---------- Повідомлення ----------

let messageTimer;

function showMessage(text, type = 'success') {
  const box = $('#message');
  box.textContent = text;
  box.className = `message ${type}`;
  box.hidden = false;
  clearTimeout(messageTimer);
  if (type === 'success') messageTimer = setTimeout(() => (box.hidden = true), 4000);
  box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function showError(err) {
  let text = err.message;
  if (Array.isArray(err.details) && err.details.length > 0) {
    text += '\n' + err.details.map((d) => `• ${d.field}: ${d.message}`).join('\n');
  }
  showMessage(text, 'error');
}

/** Обгортка для обробників: помилки API показуються на сторінці. */
const guarded = (fn) => async (...args) => {
  try {
    await fn(...args);
  } catch (err) {
    console.error(err);
    showError(err);
  }
};

// ---------- Утиліти DOM ----------

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child === undefined || child === null) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

function fillRows(tbody, rows, colspan, emptyText = 'Немає даних') {
  tbody.replaceChildren(
    ...(rows.length > 0 ? rows : [el('tr', {}, el('td', { colspan, class: 'empty' }, emptyText))]),
  );
}

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('uk-UA') : '—');
const fmtMoney = (n) => `${n} грн`;
const dash = (v) => (v === undefined || v === null || v === '' ? '—' : v);

function renderPager(container, { page, totalPages, total }, onPage) {
  container.replaceChildren(
    el('button', { class: 'small', disabled: page <= 1, onclick: () => onPage(page - 1) }, '←'),
    el('span', {}, `Сторінка ${page} з ${Math.max(totalPages, 1)} · усього ${total}`),
    el('button', { class: 'small', disabled: page >= totalPages, onclick: () => onPage(page + 1) }, '→'),
  );
}

/** Значення форми → об'єкт; порожні поля пропускаються, числові конвертуються. */
function formData(form) {
  const result = {};
  for (const input of form.elements) {
    if (!input.name || input.name === 'id') continue;
    const raw = input.value.trim();
    if (raw === '') continue;
    result[input.name] = input.type === 'number' ? Number(raw) : raw;
  }
  return result;
}

// ---------- Вкладки ----------

const loaders = {};

function switchTab(name) {
  for (const btn of document.querySelectorAll('.tab')) {
    btn.classList.toggle('active', btn.dataset.tab === name);
  }
  for (const panel of document.querySelectorAll('.panel')) {
    panel.hidden = panel.id !== `tab-${name}`;
  }
  $('#message').hidden = true;
  history.replaceState(null, '', `#${name}`);
  guarded(loaders[name])();
}

for (const btn of document.querySelectorAll('.tab')) {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
}

// ---------- Книжки ----------

const booksState = { page: 1, search: '', genre: '' };

async function loadGenreOptions() {
  const select = $('#books-filter [name=genre]');
  const genres = await api('/stats/genres');
  const current = select.value;
  select.replaceChildren(
    el('option', { value: '' }, 'Усі жанри'),
    ...genres.filter((g) => g.genre).map((g) => el('option', { value: g.genre }, g.genre)),
  );
  select.value = current;
}

async function loadBooks() {
  const data = await api('/books', {
    query: {
      page: booksState.page,
      limit: 10,
      sort: 'title',
      search: booksState.search,
      genre: booksState.genre,
    },
  });

  const rows = data.items.map((b) =>
    el('tr', {},
      el('td', {}, b.title, el('span', { class: 'sub' }, b.isbn)),
      el('td', {}, b.author),
      el('td', {}, dash(b.genre)),
      el('td', {}, dash(b.year)),
      el('td', {}, `${b.availableCopies} / ${b.totalCopies}`),
      el('td', { class: 'actions' },
        el('button', { class: 'small', onclick: () => editBook(b) }, 'Редагувати'),
        el('button', { class: 'small danger', onclick: guarded(() => deleteBook(b)) }, 'Видалити'),
      ),
    ),
  );
  fillRows($('#books-body'), rows, 6, 'Книжок не знайдено');
  renderPager($('#books-pager'), data, (p) => {
    booksState.page = p;
    guarded(loadBooks)();
  });
}

loaders.books = async () => {
  await Promise.all([loadBooks(), loadGenreOptions()]);
};

$('#books-filter').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  booksState.search = form.search.value.trim();
  booksState.genre = form.genre.value;
  booksState.page = 1;
  guarded(loadBooks)();
});
$('#books-filter [name=genre]').addEventListener('change', () => $('#books-filter').requestSubmit());

const bookForm = $('#book-form');
const BOOK_FIELDS = ['title', 'author', 'isbn', 'genre', 'year', 'pages', 'totalCopies', 'rating'];

function resetBookForm() {
  bookForm.reset();
  bookForm.id.value = '';
  $('#book-form-title').textContent = 'Нова книжка';
}

function editBook(book) {
  bookForm.id.value = book.id;
  for (const f of BOOK_FIELDS) bookForm[f].value = book[f] ?? '';
  $('#book-form-title').textContent = 'Редагування книжки';
  bookForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  bookForm.title.focus();
}

async function deleteBook(book) {
  if (!confirm(`Видалити «${book.title}»?`)) return;
  await api(`/books/${book.id}`, { method: 'DELETE' });
  if (bookForm.id.value === book.id) resetBookForm();
  showMessage(`Книжку «${book.title}» видалено`);
  await loaders.books();
}

bookForm.addEventListener('submit', guarded(async (e) => {
  e.preventDefault();
  const id = bookForm.id.value;
  const body = formData(bookForm);
  // PUT — повна заміна: незаповнені необов'язкові поля видаляються, availableCopies сервер перерахує.
  const book = id
    ? await api(`/books/${id}`, { method: 'PUT', body })
    : await api('/books', { method: 'POST', body });
  showMessage(id ? `Книжку «${book.title}» оновлено` : `Книжку «${book.title}» додано`);
  resetBookForm();
  await loaders.books();
}));
$('#book-form-cancel').addEventListener('click', resetBookForm);

// ---------- Читачі ----------

const readersState = { page: 1, search: '' };

async function loadReaders() {
  const data = await api('/readers', {
    query: { page: readersState.page, limit: 10, sort: 'name', search: readersState.search },
  });
  const rows = data.items.map((r) =>
    el('tr', {},
      el('td', {}, r.name),
      el('td', {}, r.email),
      el('td', {}, dash(r.phone)),
      el('td', {}, fmtDate(r.registeredAt)),
    ),
  );
  fillRows($('#readers-body'), rows, 4, 'Читачів не знайдено');
  renderPager($('#readers-pager'), data, (p) => {
    readersState.page = p;
    guarded(loadReaders)();
  });
}

loaders.readers = loadReaders;

$('#readers-filter').addEventListener('submit', (e) => {
  e.preventDefault();
  readersState.search = e.currentTarget.search.value.trim();
  readersState.page = 1;
  guarded(loadReaders)();
});

$('#reader-form').addEventListener('submit', guarded(async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const reader = await api('/readers', { method: 'POST', body: formData(form) });
  showMessage(`Читача «${reader.name}» додано`);
  form.reset();
  await loadReaders();
}));

// ---------- Видачі ----------

const titles = { books: new Map(), readers: new Map() };

async function fetchAll(path, query = {}) {
  const first = await api(path, { query: { ...query, limit: MAX_LIMIT, page: 1 } });
  const items = [...first.items];
  for (let page = 2; page <= first.totalPages; page++) {
    items.push(...(await api(path, { query: { ...query, limit: MAX_LIMIT, page } })).items);
  }
  return items;
}

async function loadLoanFormOptions() {
  const [books, readers] = await Promise.all([
    fetchAll('/books', { sort: 'title' }),
    fetchAll('/readers', { sort: 'name' }),
  ]);
  titles.books = new Map(books.map((b) => [b.id, `${b.title} — ${b.author}`]));
  titles.readers = new Map(readers.map((r) => [r.id, `${r.name} (${r.email})`]));

  const form = $('#loan-form');
  const bookValue = form.bookId.value;
  const readerValue = form.readerId.value;
  form.bookId.replaceChildren(
    el('option', { value: '' }, '— оберіть книжку —'),
    ...books.map((b) =>
      el('option', { value: b.id, disabled: b.availableCopies < 1 },
        `${b.title} — ${b.author} (вільно: ${b.availableCopies})`),
    ),
  );
  form.readerId.replaceChildren(
    el('option', { value: '' }, '— оберіть читача —'),
    ...readers.map((r) => el('option', { value: r.id }, `${r.name} (${r.email})`)),
  );
  form.bookId.value = bookValue;
  form.readerId.value = readerValue;
}

async function loadLoans() {
  const status = $('#loans-status').value;
  const loans = status
    ? await fetchAll('/loans', { status, sort: 'dueDate' })
    : (await Promise.all([
        fetchAll('/loans', { status: 'overdue', sort: 'dueDate' }),
        fetchAll('/loans', { status: 'active', sort: 'dueDate' }),
      ])).flat();

  const rows = loans.map((l) =>
    el('tr', {},
      el('td', {}, titles.books.get(l.bookId) ?? l.bookId),
      el('td', {}, titles.readers.get(l.readerId) ?? l.readerId),
      el('td', {}, fmtDate(l.loanDate)),
      el('td', {}, fmtDate(l.dueDate), l.extended ? el('span', { class: 'sub' }, 'продовжено') : null),
      el('td', {},
        l.isOverdue
          ? el('span', { class: 'badge overdue' }, `прострочено ${l.daysOverdue} дн. · ${fmtMoney(l.fine)}`)
          : el('span', { class: 'badge active' }, 'активна'),
      ),
      el('td', { class: 'actions' },
        el('button', { class: 'small', onclick: guarded(() => returnLoan(l)) }, 'Повернути'),
        el('button', {
          class: 'small',
          disabled: l.extended || l.isOverdue,
          title: l.extended ? 'Вже продовжено' : l.isOverdue ? 'Прострочену видачу не можна продовжити' : 'Продовжити на 7 днів',
          onclick: guarded(() => extendLoan(l)),
        }, 'Продовжити'),
      ),
    ),
  );
  fillRows($('#loans-body'), rows, 6, 'Активних видач немає');
}

loaders.loans = async () => {
  await loadLoanFormOptions();
  await loadLoans();
};

$('#loans-status').addEventListener('change', guarded(loadLoans));

async function returnLoan(loan) {
  const result = await api(`/loans/${loan.id}/return`, { method: 'POST' });
  const name = titles.books.get(loan.bookId) ?? 'Книжку';
  if (result.fine > 0) {
    showMessage(
      `${name}: повернено із запізненням на ${result.daysOverdue} дн. Штраф: ${fmtMoney(result.fine)}`,
      'error',
    );
  } else {
    showMessage(`${name}: повернено вчасно, штрафу немає`);
  }
  await loaders.loans();
}

async function extendLoan(loan) {
  const result = await api(`/loans/${loan.id}/extend`, { method: 'POST' });
  showMessage(`Видачу продовжено до ${fmtDate(result.dueDate)}`);
  await loadLoans();
}

$('#loan-form').addEventListener('submit', guarded(async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const loan = await api('/loans', { method: 'POST', body: formData(form) });
  showMessage(`Книжку видано, повернути до ${fmtDate(loan.dueDate)}`);
  form.reset();
  await loaders.loans();
}));

// ---------- Статистика ----------

async function loadStats() {
  const [summary, popular, genres, overdue] = await Promise.all([
    api('/stats/summary'),
    api('/stats/popular-books', { query: { limit: 10 } }),
    api('/stats/genres'),
    api('/stats/overdue'),
  ]);

  const tiles = [
    ['Книжок', summary.books],
    ['Читачів', summary.readers],
    ['Примірників', summary.totalCopies],
    ['Доступно', summary.availableCopies],
    ['На руках', summary.copiesOnLoan],
    ['Активних видач', summary.activeLoans],
    ['Прострочено', summary.overdueLoans, summary.overdueLoans > 0],
  ];
  $('#stats-summary').replaceChildren(
    ...tiles.map(([label, value, warn]) =>
      el('div', { class: warn ? 'tile warn' : 'tile' },
        el('div', { class: 'value' }, value),
        el('div', { class: 'label' }, label),
      ),
    ),
  );

  fillRows($('#stats-popular'), popular.map((b, i) =>
    el('tr', {},
      el('td', {}, i + 1),
      el('td', {}, b.title),
      el('td', {}, b.author),
      el('td', { class: 'num' }, b.loansCount),
    ),
  ), 4);

  fillRows($('#stats-genres'), genres.map((g) =>
    el('tr', {},
      el('td', {}, g.genre ?? 'Без жанру'),
      el('td', { class: 'num' }, g.booksCount),
      el('td', { class: 'num' }, g.totalCopies),
      el('td', { class: 'num' }, g.availableCopies),
      el('td', { class: 'num' }, g.loansCount),
    ),
  ), 5);

  $('#stats-overdue-total').textContent =
    overdue.count > 0 ? `· ${overdue.count} видач, штрафів ${fmtMoney(overdue.totalFine)}` : '';
  fillRows($('#stats-overdue'), overdue.items.map((l) =>
    el('tr', {},
      el('td', {}, l.book ? `${l.book.title} — ${l.book.author}` : '—'),
      el('td', {}, l.reader ? l.reader.name : '—', l.reader ? el('span', { class: 'sub' }, l.reader.email) : null),
      el('td', {}, fmtDate(l.dueDate)),
      el('td', { class: 'num' }, l.daysOverdue),
      el('td', { class: 'num' }, fmtMoney(l.fine)),
    ),
  ), 5, 'Прострочень немає');
}

loaders.stats = loadStats;

// ---------- Старт ----------

const initial = location.hash.slice(1);
switchTab(loaders[initial] ? initial : 'books');
