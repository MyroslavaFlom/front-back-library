import { Alert } from 'react-bootstrap';

// Повідомлення про результат дії: { variant, text } або null.
export default function Notice({ notice, onClose }) {
  if (!notice) return null;
  return (
    <Alert variant={notice.variant ?? 'success'} dismissible onClose={onClose}>
      {notice.text}
    </Alert>
  );
}
