import { Form } from 'react-bootstrap';

// Поле форми з підписом і помилкою валідації від API під ним.
// field — результат useApiForm().bind(name); error — fieldErrors[name].
export default function Field({ label, field, error, as, children, className = 'mb-3', ...props }) {
  const Control = as === 'select' ? Form.Select : Form.Control;
  return (
    <Form.Group className={className} controlId={`field-${field.name}`}>
      <Form.Label>{label}</Form.Label>
      <Control {...field} {...props}>
        {children}
      </Control>
      <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
    </Form.Group>
  );
}
