import { useState, useRef, useEffect, useCallback } from 'react';
import type { EventRecord, EventTicket } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { CheckCircle, AlertCircle, QrCode } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { checkInEventTicket, subscribeEventTickets } from '../../services/eventService';

interface ScanTicketTabProps {
  event: EventRecord;
  canEdit: boolean;
}

interface ScannedTicketLog {
  id: string;
  ticketNumber: string;
  guestName: string;
  timestamp: string;
  status: 'success' | 'duplicate' | 'error';
  message?: string;
}

export default function ScanTicketTab({ event, canEdit }: ScanTicketTabProps) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [scanLogs, setScanLogs] = useState<ScannedTicketLog[]>([]);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const processingRef = useRef(false);
  const [manualInput, setManualInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Subscribe to live event tickets from Firestore
  useEffect(() => {
    if (!event.id) return;
    const unsub = subscribeEventTickets(event.id, setTickets);
    return unsub;
  }, [event.id]);

  useEffect(() => {
    return () => {
      if (scannerRef.current && scanning) {
        try {
          scannerRef.current.clear();
        } catch (err) {
          console.error('Error stopping scanner:', err);
        }
      }
    };
  }, [scanning]);

  const processScanPayload = useCallback(
    async (decodedText: string) => {
      if (processingRef.current || !profile) return;
      processingRef.current = true;
      const timestamp = new Date().toLocaleTimeString('en-IN');

      try {
        const result = await checkInEventTicket(event.id, decodedText, profile.uid);

        setScanLogs((prev) => [
          {
            id: result.ticket.id,
            ticketNumber: result.ticket.ticketNumber,
            guestName: result.ticket.guestName,
            timestamp,
            status: 'success',
            message: 'Checked in successfully',
          },
          ...prev,
        ]);
        showToast(`✓ ${result.ticket.guestName} checked in`, 'success');

        if ('vibrate' in navigator) navigator.vibrate?.(100);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid or unverified ticket';
        const isDuplicate = message.toLowerCase().includes('already') || message.toLowerCase().includes('arrived');

        setScanLogs((prev) => [
          {
            id: decodedText,
            ticketNumber: decodedText.toUpperCase().startsWith('ST-') ? decodedText.toUpperCase() : 'QR Ticket',
            guestName: isDuplicate ? 'Already Checked In' : 'Verification Failed',
            timestamp,
            status: isDuplicate ? 'duplicate' : 'error',
            message,
          },
          ...prev,
        ]);

        showToast(message, isDuplicate ? 'info' : 'error');
        if ('vibrate' in navigator) navigator.vibrate?.(250);
      } finally {
        setTimeout(() => {
          processingRef.current = false;
        }, 1500); // 1.5s cooldown before next scan
      }
    },
    [event.id, profile, showToast]
  );

  const startScanning = () => {
    setScanning(true);

    setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.33,
        },
        false
      );

      scannerRef.current = scanner;

      scanner.render(
        (decodedText) => {
          void processScanPayload(decodedText);
        },
        () => {
          // Ignore scanning loop frames
        }
      );
    }, 100);
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setScanning(false);
  };

  const handleManualScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualInput.trim()) {
      showToast('Please enter a ticket number or ID', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await processScanPayload(manualInput.trim());
      setManualInput('');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadReport = () => {
    const csv = [
      ['Ticket Number', 'Guest Name', 'Status', 'Message', 'Time'].join(','),
      ...scanLogs.map((t) =>
        [
          `"${t.ticketNumber}"`,
          `"${t.guestName}"`,
          `"${t.status}"`,
          `"${t.message || ''}"`,
          `"${t.timestamp}"`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scan-report-${event.title.replace(/\s+/g, '_')}-${Date.now()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  // Stats calculation
  const totalRegisteredTickets = tickets.length;
  const totalCheckedIn = tickets.filter((t) => t.checkedIn).length;
  const pendingCheckIns = Math.max(0, totalRegisteredTickets - totalCheckedIn);

  return (
    <div className="space-y-6">
      {/* Real-time Event Ticket Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--dash-muted)' }}>Registered Tickets</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--dash-text)' }}>
            {totalRegisteredTickets}
          </p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--dash-muted)' }}>Checked-In (Arrived)</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600 font-mono">{totalCheckedIn}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--dash-muted)' }}>Pending Arrivals</p>
          <p className="text-2xl font-bold mt-1 text-amber-600 font-mono">{pendingCheckIns}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--dash-muted)' }}>Session Scans</p>
          <p className="text-2xl font-bold mt-1 text-blue-600 font-mono">{scanLogs.length}</p>
        </div>
      </div>

      {/* Scanner Controls */}
      <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--dash-border)' }}>
        <h4 className="font-bold text-base" style={{ color: 'var(--dash-text)' }}>
          Live Ticket Scanner
        </h4>
        <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
          Use camera scanner or manual input to verify participant tickets and record entry in real time.
        </p>

        {!scanning ? (
          <button
            onClick={startScanning}
            disabled={!canEdit}
            className="btn-primary w-full flex items-center justify-center gap-2 !py-3 font-semibold"
          >
            <QrCode className="w-5 h-5" />
            Start Camera Scanner
          </button>
        ) : (
          <button
            onClick={stopScanning}
            className="btn-secondary w-full !py-3 font-semibold"
          >
            Stop Camera Scanner
          </button>
        )}
      </div>

      {/* QR Scanner Container */}
      {scanning && (
        <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--dash-border)' }}>
          <div id="qr-reader" className="rounded-xl overflow-hidden min-h-[300px]" />
          <p className="text-xs text-center" style={{ color: 'var(--dash-muted)' }}>
            Point camera at attendee&apos;s ticket QR code
          </p>
        </div>
      )}

      {/* Manual Scan Input */}
      <form onSubmit={handleManualScan} className="rounded-2xl border p-6 space-y-3" style={{ borderColor: 'var(--dash-border)' }}>
        <label className="block text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>
          Manual Ticket Verification
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter Ticket Number (e.g. ST-8F3A29B1) or Ticket ID"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            className="input-field flex-1"
            disabled={!canEdit || submitting}
          />
          <button
            type="submit"
            disabled={!canEdit || !manualInput.trim() || submitting}
            className="btn-primary px-5 font-semibold"
          >
            {submitting ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      </form>

      {/* Scanned Tickets List */}
      {scanLogs.length > 0 && (
        <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--dash-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-base" style={{ color: 'var(--dash-text)' }}>
              Scan History & Logs
            </h4>
            <button
              onClick={downloadReport}
              className="btn-secondary !text-xs !py-1.5 !px-3"
            >
              Download Report (.csv)
            </button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {scanLogs.map((ticketLog, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3.5 rounded-xl border"
                style={{
                  borderColor: 'var(--dash-border)',
                  background:
                    ticketLog.status === 'success'
                      ? 'rgba(16,185,129,0.08)'
                      : ticketLog.status === 'duplicate'
                      ? 'rgba(245,158,11,0.08)'
                      : 'rgba(239,68,68,0.08)',
                }}
              >
                {ticketLog.status === 'success' && (
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                )}
                {ticketLog.status === 'duplicate' && (
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                )}
                {ticketLog.status === 'error' && (
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--dash-text)' }}>
                    {ticketLog.guestName}
                  </p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--dash-muted)' }}>
                    {ticketLog.ticketNumber} • {ticketLog.timestamp}
                  </p>
                  {ticketLog.message && (
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--dash-muted)' }}>
                      {ticketLog.message}
                    </p>
                  )}
                </div>

                <span
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider shrink-0"
                  style={{
                    background:
                      ticketLog.status === 'success'
                        ? 'rgba(16,185,129,0.2)'
                        : ticketLog.status === 'duplicate'
                        ? 'rgba(245,158,11,0.2)'
                        : 'rgba(239,68,68,0.2)',
                    color:
                      ticketLog.status === 'success'
                        ? '#10b981'
                        : ticketLog.status === 'duplicate'
                        ? '#f59e0b'
                        : '#ef4444',
                  }}
                >
                  {ticketLog.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
