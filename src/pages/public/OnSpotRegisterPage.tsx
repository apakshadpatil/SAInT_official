import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, QrCode } from 'lucide-react';
import OnSpotRegistrationForm from '../../components/registration/OnSpotRegistrationForm';

export default function OnSpotRegisterPage() {
  const { eventId: routeEventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const queryEventId = searchParams.get('eventId') || searchParams.get('event');
  const eventId = routeEventId || queryEventId || undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-6 sm:py-12">
      {/* Top navbar breadcrumb */}
      <div className="max-w-xl mx-auto px-4 mb-4 flex items-center justify-between">
        <Link
          to={eventId ? `/events/${eventId}` : '/events'}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{eventId ? 'Back to Event Details' : 'Back to Events'}</span>
        </Link>

        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
          <QrCode className="w-3 h-3" /> On-Spot Registration
        </span>
      </div>

      <OnSpotRegistrationForm mode="participant" initialEventId={eventId} showHeader={true} />
    </div>
  );
}
