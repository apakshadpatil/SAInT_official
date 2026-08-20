import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, Sparkles, ArrowRight, ChevronRight, MapPin, Ticket } from 'lucide-react';
import { getSiteMembers, getFacultyCoordinator, getHomeImages } from '../../services/applicationService';
import { getPositionHolders } from '../../services/positionService';
import { getPublishedUpcomingEvents } from '../../services/eventService';
import type { EventRecord } from '../../types';

export default function HomePage() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string; role: string; photoURL?: string }[]>([]);
  const [faculty, setFaculty] = useState<{ name: string; designation: string; email?: string; photoURL?: string } | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [positions, setPositions] = useState<{ position: { title: string }; users: { displayName: string; photoURL?: string }[] }[]>([]);

  useEffect(() => {
    getPublishedUpcomingEvents().then(setEvents).catch(() => {});
    getSiteMembers().then((m: unknown[]) => m.length && setMembers(m as typeof members)).catch(() => {});
    getFacultyCoordinator().then((f: unknown) => f && setFaculty(f as typeof faculty)).catch(() => {});
    getHomeImages().then(setImages).catch(() => {});
    getPositionHolders().then((p) => setPositions(p as typeof positions)).catch(() => {});
  }, []);

  return (
    <div>
      {/* Hero */}
      <section id="home" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 via-white/90 to-blue-100/60" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold mb-6">
                <Sparkles className="w-4 h-4" />
                JSPM&apos;s RSCOE — IT Department
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
                Welcome to{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-900">SAInT</span>
              </h1>
              <p className="text-lg text-slate-600 leading-relaxed mb-8 max-w-xl">
                The Student Association of Information Technology — a student-led association fostering innovation,
                collaboration, and excellence in the IT department at JSPM&apos;s Rajarshi Shahu College of Engineering.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/apply" className="btn-primary">
                  Join SAInT <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="#events" className="btn-outline">View Events</a>
              </div>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                {images.slice(0, 4).map((img, i) => (
                  <div
                    key={i}
                    className={`rounded-2xl overflow-hidden shadow-xl border border-white/50 ${i === 0 ? 'col-span-2 h-48' : 'h-36'}`}
                  >
                    <img src={img} alt={`SAInT activity ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                  </div>
                ))}
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

          {events.length === 0 ? (
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
            <div className="card bg-gradient-to-br from-blue-600 to-blue-900 !border-0 text-white overflow-hidden">
              <div className="flex items-center gap-6">
                <div className="w-32 h-32 shrink-0 rounded-full overflow-hidden ring-4 ring-white/20">
                  <img src="/images/faculty-coordinator.jpg" alt="Faculty Coordinator" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-blue-200 text-sm font-semibold uppercase tracking-wider mb-2">Faculty Coordinator</p>
                  <h3 className="text-2xl font-bold mb-1">{faculty?.name || 'Dr. Pallavi Tekade'}</h3>
                  <p className="text-blue-200">{faculty?.designation || 'Faculty Coordinator — IT Department'}</p>
                  {faculty?.email && <p className="text-sm text-blue-100 mt-2">{faculty.email}</p>}
                </div>
              </div>
            </div>

            <div className="card bg-gradient-to-br from-slate-800 to-slate-900 !border-0 text-white overflow-hidden">
              <div className="flex items-center gap-6">
                <div className="w-32 h-32 shrink-0 rounded-full overflow-hidden ring-4 ring-white/20">
                  <img src="/images/hod-it.jpg" alt="Chairman of the Club" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-slate-300 text-sm font-semibold uppercase tracking-wider mb-2">Chairman</p>
                  <h3 className="text-2xl font-bold mb-1">Dr. Nihar Ranjan</h3>
                  <p className="text-slate-300">Head of Department — Information Technology</p>
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
