import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Badge, Card, Col, Row } from 'react-bootstrap';
import { booksApi } from '../api/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { useLiveEvents } from '../hooks/useLiveEvents.js';
import ErrorAlert from '../components/ErrorAlert.jsx';
import Loading from '../components/Loading.jsx';
import { dash } from '../format.js';

export default function BookDetailsPage() {
  const { id } = useParams();
  const book = useAsync(() => booksApi.get(id), [id]);
  const [deleted, setDeleted] = useState(false);

  useLiveEvents({
    'book.updated': ({ book: changed }) => changed.id === id && book.reload(),
    'book.deleted': ({ id: deletedId }) => deletedId === id && setDeleted(true),
  });

  const back = (
    <Link to="/" className="d-inline-block mb-3">
      ← До каталогу
    </Link>
  );

  if (deleted) return <>{back}<Alert variant="warning">Цю книжку щойно видалено з каталогу.</Alert></>;
  if (book.error) return <>{back}<ErrorAlert error={book.error} /></>;
  if (!book.data) return <Loading />;

  const b = book.data;
  const available = b.availableCopies > 0;
  const facts = [
    ['Автор', b.author],
    ['Жанр', dash(b.genre)],
    ['Рік', dash(b.year)],
    ['Сторінок', dash(b.pages)],
    ['ISBN', b.isbn],
    ['Рейтинг', b.rating !== undefined ? `★ ${b.rating}` : '—'],
    ['Примірників', `${b.availableCopies} вільних із ${b.totalCopies}`],
  ];

  return (
    <>
      {back}
      <Card className="shadow-sm">
        <Card.Body className="p-4">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
            <div>
              <h1 className="h3 mb-1">{b.title}</h1>
              <div className="text-body-secondary">{b.author}</div>
            </div>
            <Badge bg={available ? 'success' : 'danger'} className="fs-6">
              {available ? 'Є в наявності' : 'Немає в наявності'}
            </Badge>
          </div>
          <Row as="dl" className="mb-0">
            {facts.map(([label, value]) => (
              <Col key={label} sm={6} lg={4} className="mb-3">
                <dt className="small text-body-secondary fw-normal">{label}</dt>
                <dd className="mb-0">{value}</dd>
              </Col>
            ))}
          </Row>
        </Card.Body>
      </Card>
    </>
  );
}
