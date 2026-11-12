import { useMemo, useState } from 'react';
import { Badge, Button, ButtonGroup, Card, Col, Form, Row, Table } from 'react-bootstrap';
import { booksApi, loansApi, readersApi } from '../../api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useApiForm } from '../../hooks/useApiForm.js';
import { useLiveEvents } from '../../hooks/useLiveEvents.js';
import { useToast } from '../../context/ToastContext.jsx';
import ErrorAlert from '../../components/ErrorAlert.jsx';
import Field from '../../components/Field.jsx';
import Loading from '../../components/Loading.jsx';
import { fmtDate, fmtMoney, toBody } from '../../format.js';

const EMPTY_LOAN = { bookId: '', readerId: '', days: '' };

async function loadLoans(status) {
  if (status) return loansApi.listAll({ status, sort: 'dueDate' });
  const [overdue, active] = await Promise.all([
    loansApi.listAll({ status: 'overdue', sort: 'dueDate' }),
    loansApi.listAll({ status: 'active', sort: 'dueDate' }),
  ]);
  return [...overdue, ...active];
}

export default function AdminLoansPage() {
  const [status, setStatus] = useState('');
  const [actionError, setActionError] = useState(null);
  const form = useApiForm(EMPTY_LOAN);
  const { showToast } = useToast();

  const books = useAsync(() => booksApi.listAll({ sort: 'title' }), []);
  const readers = useAsync(() => readersApi.listAll({ sort: 'name' }), []);
  const loans = useAsync(() => loadLoans(status), [status]);

  // Зміни з інших вкладок/адміністраторів.
  useLiveEvents({
    'loan.changed': () => loans.reload(),
    'book.created': () => books.reload(),
    'book.updated': () => books.reload(),
    'book.deleted': () => books.reload(),
  });

  const bookTitles = useMemo(
    () => new Map((books.data ?? []).map((b) => [b.id, `${b.title} — ${b.author}`])),
    [books.data],
  );
  const readerNames = useMemo(
    () => new Map((readers.data ?? []).map((r) => [r.id, `${r.name} (${r.email})`])),
    [readers.data],
  );

  const handleIssue = async (e) => {
    e.preventDefault();
    const loan = await form.submit((values) => loansApi.create(toBody(values, ['days'])));
    if (loan) {
      showToast(`Книжку видано, повернути до ${fmtDate(loan.dueDate)}`);
      form.reset();
      loans.reload();
      books.reload();
    }
  };

  const runAction = async (action) => {
    setActionError(null);
    try {
      await action();
      loans.reload();
      books.reload();
    } catch (err) {
      setActionError(err);
    }
  };

  const handleReturn = (loan) =>
    runAction(async () => {
      const result = await loansApi.return(loan.id);
      const title = bookTitles.get(loan.bookId) ?? 'Книжку';
      if (result.fine > 0) {
        showToast(
          `${title}: повернено із запізненням на ${result.daysOverdue} дн. Штраф: ${fmtMoney(result.fine)}`,
          { variant: 'warning', title: 'Штраф' },
        );
      } else {
        showToast(`${title}: повернено вчасно, штрафу немає`);
      }
    });

  const handleExtend = (loan) =>
    runAction(async () => {
      const result = await loansApi.extend(loan.id);
      showToast(`Видачу продовжено до ${fmtDate(result.dueDate)}`);
    });

  const loadError = loans.error ?? books.error ?? readers.error;

  return (
    <>
      <ErrorAlert error={actionError ?? loadError} onClose={actionError ? () => setActionError(null) : undefined} />

      <Row className="g-4">
        <Col lg={8}>
          <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
            <h2 className="h5 mb-0">Видачі на руках</h2>
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
                  <th>Повернути до</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loans.data?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-body-secondary py-4">
                      Активних видач немає
                    </td>
                  </tr>
                )}
                {loans.data?.map((l) => (
                  <tr key={l.id}>
                    <td>{bookTitles.get(l.bookId) ?? l.bookId}</td>
                    <td>{readerNames.get(l.readerId) ?? l.readerId}</td>
                    <td>
                      {fmtDate(l.dueDate)}
                      <div className="small text-body-secondary">
                        видано {fmtDate(l.loanDate)}
                        {l.extended && ' · продовжено'}
                      </div>
                    </td>
                    <td>
                      {l.isOverdue ? (
                        <Badge bg="danger">
                          {l.daysOverdue} дн. · {fmtMoney(l.fine)}
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
        </Col>

        <Col lg={4}>
          <Card>
            <Card.Body>
              <Card.Title as="h2" className="h5 mb-3">
                Видати книжку
              </Card.Title>
              <ErrorAlert error={form.error} />
              <Form onSubmit={handleIssue} noValidate>
                <Field label="Книжка*" as="select" field={form.bind('bookId')} error={form.fieldErrors.bookId}>
                  <option value="">— оберіть книжку —</option>
                  {(books.data ?? []).map((b) => (
                    <option key={b.id} value={b.id} disabled={b.availableCopies < 1}>
                      {b.title} — {b.author} (вільно: {b.availableCopies})
                    </option>
                  ))}
                </Field>
                <Field label="Читач*" as="select" field={form.bind('readerId')} error={form.fieldErrors.readerId}>
                  <option value="">— оберіть читача —</option>
                  {(readers.data ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.email})
                    </option>
                  ))}
                </Field>
                <Field label="Термін, днів" type="number" min={1} max={30} placeholder="14"
                  field={form.bind('days')} error={form.fieldErrors.days} />
                <Button type="submit" disabled={form.submitting}>
                  Видати
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}
