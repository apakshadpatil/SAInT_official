import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, Download, CheckCircle, Ticket, ArrowLeft, Loader2, CreditCard, UserPlus } from 'lucide-react';
import { getEvent, registerParticipantForEvent } from '../../services/eventService';
import type { EventRecord, EventTicket, TicketTier, TeamMemberDetail } from '../../types';
import { downloadTicketImage } from '../../utils/ticketDownload';
import QRCode from 'qrcode';

export default function EventRegisterPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState<EventTicket | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [college, setCollege] = useState('');
  const [department, setDepartment] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [customResponses, setCustomResponses] = useState<Record<string, string>>({});

  // Tier selection & Team members
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<TeamMemberDetail[]>([]);
  const [error, setError] = useState('');

  const ticketStorageKey = eventId ? `saint-event-ticket:${eventId}` : '';

  useEffect(() => {
    if (!eventId) return;
    getEvent(eventId)
      .then((e) => {
        if (!e) {
          setError('Event not found.');
          setLoading(false);
          return;
        }
        setEvent(e);
        // Default tier selection if tiered ticketing enabled
        if (e.enableTieredTicketing && e.ticketTiers && e.ticketTiers.length > 0) {
          setSelectedTierId(e.ticketTiers[0].id);
          const initialTeamSize = e.ticketTiers[0].teamSize || 1;
          if (initialTeamSize > 1) {
            setTeamMembers(
              Array.from({ length: initialTeamSize - 1 }, () => ({
                name: '',
                email: '',
                phone: '',
                college: '',
                department: '',
              }))
            );
          } else {
            setTeamMembers([]);
          }
        }

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

  const handleTierSelect = (tier: TicketTier) => {
    setSelectedTierId(tier.id);
    const size = tier.teamSize || 1;
    if (size > 1) {
      setTeamMembers((prev) => {
        const next: TeamMemberDetail[] = [];
        for (let i = 0; i < size - 1; i++) {
          next.push(prev[i] || { name: '', email: '', phone: '', college: '', department: '' });
        }
        return next;
      });
    } else {
      setTeamMembers([]);
    }
  };

  const handleTeamMemberChange = (index: number, field: keyof TeamMemberDetail, value: string) => {
    setTeamMembers((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const selectedTier = event?.ticketTiers?.find((t) => t.id === selectedTierId);

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

    // Validate team members if multi-member tier selected
    if (selectedTier && selectedTier.teamSize > 1) {
      for (let i = 0; i < teamMembers.length; i++) {
        if (!teamMembers[i].name?.trim()) {
          setError(`Please enter the full name for Teammate #${i + 2}`);
          return;
        }
      }
    }

    // Validate required custom form fields applicable to this tier/event
    const applicableCustomFields = (event.customFields || []).filter(
      (f) => !f.tierId || f.tierId === selectedTierId
    );

    for (const field of applicableCustomFields) {
      if (field.required && !customResponses[field.id]?.trim()) {
        setError(`Please complete required question: "${field.label}"`);
        return;
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
        tierId: selectedTier?.id,
        tierName: selectedTier?.name,
        teamSize: selectedTier ? selectedTier.teamSize : 1,
        teamMembers: teamMembers.length > 0 ? teamMembers : undefined,
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

  // Active payment QR logic: Tier QR if tier selected, otherwise event default QR
  const activePaymentQR = selectedTier?.paymentQRUrl || event.paymentQRUrl;
  const showPaymentQR = Boolean(event.ticketingEnabled && activePaymentQR);

  // Applicable custom fields for this event & selected tier
  const applicableCustomFields = (event.customFields || []).filter(
    (f) => !f.tierId || f.tierId === selectedTierId
  );

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#020617 0%,#0f172a 50%,#1e1b4b 100%)' }}>
      {/* Large animated background blobs */}
      <div className="public-bg-blobs" aria-hidden="true">
        <div className="public-liquid-blob-1" style={{ opacity: 0.7 }} />
        <div className="public-liquid-blob-2" style={{ opacity: 0.65 }} />
        <div className="public-liquid-blob-3" style={{ opacity: 0.55 }} />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-12 min-h-screen flex flex-col justify-center">
        <Link to="/#events" className="inline-flex items-center gap-2 text-blue-300 hover:text-white text-sm mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Events
        </Link>

        {/* Event Header Banner */}
        <div className="rounded-2xl overflow-hidden mb-6" style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(24px)',
        }}>
          {event.imageURL && (
            <img src={event.imageURL} alt={event.title} className="w-full h-52 object-cover" />
          )}
          <div className="p-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3"
              style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }}>
              <Ticket className="w-3 h-3" /> Event Registration &amp; Pass
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4">{event.title}</h1>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
                {new Date(event.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                {event.startTime} – {event.endTime}
              </div>
              <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
                {event.location}, {event.venue}
              </div>
            </div>
          </div>
        </div>

        {ticket ? (
          /* Confirmation & Ticket View */
          <div className="rounded-2xl p-6 sm:p-8 text-center space-y-6 animate-fade-in-up" style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(59,130,246,0.3)',
            backdropFilter: 'blur(24px)',
          }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
              style={{ background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.4)' }}>
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Registration Confirmed!</h2>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Welcome, <strong className="text-white">{ticket.guestName}</strong>!
                {ticket.tierName && <span> ({ticket.tierName})</span>} Your digital entry pass has been generated.
              </p>
            </div>

            <div className="inline-block p-4 bg-white rounded-2xl shadow-2xl">
              <img src={qrDataUrl} alt="Your Ticket QR" className="w-52 h-52 block" />
            </div>

            <div className="rounded-xl px-5 py-3 text-sm max-w-md mx-auto" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between">
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Pass Number:</span>
                <span className="text-white font-mono font-bold">{ticket.ticketNumber}</span>
              </div>
              {ticket.teamMembers && ticket.teamMembers.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10 text-left text-xs text-slate-300">
                  <span className="font-semibold text-blue-400">Teammates: </span>
                  {ticket.teamMembers.map((m) => m.name).join(', ')}
                </div>
              )}
            </div>

            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-white text-sm transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)', border: 'none' }}
            >
              <Download className="w-4 h-4" />
              Download Ticket Image
            </button>

            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Show this QR code at the event gate for instant check-in.
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
          /* Registration Form */
          <div className="rounded-2xl p-6 sm:p-8" style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(24px)',
          }}>
            <h2 className="text-xl font-bold text-white mb-1">Register for this Event</h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Fill in your registration details to generate your digital entry pass. No login required.
            </p>

            {/* --- TEAM SIZE / TIER SELECTION CARDS --- */}
            {event.enableTieredTicketing && event.ticketTiers && event.ticketTiers.length > 0 && (
              <div className="mb-6 space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Select Team Size / Registration Tier *
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  {event.ticketTiers.map((tier) => (
                    <button
                      type="button"
                      key={tier.id}
                      onClick={() => handleTierSelect(tier)}
                      className="p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between"
                      style={{
                        borderColor: selectedTierId === tier.id ? '#3b82f6' : 'rgba(255,255,255,0.12)',
                        background: selectedTierId === tier.id ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.03)',
                        boxShadow: selectedTierId === tier.id ? '0 0 15px rgba(59,130,246,0.25)' : 'none',
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                          {tier.teamSize} {tier.teamSize === 1 ? 'Person (Solo)' : 'Members (Team)'}
                        </span>
                        {tier.price !== undefined && (
                          <span className="text-sm font-mono font-bold text-emerald-400">
                            ₹{tier.price}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-white text-sm">{tier.name}</h4>
                      {tier.description && (
                        <p className="text-xs text-slate-300 mt-1">{tier.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Payment QR Code Box */}
            {showPaymentQR && (
              <div className="mb-6 rounded-2xl border p-5 text-center" style={{ borderColor: 'rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)' }}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4 text-blue-400" />
                  <p className="text-sm font-bold text-white">
                    Scan Payment QR Code {selectedTier?.price ? `(Amount: ₹${selectedTier.price})` : ''}
                  </p>
                </div>
                <p className="text-xs text-slate-300 mb-3">
                  Scan via GPay / PhonePe / Paytm / BHIM and enter your Transaction ID below.
                </p>
                <div className="inline-block p-2 bg-white rounded-xl shadow-lg">
                  <img src={activePaymentQR} alt="Payment QR" className="h-44 w-44 rounded-lg object-contain" />
                </div>
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
              {/* Leader / Primary Attendee */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  {selectedTier && selectedTier.teamSize > 1 ? 'Team Leader Details' : 'Attendee Information'}
                </p>

                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Full Name *
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Enter your full name"
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      Phone Number (Optional)
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit number"
                      className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      College (Optional)
                    </label>
                    <input
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                      placeholder="e.g. JSPM RSCOE"
                      className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      Department (Optional)
                    </label>
                    <input
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. IT"
                      className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400"
                    />
                  </div>
                </div>
              </div>

              {/* Teammates fields if teamSize > 1 */}
              {selectedTier && selectedTier.teamSize > 1 && teamMembers.map((member, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3 mt-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300">
                    <UserPlus className="w-3.5 h-3.5" /> Teammate #{idx + 2} Details
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-300">
                      Full Name *
                    </label>
                    <input
                      value={member.name}
                      onChange={(e) => handleTeamMemberChange(idx, 'name', e.target.value)}
                      required
                      placeholder={`Full name for teammate ${idx + 2}`}
                      className="w-full px-4 py-2 rounded-xl text-xs text-white bg-white/5 border border-white/10 outline-none focus:border-indigo-400"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-slate-300">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={member.email || ''}
                        onChange={(e) => handleTeamMemberChange(idx, 'email', e.target.value)}
                        placeholder="teammate@email.com"
                        className="w-full px-4 py-2 rounded-xl text-xs text-white bg-white/5 border border-white/10 outline-none focus:border-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-slate-300">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={member.phone || ''}
                        onChange={(e) => handleTeamMemberChange(idx, 'phone', e.target.value)}
                        placeholder="10-digit number"
                        className="w-full px-4 py-2 rounded-xl text-xs text-white bg-white/5 border border-white/10 outline-none focus:border-indigo-400"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Payment Transaction ID if paid */}
              {showPaymentQR && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Payment Reference / UTR / Transaction ID (Optional)
                  </label>
                  <input
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder="e.g. UPI Ref / 12-digit UTR"
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400 font-mono"
                  />
                </div>
              )}

              {/* Domain selection if enabled */}
              {showDomainSelection && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Select Domain
                  </label>
                  <select
                    value={selectedDomainId}
                    onChange={(e) => setSelectedDomainId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400"
                  >
                    <option value="" style={{ color: '#111827' }}>Choose a domain</option>
                    {event.participantDomains?.map((domain) => (
                      <option key={domain.id} value={domain.id} style={{ color: '#111827' }}>{domain.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Custom Form Fields from Form Builder */}
              {applicableCustomFields.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-400">Custom Event Questions</p>
                  {applicableCustomFields.map((field) => (
                    <div key={field.id}>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {field.label} {field.required ? <span className="text-red-400">*</span> : '(Optional)'}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          value={customResponses[field.id] || ''}
                          onChange={(e) => setCustomResponses({ ...customResponses, [field.id]: e.target.value })}
                          required={field.required}
                          placeholder={field.placeholder || `Enter ${field.label}`}
                          rows={3}
                          className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400"
                        />
                      ) : field.type === 'select' ? (
                        <select
                          value={customResponses[field.id] || ''}
                          onChange={(e) => setCustomResponses({ ...customResponses, [field.id]: e.target.value })}
                          required={field.required}
                          className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400"
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
                          className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg mt-6"
                style={{
                  background: submitting ? 'rgba(37,99,235,0.5)' : 'linear-gradient(135deg, #2563eb, #1e40af)',
                  border: 'none',
                }}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating Ticket Pass...</>
                ) : (
                  <><Ticket className="w-4 h-4" /> Register &amp; Download Ticket</>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
