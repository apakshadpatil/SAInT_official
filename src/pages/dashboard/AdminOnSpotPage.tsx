import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, Calendar } from 'lucide-react';
import OnSpotRegistrationForm from '../../components/registration/OnSpotRegistrationForm';

export default function AdminOnSpotPage() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId') || searchParams.get('event') || undefined;

  return (
    <div className="space-y-6">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b" style={{ borderColor: 'var(--dash-border)' }}>
        <div className="flex items-center gap-3">
          <Link
            to={eventId ? `/dashboard/events/${eventId}` : '/dashboard/registrations'}
            className="p-2 rounded-xl border hover:bg-slate-800 transition-colors"
            style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-muted)' }}
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold" style={{ color: 'var(--dash-text)' }}>
                Admin On-Spot Desk
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Desk Mode
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--dash-muted)' }}>
              Issue instant passes, collect cash or verify UPI UTRs at the event venue.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/dashboard/registrations"
            className="btn-secondary !text-xs !py-2 !px-3 flex items-center gap-1.5"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>View All Registrations</span>
          </Link>
          <Link
            to="/dashboard/events"
            className="btn-secondary !text-xs !py-2 !px-3 flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Events</span>
          </Link>
        </div>
      </div>

      {/* Main Registration Form Container */}
      <div className="py-2">
        <OnSpotRegistrationForm mode="admin" initialEventId={eventId} showHeader={false} />
      </div>
    </div>
  );
}
