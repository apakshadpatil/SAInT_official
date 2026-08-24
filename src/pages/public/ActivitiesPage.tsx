import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, MapPin, Users, Award, Ticket, ArrowRight } from 'lucide-react';
import { subscribePublishedActivities } from '../../services/eventService';
import type { EventRecord } from '../../types';
import { EventCardSkeleton } from '../../components/ui/skeleton';

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribePublishedActivities((list) => {
      setActivities(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const formatDate = (start: string, end?: string) => {
    if (!start) return '';
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    const s = new Date(start).toLocaleDateString('en-IN', opts);
    if (end && end !== start) {
      return `${s} — ${new Date(end).toLocaleDateString('en-IN', opts)}`;
    }
    return s;
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-secondary)' }}>
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-700 via-indigo-800 to-blue-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4">
          <Link to="/" className="inline-flex items-center gap-2 text-blue-200 hover:text-white mb-6 text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Our Activities & Events</h1>
          <p className="text-blue-100 text-lg max-w-2xl leading-relaxed">
            A comprehensive record and archive of hackathons, technical workshops, seminars, and guest sessions organized under SAInT at JSPM&apos;s RSCOE IT Department.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-16">
        {loading ? (
          <EventCardSkeleton count={3} viewMode="timeline" />
        ) : activities.length === 0 ? (
          <div className="text-center py-20 bg-white/50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
            <Calendar className="w-14 h-14 text-blue-400 mx-auto mb-4 opacity-70" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">No activities recorded yet</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto">
              Events and activities organized by the SAInT committee will appear here.
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline vertical stem line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-600 via-indigo-400 to-blue-200" />

            <div className="space-y-12">
              {activities.map((activity, index) => (
                <div key={activity.id} className="relative pl-16 animate-fade-in-up" style={{ animationDelay: `${index * 0.08}s` }}>
                  {/* Timeline node icon indicator */}
                  <div className="absolute left-3.5 top-6 w-5 h-5 rounded-full bg-blue-600 border-4 border-white dark:border-slate-900 shadow-md z-10" />

                  {/* Card container — Pure Crisp White */}
                  <div className="overflow-hidden !p-0 rounded-3xl border border-slate-200/90 bg-white shadow-sm hover:shadow-xl transition-all duration-300">
                    {activity.imageURL && (
                      <div className="h-56 sm:h-64 w-full overflow-hidden relative group bg-slate-100">
                        <img
                          src={activity.imageURL}
                          alt={activity.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        {activity.category && (
                          <div className="absolute top-4 left-4">
                            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-black/60 backdrop-blur-md text-white border border-white/20">
                              {activity.category}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="p-6 sm:p-8 bg-white">
                      {/* Meta badges: Date, Time, Location, Teams */}
                      <div className="flex flex-wrap items-center gap-2.5 mb-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                          <Calendar className="w-3.5 h-3.5 text-blue-600" />
                          {formatDate(activity.date, (activity as any).endDate)}
                        </span>

                        {((activity as any).time || activity.startTime) && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            {(activity as any).time || (activity.endTime ? `${activity.startTime} - ${activity.endTime}` : activity.startTime)}
                          </span>
                        )}

                        {(activity.location || activity.venue) && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            <MapPin className="w-3.5 h-3.5 text-rose-500" />
                            {activity.location || activity.venue}
                          </span>
                        )}

                        {activity.teamsEnabled && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            <Users className="w-3.5 h-3.5 text-indigo-600" />
                            Team Event ({activity.minTeamSize || 2}-{activity.maxTeamSize || 4} members)
                          </span>
                        )}
                      </div>

                      {/* Title & Description */}
                      <h3 className="text-2xl font-bold text-slate-900 mb-2 leading-tight">
                        {activity.title}
                      </h3>
                      <p className="text-slate-600 text-sm leading-relaxed mb-6 whitespace-pre-line">
                        {activity.description}
                      </p>

                      {/* Domains Covered */}
                      {activity.participantDomains && activity.participantDomains.length > 0 && (
                        <div className="mb-6">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Domains & Tracks
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {activity.participantDomains.map((d) => (
                              <span
                                key={d.id}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200"
                              >
                                {d.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Event Winners Section */}
                      {activity.winners && activity.winners.length > 0 && (
                        <div className="mt-6 rounded-2xl border p-5 bg-gradient-to-br from-amber-500/10 via-blue-500/5 to-slate-50 border-amber-300/50">
                          <div className="flex items-center gap-2 text-amber-800 font-bold text-sm mb-4">
                            <Award className="w-4 h-4 text-amber-600" />
                            <span>Event Winners & Top Performers</span>
                          </div>
                          <div className="grid sm:grid-cols-2 gap-3">
                            {activity.winners
                              .slice()
                              .sort((a, b) => a.rank - b.rank)
                              .map((winner) => (
                                <div
                                  key={winner.id}
                                  className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-sm"
                                >
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 bg-amber-100 text-amber-800 border border-amber-300">
                                    #{winner.rank}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                                      {winner.position}
                                    </p>
                                    <p className="text-sm font-semibold text-slate-900 truncate">
                                      {winner.participantName}
                                    </p>
                                    {(winner.domainName || winner.prize) && (
                                      <p className="text-xs text-slate-500 mt-0.5">
                                        {winner.domainName ? `${winner.domainName}` : ''}
                                        {winner.domainName && winner.prize ? ' · ' : ''}
                                        {winner.prize ? `Prize: ${winner.prize}` : ''}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Register Link / Action */}
                      <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                        <Link
                          to={`/events/${activity.id}/register`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                        >
                          <Ticket className="w-3.5 h-3.5" /> Event Portal
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
