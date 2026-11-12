export const HEARTBEAT_MS = 25_000;

// Server-Sent Events: потік доменних подій (book.*, loan.changed — лише для admin).
export function createEventsController(eventService) {
  return {
    stream(req, res) {
      res.set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders();
      res.write('retry: 5000\n\n');

      const send = ({ type, payload, at }) => {
        res.write(`event: ${type}\ndata: ${JSON.stringify({ ...payload, at })}\n\n`);
      };

      const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), HEARTBEAT_MS);

      let unsubscribe = () => {};
      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      unsubscribe = eventService.subscribe(req.session?.user, send, {
        onClose: () => {
          cleanup();
          res.end();
        },
      });

      req.on('close', cleanup);
    },
  };
}
