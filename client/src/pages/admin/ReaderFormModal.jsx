import { useEffect } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import { readersApi } from '../../api/index.js';
import { useApiForm } from '../../hooks/useApiForm.js';
import ErrorAlert from '../../components/ErrorAlert.jsx';
import Field from '../../components/Field.jsx';
import { toBody } from '../../format.js';

const EMPTY = { name: '', email: '', phone: '' };

export default function ReaderFormModal({ show, reader, onHide, onSaved }) {
  const form = useApiForm(EMPTY);
  const { reset } = form;

  useEffect(() => {
    if (show) reset(reader ? { name: reader.name, email: reader.email, phone: reader.phone ?? '' } : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, reader]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const saved = await form.submit((values) => {
      const body = toBody(values);
      // PUT зберігає registeredAt; порожній телефон видаляється.
      return reader ? readersApi.replace(reader.id, body) : readersApi.create(body);
    });
    if (saved) onSaved(saved, { created: !reader });
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Form onSubmit={handleSubmit} noValidate>
        <Modal.Header closeButton>
          <Modal.Title as="h5">{reader ? 'Редагування читача' : 'Новий читач'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ErrorAlert error={form.error} />
          <Field label="Ім'я*" field={form.bind('name')} error={form.fieldErrors.name} autoFocus />
          <Field label="Email*" type="email" field={form.bind('email')} error={form.fieldErrors.email} />
          <Field label="Телефон" type="tel" field={form.bind('phone')} error={form.fieldErrors.phone}
            placeholder="+380…" />
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
