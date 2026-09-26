import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Download,
  CheckCircle,
  Ticket,
  ArrowLeft,
  Loader2,
  CreditCard,
  Users,
  Plus,
  Trash2,
  ClipboardCheck,
  ExternalLink,
  MessageCircle,
  Sparkles,
  X,
  UploadCloud,
  Check,
  AlertCircle,
  Maximize2,
  Phone,
  User,
  RefreshCw,
} from 'lucide-react';
import { createRuleAgreement, getEvent, subscribeEventById, registerParticipantForEvent } from '../../services/eventService';
import type { EventRecord, EventTicket, TicketTier, TeamMemberDetail } from '../../types';
import { getEventCoordinators } from '../../types';
import { downloadTicketImage } from '../../utils/ticketDownload';
import { uploadFileToSupabase } from '../../utils/supabase';
import { compressPaymentProof } from '../../utils/imageOptimizer';
import { isValidRegistrationUrl } from '../../utils/urlValidation';
import QRCode from 'qrcode';
import EventBanner from '../../components/ui/EventBanner';

export default function EventRegisterPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState<EventTicket | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Form Fields
  const [teamName, setTeamName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [college, setCollege] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [customResponses, setCustomResponses] = useState<Record<string, string>>({});

  // Dynamic Registration Fields Configuration Helper
  const getEffectiveRegistrationFields = (evt: EventRecord | null) => ({
    name: {
      enabled: evt?.registrationFields?.name?.enabled ?? true,
      required: evt?.registrationFields?.name?.required ?? true,
      label: evt?.registrationFields?.name?.label?.trim() || 'Full Name',
    },
    email: {
      enabled: evt?.registrationFields?.email?.enabled ?? true,
      required: evt?.registrationFields?.email?.required ?? false,
      label: evt?.registrationFields?.email?.label?.trim() || 'Email Address',
    },
    phone: {
      enabled: evt?.registrationFields?.phone?.enabled ?? true,
      required: evt?.registrationFields?.phone?.required ?? false,
      label: evt?.registrationFields?.phone?.label?.trim() || 'Phone Number',
    },
    college: {
      enabled: evt?.registrationFields?.college?.enabled ?? true,
      required: evt?.registrationFields?.college?.required ?? false,
      label: evt?.registrationFields?.college?.label?.trim() || 'College',
    },
    department: {
      enabled: evt?.registrationFields?.department?.enabled ?? true,
      required: evt?.registrationFields?.department?.required ?? false,
      label: evt?.registrationFields?.department?.label?.trim() || 'Department',
    },
    year: {
      enabled: evt?.registrationFields?.year?.enabled ?? false,
      required: evt?.registrationFields?.year?.required ?? false,
      label: evt?.registrationFields?.year?.label?.trim() || 'Year of Study',
    },
  });

  // Payment Proof Fields
  const [paymentScreenshotFile, setPaymentScreenshotFile] = useState<File | null>(null);
  const [paymentScreenshotPreview, setPaymentScreenshotPreview] = useState<string | null>(null);
  const [paymentScreenshotError, setPaymentScreenshotError] = useState<string>('');
  const [paymentProofWarning, setPaymentProofWarning] = useState<string | null>(null);
  const [showFullQRModal, setShowFullQRModal] = useState(false);
  const [qrImageStatus, setQrImageStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [qrRetryCount, setQrRetryCount] = useState(0);

  // Tier selection & Team members
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<TeamMemberDetail[]>([]);
  const [error, setError] = useState('');
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [termsName, setTermsName] = useState('');
  const [termsEmail, setTermsEmail] = useState('');
  const [termsChecked, setTermsChecked] = useState(false);
  const [agreeingToTerms, setAgreeingToTerms] = useState(false);

  const ticketStorageKey = eventId ? `saint-event-ticket:${eventId}` : '';

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError('');

    // 1. Subscribe to real-time event updates
    const unsub = subscribeEventById(eventId, (e) => {
      if (e) {
        setEvent(e);
        setError('');
        if (e.registrationUrl && isValidRegistrationUrl(e.registrationUrl)) {
          window.location.replace(e.registrationUrl);
          return;
        }
        // Initialize tiers if available
        if (e.enableTieredTicketing && e.ticketTiers && e.ticketTiers.length > 0) {
          setSelectedTierId((prev) => prev || e.ticketTiers![0].id);
          const initialTeamSize = e.ticketTiers[0].teamSize || 1;
          if (initialTeamSize > 1) {
            setTeamMembers((prev) =>
              prev.length > 0
                ? prev
                : Array.from({ length: initialTeamSize - 1 }, () => ({
                  name: '', email: '', phone: '', college: '', department: '', year: '',
                }))
            );
          }
        } else if (e.teamsEnabled) {
          // Initialize default team members based on minTeamSize
          const minMembers = Math.max(1, (e.minTeamSize || 2) - 1);
          setTeamMembers((prev) =>
            prev.length > 0
              ? prev
              : Array.from({ length: minMembers }, () => ({
                name: '', email: '', phone: '', college: '', department: '', year: '',
              }))
          );
        }
        setLoading(false);
      } else {
        // Fallback: direct getEvent fetch with cache bypass
        getEvent(eventId, true)
          .then((directDoc) => {
            if (directDoc) {
              setEvent(directDoc);
              setError('');
              if (directDoc.registrationUrl && isValidRegistrationUrl(directDoc.registrationUrl)) {
                window.location.replace(directDoc.registrationUrl);
                return;
              }
            } else {
              setError('Event not found.');
            }
          })
          .catch(() => {
            setError('Event not found.');
          })
          .finally(() => {
            setLoading(false);
          });
      }
    });

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

    const storedAgreement = eventId ? sessionStorage.getItem(`saint-event-rules-agreed:${eventId}`) : null;
    if (storedAgreement) {
      try {
        const agreement = JSON.parse(storedAgreement) as { name?: string; email?: string };
        setTermsName(agreement.name || '');
        setTermsEmail(agreement.email || '');
        setName(agreement.name || '');
        setEmail(agreement.email || '');
        setRulesAccepted(true);
      } catch { sessionStorage.removeItem(`saint-event-rules-agreed:${eventId}`); }
    }

    return () => unsub();
  }, [eventId, ticketStorageKey]);

  const handleTierSelect = (tier: TicketTier) => {
    setSelectedTierId(tier.id);
    const size = tier.teamSize || 1;
    if (size > 1) {
      setTeamMembers((prev) => {
        const next: TeamMemberDetail[] = [];
        for (let i = 0; i < size - 1; i++) {
          next.push(prev[i] || { name: '', email: '', phone: '', college: '', department: '', year: '' });
        }
        return next;
      });
    } else {
      setTeamMembers([]);
    }
  };

  const handleAddTeammate = () => {
    const maxAllowed = (event?.maxTeamSize || 10) - 1;
    if (teamMembers.length >= maxAllowed) {
      setError(`Maximum team size is ${event?.maxTeamSize || 10} members (including leader).`);
      return;
    }
    setError('');
    setTeamMembers((prev) => [...prev, { name: '', email: '', phone: '', college: '', department: '', year: '' }]);
  };

  const handleRemoveTeammate = (index: number) => {
    const minRequired = Math.max(0, (event?.minTeamSize || 2) - 2);
    if (teamMembers.length <= minRequired) {
      setError(`Minimum team size is ${event?.minTeamSize || 2} members (including leader).`);
      return;
    }
    setError('');
    setTeamMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTeamMemberChange = (index: number, field: keyof TeamMemberDetail, value: string) => {
    setTeamMembers((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const selectedTier = event?.ticketTiers?.find((t) => t.id === selectedTierId);
  const isTeam = Boolean(event?.teamsEnabled) || Boolean(selectedTier && selectedTier.teamSize > 1);
  const activePaymentQR = selectedTier?.paymentQRUrl || event?.paymentQRUrl;
  const showPaymentQR = Boolean(event?.ticketingEnabled && activePaymentQR);

  useEffect(() => {
    setQrImageStatus('loading');
    setQrRetryCount(0);
  }, [activePaymentQR]);

  const handleQrError = () => {
    if (qrRetryCount < 2) {
      setTimeout(() => {
        setQrRetryCount((prev) => prev + 1);
        setQrImageStatus('loading');
      }, 800);
    } else {
      setQrImageStatus('error');
    }
  };

  const handleManualQrRetry = () => {
    setQrRetryCount((c) => c + 1);
    setQrImageStatus('loading');
  };

  const currentQrSrc = useMemo(() => {
    if (!activePaymentQR) return '';
    if (qrRetryCount === 0) return activePaymentQR;
    const sep = activePaymentQR.includes('?') ? '&' : '?';
    return `${activePaymentQR}${sep}retry=${qrRetryCount}`;
  }, [activePaymentQR, qrRetryCount]);

  // Clean up screenshot object URL on unmount or change
  useEffect(() => {
    return () => {
      if (paymentScreenshotPreview && paymentScreenshotPreview.startsWith('blob:')) {
        URL.revokeObjectURL(paymentScreenshotPreview);
      }
    };
  }, [paymentScreenshotPreview]);

  const handleScreenshotChange = (file: File | null) => {
    setPaymentScreenshotError('');
    if (!file) {
      if (paymentScreenshotPreview && paymentScreenshotPreview.startsWith('blob:')) {
        URL.revokeObjectURL(paymentScreenshotPreview);
      }
      setPaymentScreenshotFile(null);
      setPaymentScreenshotPreview(null);
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setPaymentScreenshotError('Please upload a valid image file (JPG, PNG, or WebP).');
      return;
    }

    const maxSizeBytes = 15 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setPaymentScreenshotError('Screenshot file size must be less than 15 MB.');
      return;
    }

    if (paymentScreenshotPreview && paymentScreenshotPreview.startsWith('blob:')) {
      URL.revokeObjectURL(paymentScreenshotPreview);
    }

    setPaymentScreenshotFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPaymentScreenshotPreview(objectUrl);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !eventId) return;
    if (event.status === 'cancelled' || event.status === 'completed') {
      setError('Registration is closed for this event.');
      return;
    }

    const regFieldsConfig = getEffectiveRegistrationFields(event);
    const guestName = name.trim();

    // 1. Dynamic validation for primary registrant
    if (regFieldsConfig.name.enabled && regFieldsConfig.name.required && !guestName) {
      setError('Please enter your full name.');
      return;
    }

    if (regFieldsConfig.email.enabled) {
      if (regFieldsConfig.email.required && !email.trim()) {
        setError('Please enter your email address.');
        return;
      }
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError('Please enter a valid email address.');
        return;
      }
    }

    if (regFieldsConfig.phone.enabled) {
      if (regFieldsConfig.phone.required && !phone.trim()) {
        setError('Please enter your phone number.');
        return;
      }
      if (phone.trim() && phone.trim().replace(/[^0-9]/g, '').length < 10) {
        setError('Please enter a valid 10-digit phone number.');
        return;
      }
    }

    if (regFieldsConfig.college.enabled && regFieldsConfig.college.required && !college.trim()) {
      setError('Please enter your college / institute name.');
      return;
    }

    if (regFieldsConfig.department.enabled && regFieldsConfig.department.required && !department.trim()) {
      setError('Please enter your department / branch.');
      return;
    }

    if (regFieldsConfig.year.enabled && regFieldsConfig.year.required && !year.trim()) {
      setError('Please select your year of study.');
      return;
    }

    if (isTeam && !teamName.trim()) {
      setError('Please enter your Team Name.');
      return;
    }

    // 2. Dynamic validation for team members if in team mode
    if (isTeam && teamMembers.length > 0) {
      for (let i = 0; i < teamMembers.length; i++) {
        const m = teamMembers[i];
        const num = i + 2;

        if (regFieldsConfig.name.enabled && regFieldsConfig.name.required && !m.name?.trim()) {
          setError(`Please enter the full name for Teammate #${num}.`);
          return;
        }

        if (regFieldsConfig.email.enabled) {
          if (regFieldsConfig.email.required && !m.email?.trim()) {
            setError(`Please enter the email address for Teammate #${num}.`);
            return;
          }
          if (m.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email.trim())) {
            setError(`Please enter a valid email address for Teammate #${num}.`);
            return;
          }
        }

        if (regFieldsConfig.phone.enabled) {
          if (regFieldsConfig.phone.required && !m.phone?.trim()) {
            setError(`Please enter the phone number for Teammate #${num}.`);
            return;
          }
          if (m.phone?.trim() && m.phone.trim().replace(/[^0-9]/g, '').length < 10) {
            setError(`Please enter a valid 10-digit phone number for Teammate #${num}.`);
            return;
          }
        }

        if (regFieldsConfig.college.enabled && regFieldsConfig.college.required && !m.college?.trim()) {
          setError(`Please enter the college name for Teammate #${num}.`);
          return;
        }

        if (regFieldsConfig.department.enabled && regFieldsConfig.department.required && !m.department?.trim()) {
          setError(`Please enter the department for Teammate #${num}.`);
          return;
        }

        if (regFieldsConfig.year.enabled && regFieldsConfig.year.required && !m.year?.trim()) {
          setError(`Please select the year of study for Teammate #${num}.`);
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

    // Validate payment fields if paid event
    if (showPaymentQR) {
      const cleanTxId = transactionId.trim();
      if (!cleanTxId) {
        setError('Please enter your UPI Transaction ID / UTR number.');
        return;
      }
      if (cleanTxId.length < 6) {
        setError('Please enter a valid UPI Transaction ID / UTR (at least 6 characters).');
        return;
      }
      if (!paymentScreenshotFile) {
        setError('Please upload your payment screenshot before submitting registration.');
        return;
      }
    }

    setSubmitting(true);
    setError('');
    try {
      let uploadedScreenshotUrl: string | undefined = undefined;
      let uploadedScreenshotPath: string | undefined = undefined;
      let uploadFailedNotice: string | null = null;

      if (showPaymentQR && paymentScreenshotFile) {
        try {
          const fileToUpload = await compressPaymentProof(paymentScreenshotFile);
          const cleanFileName = fileToUpload.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          uploadedScreenshotPath = `payment_proofs/${eventId}/${Date.now()}_${cleanFileName}`;
          uploadedScreenshotUrl = await uploadFileToSupabase(fileToUpload, uploadedScreenshotPath);
        } catch (uploadErr: any) {
          console.warn('[Payment] Screenshot upload failed, continuing registration with UTR:', uploadErr);
          uploadFailedNotice = "Payment proof couldn't be uploaded right now. You can continue registration, but you'll need to upload the payment proof later.";
        }
      }

      const finalCustomResponses = {
        ...customResponses,
        ...(isTeam && teamName.trim() ? { teamName: teamName.trim() } : {}),
      };

      const calculatedTeamSize = selectedTier
        ? selectedTier.teamSize
        : isTeam
          ? 1 + teamMembers.length
          : 1;

      console.log('[Ticket] Starting registration...', { eventId });
      const { ticket: newTicket } = await registerParticipantForEvent(eventId, {
        name: guestName,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        college: college.trim() || undefined,
        department: department.trim() || undefined,
        year: year.trim() || undefined,
        domain: event.participantDomains?.find((domain) => domain.id === selectedDomainId)?.name,
        domainId: selectedDomainId || undefined,
        tierId: selectedTier?.id,
        tierName: selectedTier?.name,
        teamSize: calculatedTeamSize,
        teamMembers: isTeam && teamMembers.length > 0 ? teamMembers : undefined,
        transactionId: showPaymentQR ? transactionId.trim() : (transactionId.trim() || undefined),
        paymentScreenshotUrl: uploadedScreenshotUrl,
        paymentScreenshotPath: uploadedScreenshotPath,
        paymentStatus: showPaymentQR ? 'pending' : undefined,
        customResponses: Object.keys(finalCustomResponses).length > 0 ? finalCustomResponses : undefined,
        registrationSource: 'public',
      });

      console.log('[Ticket] Registration successful:', newTicket);

      console.log('[Ticket] Generating QR...');
      const qr = await QRCode.toDataURL(newTicket.qrPayload, { width: 300, margin: 2 });
      if (uploadFailedNotice) {
        setPaymentProofWarning(uploadFailedNotice);
      }

      setTicket(newTicket);
      setQrDataUrl(qr);
      sessionStorage.setItem(ticketStorageKey, JSON.stringify(newTicket));
      sessionStorage.setItem('saint-participant-registration', JSON.stringify({
        name: newTicket.guestName,
        email: newTicket.guestEmail || '',
      }));

      console.log('[Ticket] Starting ticket download...');
      downloadTicketImage(event, newTicket, qr).catch((dlErr) => {
        console.warn('[Ticket] Auto download failed or skipped by browser:', dlErr);
      });
      console.log('[Ticket] Ticket download triggered');
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

  const handleAcceptRules = async () => {
    if (!eventId) return;
    if (!termsName.trim() || !termsEmail.trim()) {
      setError('Enter your name and email before accepting the rules.');
      return;
    }
    if (!termsChecked) {
      setError('You must agree to all rules and terms before registration.');
      return;
    }
    setAgreeingToTerms(true);
    setError('');
    try {
      let sessionId = '';
      try {
        sessionId = sessionStorage.getItem('saint-rule-session') || `rules_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        sessionStorage.setItem('saint-rule-session', sessionId);
      } catch { /* storage is optional for the audit record */ }
      await createRuleAgreement(eventId, { attendeeName: termsName, attendeeEmail: termsEmail, sessionId });
      const stored = { name: termsName.trim(), email: termsEmail.trim() };
      try { sessionStorage.setItem(`saint-event-rules-agreed:${eventId}`, JSON.stringify(stored)); } catch { /* consent remains valid for this visit */ }
      setName(stored.name);
      setEmail(stored.email);
      setRulesAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record your agreement. Please try again.');
    } finally { setAgreeingToTerms(false); }
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

  const registrationClosed = event.status === 'cancelled' || event.status === 'completed';
  const showDomainSelection = Boolean(event.enableDomainSelection && event.participantDomains?.length);

  // Applicable custom fields for this event & selected tier
  const applicableCustomFields = (event.customFields || []).filter(
    (f) => !f.tierId || f.tierId === selectedTierId
  );

  const regFieldsConfig = getEffectiveRegistrationFields(event);
  const coordinators = getEventCoordinators(event);

  const registrationBanner =
    (event.registrationBannerUrl && event.registrationBannerUrl.trim()) ||
    (event.imageURL && event.imageURL.trim()) ||
    ((event as any).bannerUrl && (event as any).bannerUrl.trim()) ||
    ((event as any).imageUrl && (event as any).imageUrl.trim()) ||
    null;
  const hasCustomBg = Boolean(event.registrationBackgroundUrl);

  return (
    <div className="min-h-screen relative text-white">
      {/* ── Fixed Full-Viewport Background Layer ────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        {hasCustomBg ? (
          <>
            <div
              className="w-full h-full bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${event.registrationBackgroundUrl})` }}
            />
            {/* Scrim overlay for high-contrast accessibility & readability */}
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[3px]" />
          </>
        ) : (
          <div
            className="w-full h-full"
            style={{ background: 'linear-gradient(135deg,#020617 0%,#0f172a 50%,#1e1b4b 100%)' }}
          >
            <div className="public-bg-blobs">
              <div className="public-liquid-blob-1" style={{ opacity: 0.7 }} />
              <div className="public-liquid-blob-2" style={{ opacity: 0.65 }} />
              <div className="public-liquid-blob-3" style={{ opacity: 0.55 }} />
            </div>
          </div>
        )}
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8 sm:py-12 min-h-screen flex flex-col justify-center">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link
            to={`/events/${eventId}`}
            className="inline-flex items-center gap-2 text-blue-300 hover:text-white text-xs sm:text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Event Details
          </Link>
          <Link
            to="/events"
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            All Events →
          </Link>
        </div>

        {/* Event Header Banner */}
        <div className="rounded-2xl overflow-hidden mb-6 shadow-2xl border" style={{
          background: 'rgba(15, 23, 42, 0.65)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(24px)',
        }}>
          {/* Standardized 16:9 Banner Image Container */}
          <EventBanner
            src={registrationBanner}
            alt={event.title}
            aspectRatioClass="aspect-video"
            maxHeightClass="max-h-[380px]"
            showOverlay={false}
            priority={true}
            fallbackIcon={<Ticket className="w-10 h-10 text-emerald-400/40" />}
          />
          <div className="p-5 sm:p-7">
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

            {/* Event Coordinators / Contact Persons */}
            {coordinators.length > 0 && (
              <div className="mt-5 pt-4 border-t border-white/10">
                <span className="text-xs font-semibold text-slate-400 block mb-2.5">
                  {coordinators.length === 1 ? 'Event Coordinator' : 'Event Coordinators'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {coordinators.map((coord, idx) => {
                    const cleanPhone = coord.phone.trim();
                    const dialUrl = `tel:${cleanPhone.replace(/\s+/g, '')}`;

                    return (
                      <div
                        key={coord.id || idx}
                        className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 transition-all"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-xs sm:text-sm font-bold text-white truncate block">
                              {coord.name}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 block pl-5">
                            {cleanPhone}
                          </span>
                        </div>
                        <a
                          href={dialUrl}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 transition-all shrink-0 cursor-pointer"
                          title={`Call ${coord.name}`}
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call</span>
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {ticket ? (
          /* ── Dedicated Registration Success State ─────────────────────── */
          <div className="rounded-3xl p-6 sm:p-9 text-center space-y-7 animate-fade-in-up shadow-2xl" style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            backdropFilter: 'blur(28px)',
          }}>
            {/* Header: Registration Successful */}
            <div className="space-y-3">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-scale-in"
                style={{ background: 'rgba(16, 185, 129, 0.15)', border: '2px solid rgba(16, 185, 129, 0.5)' }}
              >
                <CheckCircle className="w-9 h-9 text-emerald-400" />
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 inline-block mb-2">
                  Pass Confirmed &amp; Issued
                </span>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                  Registration Successful!
                </h2>
                <p className="text-sm sm:text-base mt-2 max-w-lg mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Welcome aboard, <strong className="text-white font-bold">{ticket.guestName}</strong>!
                  {ticket.tierName && <span className="text-blue-300"> ({ticket.tierName})</span>} Your official entry ticket pass is ready.
                </p>
              </div>
            </div>

            {/* Payment Proof Upload Notice (if upload failed during registration) */}
            {paymentProofWarning && (
              <div
                className="max-w-md mx-auto p-4 rounded-2xl text-left flex items-start gap-3 animate-fade-in"
                style={{
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                }}
              >
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                    Payment Proof Notice
                  </p>
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    {paymentProofWarning}
                  </p>
                  <p className="text-[11px] text-amber-300/70 pt-1">
                    You can upload the screenshot anytime from your Participant Dashboard under Registered Passes.
                  </p>
                </div>
              </div>
            )}

            {/* QR Code Presentation Box */}
            <div className="inline-block p-4 sm:p-5 bg-white rounded-3xl shadow-2xl transition-transform hover:scale-[1.02] duration-300">
              <img src={qrDataUrl} alt="Your Official Ticket QR" className="w-56 h-56 sm:w-64 sm:h-64 block" />
            </div>

            {/* Ticket Info Card */}
            <div
              className="rounded-2xl px-5 py-4 text-sm max-w-md mx-auto space-y-2 text-left"
              style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Pass Number:</span>
                <span className="text-white font-mono font-bold text-base px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/30">
                  {ticket.ticketNumber}
                </span>
              </div>
              {ticket.guestEmail && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                  <span className="text-slate-400">Email:</span>
                  <span className="text-slate-200 font-medium">{ticket.guestEmail}</span>
                </div>
              )}
              {ticket.teamName && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                  <span className="text-slate-400">Team:</span>
                  <span className="text-blue-300 font-semibold">{ticket.teamName}</span>
                </div>
              )}
              {ticket.teamMembers && ticket.teamMembers.length > 0 && (
                <div className="pt-2 border-t border-white/10 text-xs">
                  <span className="font-semibold text-blue-400 block mb-1">Registered Teammates:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ticket.teamMembers.map((m, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 text-[11px]">
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Download Ticket Action Button */}
            <div>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-white text-sm transition-all hover:opacity-95 hover:shadow-xl active:scale-[0.98] cursor-pointer shadow-lg shadow-blue-500/25 w-full sm:w-auto"
                style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
              >
                <Download className="w-4 h-4" />
                Download Ticket Image (.PNG)
              </button>
              <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Present this QR code on your phone at event check-in.
              </p>
            </div>

            {/* ── DOOMSDAY THEME PARTICIPANT PORTAL ONBOARDING CARD ───────────── */}
            <div
              className="rounded-3xl border border-blue-500/35 p-6 sm:p-7 max-w-xl mx-auto text-left shadow-2xl space-y-4"
              style={{
                background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(2, 6, 23, 0.98) 100%)',
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-blue-400 block">
                      Participant Portal Access
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                      Link &amp; Secure Pass #{ticket.ticketNumber}
                    </h3>
                  </div>
                </div>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  1-Click Setup
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Create a participant account to claim this pass. Your username and password keep your tickets, schedule, and team credentials organized in one central portal:
              </p>

              {/* Value proposition chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Instant offline QR pass access</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Real-time round &amp; venue alerts</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Manage team members &amp; roster</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Verified completion certificates</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/participant-auth?mode=signup')}
                  className="flex-1 py-3 px-6 rounded-xl font-bold text-white text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
                >
                  <Sparkles className="w-4 h-4" />
                  Create Participant Account →
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/participant-auth')}
                  className="py-3 px-4 rounded-xl font-semibold text-slate-300 hover:text-white text-xs sm:text-sm border border-slate-700/80 hover:bg-white/5 transition-all text-center cursor-pointer"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </div>

            {/* ── OFFICIAL WHATSAPP GROUP CTA (POST-REGISTRATION ONLY) ────── */}
            {event.whatsappGroupUrl && (
              <div
                className="rounded-3xl border border-emerald-500/35 p-5 sm:p-6 max-w-xl mx-auto text-left shadow-2xl space-y-4"
                style={{
                  background: 'linear-gradient(145deg, rgba(6, 78, 59, 0.25) 0%, rgba(2, 44, 34, 0.35) 100%)',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(52, 211, 153, 0.15)',
                }}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                      <MessageCircle className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-emerald-400 block">
                        Official Communications
                      </span>
                      <h4 className="text-base sm:text-lg font-bold text-white">
                        Join the Official WhatsApp Group
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Get live round schedules, venue announcements, and mentor updates.
                      </p>
                    </div>
                  </div>
                  <a
                    href={event.whatsappGroupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Join WhatsApp Group
                  </a>
                </div>
              </div>
            )}

            {/* Rulebook Download (if available) */}
            {event.rulebookUrl && (
              <div className="text-center pt-1">
                <a
                  href={event.rulebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-blue-300 hover:text-white px-4 py-2 rounded-xl border border-blue-500/20 hover:bg-blue-500/10 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View &amp; Download Official Event Rulebook
                </a>
              </div>
            )}
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
        ) : !rulesAccepted ? (
          <div className="rounded-2xl p-6 sm:p-8 space-y-6 animate-fade-in-up" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(59,130,246,0.3)', backdropFilter: 'blur(24px)' }}>
            <div className="text-center"><div className="w-14 h-14 rounded-2xl bg-blue-500/15 text-blue-300 grid place-items-center mx-auto mb-3"><ClipboardCheck className="w-7 h-7" /></div><h2 className="text-2xl font-bold text-white">Rules &amp; Terms</h2><p className="text-sm mt-2 text-slate-300">Review and accept the complete terms to unlock the registration form.</p></div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-5 max-h-96 overflow-y-auto text-sm text-slate-200 whitespace-pre-wrap leading-relaxed shadow-inner">
              {event.registrationTerms?.trim() ||
                (event.rules?.length
                  ? event.rules.join('\n\n')
                  : `1. Provide accurate registration details and carry your official QR entry pass to the event venue.\n2. Follow the published event schedule, venue safety instructions, and directions from the organizing committee.\n3. Maintain respectful and professional conduct throughout all event sessions, workshops, and competitions.\n4. The organizing team reserves the right to revoke passes or disqualify participants for misconduct or rule violations.`)}
            </div>
            {event.rulebookUrl && <a href={event.rulebookUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200"><ExternalLink className="w-4 h-4" /> Read the full rulebook</a>}
            {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
            <div className="grid sm:grid-cols-2 gap-4"><label className="text-sm text-slate-300">Full name<input value={termsName} onChange={(item) => setTermsName(item.target.value)} className="w-full mt-1.5 px-4 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400" placeholder="Your full name" /></label><label className="text-sm text-slate-300">Email address<input type="email" value={termsEmail} onChange={(item) => setTermsEmail(item.target.value)} className="w-full mt-1.5 px-4 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400" placeholder="you@example.com" /></label></div>
            <label className="flex items-start gap-3 rounded-xl border border-blue-400/20 bg-blue-500/5 p-4 cursor-pointer"><input type="checkbox" checked={termsChecked} onChange={(item) => setTermsChecked(item.target.checked)} className="mt-0.5 w-4 h-4 accent-blue-500" /><span className="text-sm text-slate-200">I agree to all rules, terms and conditions for <strong className="text-white">{event.title}</strong>.</span></label>
            <button onClick={handleAcceptRules} disabled={agreeingToTerms} className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>{agreeingToTerms ? <><Loader2 className="w-4 h-4 animate-spin" /> Recording agreement…</> : <><CheckCircle className="w-4 h-4" /> Agree & continue to registration</>}</button>
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
              {/* Team Name Field — shown for team events */}
              {(event.teamsEnabled || (selectedTier && selectedTier.teamSize > 1)) && (
                <div className="p-4 rounded-2xl border space-y-2" style={{ borderColor: 'rgba(59,130,246,0.25)', background: 'rgba(59,130,246,0.06)' }}>
                  <label className="block text-xs font-bold uppercase tracking-wider text-blue-300">
                    Team Name *
                  </label>
                  <input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="e.g. CyberKnights, CodeCrafters..."
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400"
                  />
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Pick a creative team name. This will appear on all your team's certificates.
                  </p>
                </div>
              )}

              {/* Leader / Primary Attendee */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  {selectedTier && selectedTier.teamSize > 1 ? 'Team Leader Details' : 'Attendee Information'}</p>

                {regFieldsConfig.name.enabled && (
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {regFieldsConfig.name.label} {regFieldsConfig.name.required ? '*' : '(Optional)'}
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={regFieldsConfig.name.required}
                      placeholder={`Enter your ${regFieldsConfig.name.label.toLowerCase()}`}
                      className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400"
                    />
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-3">
                  {regFieldsConfig.email.enabled && (
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {regFieldsConfig.email.label} {regFieldsConfig.email.required ? '*' : '(Optional)'}
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required={regFieldsConfig.email.required}
                        placeholder="your@email.com"
                        className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400"
                      />
                    </div>
                  )}

                  {regFieldsConfig.phone.enabled && (
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {regFieldsConfig.phone.label} {regFieldsConfig.phone.required ? '*' : '(Optional)'}
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required={regFieldsConfig.phone.required}
                        placeholder="10-digit number"
                        className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400"
                      />
                    </div>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {regFieldsConfig.college.enabled && (
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {regFieldsConfig.college.label} {regFieldsConfig.college.required ? '*' : '(Optional)'}
                      </label>
                      <input
                        value={college}
                        onChange={(e) => setCollege(e.target.value)}
                        required={regFieldsConfig.college.required}
                        placeholder="e.g. JSPM RSCOE"
                        className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400"
                      />
                    </div>
                  )}

                  {regFieldsConfig.department.enabled && (
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {regFieldsConfig.department.label} {regFieldsConfig.department.required ? '*' : '(Optional)'}
                      </label>
                      <input
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        required={regFieldsConfig.department.required}
                        placeholder="e.g. IT"
                        className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400"
                      />
                    </div>
                  )}
                </div>

                {regFieldsConfig.year.enabled && (
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {regFieldsConfig.year.label} {regFieldsConfig.year.required ? '*' : '(Optional)'}
                    </label>
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      required={regFieldsConfig.year.required}
                      className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-slate-900 border border-white/15 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 cursor-pointer"
                      style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                    >
                      <option value="" style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>Select {regFieldsConfig.year.label}</option>
                      <option value="1st Year" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>1st Year</option>
                      <option value="2nd Year" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>2nd Year</option>
                      <option value="3rd Year" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>3rd Year</option>
                      <option value="4th Year" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>4th Year</option>
                      <option value="Postgraduate" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>Postgraduate (PG)</option>
                      <option value="Other" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>Other</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Teammates fields for Team Events */}
              {isTeam && (
                <div className="space-y-4 pt-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                      <Users className="w-4 h-4" /> Teammates ({teamMembers.length + 1} Total Members)
                    </p>
                    {!selectedTier && (
                      <button
                        type="button"
                        onClick={handleAddTeammate}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold text-blue-300 border border-blue-400/30 hover:bg-blue-500/10 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Teammate
                      </button>
                    )}
                  </div>

                  {teamMembers.map((member, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                          Teammate #{idx + 2} Details
                        </span>
                        {!selectedTier && teamMembers.length > Math.max(0, (event.minTeamSize || 2) - 1) && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTeammate(idx)}
                            className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        )}
                      </div>

                      {regFieldsConfig.name.enabled && (
                        <div>
                          <label className="block text-xs font-semibold mb-1 text-slate-300">
                            {regFieldsConfig.name.label} {regFieldsConfig.name.required ? '*' : '(Optional)'}
                          </label>
                          <input
                            value={member.name}
                            onChange={(e) => handleTeamMemberChange(idx, 'name', e.target.value)}
                            required={regFieldsConfig.name.required}
                            placeholder={`${regFieldsConfig.name.label} for teammate #${idx + 2}`}
                            className="w-full px-4 py-2 rounded-xl text-xs text-white bg-white/5 border border-white/10 outline-none focus:border-indigo-400"
                          />
                        </div>
                      )}

                      <div className="grid sm:grid-cols-2 gap-3">
                        {regFieldsConfig.email.enabled && (
                          <div>
                            <label className="block text-xs font-semibold mb-1 text-slate-300">
                              {regFieldsConfig.email.label} {regFieldsConfig.email.required ? '*' : '(Optional)'}
                            </label>
                            <input
                              type="email"
                              value={member.email || ''}
                              onChange={(e) => handleTeamMemberChange(idx, 'email', e.target.value)}
                              required={regFieldsConfig.email.required}
                              placeholder="teammate@email.com"
                              className="w-full px-4 py-2 rounded-xl text-xs text-white bg-white/5 border border-white/10 outline-none focus:border-indigo-400"
                            />
                          </div>
                        )}
                        {regFieldsConfig.phone.enabled && (
                          <div>
                            <label className="block text-xs font-semibold mb-1 text-slate-300">
                              {regFieldsConfig.phone.label} {regFieldsConfig.phone.required ? '*' : '(Optional)'}
                            </label>
                            <input
                              type="tel"
                              value={member.phone || ''}
                              onChange={(e) => handleTeamMemberChange(idx, 'phone', e.target.value)}
                              required={regFieldsConfig.phone.required}
                              placeholder="10-digit number"
                              className="w-full px-4 py-2 rounded-xl text-xs text-white bg-white/5 border border-white/10 outline-none focus:border-indigo-400"
                            />
                          </div>
                        )}
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        {regFieldsConfig.college.enabled && (
                          <div>
                            <label className="block text-xs font-semibold mb-1 text-slate-300">
                              {regFieldsConfig.college.label} {regFieldsConfig.college.required ? '*' : '(Optional)'}
                            </label>
                            <input
                              value={member.college || ''}
                              onChange={(e) => handleTeamMemberChange(idx, 'college', e.target.value)}
                              required={regFieldsConfig.college.required}
                              placeholder="e.g. JSPM RSCOE"
                              className="w-full px-4 py-2 rounded-xl text-xs text-white bg-white/5 border border-white/10 outline-none focus:border-indigo-400"
                            />
                          </div>
                        )}
                        {regFieldsConfig.department.enabled && (
                          <div>
                            <label className="block text-xs font-semibold mb-1 text-slate-300">
                              {regFieldsConfig.department.label} {regFieldsConfig.department.required ? '*' : '(Optional)'}
                            </label>
                            <input
                              value={member.department || ''}
                              onChange={(e) => handleTeamMemberChange(idx, 'department', e.target.value)}
                              required={regFieldsConfig.department.required}
                              placeholder="e.g. IT"
                              className="w-full px-4 py-2 rounded-xl text-xs text-white bg-white/5 border border-white/10 outline-none focus:border-indigo-400"
                            />
                          </div>
                        )}
                      </div>

                      {regFieldsConfig.year.enabled && (
                        <div>
                          <label className="block text-xs font-semibold mb-1 text-slate-300">
                            {regFieldsConfig.year.label} {regFieldsConfig.year.required ? '*' : '(Optional)'}
                          </label>
                          <select
                            value={member.year || ''}
                            onChange={(e) => handleTeamMemberChange(idx, 'year', e.target.value)}
                            required={regFieldsConfig.year.required}
                            className="w-full px-4 py-2 rounded-xl text-xs text-white bg-slate-900 border border-white/15 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                            style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                          >
                            <option value="" style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>Select {regFieldsConfig.year.label}</option>
                            <option value="1st Year" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>1st Year</option>
                            <option value="2nd Year" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>2nd Year</option>
                            <option value="3rd Year" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>3rd Year</option>
                            <option value="4th Year" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>4th Year</option>
                            <option value="Postgraduate" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>Postgraduate (PG)</option>
                            <option value="Other" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>Other</option>
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* --- ENLARGED PAYMENT QR & PROOF SECTION --- */}
              {showPaymentQR && (
                <div
                  className="rounded-2xl border p-5 sm:p-6 space-y-6 animate-fade-in-up my-4"
                  style={{
                    borderColor: 'rgba(59,130,246,0.35)',
                    background: 'linear-gradient(180deg, rgba(30,58,138,0.2) 0%, rgba(15,23,42,0.35) 100%)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  {/* Header & Pricing */}
                  <div className="text-center space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-500/30">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Registration Payment</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 justify-center flex-wrap">
                        Scan QR &amp; Pay via UPI
                        {selectedTier?.price !== undefined && (
                          <span className="text-emerald-400 font-mono font-extrabold px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm sm:text-base">
                            ₹{selectedTier.price}
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-300 max-w-md mt-1">
                        Scan via Google Pay, PhonePe, Paytm, BHIM, or any UPI banking app. After payment, upload your payment screenshot and enter your transaction ID below.
                      </p>
                    </div>
                  </div>

                  {/* High-Resolution Noticeably Larger QR Display */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="relative group p-3.5 sm:p-4 bg-white rounded-2xl shadow-2xl border border-blue-200/50 flex flex-col items-center max-w-full">
                      {/* Loading State Skeleton */}
                      {qrImageStatus === 'loading' && (
                        <div className="w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 max-w-full aspect-square rounded-xl bg-slate-50 flex flex-col items-center justify-center p-6 text-center animate-pulse">
                          <Loader2 className="w-9 h-9 text-blue-600 animate-spin mb-3" />
                          <p className="text-xs font-bold text-slate-800 tracking-wide uppercase">Loading Payment QR</p>
                          <p className="text-[11px] text-slate-500 mt-1">Fetching UPI code...</p>
                        </div>
                      )}

                      {/* Error State */}
                      {qrImageStatus === 'error' && (
                        <div className="w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 max-w-full aspect-square rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center p-5 text-center">
                          <AlertCircle className="w-9 h-9 text-amber-500 mb-2" />
                          <p className="text-xs font-bold text-slate-800">QR Code Failed to Display</p>
                          <p className="text-[11px] text-slate-500 mt-1 mb-3.5 max-w-[210px] leading-relaxed">
                            Ad-blocker or network restrictions might be blocking the storage image.
                          </p>
                          <div className="flex flex-wrap gap-2 justify-center">
                            <button
                              type="button"
                              onClick={handleManualQrRetry}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" /> Retry
                            </button>
                            {activePaymentQR && (
                              <a
                                href={activePaymentQR}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" /> Open QR
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      <img
                        src={currentQrSrc}
                        alt="UPI Payment QR Code"
                        loading="eager"
                        decoding="async"
                        onLoad={() => setQrImageStatus('loaded')}
                        onError={handleQrError}
                        className={`w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 max-w-full aspect-square rounded-xl object-contain ${
                          qrImageStatus === 'loaded' ? 'block' : 'hidden'
                        }`}
                        style={{ imageRendering: 'crisp-edges' }}
                      />

                      {qrImageStatus === 'loaded' && (
                        <div className="mt-2.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowFullQRModal(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                            title="Enlarge QR Code"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>Tap to enlarge QR</span>
                          </button>
                          {activePaymentQR && (
                            <a
                              href={activePaymentQR}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                              title="Open QR in new tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open QR</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-400" />
                      Sharp, high-resolution QR code. Easy to scan on any phone.
                    </span>
                  </div>

                  {/* Payment Screenshot Upload & Preview */}
                  <div className="space-y-3 pt-4 border-t border-white/10 text-left">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-blue-300">
                        Upload Payment Screenshot *
                      </label>
                      <span className="text-[11px] text-slate-400">JPG, PNG, WebP (15 MB maximum)</span>
                    </div>

                    {!paymentScreenshotPreview ? (
                      <label className="border-2 border-dashed border-blue-400/30 hover:border-blue-400 rounded-2xl p-5 sm:p-6 flex flex-col items-center justify-center cursor-pointer transition-all bg-white/[0.02] hover:bg-white/[0.05] group">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleScreenshotChange(e.target.files[0]);
                            }
                          }}
                        />
                        <div className="w-12 h-12 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                          <UploadCloud className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors text-center">
                          Click or tap to upload payment screenshot
                        </p>
                        <p className="text-xs text-slate-400 mt-1 text-center">
                          Upload your successful payment screen showing Amount &amp; UPI Ref / UTR
                        </p>
                      </label>
                    ) : (
                      <div className="p-3.5 rounded-2xl bg-black/40 border border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-black/50">
                            <img
                              src={paymentScreenshotPreview}
                              alt="Payment Screenshot Preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white truncate">
                              {paymentScreenshotFile?.name || 'Payment_Screenshot.png'}
                            </p>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">
                              {paymentScreenshotFile ? `${(paymentScreenshotFile.size / (1024 * 1024)).toFixed(2)} MB` : ''}
                            </p>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 mt-1">
                              <Check className="w-3 h-3" /> Ready to submit
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <label className="px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-300 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/30 cursor-pointer transition-colors">
                            Change
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleScreenshotChange(e.target.files[0]);
                                }
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => handleScreenshotChange(null)}
                            className="p-1.5 rounded-xl text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                            title="Remove screenshot"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {paymentScreenshotError && (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium text-red-300 bg-red-500/10 border border-red-500/20">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                        <span>{paymentScreenshotError}</span>
                      </div>
                    )}
                  </div>

                  {/* Required UPI Transaction ID / UTR Input */}
                  <div className="space-y-1.5 pt-4 border-t border-white/10 text-left">
                    <label className="block text-xs font-bold uppercase tracking-wider text-blue-300">
                      UPI Transaction ID / UTR *
                    </label>
                    <input
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="e.g. 425612349870 or UPI Ref ID"
                      required
                      className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400 font-mono tracking-wider uppercase"
                    />
                    <p className="text-[11px] text-slate-400">
                      Enter the 12-digit UTR number or UPI transaction reference from your payment confirmation screen.
                    </p>
                  </div>
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
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-slate-900 border border-white/15 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 cursor-pointer"
                    style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                  >
                    <option value="" style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>Choose a domain</option>
                    {event.participantDomains?.map((domain) => (
                      <option key={domain.id} value={domain.id} style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>{domain.name}</option>
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
                          className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-slate-900 border border-white/15 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 cursor-pointer"
                          style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                        >
                          <option value="" style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>Select {field.label}...</option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt} style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>{opt}</option>
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
                  <><Loader2 className="w-4 h-4 animate-spin" /> {paymentScreenshotFile ? 'Uploading Proof & Generating Ticket Pass...' : 'Generating Ticket Pass...'}</>
                ) : (
                  <><Ticket className="w-4 h-4" /> Register &amp; Download Ticket</>
                )}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Full Screen / Enlarged Payment QR Modal */}
      {showFullQRModal && activePaymentQR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowFullQRModal(false)}
        >
          <div
            className="relative bg-slate-900 border border-slate-700/70 rounded-3xl p-6 sm:p-8 max-w-sm sm:max-w-md w-full text-center shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowFullQRModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white flex items-center justify-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-400" />
                UPI Payment QR Code
              </h3>
              {selectedTier?.price !== undefined && (
                <p className="text-sm font-bold text-emerald-400 font-mono">
                  Amount: ₹{selectedTier.price}
                </p>
              )}
            </div>
            <div className="p-4 bg-white rounded-2xl inline-block shadow-xl mx-auto max-w-full">
              {/* Loading State Skeleton */}
              {qrImageStatus === 'loading' && (
                <div className="w-72 h-72 sm:w-80 sm:h-80 max-w-full aspect-square rounded-xl bg-slate-50 flex flex-col items-center justify-center p-6 text-center animate-pulse">
                  <Loader2 className="w-9 h-9 text-blue-600 animate-spin mb-3" />
                  <p className="text-xs font-bold text-slate-800 tracking-wide uppercase">Loading Payment QR</p>
                  <p className="text-[11px] text-slate-500 mt-1">Fetching UPI code...</p>
                </div>
              )}

              {/* Error State */}
              {qrImageStatus === 'error' && (
                <div className="w-72 h-72 sm:w-80 sm:h-80 max-w-full aspect-square rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center p-5 text-center">
                  <AlertCircle className="w-9 h-9 text-amber-500 mb-2" />
                  <p className="text-xs font-bold text-slate-800">QR Code Failed to Display</p>
                  <p className="text-[11px] text-slate-500 mt-1 mb-3.5 max-w-[210px] leading-relaxed">
                    Ad-blocker or network restrictions might be blocking the storage image.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      type="button"
                      onClick={handleManualQrRetry}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Retry
                    </button>
                    {activePaymentQR && (
                      <a
                        href={activePaymentQR}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Open QR
                      </a>
                    )}
                  </div>
                </div>
              )}

              <img
                src={currentQrSrc}
                alt="Enlarged Payment QR"
                loading="eager"
                decoding="async"
                onLoad={() => setQrImageStatus('loaded')}
                onError={handleQrError}
                className={`w-72 h-72 sm:w-80 sm:h-80 max-w-full aspect-square object-contain mx-auto ${
                  qrImageStatus === 'loaded' ? 'block' : 'hidden'
                }`}
                style={{ imageRendering: 'crisp-edges' }}
              />
            </div>
            {activePaymentQR && (
              <div className="flex items-center justify-center">
                <a
                  href={activePaymentQR}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Direct QR Link</span>
                </a>
              </div>
            )}
            <p className="text-xs text-slate-300">
              Scan with GPay, PhonePe, Paytm, BHIM, or any UPI app. Tap outside or close to return.
            </p>
          </div>
        </div>
      )}


    </div>
  );
}
