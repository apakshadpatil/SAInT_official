import { GripHorizontal, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent, ReactNode } from 'react';

interface RightPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}

/**
 * Kept under its original name so existing management screens can share the
 * compact dialog without a large, space-consuming side drawer.
 */
export default function RightPanel({ open, onClose, title, children, width = '520px' }: RightPanelProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const dragStart = useRef<{
    x: number;
    y: number;
    originX: number;
    originY: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setOffset({ x: 0, y: 0 });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((element) => !element.hasAttribute('hidden'));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const focusDialog = window.requestAnimationFrame(() => dialogRef.current?.focus({ preventScroll: true }));
    document.body.classList.add('dialog-is-open');
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusDialog);
      document.body.classList.remove('dialog-is-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!open) return null;

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button, input, select, textarea, label, a, [data-no-drag]')) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const edgePadding = 12;
    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      originX: offset.x,
      originY: offset.y,
      minX: offset.x + edgePadding - rect.left,
      maxX: offset.x + window.innerWidth - edgePadding - rect.right,
      minY: offset.y + edgePadding - rect.top,
      maxY: offset.y + window.innerHeight - edgePadding - rect.bottom,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragStart.current;
    if (!drag) return;
    setOffset({
      x: Math.max(drag.minX, Math.min(drag.maxX, drag.originX + event.clientX - drag.x)),
      y: Math.max(drag.minY, Math.min(drag.maxY, drag.originY + event.clientY - drag.y)),
    });
  };

  const stopDragging = (event: PointerEvent<HTMLElement>) => {
    dragStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
  };

  const resetPosition = () => {
    dragStart.current = null;
    setIsDragging(false);
    setOffset({ x: 0, y: 0 });
  };

  const onDoubleClick = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button, input, select, textarea, label, a, [data-no-drag]')) return;
    resetPosition();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="presentation">
      <button className="absolute inset-0 drag-dialog-backdrop" aria-label={`Close ${title}`} onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby="drag-dialog-instructions"
        ref={dialogRef}
        tabIndex={-1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onDoubleClick={onDoubleClick}
        className={`drag-dialog relative w-full max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] overflow-y-auto ${isDragging ? 'drag-dialog--dragging' : ''}`}
        style={{ width: `min(calc(100vw - 1.5rem), ${width})`, transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
      >
        <div
          className="drag-dialog-handle sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b"
        >
          <div className="flex min-w-0 items-center gap-2">
            <GripHorizontal className="w-4 h-4 shrink-0" style={{ color: 'var(--dash-muted)' }} aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="text-base font-bold truncate" style={{ color: 'var(--dash-text)' }}>{title}</h2>
              <p id="drag-dialog-instructions" className="drag-dialog-hint">Drag anywhere to move · double-click to centre</p>
            </div>
          </div>
          <div className="flex items-center gap-1" data-no-drag>
            <button onClick={resetPosition} className="p-2 rounded-lg transition-colors hover:bg-white/10" style={{ color: 'var(--dash-muted)' }} aria-label="Centre dialog" title="Centre dialog">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg transition-colors hover:bg-white/10" style={{ color: 'var(--dash-muted)' }} aria-label="Close dialog">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </section>
    </div>
  );
}
