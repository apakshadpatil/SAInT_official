import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';
import { getEvents } from '../../services/eventService';
import type { EventRecord } from '../../types';

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<EventRecord[]>([]);

  useEffect(() => {
    getEvents()
      .then((events) => {
        const timelineEvents = events
          .filter((event) => event.status === 'published' || event.status === 'completed')
          .sort((a, b) => b.date.localeCompare(a.date));
        setActivities(timelineEvents);
      })
      .catch(() => {
        setActivities([]);
      });
  }, []);

  const formatDate = (start: string, end?: string) => {
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    const s = new Date(start).toLocaleDateString('en-IN', opts);
    if (end && end !== start) {
      return `${s} — ${new Date(end).toLocaleDateString('en-IN', opts)}`;
    }
    return s;
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-secondary)' }}>
      <div className="bg-gradient-to-br from-blue-700 to-blue-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4">
          <Link to="/" className="inline-flex items-center gap-2 text-blue-200 hover:text-white mb-6 text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Our Activities</h1>
          <p className="text-blue-100 text-lg max-w-2xl">
            A timeline of events and activities conducted under SAInT at JSPM&apos;s RSCOE IT Department.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-blue-400 to-blue-200" />

          {activities.map((activity, index) => (
            <div key={activity.id} className="relative pl-16 pb-12 last:pb-0 animate-fade-in-up" style={{ animationDelay: `${index * 0.1}s` }}>
              <div className="absolute left-3.5 w-5 h-5 rounded-full bg-blue-600 border-4 border-white shadow-md z-10" />

              <div className="card overflow-hidden !p-0 hover:shadow-lg transition-shadow">
                {activity.imageURL && (
                  <div className="h-48 overflow-hidden">
                    <img src={activity.imageURL} alt={activity.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-center gap-2 text-blue-600 text-sm font-semibold mb-2">
                    <Calendar className="w-4 h-4" />
                    {formatDate(activity.date)}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{activity.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-4">{activity.description}</p>

                  {activity.winners && activity.winners.length > 0 && (
                    <div className="rounded-3xl border p-4" style={{ borderColor: 'rgba(59,130,246,0.18)', background: 'rgba(59,130,246,0.04)' }}>
                      <p className="text-sm font-semibold text-blue-700 mb-3">Event Winners</p>
                      <div className="space-y-3">
                        {activity.winners
                          .slice()
                          .sort((a, b) => a.rank - b.rank)
                          .map((winner) => (
                            <div key={winner.id} className="flex items-start gap-3">
                              <span className="mt-1 w-2 h-2 rounded-full bg-blue-600" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-slate-900">{winner.position} — {winner.participantName}</p>
                                <p className="text-xs text-slate-500">
                                  Rank {winner.rank}{winner.domainName ? ` · ${winner.domainName}` : ''}{winner.prize ? ` · ${winner.prize}` : ''}
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
