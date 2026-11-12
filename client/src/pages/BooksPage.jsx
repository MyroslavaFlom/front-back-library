import { useState } from 'react';
import { Button, ButtonGroup, Card, Col, Form, Row, Table } from 'react-bootstrap';
import { booksApi, statsApi } from '../api/index.js';
import { useAsync } from '../hooks/useAsync.js';
import ErrorAlert from '../components/ErrorAlert.jsx';
import Notice from '../components/Notice.jsx';
import Pager from '../components/Pager.jsx';
import Loading from '../components/Loading.jsx';
import { dash, toBody } from '../format.js';

const PAGE_SIZE = 10;
const EMPTY_BOOK = { title: '', author: '', isbn: '', genre: '', year: '', pages: '', totalCopies: '', rating: '' };
const NUMERIC = ['year', 'pages', 'totalCopies', 'rating'];

export default function BooksPage() {
  const [filters, setFilters] = useState({ search: '', genre: '' });
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_BOOK);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);

  const books = useAsync(
    () => booksApi.list({ page, limit: PAGE_SIZE, sort: 'title', ...filters }),
    [page, filters.search, filters.genre],
  );
  const genres = useAsync(() => statsApi.genres(), []);

  const applyFilters = (next) => {
    setFilters((f) => ({ ...f, ...next }));
    setPage(1);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_BOOK);
  };

  const startEdit = (book) => {
    setEditingId(book.id);
    setForm(Object.fromEntries(Object.keys(EMPTY_BOOK).map((k) => [k, book[k] ?? ''])));
    setActionError(null);
  };

  // Обгортка дій: помилка API показується над сторінкою, успіх — повідомленням.
  const run = async (action, successText) => {
    setActionError(null);
    setNotice(null);
    try {
      await action();
      setNotice({ text: successText });
      books.reload();
      genres.reload();
      return true;
    } catch (err) {
      setActionError(err);
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const body = toBody(form, NUMERIC);
    // PUT — повна заміна: незаповнені необов'язкові поля видаляються, availableCopies сервер перерахує.
    const ok = await run(
      () => (editingId ? booksApi.replace(editingId, body) : booksApi.create(body)),
      editingId ? `Книжку «${body.title}» оновлено` : `Книжку «${body.title}» додано`,
    );
    if (ok) resetForm();
  };

  const handleDelete = async (book) => {
    if (!window.confirm(`Видалити «${book.title}»?`)) return;
    const ok = await run(() => booksApi.remove(book.id), `Книжку «${book.title}» видалено`);
    if (ok && editingId === book.id) resetForm();
  };

  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })),
  });

  return (
    <>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <ErrorAlert error={actionError ?? books.error} onClose={actionError ? () => setActionError(null) : undefined} />

      <Row className="g-4">
        <Col lg={8}>
          <Card>
            <Card.Body>
              <Card.Title className="mb-3">Каталог</Card.Title>
              <Form
                className="d-flex gap-2 mb-3 flex-wrap"
                onSubmit={(e) => {
                  e.preventDefault();
                  applyFilters({ search: searchInput.trim() });
                }}
              >
                <Form.Control
                  type="search"
                  placeholder="Пошук за назвою, автором…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="flex-grow-1 w-auto"
                />
                <Form.Select
                  className="w-auto"
                  value={filters.genre}
                  onChange={(e) => applyFilters({ genre: e.target.value })}
                >
                  <option value="">Усі жанри</option>
                  {(genres.data ?? [])
                    .filter((g) => g.genre)
                    .map((g) => (
                      <option key={g.genre} value={g.genre}>
                        {g.genre}
                      </option>
                    ))}
                </Form.Select>
                <Button type="submit">Знайти</Button>
              </Form>

              {books.loading && !books.data ? (
                <Loading />
              ) : (
                <Table hover responsive size="sm" className="align-middle">
                  <thead>
                    <tr>
                      <th>Назва</th>
                      <th>Автор</th>
                      <th>Жанр</th>
                      <th>Рік</th>
                      <th>Примірники</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {books.data?.items.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-body-secondary py-4">
                          Книжок не знайдено
                        </td>
                      </tr>
                    )}
                    {books.data?.items.map((b) => (
                      <tr key={b.id} className={editingId === b.id ? 'table-active' : undefined}>
                        <td>
                          {b.title}
                          <div className="small text-body-secondary">{b.isbn}</div>
                        </td>
                        <td>{b.author}</td>
                        <td>{dash(b.genre)}</td>
                        <td>{dash(b.year)}</td>
                        <td>
                          {b.availableCopies} / {b.totalCopies}
                        </td>
                        <td className="text-end text-nowrap">
                          <ButtonGroup size="sm">
                            <Button variant="outline-primary" onClick={() => startEdit(b)}>
                              Редагувати
                            </Button>
                            <Button variant="outline-danger" onClick={() => handleDelete(b)}>
                              Видалити
                            </Button>
                          </ButtonGroup>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              {books.data && <Pager {...books.data} onChange={setPage} />}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <Card>
            <Card.Body>
              <Card.Title className="mb-3">{editingId ? 'Редагування книжки' : 'Нова книжка'}</Card.Title>
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-2">
                  <Form.Label>Назва*</Form.Label>
                  <Form.Control required {...field('title')} />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Автор*</Form.Label>
                  <Form.Control required {...field('author')} />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>ISBN*</Form.Label>
                  <Form.Control required placeholder="978-…" {...field('isbn')} />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Жанр</Form.Label>
                  <Form.Control {...field('genre')} />
                </Form.Group>
                <Row className="g-2 mb-2">
                  <Col>
                    <Form.Label>Рік</Form.Label>
                    <Form.Control type="number" {...field('year')} />
                  </Col>
                  <Col>
                    <Form.Label>Сторінок</Form.Label>
                    <Form.Control type="number" min={1} {...field('pages')} />
                  </Col>
                </Row>
                <Row className="g-2 mb-3">
                  <Col>
                    <Form.Label>Примірників*</Form.Label>
                    <Form.Control type="number" min={0} required {...field('totalCopies')} />
                  </Col>
                  <Col>
                    <Form.Label>Рейтинг</Form.Label>
                    <Form.Control type="number" min={0} max={5} step={0.1} {...field('rating')} />
                  </Col>
                </Row>
                <div className="d-flex gap-2">
                  <Button type="submit">Зберегти</Button>
                  <Button variant="outline-secondary" onClick={resetForm}>
                    Скасувати
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}
