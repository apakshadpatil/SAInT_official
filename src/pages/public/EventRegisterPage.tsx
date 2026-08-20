import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, Download, CheckCircle, Ticket, ArrowLeft, Loader2 } from 'lucide-react';
import { getEvent, registerParticipantForEvent } from '../../services/eventService';
import type { EventRecord, EventTicket } from '../../types';
import { downloadTicketImage } from '../../utils/ticketDownload';
import QRCode from 'qrcode';

export default function EventRegisterPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState<EventTicket | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [college, setCollege] = useState('');
  const [department, setDepartment] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [customResponses, setCustomResponses] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const ticketStorageKey = eventId ? `saint-event-ticket:${eventId}` : '';

  useEffect(() => {
    if (!eventId) return;
    getEvent(eventId)
      .then((e) => {
        setEvent(e);
        const storedTicket = ticketStorageKey ? sessionStorage.getItem(ticketStorageKey) : null;
        if (storedTicket) {
          try {
            const savedTicket = JSON.parse(storedTicket) as EventTicket;
            setTicket(savedTicket);
            QRCode.toDataURL(savedTicket.qrPayload, { width: 300, margin: 2 }).then(setQrDataUrl);
          } catch {
            sessionStorage.removeItem(ticketStorageKey);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Event not found.');
        setLoading(false);
      });
  }, [eventId, ticketStorageKey]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !eventId) return;
    if (event.status !== 'published') {
      setError('Registration is closed for this event.');
      return;
    }
    const guestName = name.trim();
    if (!guestName) {
      setError('Please enter your full name.');
      return;
    }

    // Validate required custom form fields
    if (event.customFields) {
      for (const field of event.customFields) {
        if (field.required && !customResponses[field.id]?.trim()) {
          setError(`Please complete required field: "${field.label}"`);
          return;
        }
      }
    }

    setSubmitting(true);
    setError('');
    try {
      const { ticket: newTicket } = await registerParticipantForEvent(eventId, {
        name: guestName,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        college: college.trim() || undefined,
        department: department.trim() || undefined,
        domain: event.participantDomains?.find((domain) => domain.id === selectedDomainId)?.name,
        domainId: selectedDomainId || undefined,
        transactionId: transactionId.trim() || undefined,
        customResponses: Object.keys(customResponses).length > 0 ? customResponses : undefined,
        registrationSource: 'public',
      });
      const qr = await QRCode.toDataURL(newTicket.qrPayload, { width: 300, margin: 2 });
      setTicket(newTicket);
      setQrDataUrl(qr);
      sessionStorage.setItem(ticketStorageKey, JSON.stringify(newTicket));
      await downloadTicketImage(event, newTicket, qr);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!ticket || !qrDataUrl || !event) return;
    await downloadTicketImage(event, ticket, qrDataUrl);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a8a)' }}>
        <div className="public-bg-blobs" aria-hidden="true">
          <div className="public-liquid-blob-1" />
          <div className="public-liquid-blob-2" />
        </div>
        <Loader2 className="w-10 h-10 text-blue-400 animate-spin relative z-10" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4 relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a8a)' }}>
        <div className="public-bg-blobs" aria-hidden="true">
          <div className="public-liquid-blob-1" />
          <div className="public-liquid-blob-2" />
        </div>
        <p className="text-white text-xl font-bold relative z-10">Event Not Found</p>
        <Link to="/" className="text-blue-300 underline text-sm flex items-center gap-1 relative z-10">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </div>
    );
  }

  const registrationClosed = event.status !== 'published';
  const showDomainSelection = Boolean(event.enableDomainSelection && event.participantDomains?.length);
  const showPaymentQR = Boolean(event.ticketingEnabled && event.paymentQRUrl);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#020617 0%,#0f172a 50%,#1e1b4b 100%)' }}>
      {/* Large animated background blobs */}
      <div className="public-bg-blobs" aria-hidden="true">
        <div className="public-liquid-blob-1" style={{ opacity: 0.7 }} />
        <div className="public-liquid-blob-2" style={{ opacity: 0.65 }} />
        <div className="public-liquid-blob-3" style={{ opacity: 0.55 }} />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12 min-h-screen flex flex-col justify-center">
        <Link to="/#events" className="inline-flex items-center gap-2 text-blue-300 hover:text-white text-sm mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Events
        </Link>

        <div className="rounded-2xl overflow-hidden mb-6" style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(24px)',
        }}>
          {event.imageURL && (
            <img src={event.imageURL} alt={event.title} className="w-full h-48 object-cover" />
          )}
          <div className="p-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3"
              style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }}>
              <Ticket className="w-3 h-3" /> Event Registration
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">{event.title}</h1>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
                {new Date(event.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                {event.startTime} – {event.endTime}
              </div>
              <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
                {event.location}, {event.venue}
              </div>
            </div>
          </div>
        </div>

        {ticket ? (
          <div className="rounded-2xl p-6 text-center space-y-5 animate-fade-in-up" style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(59,130,246,0.25)',
            backdropFilter: 'blur(24px)',
          }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
              style={{ background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.4)' }}>
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">You&apos;re Registered!</h2>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Welcome, <strong className="text-white">{ticket.guestName}</strong>! Your ticket downloads automatically and remains available here during this browser session.
              </p>
            </div>

            <div className="inline-block p-4 bg-white rounded-2xl shadow-2xl">
              <img src={qrDataUrl} alt="Your Ticket QR" className="w-52 h-52 block" />
            </div>

            <div className="rounded-xl px-5 py-3 text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Ticket No: </span>
              <span className="text-white font-mono font-bold">{ticket.ticketNumber}</span>
            </div>

            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-semibold text-white text-sm transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)', border: 'none' }}
            >
              <Download className="w-4 h-4" />
              Download Ticket Again
            </button>

            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Screenshot or download this QR code — you&apos;ll need it for entry.
            </p>
          </div>
        ) : registrationClosed ? (
          <div className="rounded-2xl p-6 text-center" style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(239,68,68,0.25)',
            backdropFilter: 'blur(24px)',
          }}>
            <p className="text-white font-bold text-lg mb-2">Registration Closed</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              This event is not accepting registrations at the moment.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl p-6" style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(24px)',
          }}>
            <h2 className="text-xl font-bold text-white mb-1">Register for this Event</h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Fill in your details to get a unique QR ticket. No account or signup required.
            </p>

            {showPaymentQR && (
              <div className="mb-5 rounded-2xl border p-4" style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)' }}>
                <p className="text-sm font-semibold text-white mb-2">Payment QR</p>
                <img src={event.paymentQRUrl} alt="Payment QR" className="mx-auto h-40 w-40 rounded-xl object-contain bg-white p-2" />
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-xl text-sm font-medium" style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)',
                color: '#f87171',
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Full Name *
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Enter your full name"
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem',
                    borderRadius: '0.75rem',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    backdropFilter: 'blur(8px)',
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem',
                    borderRadius: '0.75rem',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    backdropFilter: 'blur(8px)',
                  }}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit number"
                    style={{
                      width: '100%',
                      padding: '0.65rem 1rem',
                      borderRadius: '0.75rem',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                      backdropFilter: 'blur(8px)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    College (Optional)
                  </label>
                  <input
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    placeholder="e.g. JSPM RSCOE"
                    style={{
                      width: '100%',
                      padding: '0.65rem 1rem',
                      borderRadius: '0.75rem',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                      backdropFilter: 'blur(8px)',
                    }}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    Department (Optional)
                  </label>
                  <input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. IT"
                    style={{
                      width: '100%',
                      padding: '0.65rem 1rem',
                      borderRadius: '0.75rem',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                      backdropFilter: 'blur(8px)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    Transaction ID (Optional)
                  </label>
                  <input
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder="Payment reference"
                    style={{
                      width: '100%',
                      padding: '0.65rem 1rem',
                      borderRadius: '0.75rem',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                      backdropFilter: 'blur(8px)',
                    }}
                  />
                </div>
              </div>

              {showDomainSelection && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    Select Domain
                  </label>
                  <select
                    value={selectedDomainId}
                    onChange={(e) => setSelectedDomainId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 1rem',
                      borderRadius: '0.75rem',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    <option value="" style={{ color: '#111827' }}>Choose a domain</option>
                    {event.participantDomains?.map((domain) => (
                      <option key={domain.id} value={domain.id} style={{ color: '#111827' }}>{domain.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Custom Form Fields */}
              {event.customFields && event.customFields.length > 0 && (
                <div className="space-y-4 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-400">Custom Event Information</p>
                  {event.customFields.map((field) => (
                    <div key={field.id}>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {field.label} {field.required ? '*' : '(Optional)'}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          value={customResponses[field.id] || ''}
                          onChange={(e) => setCustomResponses({ ...customResponses, [field.id]: e.target.value })}
                          required={field.required}
                          placeholder={field.placeholder || `Enter ${field.label}`}
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '0.65rem 1rem',
                            borderRadius: '0.75rem',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#fff',
                            fontSize: '0.9rem',
                            outline: 'none',
                            backdropFilter: 'blur(8px)',
                          }}
                        />
                      ) : field.type === 'select' ? (
                        <select
                          value={customResponses[field.id] || ''}
                          onChange={(e) => setCustomResponses({ ...customResponses, [field.id]: e.target.value })}
                          required={field.required}
                          style={{
                            width: '100%',
                            padding: '0.65rem 1rem',
                            borderRadius: '0.75rem',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#fff',
                            fontSize: '0.9rem',
                            outline: 'none',
                            backdropFilter: 'blur(8px)',
                          }}
                        >
                          <option value="" style={{ color: '#111827' }}>Select {field.label}...</option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt} style={{ color: '#111827' }}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                          value={customResponses[field.id] || ''}
                          onChange={(e) => setCustomResponses({ ...customResponses, [field.id]: e.target.value })}
                          required={field.required}
                          placeholder={field.placeholder || `Enter ${field.label}`}
                          style={{
                            width: '100%',
                            padding: '0.65rem 1rem',
                            borderRadius: '0.75rem',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#fff',
                            fontSize: '0.9rem',
                            outline: 'none',
                            backdropFilter: 'blur(8px)',
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                style={{
                  background: submitting ? 'rgba(37,99,235,0.5)' : 'linear-gradient(135deg, #2563eb, #1e40af)',
                  border: 'none',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating Ticket...</>
                ) : (
                  <><Ticket className="w-4 h-4" /> Register &amp; Download Ticket</>
                )}
              </button>
            </form>

            <p className="text-xs text-center mt-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Your ticket QR will be generated and downloaded instantly. No login required.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
