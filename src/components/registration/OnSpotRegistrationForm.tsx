import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Download,
  Users,
  User,
  Phone,
  Mail,
  GraduationCap,
  Sparkles,
  RefreshCw,
  Plus,
  Copy,
  Check,
  CreditCard,
  Banknote,
  Search,
  X,
  Eye,
  ArrowRight,
  ShieldCheck,
  Lock,
  Upload,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  getEvents,
  subscribeEventById,
  registerParticipantForEvent,
  checkExistingRegistration,
  setEventOnSpotStatus,
  type DuplicateCheckResult,
} from '../../services/eventService';
import type { EventRecord, EventTicket, TicketTier, TeamMemberDetail, EventParticipant } from '../../types';
import QRCode from 'qrcode';
import { downloadTicketImage } from '../../utils/ticketDownload';
import { uploadFileToSupabase } from '../../utils/supabase';
import { compressPaymentProof } from '../../utils/imageOptimizer';

export interface OnSpotRegistrationFormProps {
  mode: 'participant' | 'admin';
  initialEventId?: string;
  onSuccess?: (ticket: EventTicket, participant: EventParticipant) => void;
  showHeader?: boolean;
}

export default function OnSpotRegistrationForm({
  mode,
  initialEventId,
  onSuccess,
  showHeader = true,
}: OnSpotRegistrationFormProps) {
  const { showToast } = useToast();
  const { profile, user } = useAuth();

  // Event selection state
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId || '');
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [loadingEvent, setLoadingEvent] = useState<boolean>(Boolean(initialEventId));
  const [eventsList, setEventsList] = useState<EventRecord[]>([]);
  const [loadingEventsList, setLoadingEventsList] = useState(false);
  const [eventSearchQuery, setEventSearchQuery] = useState('');

  // Keep selectedEventId synchronized with initialEventId prop
  useEffect(() => {
    if (initialEventId && initialEventId !== selectedEventId) {
      setSelectedEventId(initialEventId);
    }
  }, [initialEventId, selectedEventId]);

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [college, setCollege] = useState('');
  const [participationType, setParticipationType] = useState<'solo' | 'team'>('solo');
  const [selectedTeamSize, setSelectedTeamSize] = useState<number>(2);
  const [teamName, setTeamName] = useState('');
  const [teamMemberNames, setTeamMemberNames] = useState<string[]>(['']);

  // Payment state
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState<string>('');
  const [adminPaymentVerified, setAdminPaymentVerified] = useState<boolean>(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // Submission & Validation state
  const [submitting, setSubmitting] = useState(false);
  const [enablingOnSpot, setEnablingOnSpot] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Duplicate Check state
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateCheckResult | null>(null);

  // Success Confirmation state
  const [registeredTicket, setRegisteredTicket] = useState<EventTicket | null>(null);
  const [ticketQrDataUrl, setTicketQrDataUrl] = useState<string>('');

  // Venue QR modal (for admin to display desk QR)
  const [showVenueQRModal, setShowVenueQRModal] = useState(false);
  const [venueQrDataUrl, setVenueQrDataUrl] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState(false);

  // Input ref for quick focus
  const nameInputRef = useRef<HTMLInputElement>(null);

  // 1. Load Events list only if no specific event is locked, or in admin mode
  useEffect(() => {
    let isMounted = true;
    async function loadEvents() {
      if (initialEventId && mode === 'participant') {
        return; // Fast path: skip full catalogue fetch on mobile if event is pre-selected
      }
      setLoadingEventsList(true);
      try {
        const all = await getEvents();
        if (isMounted) {
          const active = all.filter((ev) => ev.status === 'published');
          setEventsList(active);
        }
      } catch (err) {
        console.error('Failed to load events for on-spot:', err);
      } finally {
        if (isMounted) setLoadingEventsList(false);
      }
    }
    loadEvents();
    return () => {
      isMounted = false;
    };
  }, [initialEventId, mode]);

  // 2. Load or Subscribe to Selected Event
  useEffect(() => {
    if (!selectedEventId) {
      setEvent(null);
      setLoadingEvent(false);
      return;
    }

    setLoadingEvent(true);
    const unsub = subscribeEventById(selectedEventId, (ev) => {
      setEvent(ev);
      setLoadingEvent(false);
    });

    return () => unsub();
  }, [selectedEventId]);

  // Derive Team & Solo capabilities for selected event
  const eventCapabilities = useMemo(() => {
    if (!event) {
      return {
        supportsSolo: true,
        supportsTeam: false,
        availableTeamSizes: [1],
        defaultType: 'solo' as const,
        tiers: [],
      };
    }

    const tiers = event.ticketTiers || [];
    const sizes = new Set<number>();

    if (Array.isArray(event.allowedTeamSizes)) {
      event.allowedTeamSizes.forEach((s) => s > 0 && sizes.add(s));
    }
    tiers.forEach((t) => t.teamSize > 0 && sizes.add(t.teamSize));

    if (
      typeof event.minTeamSize === 'number' &&
      typeof event.maxTeamSize === 'number' &&
      event.minTeamSize > 0 &&
      event.maxTeamSize >= event.minTeamSize
    ) {
      for (let s = event.minTeamSize; s <= event.maxTeamSize; s++) sizes.add(s);
    } else if (typeof event.minTeamSize === 'number' && event.minTeamSize > 0) {
      sizes.add(event.minTeamSize);
    } else if (typeof event.maxTeamSize === 'number' && event.maxTeamSize > 0) {
      sizes.add(event.maxTeamSize);
    }

    if (event.teamsEnabled && sizes.size === 0) {
      sizes.add(1);
      sizes.add(2);
      sizes.add(3);
      sizes.add(4);
    }

    if (sizes.size === 0) {
      sizes.add(1);
    }

    const sortedSizes = Array.from(sizes).sort((a, b) => a - b);
    const supportsSolo = sortedSizes.includes(1);
    const teamSizes = sortedSizes.filter((s) => s > 1);
    const supportsTeam = Boolean(event.teamsEnabled) || teamSizes.length > 0;

    let defaultType: 'solo' | 'team' = 'solo';
    if (!supportsSolo && supportsTeam) defaultType = 'team';
    else if (supportsSolo && !supportsTeam) defaultType = 'solo';

    return {
      supportsSolo,
      supportsTeam,
      availableTeamSizes: teamSizes.length > 0 ? teamSizes : [2, 3, 4],
      defaultType,
      tiers,
    };
  }, [event]);

  // Adjust participationType and selectedTeamSize when capabilities change
  useEffect(() => {
    if (eventCapabilities.supportsSolo && !eventCapabilities.supportsTeam) {
      setParticipationType('solo');
    } else if (!eventCapabilities.supportsSolo && eventCapabilities.supportsTeam) {
      setParticipationType('team');
      if (eventCapabilities.availableTeamSizes.length > 0) {
        setSelectedTeamSize(eventCapabilities.availableTeamSizes[0]);
      }
    } else {
      setParticipationType(eventCapabilities.defaultType);
      if (eventCapabilities.availableTeamSizes.length > 0) {
        setSelectedTeamSize(eventCapabilities.availableTeamSizes[0]);
      }
    }
  }, [eventCapabilities]);

  // Synchronize team member name inputs with selected team size (teamSize - 1 member fields)
  useEffect(() => {
    if (participationType === 'team') {
      const requiredMembersCount = Math.max(1, selectedTeamSize - 1);
      setTeamMemberNames((prev) => {
        const next = [...prev];
        while (next.length < requiredMembersCount) next.push('');
        return next.slice(0, requiredMembersCount);
      });
    } else {
      setTeamMemberNames([]);
    }
  }, [participationType, selectedTeamSize]);

  // Auto-calculated Fee and Active Payment QR
  const pricingInfo = useMemo(() => {
    if (!event || event.ticketingEnabled === false) {
      return { isFree: true, fee: 0, paymentQR: undefined, tier: null };
    }

    const tiers = event.ticketTiers || [];
    let matchingTier: TicketTier | undefined = undefined;

    if (participationType === 'solo') {
      matchingTier = tiers.find((t) => t.teamSize === 1);
    } else {
      matchingTier =
        tiers.find((t) => t.teamSize === selectedTeamSize) ||
        tiers.find((t) => t.teamSize > 1);
    }

    const fee = matchingTier?.price ?? (tiers.length === 1 ? tiers[0].price ?? 0 : 0);
    const paymentQR = matchingTier?.paymentQRUrl || event.paymentQRUrl;
    const isFree = fee === 0 || (!fee && !paymentQR);

    return {
      isFree,
      fee,
      paymentQR,
      tier: matchingTier || null,
    };
  }, [event, participationType, selectedTeamSize]);

  // Generate Venue QR code for Desk sharing
  useEffect(() => {
    if (!selectedEventId || typeof window === 'undefined') return;
    const venueUrl = `${window.location.origin}/events/${selectedEventId}/on-spot`;
    QRCode.toDataURL(venueUrl, { width: 320, margin: 2 })
      .then(setVenueQrDataUrl)
      .catch((e) => console.warn('Failed to generate venue QR:', e));
  }, [selectedEventId]);

  // Real-time Duplicate Check on Phone or Email change
  const handleCheckDuplicate = async () => {
    if (!selectedEventId) return;
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const cleanEmail = email.trim().toLowerCase();

    if (cleanPhone.length < 10 && !cleanEmail.includes('@')) {
      setDuplicateInfo(null);
      return;
    }

    try {
      const result = await checkExistingRegistration(selectedEventId, cleanPhone, cleanEmail);
      if (result.isDuplicate) {
        setDuplicateInfo(result);
      } else {
        setDuplicateInfo(null);
      }
    } catch (e) {
      console.warn('Duplicate check warning:', e);
    }
  };

  // Proof Image Upload Handler
  const handleProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file', 'error');
      return;
    }

    setPaymentProofFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPaymentProofPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Form Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!selectedEventId || !event) {
      errors.event = 'Please select an event.';
    }

    if (!name.trim()) {
      errors.name = 'Full name is required.';
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) {
      errors.phone = 'Phone number is required.';
    } else if (cleanPhone.length < 10) {
      errors.phone = 'Enter a valid 10-digit mobile number.';
    }

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = 'Enter a valid email address.';
    }

    if (!college.trim()) {
      errors.college = 'College name is required.';
    }

    if (participationType === 'team') {
      teamMemberNames.forEach((memberName, idx) => {
        if (!memberName.trim()) {
          errors[`member_${idx}`] = `Member #${idx + 2} name is required.`;
        }
      });
    }

    if (!pricingInfo.isFree) {
      if (mode === 'admin') {
        if (!adminPaymentVerified) {
          errors.payment = 'Please verify that payment has been received at the venue.';
        }
      } else {
        // Participant mode requires payment proof screenshot
        if (!paymentProofFile) {
          errors.paymentProof = 'Payment screenshot/image is required.';
        }
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submission Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    if (!event || !selectedEventId) return;

    // Duplicate protection check
    setSubmitting(true);
    try {
      const dup = await checkExistingRegistration(
        selectedEventId,
        phone.replace(/\D/g, '').slice(-10),
        email.trim().toLowerCase()
      );

      if (dup.isDuplicate) {
        setDuplicateInfo(dup);
        showToast('This participant is already registered for this event.', 'error');
        setSubmitting(false);
        return;
      }

      // Handle payment screenshot upload if present (participant flow)
      let uploadedScreenshotUrl: string | undefined = undefined;
      let uploadedScreenshotPath: string | undefined = undefined;

      if (paymentProofFile) {
        try {
          const compressed = await compressPaymentProof(paymentProofFile);
          const cleanName = compressed.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          uploadedScreenshotPath = `payment_proofs/${selectedEventId}/${Date.now()}_${cleanName}`;
          uploadedScreenshotUrl = await uploadFileToSupabase(compressed, uploadedScreenshotPath);
        } catch (upErr) {
          console.warn('Payment screenshot upload failed, continuing with UTR:', upErr);
        }
      }

      // Determine payment status and verification
      const effectivePaymentStatus: 'verified' | 'pending' | undefined = pricingInfo.isFree
        ? undefined
        : mode === 'admin'
        ? 'verified'
        : 'pending';

      const effectivePaymentVerifiedAt =
        mode === 'admin' && !pricingInfo.isFree ? new Date().toISOString() : undefined;
      const effectivePaymentVerifiedBy =
        mode === 'admin' && !pricingInfo.isFree
          ? (profile?.displayName || profile?.firstName || user?.email || 'Coordinator')
          : undefined;

      const effectiveTransactionId =
        mode === 'admin' && !pricingInfo.isFree
          ? `VENUE_VERIFIED_${Date.now()}`
          : undefined;

      // Construct team members list with names only
      const teamMembersPayload: TeamMemberDetail[] =
        participationType === 'team'
          ? teamMemberNames.map((mName) => ({
              name: mName.trim(),
            }))
          : [];

      const effectiveTeamSize = participationType === 'team' ? selectedTeamSize : 1;
      const effectiveTeamName =
        participationType === 'team'
          ? (teamName.trim() || `Team ${name.trim()}`)
          : undefined;

      const { ticket: newTicket, participant: newParticipant } = await registerParticipantForEvent(
        selectedEventId,
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          college: college.trim(),
          teamSize: effectiveTeamSize,
          teamMembers: teamMembersPayload.length > 0 ? teamMembersPayload : undefined,
          tierId: pricingInfo.tier?.id,
          tierName: pricingInfo.tier?.name,
          transactionId: effectiveTransactionId,
          paymentScreenshotUrl: uploadedScreenshotUrl,
          paymentScreenshotPath: uploadedScreenshotPath,
          paymentStatus: effectivePaymentStatus,
          paymentVerifiedAt: effectivePaymentVerifiedAt,
          paymentVerifiedBy: effectivePaymentVerifiedBy,
          registrationSource: mode === 'admin' ? 'manual' : 'public',
          registrationType: 'onspot',
          registrationMode: mode,
          customResponses: effectiveTeamName ? { teamName: effectiveTeamName } : undefined,
        }
      );

      // Generate Ticket QR code
      const qrUrl = await QRCode.toDataURL(newTicket.qrPayload, { width: 300, margin: 2 });
      setRegisteredTicket(newTicket);
      setTicketQrDataUrl(qrUrl);

      showToast('On-Spot Registration Successful! 🎉', 'success');
      if (onSuccess) {
        onSuccess(newTicket, newParticipant);
      }
    } catch (err: any) {
      console.error('Registration failed:', err);
      showToast(err?.message || 'Failed to complete registration. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset form to register another participant while PRESERVING current event
  const handleRegisterAnother = () => {
    setName('');
    setPhone('');
    setEmail('');
    setCollege('');
    setTeamName('');
    setTeamMemberNames(['']);
    setPaymentProofFile(null);
    setPaymentProofPreview('');
    setAdminPaymentVerified(false);
    setFormErrors({});
    setDuplicateInfo(null);
    setRegisteredTicket(null);
    setTicketQrDataUrl('');

    // Focus back on Name input
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 100);
  };

  // Copy Venue Link
  const handleCopyVenueLink = () => {
    if (!selectedEventId) return;
    const url = `${window.location.origin}/events/${selectedEventId}/on-spot`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    showToast('Venue on-spot registration link copied to clipboard!', 'success');
    setTimeout(() => setLinkCopied(false), 2500);
  };

  // Turn On-Spot ON directly from the admin desk if selected event has it OFF
  const handleEnableOnSpotForEvent = async () => {
    if (!event) return;
    setEnablingOnSpot(true);
    try {
      await setEventOnSpotStatus(event.id, true);
      setEvent({ ...event, onSpotRegistrationOpen: true });
      showToast(`On-Spot Registration enabled for ${event.title}!`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to enable On-Spot registration', 'error');
    } finally {
      setEnablingOnSpot(false);
    }
  };

  // Filtered events for selector
  const filteredEvents = useMemo(() => {
    if (!eventSearchQuery.trim()) return eventsList;
    const q = eventSearchQuery.toLowerCase();
    return eventsList.filter(
      (ev) =>
        ev.title.toLowerCase().includes(q) ||
        ev.location.toLowerCase().includes(q) ||
        ev.category?.toLowerCase().includes(q)
    );
  }, [eventsList, eventSearchQuery]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SUCCESS SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (registeredTicket && event) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 py-6 sm:py-10 animate-fade-in">
        <div
          className="rounded-3xl border p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden"
          style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
        >
          {/* Top highlight bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500" />

          {/* Success header */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-extrabold" style={{ color: 'var(--dash-text)' }}>
              Registration Successful!
            </h2>
            <p className="text-xs sm:text-sm font-medium" style={{ color: 'var(--dash-muted)' }}>
              {mode === 'admin'
                ? 'On-Spot registration has been recorded and ticket pass is issued.'
                : 'Your on-spot registration is confirmed. Keep your pass handy at the venue!'}
            </p>
          </div>

          {/* Ticket Card Details */}
          <div
            className="rounded-2xl border p-5 space-y-3.5"
            style={{ borderColor: 'var(--dash-border)', background: 'rgba(0,0,0,0.18)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--dash-border)' }}>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                  Event
                </p>
                <p className="text-base font-bold" style={{ color: 'var(--dash-text)' }}>
                  {event.title}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                On-Spot · {mode === 'admin' ? 'Admin' : 'Self'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                  {participationType === 'team' ? 'Team Leader' : 'Participant'}
                </p>
                <p className="font-semibold text-sm truncate" style={{ color: 'var(--dash-text)' }}>
                  {registeredTicket.guestName}
                </p>
              </div>
              <div>
                <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                  Ticket ID
                </p>
                <p className="font-mono font-bold text-sm text-blue-400 truncate">
                  {registeredTicket.ticketNumber}
                </p>
              </div>

              {registeredTicket.teamName && (
                <div>
                  <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                    Team Name
                  </p>
                  <p className="font-semibold truncate" style={{ color: 'var(--dash-text)' }}>
                    {registeredTicket.teamName}
                  </p>
                </div>
              )}

              <div>
                <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                  Format
                </p>
                <p className="font-semibold capitalize" style={{ color: 'var(--dash-text)' }}>
                  {participationType === 'team' ? `Team (${selectedTeamSize} Members)` : 'Solo'}
                </p>
              </div>

              <div>
                <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                  Payment Status
                </p>
                <p className="font-bold">
                  {registeredTicket.paymentStatus === 'verified' ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Payment Verified ✓
                    </span>
                  ) : (
                    <span className="text-amber-400">Pending Verification</span>
                  )}
                </p>
              </div>

              {registeredTicket.transactionId && (
                <div>
                  <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                    {mode === 'admin' ? 'Payment Record' : 'Ref / UTR'}
                  </p>
                  <p className="font-mono text-xs truncate" style={{ color: 'var(--dash-muted)' }}>
                    {registeredTicket.transactionId.startsWith('VENUE_VERIFIED_')
                      ? 'Verified at Venue Desk'
                      : registeredTicket.transactionId}
                  </p>
                </div>
              )}
            </div>

            {/* Scannable Pass QR */}
            {ticketQrDataUrl && (
              <div className="pt-3 flex flex-col items-center border-t text-center" style={{ borderColor: 'var(--dash-border)' }}>
                <div className="p-3 bg-white rounded-2xl shadow-md inline-block">
                  <img src={ticketQrDataUrl} alt="Ticket QR" className="w-36 h-36 mx-auto object-contain" />
                </div>
                <p className="text-[11px] font-mono mt-2" style={{ color: 'var(--dash-muted)' }}>
                  Scan at desk for attendance
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            {ticketQrDataUrl && (
              <button
                type="button"
                onClick={() => downloadTicketImage(event, registeredTicket, ticketQrDataUrl)}
                className="w-full min-h-[48px] rounded-xl font-bold flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-600/25 cursor-pointer text-sm"
              >
                <Download className="w-4 h-4" /> Download Ticket Pass
              </button>
            )}

            <button
              type="button"
              onClick={handleRegisterAnother}
              className="w-full min-h-[48px] rounded-xl font-bold flex items-center justify-center gap-2 border hover:bg-slate-800 transition-all cursor-pointer text-sm"
              style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Register Another Participant ({event.title})</span>
            </button>

            {mode === 'admin' && (
              <button
                type="button"
                onClick={() => setShowVenueQRModal(true)}
                className="w-full min-h-[44px] rounded-xl font-medium flex items-center justify-center gap-2 text-xs transition-all hover:bg-slate-800 cursor-pointer"
                style={{ color: 'var(--dash-muted)' }}
              >
                <QrCode className="w-4 h-4" /> Show Venue QR for Participants in Line
              </button>
            )}
          </div>
        </div>

        {/* Venue QR Modal for Admin */}
        {showVenueQRModal && venueQrDataUrl && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowVenueQRModal(false)}
          >
            <div
              className="w-full max-w-sm rounded-3xl border p-6 space-y-4 text-center shadow-2xl"
              style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--dash-border)' }}>
                <h3 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                  Desk Registration QR
                </h3>
                <button
                  type="button"
                  onClick={() => setShowVenueQRModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
                Display this QR for participants to scan and self-register on their phones:
              </p>

              <div className="p-3 bg-white rounded-2xl inline-block mx-auto shadow-md">
                <img src={venueQrDataUrl} alt="Venue Registration QR" className="w-52 h-52 mx-auto" />
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleCopyVenueLink}
                  className="btn-primary !text-xs !py-2.5 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {linkCopied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                  <span>{linkCopied ? 'Link Copied!' : 'Copy Public On-Spot Link'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN REGISTRATION FORM
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-xl mx-auto px-4 py-4 sm:py-8 space-y-6">
      {/* Optional Top Header */}
      {showHeader && (
        <div className="space-y-1.5 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border mb-1"
            style={{
              borderColor: mode === 'admin' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)',
              background: mode === 'admin' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)',
              color: mode === 'admin' ? '#f59e0b' : '#60a5fa',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{mode === 'admin' ? 'Admin On-Spot Desk' : 'On-Spot Registration'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: 'var(--dash-text)' }}>
            On-Spot Registration
          </h1>
          <p className="text-xs sm:text-sm" style={{ color: 'var(--dash-muted)' }}>
            {mode === 'admin'
              ? 'Fast-track registrations at the venue desk without account creation.'
              : 'Complete your registration at the venue in under a minute.'}
          </p>
        </div>
      )}

      {/* EVENT LOADING OR SELECTOR */}
      {selectedEventId && (loadingEvent || !event) ? (
        <div
          className="rounded-3xl border p-8 sm:p-12 space-y-4 shadow-xl text-center animate-fade-in"
          style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
        >
          <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto shadow-md" />
          <div className="space-y-1">
            <h3 className="font-bold text-base" style={{ color: 'var(--dash-text)' }}>
              Loading Event Details...
            </h3>
            <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
              Retrieving fees, tiers, and on-spot rules
            </p>
          </div>
        </div>
      ) : !selectedEventId || !event ? (
        <div
          className="rounded-3xl border p-5 sm:p-6 space-y-4 shadow-xl animate-fade-in"
          style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-base" style={{ color: 'var(--dash-text)' }}>
              Select Event
            </h3>
          </div>
          <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
            Choose the event to register participants on the spot:
          </p>

          {/* Search Events */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={eventSearchQuery}
              onChange={(e) => setEventSearchQuery(e.target.value)}
              placeholder="Search active events..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm"
              style={{
                borderColor: 'var(--dash-border)',
                background: 'var(--dash-bg)',
                color: 'var(--dash-text)',
              }}
            />
          </div>

          {loadingEventsList ? (
            <div className="py-8 text-center text-xs" style={{ color: 'var(--dash-muted)' }}>
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
              Loading events...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-8 text-center text-xs" style={{ color: 'var(--dash-muted)' }}>
              No published events found.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {filteredEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEventId(ev.id)}
                  className="rounded-2xl border p-3.5 flex items-center justify-between gap-3 hover:border-blue-500 transition-all cursor-pointer group"
                  style={{ borderColor: 'var(--dash-border)', background: 'rgba(0,0,0,0.1)' }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm truncate group-hover:text-blue-400 transition-colors" style={{ color: 'var(--dash-text)' }}>
                        {ev.title}
                      </p>
                      {ev.onSpotRegistrationOpen ? (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded shrink-0">
                          On-Spot ON
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-800 border border-slate-700 px-1.5 py-0.2 rounded shrink-0">
                          On-Spot OFF
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                      <span>{ev.date}</span>
                      <span>·</span>
                      <span className="truncate">{ev.location}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 text-xs text-blue-400 font-semibold">
                    <span>Select</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : !event.onSpotRegistrationOpen ? (
        /* Event Selected But On-Spot Registration is OFF */
        <div
          className="rounded-3xl border p-8 space-y-5 shadow-xl text-center animate-fade-in"
          style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
        >
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="font-black text-xl" style={{ color: 'var(--dash-text)' }}>
              On-Spot Registration is Inactive
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              On-Spot Registration is currently turned <span className="text-red-400 font-bold uppercase">OFF</span> for{' '}
              <strong className="text-white">{event.title}</strong>.
              {mode === 'admin'
                ? ' Turn On-Spot ON to start registering attendees at the venue desk.'
                : ' Please use standard registration for this event.'}
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {mode === 'admin' ? (
              <>
                <button
                  type="button"
                  onClick={handleEnableOnSpotForEvent}
                  disabled={enablingOnSpot}
                  className="btn-primary !text-xs !py-3 !px-6 font-bold flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white cursor-pointer shadow-lg shadow-amber-600/25 w-full sm:w-auto"
                >
                  <QrCode className="w-4 h-4" />
                  <span>{enablingOnSpot ? 'Turning ON...' : 'Turn On-Spot ON for this Event'}</span>
                </button>
                {!initialEventId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEventId('');
                      setEvent(null);
                    }}
                    className="btn-secondary !text-xs !py-3 !px-5 cursor-pointer w-full sm:w-auto"
                  >
                    Select Another Event
                  </button>
                )}
              </>
            ) : (
              <>
                <a
                  href={event.registrationUrl || `/events/${event.id}/register`}
                  className="btn-primary !text-xs !py-3 !px-6 font-bold flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white w-full sm:w-auto"
                >
                  <span>Go to Standard Registration</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href={`/events/${event.id}`}
                  className="btn-secondary !text-xs !py-3 !px-5 w-full sm:w-auto text-center"
                >
                  Back to Event Page
                </a>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Event Header & Form */
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Selected Event Card Banner */}
          <div
            className="rounded-2xl border p-4 flex items-center justify-between gap-3 shadow-md"
            style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
          >
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25">
                Event Selected
              </span>
              <h2 className="text-base sm:text-lg font-bold truncate mt-1" style={{ color: 'var(--dash-text)' }}>
                {event.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2.5 mt-1 text-xs" style={{ color: 'var(--dash-muted)' }}>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {event.date}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {event.location}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {mode === 'admin' && (
                <button
                  type="button"
                  onClick={() => setShowVenueQRModal(true)}
                  className="p-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
                  title="Show Desk QR code for participants to scan"
                >
                  <QrCode className="w-4 h-4 text-emerald-400" />
                </button>
              )}
              {mode === 'admin' && !initialEventId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEventId('');
                    setEvent(null);
                  }}
                  className="px-2.5 py-1.5 rounded-xl border text-xs font-semibold hover:border-slate-500 transition-all cursor-pointer"
                  style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}
                >
                  Change
                </button>
              )}
            </div>
          </div>

          {/* Registration Form Card */}
          <div
            className="rounded-3xl border p-5 sm:p-7 space-y-5 shadow-xl"
            style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
          >
            {/* Solo / Team Selection (Only shown if event supports both) */}
            {eventCapabilities.supportsSolo && eventCapabilities.supportsTeam && (
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                  Participation Format
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl border" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-bg)' }}>
                  <button
                    type="button"
                    onClick={() => setParticipationType('solo')}
                    className={`min-h-[42px] rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      participationType === 'solo'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <User className="w-4 h-4" /> Solo
                  </button>
                  <button
                    type="button"
                    onClick={() => setParticipationType('team')}
                    className={`min-h-[42px] rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      participationType === 'team'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Users className="w-4 h-4" /> Team
                  </button>
                </div>
              </div>
            )}

            {/* Team Size Selector (If multiple sizes available) */}
            {participationType === 'team' && eventCapabilities.availableTeamSizes.length > 1 && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                  Team Size (Total Members)
                </label>
                <div className="flex flex-wrap gap-2">
                  {eventCapabilities.availableTeamSizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedTeamSize(size)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        selectedTeamSize === size
                          ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                          : 'border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {size === 4 ? 'Squad (4 Members)' : size === 2 ? 'Duo (2 Members)' : `${size} Members`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Primary Details (Short Form) */}
            <div className="space-y-3.5">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--dash-text)' }}>
                <User className="w-4 h-4 text-blue-500" />
                <span>{participationType === 'team' ? 'Team Leader Details' : 'Participant Details'}</span>
              </h3>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (formErrors.name) setFormErrors((p) => ({ ...p, name: '' }));
                  }}
                  placeholder="e.g. John Doe"
                  className="w-full min-h-[48px] px-4 rounded-xl border text-sm transition-all focus:border-blue-500"
                  style={{
                    borderColor: formErrors.name ? '#ef4444' : 'var(--dash-border)',
                    background: 'var(--dash-bg)',
                    color: 'var(--dash-text)',
                  }}
                />
                {formErrors.name && <p className="text-[11px] text-red-400 mt-1">{formErrors.name}</p>}
              </div>

              {/* Phone Number (numeric keyboard) */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                  Mobile Number <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setPhone(val);
                      if (formErrors.phone) setFormErrors((p) => ({ ...p, phone: '' }));
                    }}
                    onBlur={handleCheckDuplicate}
                    placeholder="10-digit mobile number"
                    className="w-full min-h-[48px] pl-10 pr-4 rounded-xl border text-sm transition-all focus:border-blue-500"
                    style={{
                      borderColor: formErrors.phone ? '#ef4444' : 'var(--dash-border)',
                      background: 'var(--dash-bg)',
                      color: 'var(--dash-text)',
                    }}
                  />
                </div>
                {formErrors.phone && <p className="text-[11px] text-red-400 mt-1">{formErrors.phone}</p>}
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                  Email Address <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (formErrors.email) setFormErrors((p) => ({ ...p, email: '' }));
                    }}
                    onBlur={handleCheckDuplicate}
                    placeholder="student@example.com"
                    className="w-full min-h-[48px] pl-10 pr-4 rounded-xl border text-sm transition-all focus:border-blue-500"
                    style={{
                      borderColor: formErrors.email ? '#ef4444' : 'var(--dash-border)',
                      background: 'var(--dash-bg)',
                      color: 'var(--dash-text)',
                    }}
                  />
                </div>
                {formErrors.email && <p className="text-[11px] text-red-400 mt-1">{formErrors.email}</p>}
              </div>

              {/* College Name */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                  College Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <GraduationCap className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={college}
                    onChange={(e) => {
                      setCollege(e.target.value);
                      if (formErrors.college) setFormErrors((p) => ({ ...p, college: '' }));
                    }}
                    placeholder="JSPM RSCOE"
                    className="w-full min-h-[48px] pl-10 pr-4 rounded-xl border text-sm transition-all focus:border-blue-500"
                    style={{
                      borderColor: formErrors.college ? '#ef4444' : 'var(--dash-border)',
                      background: 'var(--dash-bg)',
                      color: 'var(--dash-text)',
                    }}
                  />
                </div>
                {formErrors.college && <p className="text-[11px] text-red-400 mt-1">{formErrors.college}</p>}
              </div>
            </div>

            {/* DUPLICATE WARNING ALERT CARD */}
            {duplicateInfo && duplicateInfo.isDuplicate && duplicateInfo.participant && (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2 animate-fade-in text-xs">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-amber-300 text-sm">
                      This participant is already registered for this event!
                    </p>
                    <p className="text-slate-300 mt-0.5">
                      Matched by {duplicateInfo.matchedOn === 'phone' ? 'phone number' : 'email address'}:
                    </p>
                    <div className="mt-2 p-2.5 rounded-xl bg-black/40 border border-amber-500/20 space-y-1 text-slate-200">
                      <p>
                        <span className="font-semibold text-slate-400">Name:</span> {duplicateInfo.participant.name}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-400">Ticket ID:</span>{' '}
                        <span className="font-mono text-blue-400">{duplicateInfo.participant.ticketNumber}</span>
                      </p>
                      <p>
                        <span className="font-semibold text-slate-400">Payment:</span>{' '}
                        <span className="capitalize">{duplicateInfo.participant.paymentStatus || 'Pending'}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPhone('');
                      setEmail('');
                      setDuplicateInfo(null);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                  >
                    Register Different Person
                  </button>
                </div>
              </div>
            )}

            {/* TEAM SECTION (Only shown when Team is selected) */}
            {participationType === 'team' && (
              <div className="pt-3 border-t space-y-3.5" style={{ borderColor: 'var(--dash-border)' }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--dash-text)' }}>
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>Team Members (Names Only)</span>
                  </h3>
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--dash-muted)' }}>
                    {selectedTeamSize} Total ({1} Leader + {teamMemberNames.length} Members)
                  </span>
                </div>

                {/* Optional Team Name */}
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                    Team Name <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder={`e.g. Team ${name || 'Alpha'}`}
                    className="w-full min-h-[46px] px-4 rounded-xl border text-sm"
                    style={{
                      borderColor: 'var(--dash-border)',
                      background: 'var(--dash-bg)',
                      color: 'var(--dash-text)',
                    }}
                  />
                </div>

                {/* Team Members Name Inputs */}
                <div className="space-y-2.5">
                  {teamMemberNames.map((mName, idx) => (
                    <div key={idx}>
                      <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                        Member #{idx + 2} Full Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={mName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTeamMemberNames((prev) => {
                            const copy = [...prev];
                            copy[idx] = val;
                            return copy;
                          });
                          if (formErrors[`member_${idx}`]) {
                            setFormErrors((p) => ({ ...p, [`member_${idx}`]: '' }));
                          }
                        }}
                        placeholder={`e.g. Teammate ${idx + 2}`}
                        className="w-full min-h-[46px] px-4 rounded-xl border text-sm transition-all focus:border-blue-500"
                        style={{
                          borderColor: formErrors[`member_${idx}`] ? '#ef4444' : 'var(--dash-border)',
                          background: 'var(--dash-bg)',
                          color: 'var(--dash-text)',
                        }}
                      />
                      {formErrors[`member_${idx}`] && (
                        <p className="text-[11px] text-red-400 mt-1">{formErrors[`member_${idx}`]}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PAYMENT SECTION */}
            <div className="pt-3 border-t space-y-3.5" style={{ borderColor: 'var(--dash-border)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--dash-text)' }}>
                  <CreditCard className="w-4 h-4 text-blue-500" />
                  <span>Payment Details</span>
                </h3>

                {pricingInfo.isFree ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Free (₹0)
                  </span>
                ) : (
                  <span className="text-base font-extrabold text-emerald-400">
                    ₹{pricingInfo.fee}
                  </span>
                )}
              </div>

              {pricingInfo.isFree ? (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>No registration fee is required for this event.</span>
                </div>
              ) : mode === 'admin' ? (
                /* COORDINATOR / ADMIN PAYMENT FLOW:
                   - NO payment QR
                   - NO Transaction ID
                   - NO screenshot upload
                   - Verify payment directly at venue
                */
                <div className="space-y-3">
                  <div
                    onClick={() => {
                      setAdminPaymentVerified((prev) => !prev);
                      if (formErrors.payment) setFormErrors((p) => ({ ...p, payment: '' }));
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between gap-3 ${
                      adminPaymentVerified
                        ? 'border-emerald-500/50 bg-emerald-500/10 shadow-md shadow-emerald-500/10'
                        : formErrors.payment
                        ? 'border-red-500/50 bg-red-500/10'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                          adminPaymentVerified
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {adminPaymentVerified ? <Check className="w-5 h-5" /> : <Banknote className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                          {adminPaymentVerified ? 'Payment Verified at Venue' : 'Verify Payment at Venue'}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
                          {adminPaymentVerified
                            ? `₹${pricingInfo.fee} received and verified`
                            : `Collect ₹${pricingInfo.fee} (Cash or Venue UPI) and tap to verify`}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition-all flex items-center gap-1.5 ${
                        adminPaymentVerified
                          ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {adminPaymentVerified ? (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Payment Verified ✓</span>
                        </>
                      ) : (
                        <span>Tap to Verify</span>
                      )}
                    </div>
                  </div>
                  {formErrors.payment && (
                    <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{formErrors.payment}</span>
                    </p>
                  )}
                </div>
              ) : (
                /* PARTICIPANT SELF-REGISTRATION PAYMENT FLOW:
                   - Payment QR visible
                   - Upload payment screenshot ONLY (REQUIRED)
                   - NO Transaction ID field
                */
                <div className="space-y-4">
                  {/* Payment QR Display */}
                  {pricingInfo.paymentQR && (
                    <div
                      className="p-4 rounded-2xl border flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left"
                      style={{ borderColor: 'var(--dash-border)', background: 'rgba(0,0,0,0.18)' }}
                    >
                      <div
                        onClick={() => setShowQRModal(true)}
                        className="p-2 bg-white rounded-xl shadow-md cursor-pointer hover:opacity-95 transition-opacity shrink-0"
                        title="Click to enlarge"
                      >
                        <img src={pricingInfo.paymentQR} alt="Payment QR" className="w-28 h-28 object-contain" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold" style={{ color: 'var(--dash-text)' }}>
                          Scan & Pay: <span className="text-emerald-400 font-extrabold text-sm">₹{pricingInfo.fee}</span>
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                          Scan using GPay, PhonePe, Paytm or any UPI app.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowQRModal(true)}
                          className="text-[11px] text-blue-400 font-semibold hover:underline inline-flex items-center gap-1 pt-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" /> Enlarge QR Code
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Required Payment Screenshot Upload */}
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                      Upload Payment Screenshot / Image <span className="text-red-400">*</span>
                    </label>

                    {!paymentProofPreview ? (
                      <label
                        className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                          formErrors.paymentProof
                            ? 'border-red-500/60 bg-red-500/10'
                            : 'border-slate-700 hover:border-blue-500 bg-slate-900/40 hover:bg-slate-900/70'
                        }`}
                      >
                        <Upload className="w-7 h-7 text-blue-400 mb-2" />
                        <span className="text-xs font-bold text-slate-200">Tap to Upload Screenshot</span>
                        <span className="text-[11px] text-slate-400 mt-0.5">JPG, PNG, or WebP screenshot from your UPI app</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            handleProofChange(e);
                            if (formErrors.paymentProof) setFormErrors((p) => ({ ...p, paymentProof: '' }));
                          }}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div
                        className="p-3.5 rounded-2xl border flex items-center justify-between gap-3"
                        style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-bg)' }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={paymentProofPreview}
                            alt="Screenshot Preview"
                            className="w-14 h-14 object-cover rounded-xl border border-slate-700 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Screenshot Attached
                            </p>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                              {paymentProofFile?.name || 'payment_proof.jpg'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentProofFile(null);
                            setPaymentProofPreview('');
                          }}
                          className="p-1.5 rounded-xl border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-colors cursor-pointer"
                          title="Remove screenshot"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {formErrors.paymentProof && (
                      <p className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{formErrors.paymentProof}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* SUBMIT BUTTON */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={
                  submitting ||
                  Boolean(duplicateInfo?.isDuplicate) ||
                  (mode === 'admin' && !pricingInfo.isFree && !adminPaymentVerified)
                }
                className={`w-full min-h-[50px] rounded-2xl font-bold flex items-center justify-center gap-2 text-white text-sm sm:text-base transition-all shadow-xl cursor-pointer ${
                  submitting ||
                  Boolean(duplicateInfo?.isDuplicate) ||
                  (mode === 'admin' && !pricingInfo.isFree && !adminPaymentVerified)
                    ? 'opacity-50 cursor-not-allowed bg-slate-700'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/30'
                }`}
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Processing Registration...</span>
                  </>
                ) : mode === 'admin' && !pricingInfo.isFree && !adminPaymentVerified ? (
                  <>
                    <ShieldCheck className="w-5 h-5 opacity-70" />
                    <span>Verify Payment Above to Continue</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Confirm On-Spot Registration</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Enlarge QR Modal */}
      {showQRModal && pricingInfo.paymentQR && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowQRModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border p-6 space-y-4 text-center shadow-2xl"
            style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--dash-border)' }}>
              <h3 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                Payment QR · ₹{pricingInfo.fee}
              </h3>
              <button
                type="button"
                onClick={() => setShowQRModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-white rounded-2xl inline-block mx-auto shadow-md">
              <img src={pricingInfo.paymentQR} alt="Payment QR" className="w-60 h-60 object-contain mx-auto" />
            </div>
            <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
              Scan with any UPI app to pay ₹{pricingInfo.fee}
            </p>
          </div>
        </div>
      )}

      {/* Desk Venue QR Modal */}
      {showVenueQRModal && venueQrDataUrl && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowVenueQRModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border p-6 space-y-4 text-center shadow-2xl"
            style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--dash-border)' }}>
              <h3 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                Desk Venue QR
              </h3>
              <button
                type="button"
                onClick={() => setShowVenueQRModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
              Display this QR for participants to scan and self-register on their phones:
            </p>

            <div className="p-3 bg-white rounded-2xl inline-block mx-auto shadow-md">
              <img src={venueQrDataUrl} alt="Venue Registration QR" className="w-52 h-52 mx-auto" />
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleCopyVenueLink}
                className="btn-primary !text-xs !py-2.5 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {linkCopied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                <span>{linkCopied ? 'Link Copied!' : 'Copy Public On-Spot Link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
