import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, Sparkles, ArrowRight, ChevronRight, MapPin, Ticket, Zap } from 'lucide-react';
import { getSiteMembers, getFacultyCoordinator, getHomeImagesConfig, subscribeSiteSettings } from '../../services/applicationService';
import { getPositionHolders } from '../../services/positionService';
import { getPublishedUpcomingEvents } from '../../services/eventService';
import type { EventRecord } from '../../types';
import Lightning from '../../components/animation/Lightning';
import { EventCardSkeleton, CardSkeleton } from '../../components/ui/skeleton';

export default function HomePage() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);
  const [members, setMembers] = useState<{ id: string; name: string; role: string; photoURL?: string }[]>([]);
  const [faculty, setFaculty] = useState<{ name: string; designation: string; email?: string; photoURL?: string } | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [showHomeImages, setShowHomeImages] = useState<boolean>(true);
  const [positions, setPositions] = useState<{ position: { title: string }; users: { displayName: string; photoURL?: string }[] }[]>([]);
  
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
    getPublishedUpcomingEvents().then((e) => { setEvents(e); setEventsLoading(false); }).catch(() => setEventsLoading(false));
    getSiteMembers().then((m: unknown[]) => { if (m.length) setMembers(m as typeof members); setMembersLoading(false); }).catch(() => setMembersLoading(false));
    getFacultyCoordinator().then((f: unknown) => f && setFaculty(f as typeof faculty)).catch(() => {});
    getHomeImagesConfig().then((config) => {
      setImages(config.images || []);
      setShowHomeImages(config.showHomeImages !== false);
    }).catch(() => {});
    getPositionHolders().then((p) => setPositions(p as typeof positions)).catch(() => {});
  }, []);

  const hasImagesToDisplay = showHomeImages && images.length > 0;

  return (
    <div>
      {/* Hero */}
      <section id="home" className="relative overflow-hidden">
        {doomsdayMode ? (
          <>
            {/* Deep Pitch Black Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#000000] via-[#030804] to-[#000000]" />

            {/* Green Smoke / Eerie Atmospheric Mist Fog Layers */}
            <div className="doomsday-green-smoke">
              <div className="smoke-cloud-1" />
              <div className="smoke-cloud-2" />
              <div className="smoke-cloud-3" />
            </div>

            {/* Multiple Small Green Lightning Canvas Bolts in Background */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-70 z-0">
              <div className="absolute -top-12 left-[15%] w-72 h-[420px] opacity-80">
                <Lightning hue={125} xOffset={-0.35} speed={1.3} intensity={1.4} size={0.7} />
              </div>
              <div className="absolute top-8 right-[20%] w-80 h-[480px] opacity-75">
                <Lightning hue={122} xOffset={0.25} speed={1.1} intensity={1.5} size={0.85} />
              </div>
              <div className="absolute bottom-0 left-[45%] w-96 h-[400px] opacity-55">
                <Lightning hue={128} xOffset={0.0} speed={0.95} intensity={1.2} size={0.65} />
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 via-white/90 to-blue-100/60" />
        )}

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32 z-10">
          <div className={`grid ${hasImagesToDisplay ? 'lg:grid-cols-2' : 'max-w-4xl mx-auto text-center'} gap-12 items-center`}>
            <div className="animate-fade-in-up">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-6 ${
                doomsdayMode
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                  : 'bg-blue-100 text-blue-700'
              } ${!hasImagesToDisplay ? 'mx-auto' : ''}`}>
                {doomsdayMode ? <Zap className="w-4 h-4 text-emerald-400 animate-pulse" /> : <Sparkles className="w-4 h-4" />}
                {doomsdayMode ? 'DOOMSDAY PROTOCOL ACTIVE — RSCOE IT' : "JSPM's RSCOE — IT Department"}
              </div>

              {doomsdayMode ? (
                /* DIRECT IMPACT x DOOMSDAY TITLE */
                <h1
                  className="text-4xl sm:text-6xl lg:text-7xl font-black uppercase leading-none py-2 tracking-wider text-transparent bg-clip-text mb-6"
                  style={{
                    fontFamily: "'Orbitron', 'Montserrat', 'Syne', sans-serif",
                    backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #a7f3d0 35%, #22c55e 75%, #15803d 100%)',
                    textShadow: '0 0 35px rgba(34, 197, 94, 0.6), 0 0 75px rgba(34, 197, 94, 0.3)',
                    letterSpacing: '0.12em',
                  }}
                >
                  IMPACT <span className="text-emerald-400 font-light mx-2">x</span> DOOMSDAY
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

              <p className={`text-lg leading-relaxed mb-8 ${hasImagesToDisplay ? 'max-w-xl' : 'max-w-2xl mx-auto'} ${
                doomsdayMode ? 'text-emerald-100/90' : 'text-slate-600'
              }`}>
                {doomsdayMode
                  ? 'The high-voltage cyber protocol is active across all department networks, registrations, and quantum channels.'
                  : 'The Student Association of Information Technology — a student-led association fostering innovation, collaboration, and excellence in the IT department at JSPM\'s Rajarshi Shahu College of Engineering.'}
              </p>

              <div className={`flex flex-wrap gap-4 ${!hasImagesToDisplay ? 'justify-center' : ''}`}>
                <Link to="/apply" className="btn-primary">
                  Join SAInT <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="#events" className="btn-outline">View Events</a>
              </div>
            </div>

            {/* Landing Images Showcase Gallery (Multiple Images Support) */}
            {hasImagesToDisplay && (
              <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <div className={`grid gap-4 ${
                  images.length === 1
                    ? 'grid-cols-1'
                    : images.length === 2
                    ? 'grid-cols-2'
                    : 'grid-cols-2 sm:grid-cols-2'
                }`}>
                  {images.map((img, i) => (
                    <div
                      key={i}
                      className={`group relative rounded-2xl overflow-hidden shadow-xl border transition-all duration-500 hover:scale-[1.02] ${
                        doomsdayMode
                          ? 'border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.2)] bg-black/60'
                          : 'border-white/50 bg-white/10'
                      } ${
                        images.length > 2 && i === 0
                          ? 'col-span-2 h-52'
                          : images.length === 1
                          ? 'h-80'
                          : 'h-40'
                      }`}
                    >
                      <img
                        src={img}
                        alt={`SAInT showcase ${i + 1}`}
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
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <EventCardSkeleton count={3} />
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
                      <img src={event.imageURL} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
                            <img src={u.photoURL} alt="" className="w-20 h-20 rounded-full mx-auto mb-3 object-cover ring-4 ring-blue-100" />
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
                  <img src="/images/faculty-coordinator.jpg" alt="Faculty Coordinator" className="w-full h-full object-cover" />
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
                  <img src="/images/hod-it.jpg" alt="Chairman of the Club" className="w-full h-full object-cover" />
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
