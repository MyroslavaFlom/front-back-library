import { EVENT_TYPES } from '../events/index.js';

// Події, які отримують лише адміністратори (містять дані про читачів/видачі).
const ADMIN_ONLY = new Set([EVENT_TYPES.LOAN_CHANGED]);

export function createEventService(events) {
  return {
    // listener({ type, payload, at }) викликається для кожної події, доступної цьому користувачу.
    subscribe(user, listener, { onClose } = {}) {
      const isAdmin = user?.role === 'admin';
      return events.subscribe(
        (event) => {
          if (ADMIN_ONLY.has(event.type) && !isAdmin) return;
          listener(event);
        },
        { onClose },
      );
    },
  };
}
