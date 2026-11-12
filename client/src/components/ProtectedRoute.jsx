import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Alert } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext.jsx';
import Loading from './Loading.jsx';

// Доступ лише для вказаних ролей: без входу → /login, без ролі → повідомлення 403.
export default function ProtectedRoute({ roles = ['admin'] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!roles.includes(user.role)) {
    return <Alert variant="warning">Недостатньо прав для перегляду цієї сторінки.</Alert>;
  }
  return <Outlet />;
}
