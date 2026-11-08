/**
 * Тонкий контролер аналітики: бере дані з req, викликає сервіс, формує відповідь.
 *
 * @param {ReturnType<typeof import('../services/stats.service.js').createStatsService>} statsService
 */
export function createStatsController(statsService) {
  return {
    async popularBooks(req, res) {
      res.json(await statsService.popularBooks(req.query));
    },

    async genres(req, res) {
      res.json(await statsService.genres());
    },

    async overdue(req, res) {
      res.json(await statsService.overdue());
    },

    async topReaders(req, res) {
      res.json(await statsService.topReaders(req.query));
    },

    async summary(req, res) {
      res.json(await statsService.summary());
    },

    async recommendations(req, res) {
      res.json(await statsService.recommendations(req.params.id, req.query));
    },
  };
}
