import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Download,
  Filter,
  ImageUp,
  Info,
  Pause,
  Play,
  QrCode,
  RefreshCw,
  Sparkles,
  Ticket,
  Users,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { checkInByQRPayload, checkInByTicketNumber, getEvents, subscribeEvents } from '../../services/eventService';
import type { EventRecord } from '../../types';
import { parseQRPayload } from '../../utils/qrScan';

interface ScanLog {
  ticketNumber: string;
  guestName: string;
  eventTitle: string;
  teamName?: string;
  tierName?: string;
  timestamp: string;
  status: 'success' | 'already_checked_in' | 'wrong_event' | 'error';
  message: string;
}

interface CameraDiagnosticState {
  isSecureContext: boolean;
  hasMediaDevices: boolean;
  hasGetUserMedia: boolean;
  protocol: string;
  detectedCameras: number;
  activeCameraLabel?: string;
}

function playScanSound(type: 'success' | 'warning' | 'error') {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'warning') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // Audio context may be restricted by autoplay policy
  }
}

export default function QRScannerPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [events, setEvents] = useState<EventRecord[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [continuousScan, setContinuousScan] = useState(true);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileScanning, setFileScanning] = useState(false);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [lastScanResult, setLastScanResult] = useState<ScanLog | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'scanning' | 'error'>('idle');
  const [cameraError, setCameraError] = useState('');
  const [rawCameraError, setRawCameraError] = useState<string>('');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagInfo, setDiagInfo] = useState<CameraDiagnosticState>({
    isSecureContext: typeof window !== 'undefined' ? Boolean(window.isSecureContext) : false,
    hasMediaDevices: typeof navigator !== 'undefined' ? Boolean(navigator.mediaDevices) : false,
    hasGetUserMedia: typeof navigator !== 'undefined' ? Boolean(navigator.mediaDevices?.getUserMedia) : false,
    protocol: typeof window !== 'undefined' ? window.location.protocol : '',
    detectedCameras: 0,
  });

  // Fetch events for the event selector filter
  useEffect(() => {
    const unsub = subscribeEvents((list) => {
      const activeEvents = list.filter((e) => e.status !== 'cancelled');
      setEvents(activeEvents);
    });

    getEvents().then((list) => {
      const activeEvents = list.filter((e) => e.status !== 'cancelled');
      setEvents(activeEvents);
    }).catch(() => {});

    // Inspect available cameras on load for diagnostics
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setDiagInfo((prev) => ({ ...prev, detectedCameras: videoDevices.length }));
      }).catch(() => {});
    }

    return () => unsub();
  }, []);

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  const addLog = useCallback((log: ScanLog) => {
    setScanLogs((currentLogs) => [log, ...currentLogs].slice(0, 50));
  }, []);

  const verifyTicket = useCallback(async (rawValue: string) => {
    const value = rawValue.trim();
    if (!value || !profile || processingRef.current) return;

    processingRef.current = true;
    setLoading(true);

    try {
      const result = value.toUpperCase().startsWith('ST-')
        ? await checkInByTicketNumber(value, profile.uid, selectedEventId || undefined)
        : await checkInByQRPayload(value, profile.uid, selectedEventId || undefined);

      const log: ScanLog = {
        ticketNumber: result.ticket.ticketNumber,
        guestName: result.ticket.guestName,
        eventTitle: result.event.title,
        teamName: result.ticket.teamName,
        tierName: result.ticket.tierName,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
        status: 'success',
        message: 'Check-in confirmed successfully.',
      };

      setLastScanResult(log);
      addLog(log);
      playScanSound('success');
      if ('vibrate' in navigator) navigator.vibrate?.(100);
      showToast(`✓ ${result.ticket.guestName} checked in for ${result.event.title}`, 'success');
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Unable to verify this ticket.';
      const isAlreadyCheckedIn = rawMessage.toLowerCase().includes('already') || (error as { code?: string })?.code === 'ALREADY_CHECKED_IN';
      const isWrongEvent = rawMessage.toLowerCase().includes('not for the selected event') || rawMessage.toLowerCase().includes('different event');

      const errTicket = (error as { ticket?: { ticketNumber?: string; guestName?: string; teamName?: string; tierName?: string } })?.ticket;
      const errEvent = (error as { event?: { title?: string } })?.event;
      const parsed = parseQRPayload(value);

      const log: ScanLog = {
        ticketNumber: errTicket?.ticketNumber || (parsed?.ticketNumber ? parsed.ticketNumber : (value.toUpperCase().startsWith('ST-') ? value.toUpperCase() : 'QR Ticket')),
        guestName: errTicket?.guestName || (isAlreadyCheckedIn ? 'Registered Attendee' : 'Unverified Ticket'),
        eventTitle: errEvent?.title || (selectedEvent ? selectedEvent.title : 'Event Ticket'),
        teamName: errTicket?.teamName,
        tierName: errTicket?.tierName,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
        status: isAlreadyCheckedIn ? 'already_checked_in' : (isWrongEvent ? 'wrong_event' : 'error'),
        message: rawMessage,
      };

      setLastScanResult(log);
      addLog(log);
      playScanSound(isAlreadyCheckedIn ? 'warning' : 'error');
      if ('vibrate' in navigator) navigator.vibrate?.(250);
      showToast(rawMessage, isAlreadyCheckedIn ? 'info' : 'error');
    } finally {
      setLoading(false);
      setTimeout(() => {
        processingRef.current = false;
      }, 1600);
    }
  }, [addLog, profile, selectedEvent, selectedEventId, showToast]);

  // Robust Camera Scanner Lifecycle with Multi-Tier Fallback & Exact Error Reporting
  useEffect(() => {
    if (!cameraActive) return;

    let cancelled = false;
    setCameraState('starting');
    setCameraError('');
    setRawCameraError('');

    const startScanner = async () => {
      // 1. Pre-validation of browser environment
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        const msg = `Insecure Context: Camera access is blocked by the browser on non-HTTPS connections (${window.location.protocol}//). Please open the page over HTTPS.`;
        setCameraError(msg);
        setRawCameraError('SecurityError: window.isSecureContext is false');
        setCameraState('error');
        setCameraActive(false);
        return;
      }

      if (!navigator?.mediaDevices?.getUserMedia) {
        const msg = 'MediaDevices API is unavailable. Ensure HTTPS is active and browser permissions are granted.';
        setCameraError(msg);
        setRawCameraError('NotSupportedError: navigator.mediaDevices.getUserMedia is undefined');
        setCameraState('error');
        setCameraActive(false);
        return;
      }

      // Small delay to ensure the DOM element #qr-reader-container is mounted and ready
      await new Promise((r) => setTimeout(r, 80));
      if (cancelled) return;

      const container = document.getElementById('qr-reader-container');
      if (!container) {
        setCameraError('Camera container element was not found in the DOM.');
        setRawCameraError('DOMError: Element #qr-reader-container not found');
        setCameraState('error');
        setCameraActive(false);
        return;
      }

      // 2. Clean any lingering scanner instance
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
        } catch {}
        try {
          scannerRef.current.clear();
        } catch {}
        scannerRef.current = null;
      }

      const scanner = new Html5Qrcode('qr-reader-container', {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      });
      scannerRef.current = scanner;

      const onScanSuccess = (decodedText: string) => {
        if (cancelled || processingRef.current) return;
        if (!continuousScan) {
          setCameraActive(false);
        }
        void verifyTicket(decodedText);
      };

      let started = false;
      let lastErr: unknown = null;

      // ATTEMPT 1: Direct facingMode: "environment" (Standard rear camera)
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 12, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
          onScanSuccess,
          () => undefined
        );
        started = true;
        setDiagInfo((prev) => ({ ...prev, activeCameraLabel: 'Rear Camera (facingMode: environment)' }));
      } catch (err1) {
        lastErr = err1;
        console.warn('[Camera] Attempt 1 (facingMode: environment) failed:', err1);
      }

      // ATTEMPT 2: Device enumeration via Html5Qrcode.getCameras() (For Android multi-lens cameras)
      if (!started && !cancelled) {
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setDiagInfo((prev) => ({ ...prev, detectedCameras: devices.length }));
            // Prefer back/rear camera if label indicates it, otherwise use first device
            const backDevice = devices.find((d) => /back|rear|environment|main|0/i.test(d.label)) || devices[devices.length - 1];

            await scanner.start(
              backDevice.id,
              { fps: 12, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
              onScanSuccess,
              () => undefined
            );
            started = true;
            setDiagInfo((prev) => ({ ...prev, activeCameraLabel: backDevice.label || backDevice.id }));
          }
        } catch (err2) {
          lastErr = err2;
          console.warn('[Camera] Attempt 2 (getCameras device ID) failed:', err2);
        }
      }

      // ATTEMPT 3: User facing / any camera fallback
      if (!started && !cancelled) {
        try {
          await scanner.start(
            { facingMode: 'user' },
            { fps: 12, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
            onScanSuccess,
            () => undefined
          );
          started = true;
          setDiagInfo((prev) => ({ ...prev, activeCameraLabel: 'Front Camera (facingMode: user)' }));
        } catch (err3) {
          lastErr = err3;
          console.warn('[Camera] Attempt 3 (facingMode: user) failed:', err3);
        }
      }

      if (cancelled) {
        try {
          if (scanner.isScanning) await scanner.stop();
        } catch {}
        return;
      }

      if (started) {
        setCameraState('scanning');
      } else {
        const errorName = (lastErr as Error)?.name || 'CameraInitializationError';
        const errorMessage = (lastErr as Error)?.message || String(lastErr);
        const fullRawError = `${errorName}: ${errorMessage}`;

        let userFriendlyMsg = errorMessage;
        if (/notallowed|permission|denied/i.test(errorMessage) || errorName === 'NotAllowedError') {
          userFriendlyMsg = 'Camera permission was denied. Tap the lock icon beside the URL in Android Chrome, set Camera to "Allow", and try again.';
        } else if (/notfound|device not found/i.test(errorMessage) || errorName === 'NotFoundError') {
          userFriendlyMsg = 'No camera device found on this system. You can also upload a pass image or use manual pass verification.';
        } else if (/overconstrained/i.test(errorMessage) || errorName === 'OverconstrainedError') {
          userFriendlyMsg = 'Camera constraint could not be satisfied. Retrying with fallback camera...';
        }

        setCameraState('error');
        setCameraError(userFriendlyMsg);
        setRawCameraError(fullRawError);
        setCameraActive(false);
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      void (async () => {
        try {
          if (scannerRef.current && scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
        } catch {}
        try {
          scannerRef.current?.clear();
        } catch {}
        scannerRef.current = null;
      })();
    };
  }, [cameraActive, continuousScan, verifyTicket]);

  const handleManualSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!manualCode.trim()) return;
    await verifyTicket(manualCode);
    setManualCode('');
  };

  const handleImageScan = async (event: ChangeEvent<HTMLInputElement>) => {
    const image = event.target.files?.[0];
    if (!image) return;

    setCameraActive(false);
    setFileScanning(true);
    let imageScanner: Html5Qrcode | null = null;
    try {
      imageScanner = new Html5Qrcode('qr-file-reader', {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      });
      const decodedText = await imageScanner.scanFile(image, false);
      await verifyTicket(decodedText);
    } catch (error) {
      const message = 'No readable ticket QR code was found in that image.';
      const log: ScanLog = {
        ticketNumber: 'Image Upload',
        guestName: 'Unreadable QR',
        eventTitle: selectedEvent?.title || 'Unknown Event',
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
        status: 'error',
        message,
      };
      setLastScanResult(log);
      addLog(log);
      playScanSound('error');
      showToast(error instanceof Error && error.message ? `${message} Try a clearer image.` : message, 'error');
    } finally {
      try {
        imageScanner?.clear();
      } catch {}
      event.target.value = '';
      setFileScanning(false);
    }
  };

  const downloadReport = () => {
    if (scanLogs.length === 0) return;
    const csv = [
      ['Ticket Number', 'Guest Name', 'Event Title', 'Team Name', 'Tier', 'Status', 'Message', 'Timestamp'].join(','),
      ...scanLogs.map((l) =>
        [
          `"${l.ticketNumber}"`,
          `"${l.guestName}"`,
          `"${l.eventTitle}"`,
          `"${l.teamName || ''}"`,
          `"${l.tierName || ''}"`,
          `"${l.status}"`,
          `"${l.message.replace(/"/g, '""')}"`,
          `"${l.timestamp}"`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ticket_Scan_Report_${Date.now()}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const scannerBusy = loading || fileScanning || cameraState === 'starting';

  // Stats calculation
  const totalScans = scanLogs.length;
  const successScans = scanLogs.filter((l) => l.status === 'success').length;
  const duplicateScans = scanLogs.filter((l) => l.status === 'already_checked_in').length;
  const rejectedScans = scanLogs.filter((l) => l.status === 'wrong_event' || l.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Header & Event Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>Ticket Scanner</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>
            Instant QR ticket verification, camera check-in, image scan, and manual pass validation.
          </p>
        </div>

        {/* Event Scope Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-400 shrink-0" />
          <select
            aria-label="Filter by Event"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="input-field !py-2 !px-3 text-xs rounded-xl min-w-[220px]"
          >
            <option value="">All Events (Auto-Detect)</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title} {ev.date ? `(${ev.date.slice(0, 10)})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Session Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="dash-card p-4 border rounded-2xl flex flex-col justify-between" style={{ borderColor: 'var(--dash-border)' }}>
          <span className="text-xs font-semibold" style={{ color: 'var(--dash-muted)' }}>Total Scans</span>
          <span className="text-2xl font-bold font-mono mt-1" style={{ color: 'var(--dash-text)' }}>{totalScans}</span>
        </div>
        <div className="dash-card p-4 border rounded-2xl flex flex-col justify-between" style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.04)' }}>
          <span className="text-xs font-semibold text-emerald-400">Valid Check-Ins</span>
          <span className="text-2xl font-bold font-mono text-emerald-400 mt-1">{successScans}</span>
        </div>
        <div className="dash-card p-4 border rounded-2xl flex flex-col justify-between" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.04)' }}>
          <span className="text-xs font-semibold text-amber-400">Already Checked In</span>
          <span className="text-2xl font-bold font-mono text-amber-400 mt-1">{duplicateScans}</span>
        </div>
        <div className="dash-card p-4 border rounded-2xl flex flex-col justify-between" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)' }}>
          <span className="text-xs font-semibold text-red-400">Rejected / Errors</span>
          <span className="text-2xl font-bold font-mono text-red-400 mt-1">{rejectedScans}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Active Live Result Banner (if any) */}
          {lastScanResult && (
            <div
              className={`p-5 rounded-2xl border transition-all duration-300 ${
                lastScanResult.status === 'success'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  : lastScanResult.status === 'already_checked_in'
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                  : lastScanResult.status === 'wrong_event'
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                  : 'border-red-500/40 bg-red-500/10 text-red-200'
              }`}
            >
              <div className="flex items-start gap-3.5">
                {lastScanResult.status === 'success' ? (
                  <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0 mt-0.5" />
                ) : lastScanResult.status === 'already_checked_in' ? (
                  <AlertTriangle className="w-7 h-7 text-amber-400 shrink-0 mt-0.5" />
                ) : lastScanResult.status === 'wrong_event' ? (
                  <AlertCircle className="w-7 h-7 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-7 h-7 text-red-400 shrink-0 mt-0.5" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                      style={{
                        borderColor: 'currentColor',
                        background: 'rgba(255,255,255,0.06)',
                      }}
                    >
                      {lastScanResult.status === 'success'
                        ? '✓ Verified & Checked In'
                        : lastScanResult.status === 'already_checked_in'
                        ? '⚠ Already Checked In'
                        : lastScanResult.status === 'wrong_event'
                        ? '🚫 Wrong Event Ticket'
                        : '✕ Verification Failed'}
                    </span>
                    <span className="text-xs font-mono opacity-75">{lastScanResult.timestamp}</span>
                  </div>

                  <h3 className="text-lg font-bold text-white truncate">{lastScanResult.guestName}</h3>
                  <p className="text-xs opacity-90 mt-0.5">{lastScanResult.eventTitle}</p>

                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs pt-2 border-t border-white/10">
                    <span className="font-mono font-bold px-2 py-1 rounded-lg bg-black/20">
                      Pass: {lastScanResult.ticketNumber}
                    </span>
                    {lastScanResult.tierName && (
                      <span className="px-2 py-1 rounded-lg bg-black/20">
                        Tier: {lastScanResult.tierName}
                      </span>
                    )}
                    {lastScanResult.teamName && (
                      <span className="px-2 py-1 rounded-lg bg-black/20 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {lastScanResult.teamName}
                      </span>
                    )}
                  </div>

                  <p className="text-xs mt-2 font-medium opacity-90">{lastScanResult.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Scanner Viewport Box */}
          <div className="dash-card flex flex-col items-center justify-center p-6 text-center min-h-[380px] relative">
            {cameraActive ? (
              <div className="w-full max-w-md space-y-4">
                <div id="qr-reader-container" className="qr-reader overflow-hidden rounded-2xl bg-black border shadow-2xl relative" />
                <p className="text-xs" style={{ color: 'var(--dash-muted)' }} aria-live="polite">
                  {cameraState === 'starting' ? 'Opening camera stream…' : 'Align the attendee’s ticket QR code inside the frame.'}
                </p>

                <div className="flex items-center justify-center gap-3">
                  <button onClick={() => setCameraActive(false)} className="btn-outline !py-2 !px-4 text-xs flex items-center gap-1.5">
                    <Pause className="w-3.5 h-3.5" /> Stop Camera
                  </button>
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none text-slate-300">
                    <input
                      type="checkbox"
                      checked={continuousScan}
                      onChange={(e) => setContinuousScan(e.target.checked)}
                      className="rounded accent-blue-500"
                    />
                    Continuous Mode
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-md py-4">
                <div className="w-20 h-20 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500 mx-auto shadow-inner">
                  <QrCode className="w-10 h-10" />
                </div>
                <h2 className="font-bold text-lg" style={{ color: 'var(--dash-text)' }}>
                  {selectedEvent ? `Scan Tickets for "${selectedEvent.title}"` : 'Fast & Secure Ticket Check-In'}
                </h2>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--dash-muted)' }}>
                  Scan digital ticket QR codes, upload saved pass images, or verify printed pass numbers. Prevents double check-ins automatically.
                </p>

                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <button
                    onClick={() => { setCameraError(''); setRawCameraError(''); setCameraActive(true); }}
                    disabled={scannerBusy}
                    className="btn-primary flex items-center gap-2 !py-2.5 !px-5"
                  >
                    <Play className="w-4 h-4" /> Start Camera Scanner
                  </button>

                  <label className="btn-outline !py-2.5 !px-4 cursor-pointer flex items-center gap-2 text-xs">
                    <ImageUp className="w-4 h-4 text-blue-400" />
                    {fileScanning ? 'Decoding Image…' : 'Scan from Image File'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleImageScan}
                      disabled={scannerBusy}
                    />
                  </label>
                </div>

                {/* Error Banner with Exact Diagnostics */}
                {cameraError && (
                  <div className="rounded-2xl p-4 text-xs text-left bg-red-500/10 border border-red-500/30 text-red-200 space-y-2 mt-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-red-300">{cameraError}</p>
                        {rawCameraError && (
                          <p className="mt-1 font-mono text-[11px] bg-black/40 p-2 rounded-lg text-red-400 border border-red-500/20 break-all">
                            {rawCameraError}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Diagnostics toggle button */}
            <div className="mt-4 pt-3 border-t border-white/5 w-full flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${diagInfo.isSecureContext ? 'bg-emerald-400' : 'bg-red-400'}`} />
                {diagInfo.isSecureContext ? 'Secure Context (HTTPS)' : 'Insecure Context (HTTP)'}
              </span>
              <button
                type="button"
                onClick={() => setShowDiagnostics((prev) => !prev)}
                className="hover:text-slate-200 underline flex items-center gap-1"
              >
                <Info className="w-3 h-3" /> {showDiagnostics ? 'Hide Diagnostics' : 'Show Diagnostics'}
              </button>
            </div>

            {/* Diagnostic Details Box */}
            {showDiagnostics && (
              <div className="w-full mt-3 p-3 rounded-xl bg-black/40 border border-white/10 text-left text-[11px] font-mono space-y-1 text-slate-300">
                <p>window.isSecureContext: <span className={diagInfo.isSecureContext ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{String(diagInfo.isSecureContext)}</span></p>
                <p>navigator.mediaDevices: <span className={diagInfo.hasMediaDevices ? 'text-emerald-400' : 'text-red-400'}>{String(diagInfo.hasMediaDevices)}</span></p>
                <p>getUserMedia: <span className={diagInfo.hasGetUserMedia ? 'text-emerald-400' : 'text-red-400'}>{String(diagInfo.hasGetUserMedia)}</span></p>
                <p>Protocol: <span className="text-blue-300">{diagInfo.protocol}</span></p>
                <p>Detected Cameras: <span className="text-blue-300">{diagInfo.detectedCameras}</span></p>
                {diagInfo.activeCameraLabel && <p>Active Camera: <span className="text-emerald-300">{diagInfo.activeCameraLabel}</span></p>}
              </div>
            )}
          </div>

          {/* Manual Ticket Verification Box */}
          <div className="dash-card p-6">
            <div className="flex items-center gap-2 mb-2">
              <Ticket className="w-4 h-4 text-blue-400" />
              <h2 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>Manual Ticket Verification</h2>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--dash-muted)' }}>
              Enter a pass number such as <span className="font-mono font-bold text-blue-400">ST-AB12CD34</span>, ticket ID, or paste a raw QR JSON string.
            </p>
            <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                className="input-field flex-1 uppercase font-mono text-sm"
                placeholder="ST-XXXXXXXX or QR payload"
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value)}
                required
                disabled={scannerBusy}
              />
              <button type="submit" disabled={scannerBusy || !manualCode.trim()} className="btn-primary shrink-0 flex items-center gap-2">
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Verify &amp; Check In
              </button>
            </form>
          </div>
        </div>

        {/* Right Sidebar: Operations Log */}
        <aside className="lg:col-span-1">
          <div className="dash-card p-5 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'var(--dash-border)' }}>
                <div>
                  <h2 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>Scanner Operations Log</h2>
                  <span className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>{scanLogs.length} records this session</span>
                </div>
                {scanLogs.length > 0 && (
                  <button
                    onClick={downloadReport}
                    className="btn-outline !py-1.5 !px-2.5 text-[11px] flex items-center gap-1"
                    title="Export CSV"
                  >
                    <Download className="w-3 h-3" /> Export CSV
                  </button>
                )}
              </div>

              {scanLogs.length === 0 ? (
                <div className="text-center py-16">
                  <Camera className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
                  <p className="text-xs font-medium" style={{ color: 'var(--dash-text)' }}>Ready for scanning</p>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--dash-muted)' }}>Scanned tickets and results will appear here in real time.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                  {scanLogs.map((log, index) => (
                    <div
                      key={`${log.timestamp}-${index}`}
                      className={`p-3 border rounded-xl flex items-start gap-2.5 text-xs transition-all ${
                        log.status === 'success'
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : log.status === 'already_checked_in'
                          ? 'border-amber-500/30 bg-amber-500/5'
                          : 'border-red-500/30 bg-red-500/5'
                      }`}
                    >
                      {log.status === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : log.status === 'already_checked_in' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-bold truncate" style={{ color: 'var(--dash-text)' }}>{log.guestName}</p>
                          <span className="text-[9px] font-mono opacity-60 shrink-0">{log.timestamp}</span>
                        </div>
                        <p className="text-[10px] truncate" style={{ color: 'var(--dash-muted)' }}>{log.eventTitle}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-mono font-bold text-blue-400">{log.ticketNumber}</span>
                          {log.tierName && <span className="text-[9px] text-slate-400">({log.tierName})</span>}
                        </div>
                        <p
                          className="text-[10px] mt-1"
                          style={{
                            color:
                              log.status === 'success'
                                ? '#10b981'
                                : log.status === 'already_checked_in'
                                ? '#f59e0b'
                                : '#ef4444',
                          }}
                        >
                          {log.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {scanLogs.length > 0 && (
              <button
                onClick={() => { setScanLogs([]); setLastScanResult(null); }}
                className="text-[11px] text-slate-400 hover:text-slate-200 text-center block w-full mt-4 pt-3 border-t border-white/5 transition-colors"
              >
                Clear Log History
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* Hidden container for file-based QR scanning */}
      <div id="qr-file-reader" className="hidden" aria-hidden="true" />
    </div>
  );
}
