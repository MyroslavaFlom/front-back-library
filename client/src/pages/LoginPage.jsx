import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, Form } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext.jsx';
import { useApiForm } from '../hooks/useApiForm.js';
import ErrorAlert from '../components/ErrorAlert.jsx';
import Field from '../components/Field.jsx';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const form = useApiForm({ username: '', password: '' });

  const destination = (u) => location.state?.from ?? (u.role === 'admin' ? '/admin' : '/');

  if (user) return <Navigate to={destination(user)} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const loggedIn = await form.submit((values) => login(values));
    if (loggedIn) navigate(destination(loggedIn), { replace: true });
  };

  return (
    <Card className="mx-auto shadow-sm" style={{ maxWidth: 400 }}>
      <Card.Body className="p-4">
        <h1 className="h4 mb-4">Вхід</h1>
        <ErrorAlert error={form.error} />
        <Form onSubmit={handleSubmit} noValidate>
          <Field label="Ім'я користувача" field={form.bind('username')} error={form.fieldErrors.username}
            autoComplete="username" autoFocus required />
          <Field label="Пароль" type="password" field={form.bind('password')} error={form.fieldErrors.password}
            autoComplete="current-password" required />
          <Button type="submit" className="w-100" disabled={form.submitting}>
            {form.submitting ? 'Вхід…' : 'Увійти'}
          </Button>
        </Form>
      </Card.Body>
    </Card>
  );
}
