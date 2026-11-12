export function createLoanController(loanService) {
  return {
    async list(req, res) {
      res.json(await loanService.getAll(req.query));
    },

    async listByReader(req, res) {
      res.json(await loanService.getByReader(req.params.id, req.query));
    },

    async getById(req, res) {
      res.json(await loanService.getById(req.params.id));
    },

    async create(req, res) {
      const loan = await loanService.create(req.body);
      res.status(201).location(`${req.baseUrl}/${loan.id}`).json(loan);
    },

    async returnLoan(req, res) {
      res.json(await loanService.returnLoan(req.params.id));
    },

    async extend(req, res) {
      res.json(await loanService.extend(req.params.id));
    },
  };
}
