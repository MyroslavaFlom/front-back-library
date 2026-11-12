import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="text-center py-5">
      <h1 className="display-6">Сторінку не знайдено</h1>
      <Link to="/">До каталогу</Link>
    </div>
  );
}
