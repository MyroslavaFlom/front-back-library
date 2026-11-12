import { Button, Container, Nav, Navbar } from 'react-bootstrap';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AppNavbar() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <Navbar bg="dark" data-bs-theme="dark" expand="md" className="mb-4">
      <Container>
        <Navbar.Brand as={NavLink} to="/">
          Бібліотека
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="main-nav" />
        <Navbar.Collapse id="main-nav">
          <Nav className="me-auto">
            <Nav.Link as={NavLink} to="/" end>
              Каталог
            </Nav.Link>
            {isAdmin && (
              <Nav.Link as={NavLink} to="/admin">
                Адмін-панель
              </Nav.Link>
            )}
          </Nav>
          <Nav className="align-items-md-center gap-2">
            {user ? (
              <>
                <Navbar.Text>
                  {user.username}
                  {isAdmin && <span className="ms-1 badge text-bg-secondary">admin</span>}
                </Navbar.Text>
                <Button size="sm" variant="outline-light" onClick={handleLogout}>
                  Вийти
                </Button>
              </>
            ) : (
              <Nav.Link as={NavLink} to="/login">
                Вхід
              </Nav.Link>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
