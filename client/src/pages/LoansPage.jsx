import { useMemo, useState } from 'react';
import { Badge, Button, ButtonGroup, Card, Col, Form, Row, Table } from 'react-bootstrap';
import { booksApi, loansApi, readersApi } from '../api/index.js';
import { useAsync } from '../hooks/useAsync.js';
import ErrorAlert from '../components/ErrorAlert.jsx';
import Notice from '../components/Notice.jsx';
import Loading from '../components/Loading.jsx';
import { fmtDate, fmtMoney, toBody } from '../format.js';

const EMPTY_LOAN = { bookId: '', readerId: '', days: '' };

async function loadLoans(status) {
  if (status) return loansApi.listAll({ status, sort: 'dueDate' });
  const [overdue, active] = await Promise.all([
    loansApi.listAll({ status: 'overdue', sort: 'dueDate' }),
    loansApi.listAll({ status: 'active', sort: 'dueDate' }),
  ]);
  return [...overdue, ...active];
}

export default function LoansPage() {
  const [status, setStatus] = useState('');
  const [form, setForm] = useState(EMPTY_LOAN);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);

  const books = useAsync(() => booksApi.listAll({ sort: 'title' }), []);
  const readers = useAsync(() => readersApi.listAll({ sort: 'name' }), []);
  const loans = useAsync(() => loadLoans(status), [status]);

  const bookTitles = useMemo(
    () => new Map((books.data ?? []).map((b) => [b.id, `${b.title} — ${b.author}`])),
    [books.data],
  );
  const readerNames = useMemo(
    () => new Map((readers.data ?? []).map((r) => [r.id, `${r.name} (${r.email})`])),
    [readers.data],
  );

  const run = async (action) => {
    setActionError(null);
    setNotice(null);
    try {
      setNotice(await action());
      loans.reload();
      books.reload();
      return true;
    } catch (err) {
      setActionError(err);
      return false;
    }
  };

  const handleIssue = async (e) => {
    e.preventDefault();
    const ok = await run(async () => {
      const loan = await loansApi.create(toBody(form, ['days']));
      return { text: `Книжку видано, повернути до ${fmtDate(loan.dueDate)}` };
    });
    if (ok) setForm(EMPTY_LOAN);
  };

  const handleReturn = (loan) =>
    run(async () => {
      const result = await loansApi.return(loan.id);
      const title = bookTitles.get(loan.bookId) ?? 'Книжку';
      return result.fine > 0
        ? {
            variant: 'warning',
            text: `${title}: повернено із запізненням на ${result.daysOverdue} дн. Штраф: ${fmtMoney(result.fine)}`,
          }
        : { text: `${title}: повернено вчасно, штрафу немає` };
    });

  const handleExtend = (loan) =>
    run(async () => {
      const result = await loansApi.extend(loan.id);
      return { text: `Видачу продовжено до ${fmtDate(result.dueDate)}` };
    });

  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })),
  });

  const loadError = loans.error ?? books.error ?? readers.error;

  return (
    <>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <ErrorAlert error={actionError ?? loadError} onClose={actionError ? () => setActionError(null) : undefined} />

      <Row className="g-4">
        <Col lg={8}>
          <Card>
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
                <Card.Title className="mb-0">Активні видачі</Card.Title>
                <Form.Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">Активні та прострочені</option>
                  <option value="active">Лише активні</option>
                  <option value="overdue">Лише прострочені</option>
                </Form.Select>
              </div>

              {loans.loading && !loans.data ? (
                <Loading />
              ) : (
                <Table hover responsive size="sm" className="align-middle">
                  <thead>
                    <tr>
                      <th>Книжка</th>
                      <th>Читач</th>
                      <th>Видано</th>
                      <th>Повернути до</th>
                      <th>Статус</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {loans.data?.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-body-secondary py-4">
                          Активних видач немає
                        </td>
                      </tr>
                    )}
                    {loans.data?.map((l) => (
                      <tr key={l.id}>
                        <td>{bookTitles.get(l.bookId) ?? l.bookId}</td>
                        <td>{readerNames.get(l.readerId) ?? l.readerId}</td>
                        <td>{fmtDate(l.loanDate)}</td>
                        <td>
                          {fmtDate(l.dueDate)}
                          {l.extended && <div className="small text-body-secondary">продовжено</div>}
                        </td>
                        <td>
                          {l.isOverdue ? (
                            <Badge bg="danger">
                              прострочено {l.daysOverdue} дн. · {fmtMoney(l.fine)}
                            </Badge>
                          ) : (
                            <Badge bg="success">активна</Badge>
                          )}
                        </td>
                        <td className="text-end text-nowrap">
                          <ButtonGroup size="sm">
                            <Button variant="outline-primary" onClick={() => handleReturn(l)}>
                              Повернути
                            </Button>
                            <Button
                              variant="outline-secondary"
                              disabled={l.extended || l.isOverdue}
                              title={
                                l.extended
                                  ? 'Вже продовжено'
                                  : l.isOverdue
                                    ? 'Прострочену видачу не можна продовжити'
                                    : 'Продовжити на 7 днів'
                              }
                              onClick={() => handleExtend(l)}
                            >
                              Продовжити
                            </Button>
                          </ButtonGroup>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <Card>
            <Card.Body>
              <Card.Title className="mb-3">Видати книжку</Card.Title>
              <Form onSubmit={handleIssue}>
                <Form.Group className="mb-2">
                  <Form.Label>Книжка*</Form.Label>
                  <Form.Select required {...field('bookId')}>
                    <option value="">— оберіть книжку —</option>
                    {(books.data ?? []).map((b) => (
                      <option key={b.id} value={b.id} disabled={b.availableCopies < 1}>
                        {b.title} — {b.author} (вільно: {b.availableCopies})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Читач*</Form.Label>
                  <Form.Select required {...field('readerId')}>
                    <option value="">— оберіть читача —</option>
                    {(readers.data ?? []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.email})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Термін, днів</Form.Label>
                  <Form.Control type="number" min={1} max={30} placeholder="14" {...field('days')} />
                </Form.Group>
                <Button type="submit">Видати</Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}
