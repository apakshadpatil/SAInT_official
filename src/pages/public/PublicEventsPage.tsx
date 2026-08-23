import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, MapPin, Clock, Ticket, Search, X,
  LayoutGrid, List, Sparkles, Zap, Filter,
  Users
} from 'lucide-react';
import { subscribePublishedUpcomingEvents } from '../../services/eventService';
import { subscribeSiteSettings } from '../../services/applicationService';
import type { EventRecord } from '../../types';
import { EventCardSkeleton } from '../../components/ui/skeleton';

export default function PublicEventsPage() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'tile' | 'detailed'>('tile');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [doomsdayMode, setDoomsdayMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('saint_doomsday_mode') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const unsub = subscribeSiteSettings((settings) => {
      const active = Boolean(settings?.doomsdayMode);
      setDoomsdayMode(active);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribePublishedUpcomingEvents((list) => {
      setEvents(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    events.forEach(e => { if (e.category) set.add(e.category); });
    return ['all', ...Array.from(set)];
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const matchCat = selectedCategory === 'all' || e.category?.toLowerCase() === selectedCategory.toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q ||
        e.title.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.location && e.location.toLowerCase().includes(q)) ||
        (e.tags && e.tags.some(t => t.toLowerCase().includes(q)));
      return matchCat && matchQuery;
    });
  }, [events, selectedCategory, searchQuery]);

  return (
    <div className={`min-h-screen relative pb-20 ${doomsdayMode ? 'bg-[#050505] text-white' : 'bg-slate-50/50 text-slate-900'}`}>
      {/* Doomsday Green Smoke Animation Background — strictly NO lightning */}
      {doomsdayMode && (
        <div className="doomsday-green-smoke">
          <div className="smoke-cloud-1" />
          <div className="smoke-cloud-2" />
          <div className="smoke-cloud-3" />
        </div>
      )}

      {/* Header Banner */}
      <section className={`relative z-10 pt-12 pb-14 px-4 sm:px-6 lg:px-8 border-b ${doomsdayMode ? 'border-emerald-500/20 bg-black/40' : 'border-slate-200/80 bg-gradient-to-b from-blue-50/80 via-white to-transparent'}`}>
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm" style={doomsdayMode ? { background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' } : { background: 'rgba(37,99,235,0.08)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.2)' }}>
            {doomsdayMode ? <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{doomsdayMode ? 'DOOMSDAY PORTAL — ACTIVE EVENTS' : 'SAInT IT Events Portal'}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight" style={doomsdayMode ? { color: '#ffffff', textShadow: '0 0 25px rgba(16,185,129,0.35)' } : { color: '#0f172a' }}>
            Upcoming {doomsdayMode ? <span className="text-emerald-400">Events & Hackathons</span> : <span className="text-blue-600">Events &amp; Activities</span>}
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base leading-relaxed" style={{ color: doomsdayMode ? '#94a3b8' : '#64748b' }}>
            Discover department hackathons, workshops, guest lectures, and competitions. Register instantly and get your digital QR entry ticket.
          </p>
        </div>
      </section>

      {/* Controls: Search, View Mode Toggle, Category Filters */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 relative z-10">
        <div className="p-4 sm:p-5 rounded-2xl border shadow-sm backdrop-blur-md transition-all space-y-4" style={doomsdayMode ? { background: 'rgba(10,15,10,0.85)', borderColor: 'rgba(16,185,129,0.25)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' } : { background: '#ffffff', borderColor: '#e2e8f0', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)' }}>
          {/* Top Row: Search input + View Switcher */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search bar with glow, icons and clear button */}
            <div className="relative flex-1 group">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none" style={{ color: doomsdayMode ? '#34d399' : searchQuery ? '#2563eb' : '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search events by title, description, venue, tags..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-24 py-2.5 text-xs sm:text-sm rounded-xl outline-none transition-all focus:ring-2"
                style={doomsdayMode ? {
                  background: '#090909',
                  border: '1px solid rgba(16,185,129,0.3)',
                  color: '#ffffff'
                } : {
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a'
                }}
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md font-mono shrink-0" style={doomsdayMode ? { background: 'rgba(16,185,129,0.2)', color: '#34d399' } : { background: '#eff6ff', color: '#2563eb' }}>
                  {filteredEvents.length} found
                </span>
              </div>
            </div>

            {/* View Mode Switcher (Tile vs Detailed) */}
            <div className="flex items-center gap-1 p-1 rounded-xl border shrink-0 self-end md:self-auto" style={doomsdayMode ? { background: '#000', borderColor: 'rgba(16,185,129,0.3)' } : { background: '#f1f5f9', borderColor: '#e2e8f0' }}>
              <button
                onClick={() => setViewMode('tile')}
                title="Tile Format (Grid Cards)"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${viewMode === 'tile' ? (doomsdayMode ? 'bg-emerald-500 text-black font-bold' : 'bg-white shadow text-blue-600') : 'text-slate-500 hover:text-slate-800'}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                onClick={() => setViewMode('detailed')}
                title="Detailed Format (Expanded List)"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${viewMode === 'detailed' ? (doomsdayMode ? 'bg-emerald-500 text-black font-bold' : 'bg-white shadow text-blue-600') : 'text-slate-500 hover:text-slate-800'}`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>
          </div>

          {/* Bottom Row: Category Chips with Filter Icon */}
          <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: doomsdayMode ? 'rgba(16,185,129,0.15)' : '#f1f5f9' }}>
            <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider shrink-0" style={{ color: doomsdayMode ? '#34d399' : '#64748b' }}>
              <Filter className="w-3 h-3" /> Filter:
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1 scrollbar-none">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="px-3 py-1 rounded-lg font-semibold uppercase text-[10px] tracking-wider transition-all capitalize whitespace-nowrap cursor-pointer"
                  style={selectedCategory === cat
                    ? (doomsdayMode ? { background: '#10b981', color: '#000000', fontWeight: 'bold' } : { background: '#2563eb', color: '#ffffff', boxShadow: '0 2px 8px rgba(37,99,235,0.25)' })
                    : (doomsdayMode ? { background: 'rgba(16,185,129,0.1)', color: '#a7f3d0', border: '1px solid rgba(16,185,129,0.2)' } : { background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' })
                  }
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Events Grid / List */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 relative z-10">
        {loading ? (
          viewMode === 'detailed' ? (
            <EventCardSkeleton count={4} viewMode="list" />
          ) : (
            <EventCardSkeleton count={6} viewMode="grid" />
          )
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed" style={doomsdayMode ? { borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(10,15,10,0.4)' } : { borderColor: '#cbd5e1', background: '#ffffff' }}>
            <Calendar className="w-12 h-12 mx-auto mb-3" style={{ color: doomsdayMode ? '#34d399' : '#94a3b8' }} />
            <h3 className="text-base font-bold" style={{ color: doomsdayMode ? '#ffffff' : '#0f172a' }}>No matching upcoming events</h3>
            <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: doomsdayMode ? '#94a3b8' : '#64748b' }}>Try changing your search keywords or switching category filters.</p>
          </div>
        ) : viewMode === 'tile' ? (
          /* ── TILE FORMAT (GRID OF CARDS) ── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map(event => (
              <div
                key={event.id}
                className="group rounded-xl border overflow-hidden flex flex-col transition-all duration-300 hover:shadow-xl"
                style={doomsdayMode ? { background: '#0a0d0a', borderColor: 'rgba(16,185,129,0.25)' } : { background: '#ffffff', borderColor: '#e2e8f0' }}
              >
                {/* Image Banner */}
                {event.imageURL ? (
                  <div className="h-44 overflow-hidden relative shrink-0">
                    <img src={event.imageURL} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    {event.category && (
                      <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md" style={doomsdayMode ? { background: 'rgba(0,0,0,0.8)', color: '#34d399', border: '1px solid rgba(16,185,129,0.4)' } : { background: 'rgba(255,255,255,0.9)', color: '#2563eb' }}>
                        {event.category}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="h-44 flex items-center justify-center shrink-0" style={doomsdayMode ? { background: 'linear-gradient(135deg, #064e3b, #022c22)' } : { background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>
                    <Calendar className="w-12 h-12 text-white/30" />
                  </div>
                )}

                {/* Content */}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center gap-2 text-xs font-semibold mb-2" style={{ color: doomsdayMode ? '#34d399' : '#2563eb' }}>
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>{new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span>·</span>
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>{event.startTime}</span>
                  </div>

                  <h3 className="text-lg font-bold line-clamp-1 mb-2 group-hover:underline" style={{ color: doomsdayMode ? '#ffffff' : '#0f172a' }}>
                    {event.title}
                  </h3>

                  <p className="text-xs leading-relaxed flex-1 line-clamp-3 mb-4" style={{ color: doomsdayMode ? '#94a3b8' : '#64748b' }}>
                    {event.description}
                  </p>

                  <div className="flex items-center gap-1.5 text-xs mb-4" style={{ color: doomsdayMode ? '#6ee7b7' : '#475569' }}>
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-red-500" />
                    <span className="truncate">{event.location}{event.venue ? ` · ${event.venue}` : ''}</span>
                  </div>

                  {/* Register Button */}
                  <Link
                    to={`/events/${event.id}/register`}
                    className="w-full py-2.5 px-4 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:scale-[1.02]"
                    style={doomsdayMode
                      ? { background: 'linear-gradient(135deg, #10b981, #059669)', color: '#000000', boxShadow: '0 4px 15px rgba(16,185,129,0.3)' }
                      : { background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#ffffff' }
                    }
                  >
                    <Ticket className="w-4 h-4" />
                    <span>Register &amp; Get Ticket</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── DETAILED FORMAT (EXPANDED RICH LIST) ── */
          <div className="space-y-4">
            {filteredEvents.map(event => (
              <div
                key={event.id}
                className="p-5 sm:p-6 rounded-xl border flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 transition-all hover:shadow-lg"
                style={doomsdayMode ? { background: '#0a0d0a', borderColor: 'rgba(16,185,129,0.25)' } : { background: '#ffffff', borderColor: '#e2e8f0' }}
              >
                {/* Left Side: Thumbnail & Meta */}
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden shrink-0 border" style={{ borderColor: doomsdayMode ? 'rgba(16,185,129,0.3)' : '#e2e8f0' }}>
                    {event.imageURL ? (
                      <img src={event.imageURL} alt={event.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={doomsdayMode ? { background: '#064e3b' } : { background: '#2563eb' }}>
                        <Calendar className="w-8 h-8 text-white/40" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" style={doomsdayMode ? { background: 'rgba(16,185,129,0.15)', color: '#34d399' } : { background: '#eff6ff', color: '#2563eb' }}>
                        {event.category || 'Event'}
                      </span>
                      <span className="text-xs flex items-center gap-1 font-semibold" style={{ color: doomsdayMode ? '#34d399' : '#2563eb' }}>
                        <Calendar className="w-3 h-3" />
                        {new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · {event.startTime}
                      </span>
                    </div>

                    <h3 className="text-xl font-black" style={{ color: doomsdayMode ? '#ffffff' : '#0f172a' }}>
                      {event.title}
                    </h3>

                    <p className="text-xs leading-relaxed line-clamp-2" style={{ color: doomsdayMode ? '#94a3b8' : '#64748b' }}>
                      {event.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs pt-1" style={{ color: doomsdayMode ? '#6ee7b7' : '#475569' }}>
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-red-500" />{event.location}{event.venue ? ` (${event.venue})` : ''}</span>
                      {event.maxAttendees && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-purple-500" />Max {event.maxAttendees} seats</span>}
                    </div>
                  </div>
                </div>

                {/* Right Side: Register Action */}
                <div className="w-full lg:w-56 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0" style={{ borderColor: doomsdayMode ? 'rgba(16,185,129,0.2)' : '#f1f5f9' }}>
                  <Link
                    to={`/events/${event.id}/register`}
                    className="w-full py-3 px-4 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:scale-[1.02]"
                    style={doomsdayMode
                      ? { background: 'linear-gradient(135deg, #10b981, #059669)', color: '#000000', boxShadow: '0 4px 15px rgba(16,185,129,0.3)' }
                      : { background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#ffffff' }
                    }
                  >
                    <Ticket className="w-4 h-4" />
                    <span>Register Now</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
