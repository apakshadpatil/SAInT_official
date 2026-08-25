import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9) + Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  const portalContent = typeof document !== 'undefined' ? createPortal(
    <div
      id="saint-toast-portal"
      className="fixed top-6 right-6 z-[999999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      style={{ isolation: 'isolate' }}
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-start gap-3 px-4 py-3 rounded-2xl pointer-events-auto shadow-2xl backdrop-blur-xl transition-all duration-300 transform translate-y-0 opacity-100"
          style={{
            background: 'rgba(15, 23, 42, 0.88)',
            border: toast.type === 'error'
              ? '1px solid rgba(239, 68, 68, 0.4)'
              : toast.type === 'success'
              ? '1px solid rgba(16, 185, 129, 0.4)'
              : '1px solid rgba(59, 130, 246, 0.35)',
            boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.6), 0 0 20px 0 rgba(0, 0, 0, 0.2)',
            color: '#f8fafc',
          }}
        >
          {toast.type === 'success' && (
            <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}
          {toast.type === 'error' && (
            <div className="p-1 rounded-full bg-red-500/20 text-red-400 shrink-0 mt-0.5">
              <AlertCircle className="w-4 h-4" />
            </div>
          )}
          {toast.type === 'info' && (
            <div className="p-1 rounded-full bg-blue-500/20 text-blue-400 shrink-0 mt-0.5">
              <Info className="w-4 h-4" />
            </div>
          )}

          <div className="flex-1 min-w-0 pr-1">
            <span className="text-xs font-semibold leading-relaxed break-words block">{toast.message}</span>
          </div>

          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="text-slate-400 hover:text-white p-0.5 rounded-md transition-colors shrink-0 -mr-1 -mt-0.5"
            aria-label="Close notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {portalContent}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

