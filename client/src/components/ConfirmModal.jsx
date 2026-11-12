import { useState } from 'react';
import { Button, Modal } from 'react-bootstrap';

// Підтвердження небезпечної дії. onConfirm може бути async; модалка закривається батьком.
export default function ConfirmModal({ show, title, children, confirmLabel = 'Видалити', onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h5">{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{children}</Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancel} disabled={busy}>
          Скасувати
        </Button>
        <Button variant="danger" onClick={confirm} disabled={busy}>
          {confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
