import { useState, useRef, useEffect, useCallback } from 'react';
import type { EventRecord, EventTicket } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { CheckCircle, AlertCircle, QrCode, ShieldAlert, RefreshCw } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
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
  const [scannerStarting, setScannerStarting] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [isPermissionBlocked, setIsPermissionBlocked] = useState(false);
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [scanLogs, setScanLogs] = useState<ScannedTicketLog[]>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const [manualInput, setManualInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Subscribe to live event tickets from Firestore
  useEffect(() => {
    if (!event.id) return;
    const unsub = subscribeEventTickets(event.id, setTickets);
    return unsub;
  }, [event.id]);

  const stopScanning = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
      try {
        scannerRef.current.clear();
      } catch (err) {
        console.warn('Error clearing scanner:', err);
      }
      scannerRef.current = null;
    }

    // Stop hardware tracks
    try {
      const container = document.getElementById('qr-reader');
      if (container) {
        const videos = container.querySelectorAll('video');
        videos.forEach((video) => {
          if (video.srcObject instanceof MediaStream) {
            video.srcObject.getTracks().forEach((track) => {
              try {
                track.stop();
              } catch {}
            });
            video.srcObject = null;
          }
        });
      }
    } catch {}

    setScanning(false);
    setScannerStarting(false);
  }, []);

  useEffect(() => {
    return () => {
      void stopScanning();
    };
  }, [stopScanning]);

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

  const startScanning = async () => {
    setScanning(true);
    setScannerStarting(true);
    setScannerError('');
    setIsPermissionBlocked(false);

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setScannerError('Camera access requires HTTPS connection.');
      setScanning(false);
      setScannerStarting(false);
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setScannerError('Camera access is not supported on this browser or connection.');
      setScanning(false);
      setScannerStarting(false);
      return;
    }

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    let container = document.getElementById('qr-reader');
    let waitCount = 0;
    while (!container && waitCount < 10) {
      await new Promise((r) => setTimeout(r, 60));
      container = document.getElementById('qr-reader');
      waitCount++;
    }

    if (!container) {
      setScannerError('Camera preview container not found in DOM.');
      setScanning(false);
      setScannerStarting(false);
      return;
    }

    await stopScanning();
    setScanning(true);

    const scanner = new Html5Qrcode('qr-reader', {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    });
    scannerRef.current = scanner;

    const qrboxFunc = (viewfinderWidth: number, viewfinderHeight: number) => {
      const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
      const edge = Math.max(180, Math.min(Math.floor(minEdge * 0.72), 280));
      return { width: edge, height: edge };
    };

    const config = { fps: 12, qrbox: qrboxFunc };

    try {
      await scanner.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          void processScanPayload(decodedText);
        },
        () => undefined
      );
      setScannerStarting(false);
    } catch (err1) {
      console.warn('[ScanTicketTab] facingMode: environment failed, checking fallback:', err1);
      const errName = (err1 as Error)?.name || '';
      const errMsg = (err1 as Error)?.message || String(err1);
      const isPerm = errName === 'NotAllowedError' || /permission|denied|not allowed/i.test(errMsg);

      if (isPerm) {
        setIsPermissionBlocked(true);
        setScannerError('Camera permission is blocked. Please allow camera access in browser settings.');
        await stopScanning();
        return;
      }

      // Try camera enumeration fallback
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          const rearDev =
            devices.find((d) => /back|rear|environment|main|0/i.test(d.label)) || devices[devices.length - 1];
          await scanner.start(
            rearDev.id,
            config,
            (decodedText) => {
              void processScanPayload(decodedText);
            },
            () => undefined
          );
          setScannerStarting(false);
        } else {
          await scanner.start(
            { facingMode: 'user' },
            config,
            (decodedText) => {
              void processScanPayload(decodedText);
            },
            () => undefined
          );
          setScannerStarting(false);
        }
      } catch (fallbackErr) {
        const msg = (fallbackErr as Error)?.message || 'Failed to start device camera.';
        setScannerError(msg);
        await stopScanning();
      }
    }
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
          Use phone camera scanner or manual input to verify participant tickets and record entry in real time.
        </p>

        {isPermissionBlocked ? (
          <div className="rounded-2xl p-4 text-left bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold text-sm text-amber-300">Camera permission is blocked</h5>
                <p className="text-xs text-amber-200/90 mt-1">
                  Camera access is required to scan tickets. Please allow camera access in browser settings and try again.
                </p>
              </div>
            </div>
            <button
              onClick={startScanning}
              className="btn-primary !py-2 !px-4 text-xs font-semibold"
            >
              Retry Camera Access
            </button>
          </div>
        ) : scannerError ? (
          <div className="rounded-2xl p-4 text-left bg-red-500/10 border border-red-500/30 text-red-200 space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-200">{scannerError}</p>
            </div>
            <button
              onClick={startScanning}
              className="btn-primary !py-2 !px-4 text-xs font-semibold"
            >
              Retry Camera
            </button>
          </div>
        ) : !scanning ? (
          <button
            onClick={startScanning}
            disabled={!canEdit || scannerStarting}
            className="btn-primary w-full flex items-center justify-center gap-2 !py-3 font-semibold"
          >
            {scannerStarting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <QrCode className="w-5 h-5" />}
            {scannerStarting ? 'Opening Camera…' : 'Start Camera Scanner'}
          </button>
        ) : (
          <button
            onClick={stopScanning}
            className="btn-secondary w-full !py-3 font-semibold text-rose-300 border-rose-500/30"
          >
            Stop Camera Scanner
          </button>
        )}
      </div>

      {/* QR Scanner Container */}
      {scanning && (
        <div className="rounded-2xl border p-4 sm:p-6 space-y-4" style={{ borderColor: 'var(--dash-border)' }}>
          <div className="relative w-full max-w-sm mx-auto aspect-square rounded-xl overflow-hidden bg-black">
            <div id="qr-reader" className="qr-reader w-full h-full" />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-48 h-48 border border-white/20 rounded-2xl relative">
                <span className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-emerald-400 rounded-tl-md" />
                <span className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-emerald-400 rounded-tr-md" />
                <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-emerald-400 rounded-bl-md" />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-emerald-400 rounded-br-md" />
                <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#10b981] animate-laser" />
              </div>
            </div>
          </div>
          <p className="text-xs text-center" style={{ color: 'var(--dash-muted)' }}>
            Point rear camera at attendee&apos;s ticket QR code
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
