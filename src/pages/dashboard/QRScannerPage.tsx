import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { AlertTriangle, CheckCircle2, ImageUp, Pause, Play, QrCode, Ticket } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { checkInByQRPayload, checkInByTicketNumber } from '../../services/eventService';

interface ScanLog {
  ticketNumber: string;
  guestName: string;
  eventTitle: string;
  timestamp: string;
  status: 'success' | 'error';
  message: string;
}

function getCameraErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/notallowed|permission|denied/i.test(message)) return 'Camera permission was denied. Allow camera access in your browser settings and try again.';
  if (/notfound|requested device not found/i.test(message)) return 'No camera was found. Connect a camera or use ticket number verification.';
  if (/notreadable|in use/i.test(message)) return 'The camera is already in use by another application. Close it and try again.';
  return 'The camera could not start. Use a secure HTTPS connection and try again.';
}

export default function QRScannerPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileScanning, setFileScanning] = useState(false);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'scanning' | 'error'>('idle');
  const [cameraError, setCameraError] = useState('');

  const addLog = useCallback((log: ScanLog) => {
    setScanLogs((currentLogs) => [log, ...currentLogs].slice(0, 20));
  }, []);

  const verifyTicket = useCallback(async (rawValue: string) => {
    const value = rawValue.trim();
    if (!value || !profile || processingRef.current) return;

    processingRef.current = true;
    setLoading(true);
    try {
      const result = value.toUpperCase().startsWith('ST-')
        ? await checkInByTicketNumber(value, profile.uid)
        : await checkInByQRPayload(value, profile.uid);
      addLog({
        ticketNumber: result.ticket.ticketNumber,
        guestName: result.ticket.guestName,
        eventTitle: result.event.title,
        timestamp: new Date().toLocaleTimeString('en-IN'),
        status: 'success',
        message: 'Check-in completed successfully.',
      });
      showToast(`${result.ticket.guestName} checked in for ${result.event.title}.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to verify this ticket.';
      addLog({
        ticketNumber: value.toUpperCase().startsWith('ST-') ? value.toUpperCase() : 'QR ticket',
        guestName: 'Unknown guest',
        eventTitle: 'Unknown event',
        timestamp: new Date().toLocaleTimeString('en-IN'),
        status: 'error',
        message,
      });
      showToast(message, 'error');
    } finally {
      setLoading(false);
      processingRef.current = false;
    }
  }, [addLog, profile, showToast]);

  useEffect(() => {
    if (!cameraActive) return;

    let cancelled = false;
    const scanner = new Html5Qrcode('qr-reader-container', {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    });
    scannerRef.current = scanner;
    setCameraState('starting');
    setCameraError('');

    const startScanner = async () => {
      try {
        await scanner.start(
          { facingMode: { ideal: 'environment' } },
          { fps: 12, qrbox: { width: 260, height: 260 }, aspectRatio: 1 },
          (decodedText) => {
            if (cancelled || processingRef.current) return;
            setCameraActive(false);
            void verifyTicket(decodedText);
          },
          () => undefined
        );

        if (cancelled) {
          if (scanner.isScanning) await scanner.stop();
          return;
        }
        setCameraState('scanning');
      } catch (error) {
        if (!cancelled) {
          setCameraState('error');
          setCameraError(getCameraErrorMessage(error));
          setCameraActive(false);
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      void (async () => {
        try {
          if (scanner.isScanning) await scanner.stop();
        } catch {}
        try {
          scanner.clear();
        } catch {}
        if (scannerRef.current === scanner) scannerRef.current = null;
      })();
    };
  }, [cameraActive, verifyTicket]);

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
      addLog({
        ticketNumber: 'Image upload',
        guestName: 'Unknown guest',
        eventTitle: 'Unknown event',
        timestamp: new Date().toLocaleTimeString('en-IN'),
        status: 'error',
        message,
      });
      showToast(error instanceof Error && error.message ? `${message} Try a clearer image.` : message, 'error');
    } finally {
      try {
        imageScanner?.clear();
      } catch {}
      event.target.value = '';
      setFileScanning(false);
    }
  };

  const scannerBusy = loading || fileScanning || cameraState === 'starting';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>Ticket Scanner</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>Scan a ticket QR, upload a saved QR image, or verify the printed ticket number.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="dash-card flex flex-col items-center justify-center p-6 text-center min-h-[400px]">
            {cameraActive ? (
              <div className="w-full max-w-md space-y-4">
                <div id="qr-reader-container" className="qr-reader overflow-hidden rounded-2xl bg-black border" />
                <p className="text-xs" style={{ color: 'var(--dash-muted)' }} aria-live="polite">
                  {cameraState === 'starting' ? 'Opening your camera…' : 'Align the ticket QR code inside the frame.'}
                </p>
                <button onClick={() => setCameraActive(false)} className="btn-outline !py-2 !px-4 text-xs mx-auto flex">
                  <Pause className="w-3.5 h-3.5" /> Stop Camera
                </button>
              </div>
            ) : (
              <div className="space-y-4 max-w-md">
                <div className="w-20 h-20 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-600 mx-auto">
                  <QrCode className="w-10 h-10" />
                </div>
                <h2 className="font-bold text-lg" style={{ color: 'var(--dash-text)' }}>Fast, reliable ticket check-in</h2>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--dash-muted)' }}>
                  The scanner prefers the rear camera on phones and prevents a ticket from being submitted twice while it is processing.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    onClick={() => { setCameraError(''); setCameraActive(true); }}
                    disabled={scannerBusy}
                    className="btn-primary"
                  >
                    <Play className="w-4 h-4" /> Start Camera
                  </button>
                  <label className="btn-outline !py-2.5 cursor-pointer">
                    <ImageUp className="w-4 h-4" /> {fileScanning ? 'Reading Image…' : 'Scan from Image'}
                    <input type="file" accept="image/*" className="sr-only" onChange={handleImageScan} disabled={scannerBusy} />
                  </label>
                </div>
                {cameraError && <p className="rounded-xl px-4 py-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20">{cameraError}</p>}
              </div>
            )}
          </div>

          <div className="dash-card p-6">
            <h2 className="font-bold text-sm mb-2" style={{ color: 'var(--dash-text)' }}>Manual Ticket Verification</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--dash-muted)' }}>Enter a ticket number such as <span className="font-mono">ST-AB12CD34</span>, or paste a complete QR payload.</p>
            <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                className="input-field flex-1"
                placeholder="ST-XXXXXXXX or QR payload"
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value)}
                required
              />
              <button type="submit" disabled={scannerBusy} className="btn-primary shrink-0">Verify Ticket</button>
            </form>
          </div>
        </div>

        <aside className="lg:col-span-1">
          <div className="dash-card p-5 h-full">
            <h2 className="font-bold text-sm border-b pb-3 mb-4" style={{ color: 'var(--dash-text)', borderColor: 'var(--dash-border)' }}>Scanner Operations Log</h2>
            {scanLogs.length === 0 ? (
              <div className="text-center py-16">
                <Ticket className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>No tickets scanned in this session.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {scanLogs.map((log, index) => (
                  <div key={`${log.timestamp}-${index}`} className="p-3 border rounded-xl flex items-start gap-2 text-xs" style={{ borderColor: 'var(--dash-border)' }}>
                    {log.status === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <p className="font-bold truncate" style={{ color: 'var(--dash-text)' }}>{log.guestName}</p>
                      <p className="text-[10px]" style={{ color: 'var(--dash-muted)' }}>{log.eventTitle}</p>
                      <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--dash-muted)' }}>{log.ticketNumber}</p>
                      <p className="text-[9px] mt-1" style={{ color: log.status === 'success' ? 'var(--dash-muted)' : '#ef4444' }}>{log.message}</p>
                      <span className="text-[8px] text-slate-400 block mt-1">Time: {log.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      <div id="qr-file-reader" className="hidden" aria-hidden="true" />
    </div>
  );
}
