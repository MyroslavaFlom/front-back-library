import { useEffect, useRef } from 'react';
import { subscribeToEvents } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

export const LIVE_EVENTS = ['book.created', 'book.updated', 'book.deleted', 'loan.changed'];

// Підписка на SSE /api/events. handlers — { 'book.created': (data) => ..., ... }.
// Обробники можна передавати інлайном: беруться останні, перепідключення лише при зміні користувача
// (сервер вирішує, які події доступні, у момент підключення).
export function useLiveEvents(handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const { user } = useAuth();
  const userKey = user ? `${user.id}:${user.role}` : 'anonymous';

  useEffect(() => {
    const dispatch = Object.fromEntries(
      LIVE_EVENTS.map((type) => [type, (data) => handlersRef.current[type]?.(data)]),
    );
    return subscribeToEvents(dispatch);
  }, [userKey]);
}
