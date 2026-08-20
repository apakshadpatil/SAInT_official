import { useEffect, useState } from 'react';
import type { EventRecord } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { Upload, Check, Copy, ToggleLeft, ToggleRight, QrCode } from 'lucide-react';
import { uploadDataUrlToSupabase, SUPABASE_BUCKET } from '../../utils/supabase';

interface TicketingTabProps {
  event: EventRecord;
  onUpdate: (updates: Partial<EventRecord>) => Promise<void>;
  canEdit: boolean;
}

export default function TicketingTab({ event, onUpdate, canEdit }: TicketingTabProps) {
  const { showToast } = useToast();
  const [paymentQRPreview, setPaymentQRPreview] = useState<string>(event.paymentQRUrl || '');
  const [loading, setLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [ticketingEnabled, setTicketingEnabled] = useState(Boolean(event.ticketingEnabled));
  const registrationLink = `${window.location.origin}/events/${event.id}/register`;

  useEffect(() => {
    setPaymentQRPreview(event.paymentQRUrl || '');
    setTicketingEnabled(Boolean(event.ticketingEnabled));
  }, [event.paymentQRUrl, event.ticketingEnabled]);

  const handlePaymentQRUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      setPaymentQRPreview(preview);
    };
    reader.readAsDataURL(file);
  };

  const handleToggleTicketing = async () => {
    setLoading(true);
    try {
      const nextValue = !ticketingEnabled;
      await onUpdate({
        ticketingEnabled: nextValue,
        paymentQRUrl: nextValue ? event.paymentQRUrl || paymentQRPreview || undefined : undefined,
      });
      setTicketingEnabled(nextValue);
      showToast(nextValue ? 'Ticketing enabled for this event' : 'Ticketing disabled for this event', 'success');
    } catch (err) {
      showToast('Failed to update ticketing setting', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePaymentQR = async () => {
    setLoading(true);
    try {
      let finalUrl = paymentQRPreview;
      if (paymentQRPreview && paymentQRPreview.startsWith('data:')) {
        const dest = `tickets/payment_qr/${event.id}_${Date.now()}.png`;
        finalUrl = await uploadDataUrlToSupabase(paymentQRPreview, dest, 'payment_qr.png', SUPABASE_BUCKET);
      }

      await onUpdate({
        paymentQRUrl: finalUrl || undefined,
        ticketingEnabled: true,
      });

      setPaymentQRPreview(finalUrl || '');
      setTicketingEnabled(true);
      showToast('Payment QR code saved & Ticketing enabled!', 'success');
    } catch (err) {
      console.error('Failed to save payment QR code:', err);
      showToast(err instanceof Error ? err.message : 'Failed to save payment QR code', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(registrationLink);
    setLinkCopied(true);
    showToast('Registration link copied!', 'success');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Ticketing Status Bar */}
      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--dash-border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold text-lg" style={{ color: 'var(--dash-text)' }}>
                Event Ticketing Status
              </h3>
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>
              {ticketingEnabled
                ? 'Ticketing is ACTIVE. Participants can register and generate digital QR tickets.'
                : 'Ticketing is INACTIVE. Participants cannot register for tickets until enabled.'}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={handleToggleTicketing}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all shrink-0 cursor-pointer"
              style={{
                borderColor: ticketingEnabled ? 'rgba(16,185,129,0.3)' : 'var(--dash-border)',
                background: ticketingEnabled ? 'rgba(16,185,129,0.1)' : 'var(--dash-card)',
                color: ticketingEnabled ? '#10b981' : 'var(--dash-text)',
              }}
            >
              {ticketingEnabled ? <ToggleRight className="w-6 h-6 text-emerald-500" /> : <ToggleLeft className="w-6 h-6 text-slate-400" />}
              {ticketingEnabled ? 'Ticketing Enabled' : 'Enable Ticketing'}
            </button>
          )}
        </div>
      </div>

      {/* Registration Link Section */}
      <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--dash-border)' }}>
        <h4 className="font-bold text-base" style={{ color: 'var(--dash-text)' }}>
          Public Registration & Ticket Link
        </h4>
        <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>
          Share this direct registration link with students and attendees to let them register and receive their pass.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={registrationLink}
            readOnly
            className="input-field flex-1 font-mono text-xs"
          />
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer"
            style={{
              background: linkCopied ? 'rgba(16,185,129,0.15)' : 'var(--dash-card)',
              color: linkCopied ? '#10b981' : 'var(--dash-text)',
              border: '1px solid ' + (linkCopied ? 'rgba(16,185,129,0.3)' : 'var(--dash-border)'),
            }}
          >
            <Copy className="w-4 h-4" />
            {linkCopied ? 'Copied' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* Payment QR Code Section */}
      <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--dash-border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-base" style={{ color: 'var(--dash-text)' }}>
              Payment QR Code (UPI / Banking)
            </h4>
            <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
              Upload your UPI/Payment QR code if this is a paid event. Leave blank for free events.
            </p>
          </div>
          {paymentQRPreview && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              Active Payment QR
            </span>
          )}
        </div>

        {paymentQRPreview ? (
          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl border" style={{ borderColor: 'var(--dash-border)' }}>
            <div className="w-40 h-40 rounded-xl border p-2 bg-white shrink-0">
              <img src={paymentQRPreview} alt="Payment QR" className="w-full h-full object-contain" />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>Payment QR Code Active</p>
              <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
                This QR image is displayed to attendees on the registration form so they can pay and provide transaction ID.
              </p>
              {canEdit && (
                <div className="flex items-center gap-2">
                  <label className="btn-secondary !text-xs !py-2 cursor-pointer">
                    Replace QR Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handlePaymentQRUpload(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={() => {
                      setPaymentQRPreview('');
                      void onUpdate({ paymentQRUrl: undefined });
                      showToast('Payment QR removed', 'info');
                    }}
                    className="px-3 py-2 text-xs font-semibold rounded-xl text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-all"
                  >
                    Remove QR
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 cursor-pointer transition hover:bg-blue-500/5 text-center"
              style={{ borderColor: 'var(--dash-border)' }}
            >
              <Upload className="w-8 h-8 text-blue-500" />
              <p className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>Click to upload Payment QR image</p>
              <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>PNG, JPG, WEBP up to 5MB</p>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handlePaymentQRUpload(e.target.files[0])}
                className="hidden"
                disabled={!canEdit}
              />
            </label>
          </div>
        )}

        {canEdit && paymentQRPreview && paymentQRPreview.startsWith('data:') && (
          <button
            onClick={handleSavePaymentQR}
            disabled={loading}
            className="btn-primary w-full !py-3 font-semibold"
          >
            {loading ? 'Uploading & Saving to Supabase...' : 'Save Payment QR Code'}
          </button>
        )}
      </div>

      {/* Ticketing Features & Verification */}
      <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--dash-border)' }}>
        <h4 className="font-bold text-base" style={{ color: 'var(--dash-text)' }}>
          Included Ticketing Features
        </h4>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2 p-2.5 rounded-xl border" style={{ borderColor: 'var(--dash-border)' }}>
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Automatic digital ticket pass generation</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl border" style={{ borderColor: 'var(--dash-border)' }}>
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Unique QR code payload per ticket</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl border" style={{ borderColor: 'var(--dash-border)' }}>
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Real-time QR camera scanner check-in</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl border" style={{ borderColor: 'var(--dash-border)' }}>
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Manual ticket number verification (ST-XXXXXX)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
