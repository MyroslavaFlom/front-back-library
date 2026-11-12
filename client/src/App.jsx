import { Navigate, Route, Routes } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import AppNavbar from './components/AppNavbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import BookDetailsPage from './pages/BookDetailsPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminBooksPage from './pages/admin/AdminBooksPage.jsx';
import AdminReadersPage from './pages/admin/AdminReadersPage.jsx';
import AdminLoansPage from './pages/admin/AdminLoansPage.jsx';
import AdminStatsPage from './pages/admin/AdminStatsPage.jsx';

export default function App() {
  return (
    <>
      <AppNavbar />
      <Container className="pb-5">
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/books/:id" element={<BookDetailsPage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route path="/admin" element={<ProtectedRoute roles={['admin']} />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="books" replace />} />
              <Route path="books" element={<AdminBooksPage />} />
              <Route path="readers" element={<AdminReadersPage />} />
              <Route path="loans" element={<AdminLoansPage />} />
              <Route path="stats" element={<AdminStatsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Container>
    </>
  );
}
