import { Alert } from 'react-bootstrap';

export default function ErrorAlert({ error, onClose, className }) {
  if (!error) return null;
  return (
    <Alert variant="danger" dismissible={Boolean(onClose)} onClose={onClose} className={className}>
      {error.message}
      {error.details?.length > 0 && (
        <ul className="mb-0 mt-2">
          {error.details.map((d, i) => (
            <li key={i}>
              {d.field && <code>{d.field}</code>}
              {d.field && ': '}
              {d.message}
            </li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
