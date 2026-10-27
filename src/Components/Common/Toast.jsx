import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

// Small, self-dismissing messages in the corner:  const toast = useToast();  toast.success('Saved')
const ToastContext = createContext(null);
const NOOP = { success: () => {}, error: () => {}, info: () => {} };

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext) || NOOP;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback((tone, message, ms) => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, tone, message }]);
    setTimeout(() => dismiss(id), ms);
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (m) => push('success', m, 4000),
    info: (m) => push('info', m, 4000),
    error: (m) => push('error', m, 7000),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-item toast-${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            <span>{t.message}</span>
            <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
