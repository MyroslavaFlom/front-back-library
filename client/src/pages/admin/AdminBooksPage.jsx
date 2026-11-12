import { useState } from 'react';
import { Button, ButtonGroup, Form, Table } from 'react-bootstrap';
import { booksApi } from '../../api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useLiveEvents } from '../../hooks/useLiveEvents.js';
import { useToast } from '../../context/ToastContext.jsx';
import ErrorAlert from '../../components/ErrorAlert.jsx';
import Loading from '../../components/Loading.jsx';
import Pager from '../../components/Pager.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import BookFormModal from './BookFormModal.jsx';
import { dash } from '../../format.js';

const PAGE_SIZE = 15;

export default function AdminBooksPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [editing, setEditing] = useState(undefined); // undefined — закрито, null — нова, object — редагування
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const { showToast } = useToast();

  const books = useAsync(() => booksApi.list({ page, limit: PAGE_SIZE, sort: 'title', search }), [page, search]);

  useLiveEvents({
    'book.created': () => books.reload(),
    'book.updated': () => books.reload(),
    'book.deleted': () => books.reload(),
  });

  const handleSaved = (book, { created }) => {
    setEditing(undefined);
    showToast(created ? `Книжку «${book.title}» додано` : `Книжку «${book.title}» оновлено`);
    books.reload();
  };

  const handleDelete = async () => {
    try {
      await booksApi.remove(deleting.id);
      showToast(`Книжку «${deleting.title}» видалено`);
      books.reload();
    } catch (err) {
      setDeleteError(err);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <div className="d-flex gap-2 mb-3 flex-wrap">
        <Form
          className="d-flex gap-2 flex-grow-1"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput.trim());
            setPage(1);
          }}
        >
          <Form.Control
            type="search"
            placeholder="Пошук за назвою, автором…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Button type="submit" variant="outline-primary">
            Знайти
          </Button>
        </Form>
        <Button onClick={() => setEditing(null)}>+ Додати книжку</Button>
      </div>

      <ErrorAlert error={deleteError ?? books.error} onClose={deleteError ? () => setDeleteError(null) : undefined} />

      {books.loading && !books.data ? (
        <Loading />
      ) : (
        <Table hover responsive size="sm" className="align-middle">
          <thead>
            <tr>
              <th>Назва</th>
              <th>Автор</th>
              <th>Жанр</th>
              <th>Рік</th>
              <th>Примірники</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {books.data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-body-secondary py-4">
                  Книжок не знайдено
                </td>
              </tr>
            )}
            {books.data?.items.map((b) => (
              <tr key={b.id}>
                <td>
                  {b.title}
                  <div className="small text-body-secondary">{b.isbn}</div>
                </td>
                <td>{b.author}</td>
                <td>{dash(b.genre)}</td>
                <td>{dash(b.year)}</td>
                <td>
                  {b.availableCopies} / {b.totalCopies}
                </td>
                <td className="text-end text-nowrap">
                  <ButtonGroup size="sm">
                    <Button variant="outline-primary" onClick={() => setEditing(b)}>
                      Редагувати
                    </Button>
                    <Button variant="outline-danger" onClick={() => setDeleting(b)}>
                      Видалити
                    </Button>
                  </ButtonGroup>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {books.data && <Pager {...books.data} onChange={setPage} />}

      <BookFormModal
        show={editing !== undefined}
        book={editing ?? null}
        onHide={() => setEditing(undefined)}
        onSaved={handleSaved}
      />
      <ConfirmModal
        show={Boolean(deleting)}
        title="Видалити книжку?"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      >
        Книжку «{deleting?.title}» буде видалено назавжди.
      </ConfirmModal>
    </>
  );
}
