import { useState } from 'react';
import { Button, Card, Col, Form, Row, Table } from 'react-bootstrap';
import { readersApi } from '../api/index.js';
import { useAsync } from '../hooks/useAsync.js';
import ErrorAlert from '../components/ErrorAlert.jsx';
import Notice from '../components/Notice.jsx';
import Pager from '../components/Pager.jsx';
import Loading from '../components/Loading.jsx';
import { dash, fmtDate, toBody } from '../format.js';

const PAGE_SIZE = 10;
const EMPTY_READER = { name: '', email: '', phone: '' };

export default function ReadersPage() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(EMPTY_READER);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);

  const readers = useAsync(
    () => readersApi.list({ page, limit: PAGE_SIZE, sort: 'name', search }),
    [page, search],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setActionError(null);
    setNotice(null);
    try {
      const reader = await readersApi.create(toBody(form));
      setNotice({ text: `Читача «${reader.name}» додано` });
      setForm(EMPTY_READER);
      readers.reload();
    } catch (err) {
      setActionError(err);
    }
  };

  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })),
  });

  return (
    <>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <ErrorAlert error={actionError ?? readers.error} onClose={actionError ? () => setActionError(null) : undefined} />

      <Row className="g-4">
        <Col lg={8}>
          <Card>
            <Card.Body>
              <Card.Title className="mb-3">Читачі</Card.Title>
              <Form
                className="d-flex gap-2 mb-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSearch(searchInput.trim());
                  setPage(1);
                }}
              >
                <Form.Control
                  type="search"
                  placeholder="Пошук за ім'ям або email"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <Button type="submit">Знайти</Button>
              </Form>

              {readers.loading && !readers.data ? (
                <Loading />
              ) : (
                <Table hover responsive size="sm" className="align-middle">
                  <thead>
                    <tr>
                      <th>Ім'я</th>
                      <th>Email</th>
                      <th>Телефон</th>
                      <th>Зареєстрований</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readers.data?.items.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center text-body-secondary py-4">
                          Читачів не знайдено
                        </td>
                      </tr>
                    )}
                    {readers.data?.items.map((r) => (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td>{r.email}</td>
                        <td>{dash(r.phone)}</td>
                        <td>{fmtDate(r.registeredAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              {readers.data && <Pager {...readers.data} onChange={setPage} />}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <Card>
            <Card.Body>
              <Card.Title className="mb-3">Новий читач</Card.Title>
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-2">
                  <Form.Label>Ім'я*</Form.Label>
                  <Form.Control required {...field('name')} />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Email*</Form.Label>
                  <Form.Control type="email" required {...field('email')} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Телефон</Form.Label>
                  <Form.Control type="tel" {...field('phone')} />
                </Form.Group>
                <Button type="submit">Додати</Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}
