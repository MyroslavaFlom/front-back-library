import { useState } from 'react';
import { Button, ButtonGroup, Form, Table } from 'react-bootstrap';
import { readersApi } from '../../api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import ErrorAlert from '../../components/ErrorAlert.jsx';
import Loading from '../../components/Loading.jsx';
import Pager from '../../components/Pager.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import ReaderFormModal from './ReaderFormModal.jsx';
import { dash, fmtDate } from '../../format.js';

const PAGE_SIZE = 15;

export default function AdminReadersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [editing, setEditing] = useState(undefined);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const { showToast } = useToast();

  const readers = useAsync(
    () => readersApi.list({ page, limit: PAGE_SIZE, sort: 'name', search }),
    [page, search],
  );

  const handleSaved = (reader, { created }) => {
    setEditing(undefined);
    showToast(created ? `Читача «${reader.name}» додано` : `Читача «${reader.name}» оновлено`);
    readers.reload();
  };

  const handleDelete = async () => {
    try {
      await readersApi.remove(deleting.id);
      showToast(`Читача «${deleting.name}» видалено`);
      readers.reload();
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
            placeholder="Пошук за ім'ям або email"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Button type="submit" variant="outline-primary">
            Знайти
          </Button>
        </Form>
        <Button onClick={() => setEditing(null)}>+ Додати читача</Button>
      </div>

      <ErrorAlert error={deleteError ?? readers.error} onClose={deleteError ? () => setDeleteError(null) : undefined} />

      {readers.loading && !readers.data ? (
        <Loading />
      ) : (
        <Table hover responsive size="sm" className="align-middle">
          <thead>
            <tr>
              <th>Ім'я</th>
              <th>Email</th>
              <th>Телефон</th>
              <th>Зареєстрований</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {readers.data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-body-secondary py-4">
                  Читачів не знайдено
                </td>
              </tr>
            )}
            {readers.data?.items.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.email}</td>
                <td>{dash(r.phone)}</td>
                <td>{fmtDate(r.registeredAt)}</td>
                <td className="text-end text-nowrap">
                  <ButtonGroup size="sm">
                    <Button variant="outline-primary" onClick={() => setEditing(r)}>
                      Редагувати
                    </Button>
                    <Button variant="outline-danger" onClick={() => setDeleting(r)}>
                      Видалити
                    </Button>
                  </ButtonGroup>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {readers.data && <Pager {...readers.data} onChange={setPage} />}

      <ReaderFormModal
        show={editing !== undefined}
        reader={editing ?? null}
        onHide={() => setEditing(undefined)}
        onSaved={handleSaved}
      />
      <ConfirmModal
        show={Boolean(deleting)}
        title="Видалити читача?"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      >
        Читача «{deleting?.name}» буде видалено назавжди.
      </ConfirmModal>
    </>
  );
}
