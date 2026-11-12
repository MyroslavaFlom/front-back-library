// Server-Sent Events: GET /api/events. Повертає функцію, що закриває з'єднання.
// handlers — { 'book.created': (data) => ..., ... }; EventSource сам перепідключається.
export function subscribeToEvents(handlers) {
  const source = new EventSource('/api/events', { withCredentials: true });
  for (const [type, handler] of Object.entries(handlers)) {
    source.addEventListener(type, (event) => {
      let data = null;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      handler(data);
    });
  }
  return () => source.close();
}
