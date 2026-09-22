import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Ticket,
  ArrowLeft,
  Share2,
  Users,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  FileText,
  Check,
  ShieldCheck,
  CalendarPlus,
  Compass,
  Phone,
  User
} from 'lucide-react';
import { getEvent, subscribeEventById } from '../../services/eventService';
import type { EventRecord } from '../../types';
import { getEventCoordinators } from '../../types';
import { getSectionIcon } from '../../utils/eventSectionIcons';
import { useToast } from '../../contexts/ToastContext';
import EventBanner from '../../components/ui/EventBanner';

export default function PublicEventDetailsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { showToast } = useToast();

  const [event, setEvent] = useState<EventRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Synchronous read from DOM / localStorage synced by PublicLayout
  const [doomsdayMode, setDoomsdayMode] = useState<boolean>(() => {
    try {
      if (typeof document !== 'undefined') {
        return document.documentElement.getAttribute('data-doomsday') === 'true' || localStorage.getItem('saint_doomsday_mode') === 'true';
      }
      return false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDoomsdayMode(document.documentElement.getAttribute('data-doomsday') === 'true');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-doomsday'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError('');

    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch {
      window.scrollTo(0, 0);
    }
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    const unsub = subscribeEventById(eventId, (e) => {
      if (e) {
        setEvent(e);
        setError('');
        setLoading(false);
      } else {
        // Fallback fetch
        getEvent(eventId, true)
          .then((directDoc) => {
            if (directDoc) {
              setEvent(directDoc);
              setError('');
            } else {
              setError('Event not found.');
            }
          })
          .catch(() => {
            setError('Event not found.');
          })
          .finally(() => setLoading(false));
      }
    });

    return () => unsub();
  }, [eventId]);

  useEffect(() => {
    if (!loading && event) {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      } catch {
        window.scrollTo(0, 0);
      }
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [loading, event?.id]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: event?.title || 'SAInT Event',
          text: event?.description || 'Join this event on SAInT IT Portal',
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        showToast('Event link copied to clipboard!', 'success');
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast('Event link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleAddToCalendar = () => {
    if (!event) return;
    try {
      const startDateTime = new Date(`${event.date} ${event.startTime || '10:00 AM'}`);
      const endDateTime = new Date(`${event.date} ${event.endTime || '05:00 PM'}`);
      
      const formatTime = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
      const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        event.title
      )}&dates=${formatTime(startDateTime)}/${formatTime(endDateTime)}&details=${encodeURIComponent(
        event.description || ''
      )}&location=${encodeURIComponent(`${event.venue ? event.venue + ', ' : ''}${event.location || ''}`)}`;

      window.open(googleCalUrl, '_blank', 'noopener,noreferrer');
    } catch {
      showToast('Could not open calendar generator', 'info');
    }
  };

  // Filtered visible custom sections sorted by order
  const activeCustomSections = useMemo(() => {
    if (!event?.customSections) return [];
    return event.customSections
      .filter((s) => s.visible && s.content && s.content.trim().length > 0)
      .slice()
      .sort((a, b) => a.order - b.order);
  }, [event?.customSections]);

  // Event Coordinators / Contact Persons
  const coordinators = useMemo(() => getEventCoordinators(event), [event]);

  // Check if standard rules exist
  const hasStandardRules = Boolean(event?.rules && event.rules.length > 0);

  // Status checks
  const isCancelled = event?.status === 'cancelled';
  const isCompleted = event?.status === 'completed';
  const isDraft = event?.status === 'draft';
  const isRegistrationOpen = !isCancelled && !isCompleted;

  // Banner image priority: imageURL -> registrationBannerUrl -> bannerUrl -> imageUrl
  const displayBannerUrl =
    (event?.imageURL && event.imageURL.trim()) ||
    (event?.registrationBannerUrl && event.registrationBannerUrl.trim()) ||
    ((event as any)?.bannerUrl && (event as any).bannerUrl.trim()) ||
    ((event as any)?.imageUrl && (event as any).imageUrl.trim()) ||
    null;

  // Loading State
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${doomsdayMode ? 'bg-[#050505]' : 'bg-slate-950'}`}>
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-400">Loading Event Details...</p>
        </div>
      </div>
    );
  }

  // Not Found State
  if (!event || error) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 text-center ${doomsdayMode ? 'bg-[#050505] text-white' : 'bg-slate-950 text-white'}`}>
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black mb-2">Event Not Found</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          The requested event may have been removed, unlisted, or the link may be incorrect.
        </p>
        <Link
          to="/events"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md"
        >
          <ArrowLeft className="w-4 h-4" /> Browse All Events
        </Link>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-24 transition-colors ${doomsdayMode ? 'bg-[#050505] text-white' : 'bg-[#0a0f1d] text-slate-100'}`}>
      {/* Background Ambience Blobs */}
      <div className="public-bg-blobs" aria-hidden="true">
        <div className="public-liquid-blob-1" style={{ opacity: doomsdayMode ? 0.2 : 0.45 }} />
        <div className="public-liquid-blob-2" style={{ opacity: doomsdayMode ? 0.15 : 0.4 }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link
            to="/events"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to All Events</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddToCalendar}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-700/80 bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Add to Google Calendar"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Add to Calendar</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-700/80 bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Share event link"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── HERO BANNER & HEADER ─────────────────────────────────────────── */}
        <div
          className="rounded-3xl overflow-hidden border shadow-2xl mb-8 relative"
          style={{
            borderColor: doomsdayMode ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)',
            background: doomsdayMode ? 'rgba(10,15,10,0.85)' : 'rgba(15,23,42,0.6)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Standardized 16:9 Banner Image Container */}
          <EventBanner
            src={displayBannerUrl}
            alt={event.title}
            aspectRatioClass="aspect-video"
            maxHeightClass="max-h-[440px]"
            showOverlay={true}
            doomsdayMode={doomsdayMode}
            priority={true}
            fallbackIcon={<Compass className="w-12 h-12 text-emerald-400/35" />}
          />

          {/* Hero Content Overlay */}
          <div className="p-6 sm:p-8 md:p-10 relative z-10 -mt-16 sm:-mt-20">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {/* Status Badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider backdrop-blur-md shadow-sm border ${
                  isRegistrationOpen
                    ? doomsdayMode
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : isCompleted
                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                    : 'bg-red-500/15 text-red-300 border-red-500/30'
                }`}
              >
                {isRegistrationOpen ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Registration Open
                  </>
                ) : isCompleted ? (
                  'Event Completed'
                ) : (
                  'Registration Closed'
                )}
              </span>

              {/* Category */}
              {event.category && (
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  {event.category}
                </span>
              )}

              {/* Tier/Team Mode Badge */}
              {event.teamsEnabled && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Teams of {event.minTeamSize || 2}-{event.maxTeamSize || 4}
                </span>
              )}

              {isDraft && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Draft Mode
                </span>
              )}
            </div>

            {/* Event Title */}
            <h1
              className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight text-white mb-4"
              style={doomsdayMode ? { textShadow: '0 0 25px rgba(16,185,129,0.3)' } : {}}
            >
              {event.title}
            </h1>

            {/* Description Overview */}
            {event.description && (
              <p className="text-sm sm:text-base text-slate-300 max-w-4xl leading-relaxed mb-6 font-normal">
                {event.description}
              </p>
            )}

            {/* Meta Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-white/10">
              {/* Date */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block">Date</span>
                  <span className="text-xs sm:text-sm font-bold text-white">
                    {new Date(event.date).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {/* Time */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block">Timing</span>
                  <span className="text-xs sm:text-sm font-bold text-white">
                    {event.startTime} {event.endTime ? `– ${event.endTime}` : ''}
                  </span>
                </div>
              </div>

              {/* Venue */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold text-slate-400 block">Venue</span>
                  <span className="text-xs sm:text-sm font-bold text-white truncate block" title={`${event.venue ? event.venue + ', ' : ''}${event.location || 'On Campus'}`}>
                    {event.venue || event.location || 'On Campus'}
                  </span>
                </div>
              </div>

              {/* Capacity / Team */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block">Participation</span>
                  <span className="text-xs sm:text-sm font-bold text-white">
                    {event.teamsEnabled ? `Team (${event.minTeamSize || 2}-${event.maxTeamSize || 4})` : 'Individual Pass'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── TWO COLUMN MAIN LAYOUT ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ── LEFT COLUMN: Event Content & Sections (8 cols) ───────────────── */}
          <div className="lg:col-span-8 space-y-6">
            {/* Dynamic Custom Sections */}
            {activeCustomSections.map((section) => {
              const iconObj = getSectionIcon(section.icon);
              const IconComp = iconObj.icon;

              return (
                <div
                  key={section.id}
                  className="rounded-3xl border p-6 sm:p-8 space-y-4 shadow-xl transition-all"
                  style={{
                    borderColor: doomsdayMode ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)',
                    background: doomsdayMode ? 'rgba(10,15,10,0.8)' : 'rgba(15,23,42,0.5)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md"
                      style={{
                        background: `${iconObj.color}20`,
                        border: `1px solid ${iconObj.color}45`,
                      }}
                    >
                      <IconComp className="w-5 h-5" style={{ color: iconObj.color }} />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white">
                      {section.title}
                    </h2>
                  </div>

                  {/* Section Content formatted */}
                  <div className="text-sm sm:text-base text-slate-300 leading-relaxed whitespace-pre-line pl-1 sm:pl-2">
                    {section.content}
                  </div>
                </div>
              );
            })}

            {/* Standard Rules (if configured on event and not already a section) */}
            {hasStandardRules && !activeCustomSections.some((s) => s.title.toLowerCase().includes('rule')) && (
              <div
                className="rounded-3xl border p-6 sm:p-8 space-y-4 shadow-xl"
                style={{
                  borderColor: 'rgba(59,130,246,0.3)',
                  background: 'rgba(15,23,42,0.5)',
                  backdropFilter: 'blur(16px)',
                }}
              >
                <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">
                    Event Rules &amp; Code of Conduct
                  </h2>
                </div>

                <ul className="space-y-2.5 text-sm text-slate-300 leading-relaxed">
                  {event.rules!.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-1" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Fallback if no sections are present */}
            {activeCustomSections.length === 0 && !hasStandardRules && (
              <div
                className="rounded-3xl border p-8 text-center space-y-3"
                style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.4)' }}
              >
                <Sparkles className="w-8 h-8 text-blue-400 mx-auto" />
                <h3 className="font-bold text-base text-white">Ready for Event Day</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  All event participants are invited to check in on time. Register below to receive your digital entry QR pass.
                </p>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN: Registration CTA Card (Sticky Desktop) ─────────── */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
            <div
              className="rounded-3xl border p-6 sm:p-7 space-y-6 shadow-2xl relative overflow-hidden"
              style={{
                borderColor: doomsdayMode ? 'rgba(16,185,129,0.35)' : 'rgba(59,130,246,0.35)',
                background: doomsdayMode
                  ? 'linear-gradient(135deg, rgba(10,25,15,0.9), rgba(5,10,5,0.95))'
                  : 'linear-gradient(135deg, rgba(15,23,42,0.85), rgba(30,27,75,0.85))',
                backdropFilter: 'blur(24px)',
              }}
            >
              {/* Card Header & Price */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  Entry Pass
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {event.ticketingEnabled ? 'Digital QR Ticket' : 'Free Entry'}
                </span>
              </div>

              <div>
                <h3 className="text-2xl font-black text-white mb-1">
                  Ready to Participate?
                </h3>
                <p className="text-xs text-slate-300">
                  Register online to get your digital entry pass delivered instantly.
                </p>
              </div>

              {/* Quick Checklist */}
              <div className="space-y-2.5 py-3 border-y border-white/10 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Instant digital QR entry pass generation</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Verified digital participation certificate</span>
                </div>
                {event.teamsEnabled && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Team registration supported</span>
                  </div>
                )}
                {event.maxAttendees && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Limited capacity ({event.maxAttendees} seats)</span>
                  </div>
                )}
              </div>

              {/* Primary Register CTA Button */}
              {isRegistrationOpen ? (
                event.registrationUrl ? (
                  <a
                    href={event.registrationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-6 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    style={
                      doomsdayMode
                        ? {
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#000000',
                            boxShadow: '0 8px 25px rgba(16,185,129,0.4)',
                          }
                        : {
                            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                            color: '#ffffff',
                            boxShadow: '0 8px 25px rgba(37,99,235,0.4)',
                          }
                    }
                  >
                    <ExternalLink className="w-5 h-5" />
                    <span>Register</span>
                  </a>
                ) : (
                  <Link
                    to={`/events/${event.id}/register`}
                    className="w-full py-3.5 px-6 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    style={
                      doomsdayMode
                        ? {
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#000000',
                            boxShadow: '0 8px 25px rgba(16,185,129,0.4)',
                          }
                        : {
                            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                            color: '#ffffff',
                            boxShadow: '0 8px 25px rgba(37,99,235,0.4)',
                          }
                    }
                  >
                    <Ticket className="w-5 h-5" />
                    <span>Register &amp; Get Ticket</span>
                  </Link>
                )
              ) : (
                <div className="w-full py-3.5 px-6 rounded-2xl font-bold text-xs text-center bg-slate-800/80 text-slate-400 border border-slate-700">
                  {isCompleted ? 'This event has concluded' : 'Registration is currently closed'}
                </div>
              )}

              {/* External Links: WhatsApp, Rulebook */}
              <div className="space-y-2 pt-2">
                {event.rulebookUrl && (
                  <a
                    href={event.rulebookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold border border-slate-700 hover:border-slate-600 bg-slate-800/60 hover:bg-slate-800 text-slate-200 transition-all flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                    <span>Download Official Rulebook PDF</span>
                  </a>
                )}
              </div>

              {/* Location Note */}
              <div className="pt-2 text-center">
                <p className="text-[11px] text-slate-400">
                  📍 {event.venue ? `${event.venue}, ` : ''}{event.location || 'College Campus'}
                </p>
              </div>
            </div>

            {/* Event Coordinators / Contact Persons */}
            {coordinators.length > 0 && (
              <div
                className="rounded-3xl border p-5 sm:p-6 space-y-3.5 shadow-xl"
                style={{
                  borderColor: doomsdayMode ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)',
                  background: doomsdayMode ? 'rgba(10,15,10,0.85)' : 'rgba(15,23,42,0.6)',
                  backdropFilter: 'blur(20px)',
                }}
              >
                <div className="flex items-center gap-2.5 pb-2.5 border-b border-white/10">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white leading-none">
                      {coordinators.length === 1 ? 'Event Coordinator' : 'Event Coordinators'}
                    </h4>
                    <span className="text-[11px] text-slate-400">Questions? Reach out directly</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {coordinators.map((coord, idx) => {
                    const cleanPhone = coord.phone.trim();
                    const dialUrl = `tel:${cleanPhone.replace(/\s+/g, '')}`;

                    return (
                      <div
                        key={coord.id || idx}
                        className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/15 transition-all"
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
      </div>
    </div>
  );
}
