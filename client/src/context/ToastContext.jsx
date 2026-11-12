import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';

const ToastContext = createContext(null);
let nextId = 1;

// Спливні повідомлення: showToast(text, { variant: 'success' | 'danger' | 'warning' | 'info', title }).
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const showToast = useCallback((text, { variant = 'success', title } = {}) => {
    setToasts((list) => [...list, { id: nextId++, text, variant, title }]);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer position="bottom-end" className="p-3 position-fixed">
        {toasts.map((t) => (
          <Toast key={t.id} bg={t.variant} onClose={() => dismiss(t.id)} delay={5000} autohide>
            {t.title && (
              <Toast.Header>
                <strong className="me-auto">{t.title}</strong>
              </Toast.Header>
            )}
            <Toast.Body className={['warning', 'light', 'info'].includes(t.variant) ? '' : 'text-white'}>
              {t.text}
            </Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
