/**
 * Тонкий контролер: бере дані з req, викликає сервіс, формує відповідь.
 * Помилки (HttpError тощо) Express 5 сам передає в errorHandler.
 *
 * @param {ReturnType<typeof import('../services/book.service.js').createBookService>} bookService
 */
export function createBookController(bookService) {
  return {
    async list(req, res) {
      res.json(await bookService.getAll(req.query));
    },

    async getById(req, res) {
      res.json(await bookService.getById(req.params.id));
    },

    async create(req, res) {
      const book = await bookService.create(req.body);
      res.status(201).location(`${req.baseUrl}/${book.id}`).json(book);
    },

    async replace(req, res) {
      res.json(await bookService.replace(req.params.id, req.body));
    },

    async patch(req, res) {
      res.json(await bookService.patch(req.params.id, req.body));
    },

    async remove(req, res) {
      await bookService.delete(req.params.id);
      res.status(204).end();
    },
  };
}
