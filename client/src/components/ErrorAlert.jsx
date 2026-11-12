import { Alert } from 'react-bootstrap';

export default function ErrorAlert({ error, onClose }) {
  if (!error) return null;
  return (
    <Alert variant="danger" dismissible={Boolean(onClose)} onClose={onClose}>
      {error.message}
      {error.details?.length > 0 && (
        <ul className="mb-0 mt-2">
          {error.details.map((d, i) => (
            <li key={i}>
              <code>{d.field}</code>: {d.message}
            </li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
