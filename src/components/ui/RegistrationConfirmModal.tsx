import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Unlock, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface RegistrationConfirmModalProps {
  isOpen: boolean;
  type: 'close' | 'open';
  participantCount?: number;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function RegistrationConfirmModal({
  isOpen,
  type,
  participantCount = 0,
  loading,
  onConfirm,
  onClose,
}: RegistrationConfirmModalProps) {
  // Lock body scroll while modal is open and handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, loading, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border p-5 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto animate-fade-in my-auto"
        style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
              type === 'close'
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            }`}
          >
            {type === 'close' ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold" style={{ color: 'var(--dash-text)' }}>
              {type === 'close' ? 'Close Event Registrations?' : 'Reopen Event Registrations?'}
            </h3>
            <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
              {type === 'close'
                ? 'Are you sure you want to close registrations for this event?'
                : 'Are you sure you want to reopen registrations for this event?'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className="rounded-xl p-3.5 space-y-2 border text-xs"
          style={{
            borderColor:
              type === 'close'
                ? 'rgba(239, 68, 68, 0.25)'
                : 'rgba(16, 185, 129, 0.25)',
            background:
              type === 'close'
                ? 'rgba(239, 68, 68, 0.05)'
                : 'rgba(16, 185, 129, 0.05)',
          }}
        >
          {type === 'close' ? (
            <>
              <div className="flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Existing registrations ({participantCount}) will remain completely intact.
                </span>
              </div>
              <div className="flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Admin view, participant lists, and ticket check-ins remain fully available.</span>
              </div>
              <div className="flex items-center gap-2 text-red-400 font-medium">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>Students will see "Registration Closed" and will be prevented from registering.</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Students will immediately be able to register through the public portal.</span>
              </div>
              <div className="flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>All existing registrations and event settings remain preserved.</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-secondary !text-xs !py-2 !px-4 cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`!text-xs !py-2 !px-4 rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer ${
              type === 'close'
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
            }`}
          >
            {loading ? (
              'Updating...'
            ) : type === 'close' ? (
              <>
                <Lock className="w-3.5 h-3.5" /> Yes, Close Registrations
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5" /> Yes, Open Registrations
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
