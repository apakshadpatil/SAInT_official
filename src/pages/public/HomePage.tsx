import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, Sparkles, ArrowRight, ChevronRight, MapPin, Ticket, Zap, AlertCircle, Eye, History } from 'lucide-react';
import { getSiteMembers, getFacultyCoordinator, getHomeImagesConfig, subscribeSiteSettings } from '../../services/applicationService';
import { getPositionHolders } from '../../services/positionService';
import { getPastEvents, getUpcomingEvents, subscribeEvents } from '../../services/eventService';
import { getStoredTotalVisitCount, subscribeTotalVisitCount } from '../../services/visitorTrackingService';
import type { EventRecord } from '../../types';
import Lightning from '../../components/animation/Lightning';
import { EventCardSkeleton } from '../../components/ui/skeleton';
import SponsorsSection from '../../components/ui/SponsorsSection';

function AnimatedStatisticValue({ value, loading }: { value: number; loading: boolean }) {
  const [displayValue, setDisplayValue] = useState(0);
  const displayedValueRef = useRef(0);

  useEffect(() => {
    if (loading) {
      displayedValueRef.current = 0;
      setDisplayValue(0);
      return;
    }

    const startValue = displayedValueRef.current;
    const difference = value - startValue;
    const duration = 850;
    const startTime = performance.now();
    let frameId = 0;

    const animate = (timestamp: number) => {
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(startValue + difference * eased);
      displayedValueRef.current = nextValue;
      setDisplayValue(nextValue);
      if (progress < 1) frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [loading, value]);

  if (loading) return <span className="block h-8 w-16 rounded-lg bg-slate-200/80 animate-pulse" aria-label="Loading statistic" />;
  return <span className="text-2xl font-black tabular-nums" aria-live="polite">{displayValue.toLocaleString('en-IN')}</span>;
}

export default function HomePage() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [members, setMembers] = useState<{ id: string; name: string; role: string; photoURL?: string }[]>([]);
  const [faculty, setFaculty] = useState<{ name: string; designation: string; email?: string; photoURL?: string } | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [showHomeImages, setShowHomeImages] = useState<boolean>(true);
  const [positions, setPositions] = useState<{ position: { title: string }; users: { displayName: string; photoURL?: string }[] }[]>([]);
  const [totalVisits, setTotalVisits] = useState(getStoredTotalVisitCount);
  const [conductedEvents, setConductedEvents] = useState(0);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [conductedEventsLoading, setConductedEventsLoading] = useState(true);

  // Instantaneous read from localStorage
  const [doomsdayMode, setDoomsdayMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('saint_doomsday_mode') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const unsub = subscribeSiteSettings((settings) => {
      setDoomsdayMode(Boolean(settings?.doomsdayMode));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let isMounted = true;
    setEventsLoading(true);
    setEventsError(null);

    const unsubscribeVisits = subscribeTotalVisitCount((count) => {
      if (isMounted) {
        setTotalVisits((current) => Math.max(current, count));
        setVisitsLoading(false);
      }
    });

    const unsubscribeEvents = subscribeEvents((allEvents) => {
      if (isMounted) {
        setEvents(getUpcomingEvents(allEvents));
        setEventsLoading(false);
        setConductedEvents(getPastEvents(allEvents).length);
        setConductedEventsLoading(false);
      }
    });

    getSiteMembers()
      .then((m: unknown[]) => {
        if (m.length && isMounted) setMembers(m as typeof members);
      })
      .catch(() => { });

    getFacultyCoordinator()
      .then((f: unknown) => {
        if (f && isMounted) setFaculty(f as typeof faculty);
      })
      .catch(() => { });

    getHomeImagesConfig()
      .then((config) => {
        if (isMounted) {
          setImages(config.images || []);
          setShowHomeImages(config.showHomeImages !== false);
        }
      })
      .catch(() => { });

    getPositionHolders()
      .then((p) => {
        if (isMounted) setPositions(p as typeof positions);
      })
      .catch(() => { });

    return () => {
      isMounted = false;
      unsubscribeVisits();
      unsubscribeEvents();
    };
  }, []);

  const hasImagesToDisplay = showHomeImages && images.length > 0;

  return (
    <div>
      {/* Hero */}
      <section id="home" className="relative overflow-hidden">
        {doomsdayMode ? (
          <>
            <div className="doomsday-hero-background absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "linear-gradient(rgba(0, 10, 5, 0.34), rgba(0, 10, 5, 0.58)), url('/images/doomsday-impact-background.jpeg')" }} />
            <div className="doomsday-green-smoke" aria-hidden="true">
              <div className="smoke-cloud-1" />
              <div className="smoke-cloud-2" />
              <div className="smoke-cloud-3" />
            </div>
            {/* One bolt only: layered over the artwork but behind the hero content. */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-[2] opacity-90">
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[min(82vw,43rem)] h-[40rem]">
                <Lightning hue={125} xOffset={0} speed={1.08} intensity={1.38} size={0.68} branching />
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 via-white/90 to-blue-100/60" />
        )}

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32 z-10">
          <div className={`grid ${hasImagesToDisplay ? 'lg:grid-cols-2' : 'max-w-4xl mx-auto text-center'} gap-12 items-center`}>
            <div className="animate-fade-in-up">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-6 ${doomsdayMode
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                : 'bg-blue-100 text-blue-700'
                } ${!hasImagesToDisplay ? 'mx-auto' : ''}`}>
                {doomsdayMode ? <Zap className="w-4 h-4 text-emerald-400 animate-pulse" /> : <Sparkles className="w-4 h-4" />}
                {doomsdayMode ? 'DOOMSDAY PROTOCOL ACTIVE — RSCOE IT' : "JSPM's RSCOE — IT Department"}
              </div>

              {doomsdayMode ? (
                /* DIRECT IMPACT x DOOMSDAY TITLE */
                <h1
                  className="doomsday-hero-text whitespace-nowrap text-[clamp(1.3rem,7.4vw,4.5rem)] font-black uppercase leading-none py-2 text-transparent bg-clip-text mb-6"
                  style={{
                    fontFamily: "'Orbitron', 'Montserrat', 'Syne', sans-serif",
                    backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #a7f3d0 35%, #22c55e 75%, #15803d 100%)',
                    textShadow: '0 0 35px rgba(34, 197, 94, 0.6), 0 0 75px rgba(34, 197, 94, 0.3)',
                    letterSpacing: '0.055em',
                  }}
                >
                  IMPACT <span className="text-emerald-400 font-light">x</span> DOOMSDAY
                </h1>
              ) : (
                /* DEFAULT WELCOME TO SAINT TITLE */
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
                  Welcome to{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-900">
                    SAInT
                  </span>
                </h1>
              )}

              <p className={`text-lg leading-relaxed mb-8 ${hasImagesToDisplay ? 'max-w-xl' : 'max-w-2xl mx-auto'} ${doomsdayMode ? 'text-emerald-100/90' : 'text-slate-600'}`}>
                {doomsdayMode
                  ? 'The high-voltage cyber protocol is active across all department networks, registrations, and quantum channels.'
                  : 'The Student Association of Information Technology — a student-led association fostering innovation, collaboration, and excellence in the IT department at JSPM\'s Rajarshi Shahu College of Engineering.'}
              </p>

              <div className={`flex flex-wrap gap-3.5 ${!hasImagesToDisplay ? 'justify-center' : ''}`}>
                <Link
                  to="/apply"
                  className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200 shadow-md ${doomsdayMode
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'
                    }`}
                >
                  Join SAInT <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/participant-auth"
                  className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200 shadow-md ${doomsdayMode
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/25'
                    }`}
                >
                  🎟️ Login as Participant
                </Link>
                <a
                  href="#events"
                  className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${doomsdayMode
                    ? 'border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
                    : 'border border-slate-300 text-slate-700 bg-white/80 hover:bg-white'
                    }`}
                >
                  View Events
                </a>
              </div>
            </div>

            {/* Landing Images Showcase Gallery (Multiple Images Support) */}
            {hasImagesToDisplay && (
              <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <div className={`grid gap-4 ${images.length === 1
                  ? 'grid-cols-1'
                  : images.length === 2
                    ? 'grid-cols-2'
                    : 'grid-cols-2 sm:grid-cols-2'
                  }`}>
                  {images.map((img, i) => (
                    <div
                      key={i}
                      className={`group relative rounded-2xl overflow-hidden shadow-xl border transition-all duration-500 hover:scale-[1.02] ${doomsdayMode
                        ? 'border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.2)] bg-black/60'
                        : 'border-white/50 bg-white/10'
                        } ${images.length > 2 && i === 0
                          ? 'col-span-2 h-52'
                          : images.length === 1
                            ? 'h-80'
                            : 'h-40'
                        }`}
                    >
                      <img
                        src={img}
                        alt={`SAInT showcase ${i + 1}`}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={`relative py-7 sm:py-9 ${doomsdayMode ? 'bg-black/70' : 'bg-white/80'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
          {[
            { label: 'Visits', value: totalVisits, loading: visitsLoading, icon: Eye, color: 'text-blue-600' },
            { label: 'Upcoming events', value: events.length, loading: eventsLoading, icon: Calendar, color: 'text-indigo-600' },
            { label: 'Events conducted', value: conductedEvents, loading: conductedEventsLoading, icon: History, color: 'text-emerald-600' },
          ].map(({ label, value, loading, icon: Icon, color }) => (
            <div key={label} className={`rounded-2xl px-5 py-4 flex items-center gap-4 ${doomsdayMode ? 'bg-black/60' : 'border border-slate-200 bg-white shadow-sm'}`}>
              <div className={`p-3 rounded-xl bg-slate-100 ${color}`}><Icon className="w-5 h-5" /></div>
              <div className={doomsdayMode ? 'text-white' : 'text-slate-900'}><AnimatedStatisticValue value={value} loading={loading} /><p className={`text-xs font-semibold uppercase tracking-wider ${doomsdayMode ? 'text-emerald-200/80' : 'text-slate-500'}`}>{label}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* Sponsors Section — Infinite Horizontal Logo Marquee */}
      <SponsorsSection />

      {/* Upcoming Events — sourced from dashboard events collection */}
      <section id="events" className="py-20 bg-gradient-to-b from-white/70 to-blue-50/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-blue-600 font-semibold text-sm uppercase tracking-wider mb-2">What&apos;s Next</p>
              <h2 className="section-title">Upcoming Events</h2>
              <p className="text-slate-500 text-sm mt-2">Register instantly — no account required</p>
            </div>
            <Link to="/activities" className="hidden sm:flex items-center gap-1 text-blue-600 font-semibold text-sm hover:gap-2 transition-all">
              Past Activities <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {eventsLoading ? (
            <EventCardSkeleton count={3} />
          ) : eventsError ? (
            <div className="card text-center py-12 border-dashed border-red-300 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/10">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <p className="text-red-600 dark:text-red-400 font-medium">Unable to load upcoming events</p>
              <p className="text-slate-400 text-sm mt-1">Please check your connection or refresh the page.</p>
            </div>
          ) : eventsError ? (
            <div className="card text-center py-12 border-dashed border-red-300 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/10">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <p className="text-red-600 dark:text-red-400 font-medium">Unable to load upcoming events</p>
              <p className="text-slate-400 text-sm mt-1">Please check your connection or refresh the page.</p>
            </div>
          ) : events.length === 0 ? (
            <div className="card text-center py-16 border-dashed">
              <Calendar className="w-12 h-12 text-blue-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No upcoming events right now.</p>
              <p className="text-slate-400 text-sm mt-1">Check back soon — new events are added from the dashboard.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <div key={event.id} className="card group hover:shadow-lg hover:border-blue-200 transition-all duration-300 !p-0 overflow-hidden flex flex-col">
                  {event.imageURL ? (
                    <div className="h-44 overflow-hidden shrink-0">
                      <img
                        src={event.imageURL}
                        alt={event.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  ) : (
                    <div className="h-44 bg-gradient-to-br from-blue-500 to-blue-800 flex items-center justify-center shrink-0">
                      <Calendar className="w-12 h-12 text-white/30" />
                    </div>
                  )}
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-2 text-blue-600 text-sm font-medium mb-3">
                      <Calendar className="w-4 h-4 shrink-0" />
                      {new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {' · '}{event.startTime}
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">{event.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed flex-1 line-clamp-3">{event.description}</p>
                    <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium mt-3 mb-4">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      {event.location}{event.venue ? ` · ${event.venue}` : ''}
                    </div>
                    <Link
                      to={`/events/${event.id}/register`}
                      className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}
                    >
                      <Ticket className="w-4 h-4" />
                      Register &amp; Get Ticket
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-blue-600 font-semibold text-sm uppercase tracking-wider mb-2">Who We Are</p>
            <h2 className="section-title mb-4">About SAInT</h2>
            <p className="text-slate-600 max-w-3xl mx-auto leading-relaxed">
              SAInT (Student Association of Information Technology) is the official student body of the IT Department
              at JSPM&apos;s Rajarshi Shahu College of Engineering. We organize technical events, workshops, cultural
              activities, and provide a platform for students to develop leadership, technical, and interpersonal skills.
            </p>
            <Link to="/about" className="btn-outline mt-7">Discover SAInT <ArrowRight className="w-4 h-4" /></Link>
          </div>

          {/* Core Team / Positions */}
          {(positions.length > 0 || members.length > 0) && (
            <div className="mb-14">
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Users className="w-6 h-6 text-blue-600" /> Current Members
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-9">
                {positions.length > 0
                  ? positions.flatMap(({ position, users }) =>
                    users.map((u) => (
                      <div key={`${position.title}-${u?.displayName}`} className="text-center">
                        {u?.photoURL ? (
                          <img
                            src={u.photoURL}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="w-20 h-20 rounded-full mx-auto mb-3 object-cover ring-4 ring-blue-100"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-full mx-auto mb-3 bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-2xl ring-4 ring-blue-50">
                            {u?.displayName?.[0]}
                          </div>
                        )}
                        <h4 className="font-bold text-slate-900">{u?.displayName}</h4>
                        <p className="text-sm text-blue-600 font-medium mt-1">{position.title}</p>
                      </div>
                    ))
                  )
                  : members.map((m) => (
                    <div key={m.id} className="text-center">
                      <div className="w-20 h-20 rounded-full mx-auto mb-3 bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-2xl ring-4 ring-blue-50">
                        {m.name[0]}
                      </div>
                      <h4 className="font-bold text-slate-900">{m.name}</h4>
                      <p className="text-sm text-blue-600 font-medium mt-1">{m.role}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Faculty Coordinator & Chairman */}
          <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
            {/* Faculty Coordinator card */}
            <div className="card doomsday-card-faculty bg-gradient-to-br from-blue-600 to-blue-900 !border-0 text-white overflow-hidden">
              <div className="flex items-center gap-6">
                <div className="w-32 h-32 shrink-0 rounded-full overflow-hidden ring-4 ring-white/20">
                  <img
                    src="/images/faculty-coordinator.jpg"
                    alt="Faculty Coordinator"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="label-muted text-blue-200 text-sm font-semibold uppercase tracking-wider mb-2">Faculty Coordinator</p>
                  <h3 className="text-2xl font-bold mb-1">{faculty?.name || 'Dr. Pallavi Tekade'}</h3>
                  <p className="label-muted text-blue-200">{faculty?.designation || 'Faculty Coordinator — IT Department'}</p>
                  {faculty?.email && <p className="text-sm text-blue-100 mt-2">{faculty.email}</p>}
                </div>
              </div>
            </div>

            {/* Chairman card */}
            <div className="card doomsday-card-chairman bg-gradient-to-br from-slate-800 to-slate-900 !border-0 text-white overflow-hidden">
              <div className="flex items-center gap-6">
                <div className="w-32 h-32 shrink-0 rounded-full overflow-hidden ring-4 ring-white/20">
                  <img
                    src="/images/hod-it.jpg"
                    alt="Chairman of the Club"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="label-muted text-slate-300 text-sm font-semibold uppercase tracking-wider mb-2">Chairman</p>
                  <h3 className="text-2xl font-bold mb-1">Dr. Nihar Ranjan</h3>
                  <p className="label-muted text-slate-300">Head of Department — Information Technology</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-8" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Need help?</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-900">Contact the SAInT support desk</h2>
                </div>
              </div>
              <Link to="/support" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">
                Raise a support ticket
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to be part of SAInT?</h2>
          <p className="text-blue-100 mb-8">Apply now and join our vibrant community of innovators and leaders.</p>
          <Link to="/apply" className="inline-flex items-center gap-2 px-8 py-3 bg-white text-blue-700 rounded-xl font-bold hover:shadow-lg transition-all">
            Apply for Interview <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
