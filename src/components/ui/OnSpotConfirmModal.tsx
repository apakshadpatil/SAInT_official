import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { QrCode, AlertCircle, X, Sparkles, CheckCircle2, RotateCcw } from 'lucide-react';

interface OnSpotConfirmModalProps {
  isOpen: boolean;
  type: 'enable' | 'disable';
  eventTitle: string;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function OnSpotConfirmModal({
  isOpen,
  type,
  eventTitle,
  loading,
  onConfirm,
  onClose,
}: OnSpotConfirmModalProps) {
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

  const isEnabling = type === 'enable';

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
              isEnabling
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : 'bg-slate-500/15 text-slate-300 border-slate-500/30'
            }`}
          >
            {isEnabling ? <QrCode className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <h3 className="font-extrabold text-base sm:text-lg tracking-tight" style={{ color: 'var(--dash-text)' }}>
              {isEnabling ? 'Enable On-Spot Registration?' : 'Disable On-Spot Registration?'}
            </h3>
            <p className="text-xs font-semibold mt-0.5 truncate text-amber-400" title={eventTitle}>
              {eventTitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close dialog"
            className="absolute top-4 right-4 p-1.5 rounded-xl border hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-40"
            style={{
              borderColor: 'var(--dash-border)',
              background: 'var(--dash-hover)',
              color: 'var(--dash-muted)',
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informational Card */}
        <div
          className={`rounded-xl border p-3.5 space-y-2 text-xs leading-relaxed ${
            isEnabling
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
              : 'border-slate-700/60 bg-slate-800/40 text-slate-300'
          }`}
        >
          {isEnabling ? (
            <>
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>On-Spot Venue Mode Activated</span>
              </div>
              <p>
                When enabled, the public page for <strong>{eventTitle}</strong> will show <strong>On-Spot Registration</strong> instead of the normal registration flow, allowing students to register at the venue in seconds.
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-amber-300/80 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Admin On-Spot Desk will also be available for this event.</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 font-bold text-slate-200">
                <AlertCircle className="w-3.5 h-3.5 text-blue-400" />
                <span>Standard Registration Restored</span>
              </div>
              <p>
                Disabling On-Spot Registration will restore the standard online registration option on the public event page.
              </p>
              <p className="text-[11px] text-slate-400">
                Existing registrations and participant records remain completely intact and unaffected.
              </p>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t" style={{ borderColor: 'var(--dash-border)' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border hover:opacity-80 transition-all cursor-pointer disabled:opacity-40"
            style={{
              borderColor: 'var(--dash-border)',
              background: 'var(--dash-hover)',
              color: 'var(--dash-text)',
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-md ${
              isEnabling
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            }`}
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Updating...</span>
              </>
            ) : isEnabling ? (
              <>
                <QrCode className="w-3.5 h-3.5" />
                <span>Turn On-Spot ON</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Turn On-Spot OFF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
