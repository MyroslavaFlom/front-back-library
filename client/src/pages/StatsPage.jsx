import { Card, Col, Row, Table } from 'react-bootstrap';
import { statsApi } from '../api/index.js';
import { useAsync } from '../hooks/useAsync.js';
import ErrorAlert from '../components/ErrorAlert.jsx';
import Loading from '../components/Loading.jsx';
import { fmtDate, fmtMoney } from '../format.js';

async function loadStats() {
  const [summary, popular, genres, overdue] = await Promise.all([
    statsApi.summary(),
    statsApi.popularBooks({ limit: 10 }),
    statsApi.genres(),
    statsApi.overdue(),
  ]);
  return { summary, popular, genres, overdue };
}

function EmptyRow({ colSpan, text = 'Немає даних' }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center text-body-secondary py-3">
        {text}
      </td>
    </tr>
  );
}

export default function StatsPage() {
  const { data, error, loading } = useAsync(loadStats, []);

  if (error) return <ErrorAlert error={error} />;
  if (loading || !data) return <Loading />;

  const { summary, popular, genres, overdue } = data;
  const tiles = [
    ['Книжок', summary.books],
    ['Читачів', summary.readers],
    ['Примірників', summary.totalCopies],
    ['Доступно', summary.availableCopies],
    ['На руках', summary.copiesOnLoan],
    ['Активних видач', summary.activeLoans],
    ['Прострочено', summary.overdueLoans, summary.overdueLoans > 0],
  ];

  return (
    <>
      <Row xs={2} md={4} xl={7} className="g-3 mb-4">
        {tiles.map(([label, value, warn]) => (
          <Col key={label}>
            <Card body className="h-100">
              <div className={`fs-3 fw-semibold ${warn ? 'text-danger' : ''}`}>{value}</div>
              <div className="small text-body-secondary">{label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row className="g-4 mb-4">
        <Col lg={6}>
          <Card>
            <Card.Body>
              <Card.Title className="mb-3">Популярні книжки</Card.Title>
              <Table size="sm" responsive className="mb-0">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Назва</th>
                    <th>Автор</th>
                    <th className="text-end">Видач</th>
                  </tr>
                </thead>
                <tbody>
                  {popular.length === 0 && <EmptyRow colSpan={4} />}
                  {popular.map((b, i) => (
                    <tr key={b.bookId}>
                      <td>{i + 1}</td>
                      <td>{b.title}</td>
                      <td>{b.author}</td>
                      <td className="text-end">{b.loansCount}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card>
            <Card.Body>
              <Card.Title className="mb-3">Жанри</Card.Title>
              <Table size="sm" responsive className="mb-0">
                <thead>
                  <tr>
                    <th>Жанр</th>
                    <th className="text-end">Книжок</th>
                    <th className="text-end">Примірників</th>
                    <th className="text-end">Доступно</th>
                    <th className="text-end">Видач</th>
                  </tr>
                </thead>
                <tbody>
                  {genres.length === 0 && <EmptyRow colSpan={5} />}
                  {genres.map((g) => (
                    <tr key={g.genre ?? '—'}>
                      <td>{g.genre ?? 'Без жанру'}</td>
                      <td className="text-end">{g.booksCount}</td>
                      <td className="text-end">{g.totalCopies}</td>
                      <td className="text-end">{g.availableCopies}</td>
                      <td className="text-end">{g.loansCount}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card>
        <Card.Body>
          <Card.Title className="mb-3">
            Прострочення{' '}
            {overdue.count > 0 && (
              <span className="fs-6 fw-normal text-body-secondary">
                · {overdue.count} видач, штрафів {fmtMoney(overdue.totalFine)}
              </span>
            )}
          </Card.Title>
          <Table size="sm" responsive className="mb-0">
            <thead>
              <tr>
                <th>Книжка</th>
                <th>Читач</th>
                <th>Повернути до</th>
                <th className="text-end">Днів</th>
                <th className="text-end">Штраф</th>
              </tr>
            </thead>
            <tbody>
              {overdue.items.length === 0 && <EmptyRow colSpan={5} text="Прострочень немає" />}
              {overdue.items.map((l) => (
                <tr key={l.id}>
                  <td>{l.book ? `${l.book.title} — ${l.book.author}` : '—'}</td>
                  <td>
                    {l.reader?.name ?? '—'}
                    {l.reader && <div className="small text-body-secondary">{l.reader.email}</div>}
                  </td>
                  <td>{fmtDate(l.dueDate)}</td>
                  <td className="text-end">{l.daysOverdue}</td>
                  <td className="text-end">{fmtMoney(l.fine)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}
