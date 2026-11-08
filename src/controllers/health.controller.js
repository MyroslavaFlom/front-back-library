import { checkHealth } from '../services/health.service.js';

export async function getHealth(req, res) {
  const health = await checkHealth();
  res.status(health.status === 'ok' ? 200 : 503).json(health);
}
