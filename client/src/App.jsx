import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { Container, Nav, Navbar } from 'react-bootstrap';
import BooksPage from './pages/BooksPage.jsx';
import ReadersPage from './pages/ReadersPage.jsx';
import LoansPage from './pages/LoansPage.jsx';
import StatsPage from './pages/StatsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

const links = [
  ['/books', 'Книжки'],
  ['/readers', 'Читачі'],
  ['/loans', 'Видачі'],
  ['/stats', 'Статистика'],
];

export default function App() {
  return (
    <>
      <Navbar bg="dark" data-bs-theme="dark" expand="sm" className="mb-4">
        <Container>
          <Navbar.Brand as={NavLink} to="/">Бібліотека</Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav">
            <Nav>
              {links.map(([to, label]) => (
                <Nav.Link key={to} as={NavLink} to={to}>
                  {label}
                </Nav.Link>
              ))}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container className="pb-5">
        <Routes>
          <Route path="/" element={<Navigate to="/books" replace />} />
          <Route path="/books" element={<BooksPage />} />
          <Route path="/readers" element={<ReadersPage />} />
          <Route path="/loans" element={<LoansPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Container>
    </>
  );
}
