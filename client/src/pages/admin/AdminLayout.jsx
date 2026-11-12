import { Nav } from 'react-bootstrap';
import { NavLink, Outlet } from 'react-router-dom';

const SECTIONS = [
  ['books', 'Книжки'],
  ['readers', 'Читачі'],
  ['loans', 'Видачі'],
  ['stats', 'Статистика'],
];

export default function AdminLayout() {
  return (
    <>
      <h1 className="h3 mb-3">Адмін-панель</h1>
      <Nav variant="tabs" className="mb-4">
        {SECTIONS.map(([to, label]) => (
          <Nav.Item key={to}>
            <Nav.Link as={NavLink} to={to}>
              {label}
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>
      <Outlet />
    </>
  );
}
