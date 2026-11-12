import { Card, Col, Row, Table } from 'react-bootstrap';
import { statsApi } from '../../api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useLiveEvents } from '../../hooks/useLiveEvents.js';
import ErrorAlert from '../../components/ErrorAlert.jsx';
import Loading from '../../components/Loading.jsx';
import { fmtDate, fmtMoney } from '../../format.js';

async function loadStats() {
  const [summary, popular, overdue] = await Promise.all([
    statsApi.summary(),
    statsApi.popularBooks({ limit: 5 }),
    statsApi.overdue(),
  ]);
  return { summary, popular, overdue };
}

export default function AdminStatsPage() {
  const stats = useAsync(loadStats, []);

  useLiveEvents({
    'loan.changed': () => stats.reload(),
    'book.created': () => stats.reload(),
    'book.deleted': () => stats.reload(),
  });

  if (stats.error) return <ErrorAlert error={stats.error} />;
  if (!stats.data) return <Loading />;

  const { summary, popular, overdue } = stats.data;
  const tiles = [
    ['Книжок', summary.books],
    ['Читачів', summary.readers],
    ['Примірників', summary.totalCopies],
    ['Доступно', summary.availableCopies],
    ['На руках', summary.copiesOnLoan],
    ['Активних видач', summary.activeLoans],
    ['Прострочено', summary.overdueLoans, summary.overdueLoans > 0],
    ['Сума штрафів', fmtMoney(overdue.totalFine), overdue.totalFine > 0],
  ];

  return (
    <>
      <Row xs={2} md={4} className="g-3 mb-4">
        {tiles.map(([label, value, warn]) => (
          <Col key={label}>
            <Card body className="h-100">
              <div className={`fs-3 fw-semibold ${warn ? 'text-danger' : ''}`}>{value}</div>
              <div className="small text-body-secondary">{label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row className="g-4">
        <Col lg={5}>
          <Card>
            <Card.Body>
              <Card.Title as="h2" className="h5 mb-3">
                Популярні книжки
              </Card.Title>
              <Table size="sm" className="mb-0">
                <tbody>
                  {popular.length === 0 && (
                    <tr>
                      <td className="text-body-secondary">Немає даних</td>
                    </tr>
                  )}
                  {popular.map((b, i) => (
                    <tr key={b.bookId}>
                      <td className="text-body-secondary">{i + 1}</td>
                      <td>
                        {b.title}
                        <div className="small text-body-secondary">{b.author}</div>
                      </td>
                      <td className="text-end">{b.loansCount}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={7}>
          <Card>
            <Card.Body>
              <Card.Title as="h2" className="h5 mb-3">
                Прострочення
              </Card.Title>
              <Table size="sm" responsive className="mb-0">
                <thead>
                  <tr>
                    <th>Книжка</th>
                    <th>Читач</th>
                    <th>Термін</th>
                    <th className="text-end">Штраф</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-body-secondary">
                        Прострочень немає
                      </td>
                    </tr>
                  )}
                  {overdue.items.map((l) => (
                    <tr key={l.id}>
                      <td>{l.book?.title ?? '—'}</td>
                      <td>{l.reader?.name ?? '—'}</td>
                      <td>
                        {fmtDate(l.dueDate)}
                        <div className="small text-danger">{l.daysOverdue} дн.</div>
                      </td>
                      <td className="text-end">{fmtMoney(l.fine)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}
