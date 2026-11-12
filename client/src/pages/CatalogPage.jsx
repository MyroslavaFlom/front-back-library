import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, Col, Form, Row } from 'react-bootstrap';
import { booksApi } from '../api/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { useLiveEvents } from '../hooks/useLiveEvents.js';
import { useToast } from '../context/ToastContext.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import Loading from '../components/Loading.jsx';
import Pager from '../components/Pager.jsx';
import { dash } from '../format.js';

const PAGE_SIZE = 12;

// Жанри — з усіх книжок каталогу (окремого публічного ендпоінта для жанрів немає).
async function loadGenres() {
  const books = await booksApi.listAll({ sort: 'title' });
  return [...new Set(books.map((b) => b.genre).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'uk'));
}

function BookCard({ book }) {
  const available = book.availableCopies > 0;
  return (
    <Card className="h-100 shadow-sm">
      <Card.Body className="d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          {book.genre ? <Badge bg="secondary">{book.genre}</Badge> : <span />}
          {book.rating !== undefined && <span className="small text-body-secondary">★ {book.rating}</span>}
        </div>
        <Card.Title as="h5" className="mb-1">
          <Link to={`/books/${book.id}`} className="stretched-link text-decoration-none text-reset">
            {book.title}
          </Link>
        </Card.Title>
        <Card.Subtitle className="text-body-secondary mb-3">{book.author}</Card.Subtitle>
        <div className="mt-auto d-flex justify-content-between align-items-center small">
          <span className="text-body-secondary">{dash(book.year)}</span>
          <Badge bg={available ? 'success' : 'danger'}>
            {available ? `Доступно: ${book.availableCopies}` : 'Немає в наявності'}
          </Badge>
        </div>
      </Card.Body>
    </Card>
  );
}

export default function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const genre = params.get('genre') ?? '';
  const available = params.get('available') === 'true';
  const page = Number(params.get('page')) || 1;
  const [searchInput, setSearchInput] = useState(search);
  const { showToast } = useToast();

  useEffect(() => setSearchInput(search), [search]);

  const books = useAsync(
    () =>
      booksApi.list({
        page,
        limit: PAGE_SIZE,
        sort: 'title',
        search,
        genre,
        available: available ? 'true' : undefined,
      }),
    [page, search, genre, available],
  );
  const genres = useAsync(loadGenres, []);

  // Каталог оновлюється сам: зміни книжок (зокрема кількість вільних примірників після видачі).
  useLiveEvents({
    'book.created': ({ book }) => {
      showToast(`Додано нову книжку: ${book.title}`, { variant: 'info', title: 'Каталог' });
      books.reload();
      genres.reload();
    },
    'book.updated': () => books.reload(),
    'book.deleted': () => books.reload(),
  });

  const updateParams = (changes) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === '' || value === false || value === undefined || value === 1) next.delete(key);
      else next.set(key, String(value));
    }
    setParams(next);
  };

  return (
    <>
      <h1 className="h3 mb-3">Каталог</h1>

      <Form
        className="row g-2 align-items-center mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          updateParams({ search: searchInput.trim(), page: 1 });
        }}
      >
        <Col md>
          <Form.Control
            type="search"
            placeholder="Пошук за назвою, автором…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Пошук"
          />
        </Col>
        <Col md="auto">
          <Form.Select
            value={genre}
            onChange={(e) => updateParams({ genre: e.target.value, page: 1 })}
            aria-label="Жанр"
          >
            <option value="">Усі жанри</option>
            {(genres.data ?? []).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Form.Select>
        </Col>
        <Col xs="auto">
          <Form.Check
            type="switch"
            id="only-available"
            label="Лише доступні"
            checked={available}
            onChange={(e) => updateParams({ available: e.target.checked, page: 1 })}
          />
        </Col>
        <Col xs="auto">
          <Button type="submit">Знайти</Button>
        </Col>
      </Form>

      <ErrorAlert error={books.error} />

      {books.loading && !books.data ? (
        <Loading />
      ) : books.data?.items.length === 0 ? (
        <p className="text-center text-body-secondary py-5">Книжок не знайдено</p>
      ) : (
        <Row xs={1} sm={2} lg={3} xl={4} className="g-3 mb-4">
          {books.data?.items.map((book) => (
            <Col key={book.id}>
              <BookCard book={book} />
            </Col>
          ))}
        </Row>
      )}

      {books.data && books.data.totalPages > 1 && (
        <Pager {...books.data} onChange={(p) => updateParams({ page: p })} />
      )}
    </>
  );
}
