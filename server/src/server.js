import { config } from './config/env.js';
import { connectDb, closeDb, DbConnectionError } from './config/db.js';
import { createApp } from './app.js';
import { createSessionStore } from './config/session.js';
import { createEventBus } from './events/index.js';
import { ensureIndexes, getDaos } from './dao/index.js';
import { createServices } from './services/index.js';

async function start() {
  await connectDb();
  console.log(`Connected to MongoDB (db: ${config.dbName})`);
  await ensureIndexes();
  console.log('MongoDB indexes ensured');

  const events = createEventBus();
  const services = createServices(getDaos(), { nodeEnv: config.nodeEnv, events });
  const sessionStore = createSessionStore();
  const app = createApp({ services, sessionStore });
  const server = app.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
  });

  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down gracefully...`);

    // Аварійний вихід, якщо закриття зависне.
    const forceExit = setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    try {
      // Закрити SSE-потоки, інакше server.close() чекатиме їх до таймауту.
      events.close();
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
        server.closeIdleConnections();
      });
      console.log('HTTP server closed');
      await sessionStore.close();
      await closeDb();
      console.log('MongoDB connection closed');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch(async (err) => {
  // Для помилок БД виводимо лише безпечне повідомлення (без стека й рядка підключення).
  if (err instanceof DbConnectionError) {
    console.error(err.message);
  } else {
    console.error('Failed to start server:', err);
  }
  await closeDb();
  process.exit(1);
});
