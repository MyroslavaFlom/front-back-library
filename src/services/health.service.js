import { pingDb } from '../config/db.js';

export async function checkHealth() {
  try {
    await pingDb();
    return { status: 'ok', db: 'connected' };
  } catch {
    return { status: 'error', db: 'disconnected' };
  }
}
