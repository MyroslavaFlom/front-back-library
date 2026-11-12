import { useEffect } from 'react';
import { Button, Col, Form, Modal, Row } from 'react-bootstrap';
import { booksApi } from '../../api/index.js';
import { useApiForm } from '../../hooks/useApiForm.js';
import ErrorAlert from '../../components/ErrorAlert.jsx';
import Field from '../../components/Field.jsx';
import { toBody } from '../../format.js';

const EMPTY = { title: '', author: '', isbn: '', genre: '', year: '', pages: '', totalCopies: '', rating: '' };
const NUMERIC = ['year', 'pages', 'totalCopies', 'rating'];

// book = null — нова книжка; інакше редагування (PUT: незаповнені необов'язкові поля видаляються).
export default function BookFormModal({ show, book, onHide, onSaved }) {
  const form = useApiForm(EMPTY);
  const { reset } = form;

  useEffect(() => {
    if (show) reset(book ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, book[k] ?? ''])) : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, book]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const saved = await form.submit((values) => {
      const body = toBody(values, NUMERIC);
      return book ? booksApi.replace(book.id, body) : booksApi.create(body);
    });
    if (saved) onSaved(saved, { created: !book });
  };

  const f = (name, label, props = {}) => (
    <Field label={label} field={form.bind(name)} error={form.fieldErrors[name]} {...props} />
  );

  return (
    <Modal show={show} onHide={onHide} centered>
      <Form onSubmit={handleSubmit} noValidate>
        <Modal.Header closeButton>
          <Modal.Title as="h5">{book ? 'Редагування книжки' : 'Нова книжка'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ErrorAlert error={form.error} />
          {f('title', 'Назва*', { autoFocus: true })}
          {f('author', 'Автор*')}
          {f('isbn', 'ISBN*', { placeholder: '978-…' })}
          {f('genre', 'Жанр')}
          <Row>
            <Col>{f('year', 'Рік', { type: 'number' })}</Col>
            <Col>{f('pages', 'Сторінок', { type: 'number', min: 1 })}</Col>
          </Row>
          <Row>
            <Col>{f('totalCopies', 'Примірників*', { type: 'number', min: 0 })}</Col>
            <Col>{f('rating', 'Рейтинг', { type: 'number', min: 0, max: 5, step: 0.1 })}</Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide}>
            Скасувати
          </Button>
          <Button type="submit" disabled={form.submitting}>
            Зберегти
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
