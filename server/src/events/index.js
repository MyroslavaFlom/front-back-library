import { EventEmitter } from 'node:events';

// Шина доменних подій у межах процесу. Сервіси публікують, SSE-підписники отримують.
// Типи подій — у EVENT_TYPES; payload — серіалізовний у JSON об'єкт.
export const EVENT_TYPES = Object.freeze({
  BOOK_CREATED: 'book.created',
  BOOK_UPDATED: 'book.updated',
  BOOK_DELETED: 'book.deleted',
  LOAN_CHANGED: 'loan.changed',
});

const EVENT = 'event';
const CLOSE = 'close';

export function createEventBus() {
  const emitter = new EventEmitter();
  // Кожне SSE-з'єднання — окремий слухач; стандартний ліміт 10 тут занизький.
  emitter.setMaxListeners(0);

  return Object.freeze({
    publish(type, payload) {
      emitter.emit(EVENT, { type, payload, at: new Date().toISOString() });
    },

    // Повертає функцію відписки. onClose викликається при зупинці сервера.
    subscribe(listener, { onClose } = {}) {
      emitter.on(EVENT, listener);
      if (onClose) emitter.on(CLOSE, onClose);
      return () => {
        emitter.off(EVENT, listener);
        if (onClose) emitter.off(CLOSE, onClose);
      };
    },

    close() {
      emitter.emit(CLOSE);
    },
  });
}

// Заглушка для сервісів, створених без шини (напр. у seed-скрипті).
export const noopEvents = Object.freeze({ publish() {}, subscribe: () => () => {}, close() {} });
