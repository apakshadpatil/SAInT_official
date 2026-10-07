import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Navigate } from 'react-router-dom';
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
  ShieldAlert,
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
import { canAccessTicketScanner } from '../../utils/permissions';

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

  if (!canAccessTicketScanner(profile)) {
    return <Navigate to="/dashboard" replace />;
  }

  const [events, setEvents] = useState<EventRecord[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [continuousScan, setContinuousScan] = useState(true);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const startingRef = useRef(false);
  const continuousScanRef = useRef(continuousScan);

  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileScanning, setFileScanning] = useState(false);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [lastScanResult, setLastScanResult] = useState<ScanLog | null>(null);

  // Camera Scanner Lifecycle State: Default to ACTIVE on open for phones & desktops
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'scanning' | 'error'>('starting');
  const [cameraError, setCameraError] = useState('');
  const [rawCameraError, setRawCameraError] = useState<string>('');
  const [isPermissionBlocked, setIsPermissionBlocked] = useState(false);

  // Multi-camera & Rear camera preference (Requirements 3 & 10)
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [activeCameraLabel, setActiveCameraLabel] = useState<string>('Rear Camera');

  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagInfo, setDiagInfo] = useState<CameraDiagnosticState>({
    isSecureContext: typeof window !== 'undefined' ? Boolean(window.isSecureContext) : false,
    hasMediaDevices: typeof navigator !== 'undefined' ? Boolean(navigator.mediaDevices) : false,
    hasGetUserMedia: typeof navigator !== 'undefined' ? Boolean(navigator.mediaDevices?.getUserMedia) : false,
    protocol: typeof window !== 'undefined' ? window.location.protocol : '',
    detectedCameras: 0,
  });

  // Keep continuousScanRef synced with continuousScan state
  useEffect(() => {
    continuousScanRef.current = continuousScan;
  }, [continuousScan]);

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

  // Clean and stop scanner and all hardware media tracks
  const stopScannerInstance = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.warn('[Camera] scanner.stop warning:', err);
      }
      try {
        scannerRef.current.clear();
      } catch (err) {
        console.warn('[Camera] scanner.clear warning:', err);
      }
      scannerRef.current = null;
    }

    // Stop all media tracks directly from video element to prevent camera staying on in background
    try {
      const container = document.getElementById('qr-reader-container');
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
  }, []);

  // Robust Camera Scanner Lifecycle with Multi-Tier Fallback & Exact Error Reporting
  const startScanner = useCallback(
    async (overrideTarget?: string | { facingMode: string }) => {
      if (startingRef.current) return;
      startingRef.current = true;
      setCameraState('starting');
      setCameraError('');
      setRawCameraError('');
      setIsPermissionBlocked(false);

      // 1. Secure context validation (HTTPS required by browsers for camera APIs)
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        const isHttp = window.location.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(window.location.hostname);
        const msg = isHttp
          ? `Insecure Context: Camera access requires HTTPS. Please access this website over https://${window.location.host}${window.location.pathname}`
          : 'Camera access is blocked by the browser in an insecure context. Please ensure HTTPS is active.';
        setCameraError(msg);
        setRawCameraError('SecurityError: window.isSecureContext is false');
        setIsPermissionBlocked(false);
        setCameraState('error');
        setCameraActive(false);
        startingRef.current = false;
        return;
      }

      // 2. MediaDevices API support validation
      if (!navigator?.mediaDevices?.getUserMedia) {
        const msg = 'MediaDevices camera API is unavailable on this browser. Ensure you are using HTTPS and a modern mobile browser (Chrome/Safari).';
        setCameraError(msg);
        setRawCameraError('NotSupportedError: navigator.mediaDevices.getUserMedia is undefined');
        setIsPermissionBlocked(false);
        setCameraState('error');
        setCameraActive(false);
        startingRef.current = false;
        return;
      }

      // 3. Stop any existing scanner cleanly
      await stopScannerInstance();

      // 4. Ensure DOM container is mounted and ready
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      let container = document.getElementById('qr-reader-container');
      let waitCount = 0;
      while (!container && waitCount < 12) {
        await new Promise((r) => setTimeout(r, 50));
        container = document.getElementById('qr-reader-container');
        waitCount++;
      }

      if (!container) {
        setCameraError('Camera container viewport not found in page DOM.');
        setRawCameraError('DOMError: Element #qr-reader-container not found');
        setCameraState('error');
        setCameraActive(false);
        startingRef.current = false;
        return;
      }

      // 5. Initialize Html5Qrcode
      const scanner = new Html5Qrcode('qr-reader-container', {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      });
      scannerRef.current = scanner;

      const onScanSuccess = (decodedText: string) => {
        if (processingRef.current) return;
        if (!continuousScanRef.current) {
          void stopScannerInstance();
          setCameraActive(false);
          setCameraState('idle');
        }
        void verifyTicket(decodedText);
      };

      const qrboxFunc = (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const edge = Math.max(180, Math.min(Math.floor(minEdge * 0.72), 280));
        return { width: edge, height: edge };
      };

      const scanConfig = {
        fps: 12,
        qrbox: qrboxFunc,
      };

      let started = false;
      let lastErr: unknown = null;

      // Primary attempt: overrideTarget or selectedCameraId or environment facingMode (rear camera)
      const target: string | { facingMode: string } =
        overrideTarget || (selectedCameraId ? selectedCameraId : { facingMode: 'environment' });

      try {
        await scanner.start(target, scanConfig, onScanSuccess, () => undefined);
        started = true;
        if (typeof target === 'object' && target.facingMode === 'environment') {
          setActiveCameraLabel('Rear Camera');
        }
      } catch (err1) {
        lastErr = err1;
        console.warn('[Camera] Primary target start failed:', err1);

        const errName = (err1 as Error)?.name || '';
        const errMsg = (err1 as Error)?.message || String(err1);
        const isPermissionError =
          errName === 'NotAllowedError' ||
          errName === 'PermissionDeniedError' ||
          /permission|not allowed|denied/i.test(errMsg);

        if (isPermissionError) {
          // Explicit permission block by user: stop immediately, do not loop fallbacks
          started = false;
        } else {
          // Fallback 1: Enumerate cameras via getCameras() and pick rear camera
          try {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              const rearDev =
                devices.find((d) => /back|rear|environment|main|0/i.test(d.label)) || devices[devices.length - 1];
              await scanner.start(rearDev.id, scanConfig, onScanSuccess, () => undefined);
              started = true;
              setSelectedCameraId(rearDev.id);
              setActiveCameraLabel(rearDev.label || 'Rear Camera');
            }
          } catch (err2) {
            lastErr = err2;
            console.warn('[Camera] Fallback getCameras failed:', err2);
          }

          // Fallback 2: Front/user facing camera
          if (!started) {
            try {
              await scanner.start({ facingMode: 'user' }, scanConfig, onScanSuccess, () => undefined);
              started = true;
              setFacingMode('user');
              setActiveCameraLabel('Front Camera');
            } catch (err3) {
              lastErr = err3;
              console.warn('[Camera] Fallback user facing camera failed:', err3);
            }
          }
        }
      }

      startingRef.current = false;

      if (started) {
        setCameraState('scanning');
        setCameraActive(true);
        setCameraError('');
        setIsPermissionBlocked(false);

        // Populate available cameras list now that permission is active
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            const mapped = devices.map((d, i) => {
              let label = d.label;
              if (!label) {
                label = /back|rear|environment/i.test(d.label) ? 'Rear Camera' : i === 0 ? 'Rear Camera' : `Camera ${i + 1}`;
              }
              return { id: d.id, label };
            });
            setAvailableCameras(mapped);
            setDiagInfo((prev) => ({ ...prev, detectedCameras: devices.length }));
          }
        } catch {}
      } else {
        const errorName = (lastErr as Error)?.name || 'CameraError';
        const errorMessage = (lastErr as Error)?.message || String(lastErr);
        const isPerm =
          errorName === 'NotAllowedError' ||
          errorName === 'PermissionDeniedError' ||
          /permission|not allowed|denied/i.test(errorMessage);

        let displayMsg = errorMessage;
        if (isPerm) {
          displayMsg = 'Camera permission is blocked. Please allow camera access in your browser settings and try again.';
          setIsPermissionBlocked(true);
        } else if (errorName === 'NotFoundError' || /not found|no camera/i.test(errorMessage)) {
          displayMsg = 'No camera device found on this system. You can scan using an image file or enter the ticket number manually.';
          setIsPermissionBlocked(false);
        } else if (errorName === 'NotReadableError' || /in use|could not start/i.test(errorMessage)) {
          displayMsg = 'Camera is currently in use by another application or tab. Please close other camera apps and try again.';
          setIsPermissionBlocked(false);
        } else {
          setIsPermissionBlocked(false);
        }

        setCameraState('error');
        setCameraError(displayMsg);
        setRawCameraError(`${errorName}: ${errorMessage}`);
        setCameraActive(false);
        await stopScannerInstance();
      }
    },
    [facingMode, selectedCameraId, stopScannerInstance, verifyTicket]
  );

  // Auto-start camera when active, stop tracks cleanly when inactive or unmounted
  useEffect(() => {
    if (cameraActive) {
      void startScanner();
    } else {
      void stopScannerInstance();
    }

    return () => {
      void stopScannerInstance();
    };
  }, [cameraActive, startScanner, stopScannerInstance]);

  const handleSwitchCamera = async () => {
    if (cameraState === 'starting' || startingRef.current) return;

    if (availableCameras.length > 1) {
      const nextIdx = (currentCameraIndex + 1) % availableCameras.length;
      setCurrentCameraIndex(nextIdx);
      const nextDev = availableCameras[nextIdx];
      setSelectedCameraId(nextDev.id);
      setActiveCameraLabel(nextDev.label || `Camera ${nextIdx + 1}`);
      setDiagInfo((prev) => ({ ...prev, activeCameraLabel: nextDev.label || nextDev.id }));
      await startScanner(nextDev.id);
    } else {
      const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
      setFacingMode(nextFacing);
      setSelectedCameraId(null);
      const label = nextFacing === 'environment' ? 'Rear Camera' : 'Front Camera';
      setActiveCameraLabel(label);
      setDiagInfo((prev) => ({ ...prev, activeCameraLabel: label }));
      await startScanner({ facingMode: nextFacing });
    }
  };

  const handleStopCamera = async () => {
    setCameraActive(false);
    setCameraState('idle');
    await stopScannerInstance();
  };

  const handleStartCamera = () => {
    setCameraError('');
    setRawCameraError('');
    setIsPermissionBlocked(false);
    setCameraActive(true);
  };

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
          <div className="dash-card flex flex-col items-center justify-center p-4 sm:p-6 text-center min-h-[400px] relative overflow-hidden">
            {/* Header bar inside scanner card */}
            <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5 text-left">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base" style={{ color: 'var(--dash-text)' }}>Scan Ticket</h2>
                  <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
                    {selectedEvent ? `Event: ${selectedEvent.title}` : 'Live Attendance & Pass Scanner'}
                  </p>
                </div>
              </div>

              {/* Status indicator badge */}
              <div className="flex items-center gap-2">
                {cameraActive && cameraState === 'scanning' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Live Camera
                  </span>
                )}
                {cameraActive && cameraState === 'starting' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Starting…
                  </span>
                )}
              </div>
            </div>

            {/* LIVE CAMERA VIEWPORT */}
            <div className={`w-full max-w-md mx-auto space-y-4 ${cameraActive && cameraState !== 'error' ? 'block' : 'hidden'}`}>
              <div className="relative w-full aspect-square sm:aspect-[4/3] rounded-2xl overflow-hidden bg-black border border-white/15 shadow-2xl flex items-center justify-center">
                {/* HTML5 QR Container for live video stream */}
                <div id="qr-reader-container" className="qr-reader w-full h-full" />

                {/* Targeting Reticle & Overlay (Visible during active scanning) */}
                {cameraState === 'scanning' && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    {/* Viewfinder Target Frame with Glowing Reticle Corners */}
                    <div className="relative w-56 h-56 sm:w-64 sm:h-64 border border-white/20 rounded-2xl">
                      {/* Top-Left Corner */}
                      <span className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                      {/* Top-Right Corner */}
                      <span className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                      {/* Bottom-Left Corner */}
                      <span className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                      {/* Bottom-Right Corner */}
                      <span className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                      {/* Animated Laser Scanning Line */}
                      <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#10b981] animate-laser" />

                      {/* Subtle Watermark */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[11px] font-bold tracking-widest text-white/40 uppercase bg-black/40 px-3 py-1 rounded-full border border-white/10 backdrop-blur-sm">
                          Scan QR
                        </span>
                      </div>
                    </div>

                    <p className="mt-3 text-[11px] font-medium text-white/90 bg-black/60 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-sm">
                      Align attendee’s ticket QR inside the frame
                    </p>
                  </div>
                )}

                {/* Loading / Starting Camera Overlay */}
                {cameraState === 'starting' && (
                  <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-3 z-10">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 animate-pulse">
                      <Camera className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-white">Opening camera stream…</p>
                    <p className="text-xs text-slate-400 max-w-xs">
                      Requesting camera access. Tap &ldquo;Allow&rdquo; if your browser prompts for permission.
                    </p>
                  </div>
                )}
              </div>

              {/* Mobile Scanner Controls Bar */}
              <div className="w-full flex flex-wrap items-center justify-between gap-2.5 pt-1 text-xs">
                {/* Switch Camera Button (Requirement 10) */}
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  disabled={cameraState === 'starting'}
                  className="btn-outline !py-2 !px-3 text-xs flex items-center gap-1.5 rounded-xl text-slate-200 hover:text-white"
                  title="Switch between rear and front cameras"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Switch Camera</span>
                </button>

                {/* Active camera name badge */}
                {activeCameraLabel && (
                  <span className="text-[11px] text-slate-400 truncate max-w-[130px] font-mono">
                    {activeCameraLabel}
                  </span>
                )}

                {/* Stop Camera Button */}
                <button
                  type="button"
                  onClick={handleStopCamera}
                  className="btn-outline !py-2 !px-3 text-xs flex items-center gap-1.5 rounded-xl text-rose-300 hover:text-rose-200 border-rose-500/30 hover:bg-rose-500/10"
                >
                  <Pause className="w-3.5 h-3.5" /> Stop
                </button>

                {/* Continuous Scan Checkbox */}
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-300 text-xs">
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

            {/* INACTIVE / PERMISSION DENIED / ERROR VIEW */}
            {(!cameraActive || cameraState === 'error') && (
              <div className="w-full max-w-md mx-auto py-3 space-y-4">
                {/* 1. Permission Denied View (Requirement 4 & 11) */}
                {isPermissionBlocked ? (
                  <div className="rounded-2xl p-5 text-left bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-3 shadow-lg">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="font-bold text-sm text-amber-300">Camera permission is blocked</h4>
                        <p className="text-xs text-amber-200/90 leading-relaxed">
                          Camera access is required to scan tickets. Please allow camera access in your browser settings and try again.
                        </p>
                      </div>
                    </div>

                    {/* Step-by-step unblock instructions for mobile browsers */}
                    <div className="bg-black/40 rounded-xl p-3 border border-amber-500/20 text-xs space-y-2 text-slate-300">
                      <p className="font-semibold text-amber-300 text-[11px] uppercase tracking-wider">How to enable camera access:</p>
                      <ul className="space-y-1.5 list-disc list-inside text-[11px] text-slate-300">
                        <li><strong>Android Chrome:</strong> Tap the lock/tune icon <span className="font-mono">🔒</span> beside the URL &rarr; <em>Permissions</em> &rarr; <em>Camera</em> &rarr; <strong>Allow</strong>.</li>
                        <li><strong>iPhone Safari:</strong> Tap <span className="font-mono">aA</span> in the address bar &rarr; <em>Website Settings</em> &rarr; set <em>Camera</em> to <strong>Allow</strong> (or open iOS <em>Settings &rarr; Safari &rarr; Camera</em>).</li>
                      </ul>
                    </div>

                    <div className="pt-1 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleStartCamera}
                        className="btn-primary !py-2.5 !px-4 text-xs font-semibold flex items-center gap-2"
                      >
                        <Play className="w-4 h-4" /> Try Again / Grant Camera Access
                      </button>
                    </div>
                  </div>
                ) : cameraError ? (
                  /* 2. Other Camera Error View */
                  <div className="rounded-2xl p-4 text-left bg-red-500/10 border border-red-500/30 text-red-200 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-sm text-red-300">Unable to Access Camera</h4>
                        <p className="text-xs text-red-200/90 mt-1 leading-relaxed">{cameraError}</p>
                        {rawCameraError && (
                          <p className="mt-2 font-mono text-[10px] bg-black/40 p-2 rounded-lg text-red-400 border border-red-500/20 break-all">
                            {rawCameraError}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleStartCamera}
                      className="btn-primary !py-2 !px-4 text-xs flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
                    </button>
                  </div>
                ) : (
                  /* 3. Idle / Stopped View */
                  <div className="space-y-3 py-2">
                    <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto shadow-inner">
                      <Camera className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-base" style={{ color: 'var(--dash-text)' }}>
                      {selectedEvent ? `Scan Tickets for "${selectedEvent.title}"` : 'Camera is Stopped'}
                    </h3>
                    <p className="text-xs leading-relaxed max-w-sm mx-auto" style={{ color: 'var(--dash-muted)' }}>
                      Tap below to start scanning attendee passes live with your phone camera. Defaulting to the rear camera.
                    </p>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleStartCamera}
                        disabled={scannerBusy}
                        className="btn-primary inline-flex items-center gap-2 !py-2.5 !px-5 font-semibold text-xs"
                      >
                        <Play className="w-4 h-4" /> Start Camera Scanner
                      </button>
                    </div>
                  </div>
                )}

                {/* Secondary Fallback: Image Upload (Requirement 8) */}
                <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-center gap-2 text-xs">
                  <span className="text-[11px] text-slate-400">Can&apos;t use camera?</span>
                  <label className="btn-outline !py-2 !px-3.5 cursor-pointer inline-flex items-center gap-2 text-xs text-slate-300 hover:text-white rounded-xl">
                    <ImageUp className="w-3.5 h-3.5 text-blue-400" />
                    {fileScanning ? 'Decoding Pass Image…' : 'Scan from Image File (Fallback)'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleImageScan}
                      disabled={scannerBusy}
                    />
                  </label>
                </div>
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
