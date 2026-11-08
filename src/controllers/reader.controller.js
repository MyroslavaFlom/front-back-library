/**
 * Тонкий контролер: бере дані з req, викликає сервіс, формує відповідь.
 * Помилки (HttpError тощо) Express 5 сам передає в errorHandler.
 *
 * @param {ReturnType<typeof import('../services/reader.service.js').createReaderService>} readerService
 */
export function createReaderController(readerService) {
  return {
    async list(req, res) {
      res.json(await readerService.getAll(req.query));
    },

    async getById(req, res) {
      res.json(await readerService.getById(req.params.id));
    },

    async create(req, res) {
      const reader = await readerService.create(req.body);
      res.status(201).location(`${req.baseUrl}/${reader.id}`).json(reader);
    },

    async replace(req, res) {
      res.json(await readerService.replace(req.params.id, req.body));
    },

    async patch(req, res) {
      res.json(await readerService.patch(req.params.id, req.body));
    },

    async remove(req, res) {
      await readerService.delete(req.params.id);
      res.status(204).end();
    },
  };
}
