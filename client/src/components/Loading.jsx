import { Spinner } from 'react-bootstrap';

export default function Loading() {
  return (
    <div className="text-center py-4">
      <Spinner animation="border" size="sm" /> <span className="ms-2 text-body-secondary">Завантаження…</span>
    </div>
  );
}
