import { Button } from 'react-bootstrap';

export default function Pager({ page, totalPages, total, onChange }) {
  return (
    <div className="d-flex align-items-center gap-2 small text-body-secondary">
      <Button size="sm" variant="outline-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ←
      </Button>
      <span>
        Сторінка {page} з {Math.max(totalPages, 1)} · усього {total}
      </span>
      <Button size="sm" variant="outline-secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        →
      </Button>
    </div>
  );
}
