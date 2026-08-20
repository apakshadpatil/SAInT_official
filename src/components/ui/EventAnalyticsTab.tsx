import type { EventRecord } from '../../types';

interface EventAnalyticsTabProps {
  event: EventRecord;
}

export default function EventAnalyticsTab({ event }: EventAnalyticsTabProps) {
  const participants = event.participants || [];
  const arrived = participants.filter((participant) => participant.arrived).length;
  const pending = participants.length - arrived;
  const registrationRate = participants.length ? Math.round((participants.length / Math.max(1, participants.length)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)' }}>
          <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>Total Registrations</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--dash-text)' }}>{participants.length}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)' }}>
          <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>Checked In</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{arrived}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)' }}>
          <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>Pending</p>
          <p className="text-2xl font-bold mt-1 text-amber-600">{pending}</p>
        </div>
      </div>

      <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--dash-border)' }}>
        <h4 className="font-semibold mb-3" style={{ color: 'var(--dash-text)' }}>Summary</h4>
        <div className="space-y-3 text-sm" style={{ color: 'var(--dash-muted)' }}>
          <div className="flex items-center justify-between rounded-xl p-3" style={{ background: 'var(--dash-card)' }}>
            <span>Registration rate</span>
            <span className="font-semibold text-blue-600">{registrationRate}%</span>
          </div>
          <div className="flex items-center justify-between rounded-xl p-3" style={{ background: 'var(--dash-card)' }}>
            <span>Domains enabled</span>
            <span className="font-semibold" style={{ color: 'var(--dash-text)' }}>{event.enableDomainSelection ? (event.participantDomains?.length || 0) : 0}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl p-3" style={{ background: 'var(--dash-card)' }}>
            <span>Ticketing enabled</span>
            <span className="font-semibold" style={{ color: event.ticketingEnabled ? '#10b981' : '#f59e0b' }}>{event.ticketingEnabled ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
