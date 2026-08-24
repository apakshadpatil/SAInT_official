import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { subscribeEvents, subscribeEventTickets, mergeEventWithTickets, updateEvent } from '../../services/eventService';
import type { EventRecord, EventTicket, EventWinner } from '../../types';
import { isCoreMember } from '../../utils/permissions';
import { Plus, Trash2, ArrowRight, Award } from 'lucide-react';

function now() {
  return new Date().toISOString();
}

export default function WinnersPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [participantId, setParticipantId] = useState('');
  const [manualName, setManualName] = useState('');
  const [position, setPosition] = useState('Winner');
  const [rank, setRank] = useState('1');
  const [prize, setPrize] = useState('');
  const [domainId, setDomainId] = useState('');
  const [loading, setLoading] = useState(false);

  const rawSelectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? events[0] ?? null,
    [events, selectedEventId]
  );

  useEffect(() => {
    if (!rawSelectedEvent?.id) {
      setTickets([]);
      return;
    }
    const unsub = subscribeEventTickets(rawSelectedEvent.id, setTickets);
    return () => unsub();
  }, [rawSelectedEvent?.id]);

  const selectedEvent = useMemo(() => {
    if (!rawSelectedEvent) return null;
    return mergeEventWithTickets(rawSelectedEvent, tickets);
  }, [rawSelectedEvent, tickets]);

  useEffect(() => {
    const unsubscribe = subscribeEvents((allEvents) => {
      setEvents(allEvents);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!selectedEventId && events.length > 0) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  if (!isCoreMember(profile)) {
    return (
      <div className="rounded-3xl border p-12 text-center" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
        <p className="text-lg font-semibold" style={{ color: 'var(--dash-text)' }}>Access denied</p>
        <p className="mt-3 text-sm" style={{ color: 'var(--dash-muted)' }}>
          Event winners management is only available to Core Team members and Super Admins.
        </p>
      </div>
    );
  }

  const sortedEvents = [...events].sort((a, b) => b.date.localeCompare(a.date));
  const participants = selectedEvent?.participants || [];
  const winners = selectedEvent?.winners ? [...selectedEvent.winners].sort((a, b) => a.rank - b.rank) : [];

  const handleAddWinner = async () => {
    if (!selectedEvent) return;
    if (!position.trim()) {
      showToast('Enter a winner position or title', 'error');
      return;
    }
    const name = participantId
      ? participants.find((participant) => participant.id === participantId)?.name || manualName.trim()
      : manualName.trim();
    if (!name) {
      showToast('Select a participant or enter a winner name', 'error');
      return;
    }

    const selectedParticipant = participants.find((participant) => participant.id === participantId);
    const domain = selectedEvent.participantDomains?.find((domainItem) => domainItem.id === domainId);

    const newWinner: EventWinner = {
      id: `winner-${Date.now()}`,
      eventId: selectedEvent.id,
      participantId: selectedParticipant?.id,
      participantName: name,
      participantEmail: selectedParticipant?.email,
      position: position.trim(),
      rank: Number(rank) || 1,
      prize: prize.trim() || undefined,
      domainId: domain?.id,
      domainName: domain?.name,
      createdAt: now(),
      updatedAt: now(),
    };

    setLoading(true);
    try {
      const nextWinners = [...winners, newWinner];
      await updateEvent(selectedEvent.id, { winners: nextWinners });
      setParticipantId('');
      setManualName('');
      setPosition('Winner');
      setRank('1');
      setPrize('');
      setDomainId('');
      showToast('Winner added to event', 'success');
    } catch (err) {
      showToast('Failed to add winner', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveWinner = async (winnerId: string) => {
    if (!selectedEvent) return;
    if (!window.confirm('Remove this winner entry from the event?')) return;

    setLoading(true);
    try {
      const nextWinners = (selectedEvent.winners || []).filter((winner) => winner.id !== winnerId);
      await updateEvent(selectedEvent.id, { winners: nextWinners });
      showToast('Winner removed', 'success');
    } catch (err) {
      showToast('Failed to remove winner', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] font-semibold text-blue-500">Event Winners</p>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--dash-text)' }}>Manage Event Winners & Runner-ups</h1>
          <p className="mt-2 text-sm max-w-2xl" style={{ color: 'var(--dash-muted)' }}>
            Assign winners for each event, preserve domain-specific results when enabled, and publish a public winners timeline.
          </p>
        </div>
        <Link
          to="/dashboard/events"
          className="btn-secondary inline-flex items-center gap-2"
        >
          <ArrowRight className="w-4 h-4" /> View Events
        </Link>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-6">
        <div className="space-y-3">
          <div className="rounded-3xl border p-5" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
            <h2 className="font-semibold mb-4" style={{ color: 'var(--dash-text)' }}>Select Event</h2>
            <div className="space-y-2">
              {sortedEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-center" style={{ borderColor: 'var(--dash-border)' }}>
                  <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>No events available yet.</p>
                </div>
              ) : (
                sortedEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedEventId(event.id)}
                    className="w-full text-left rounded-2xl border p-4 transition-all hover:border-blue-400"
                    style={{
                      borderColor: selectedEvent?.id === event.id ? 'var(--dash-accent)' : 'var(--dash-border)',
                      background: selectedEvent?.id === event.id ? 'rgba(37,99,235,0.08)' : 'transparent',
                      color: 'var(--dash-text)',
                    }}
                  >
                    <p className="font-semibold truncate">{event.title}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
                      {new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {selectedEvent && (
            <div className="rounded-3xl border p-5" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
              <h3 className="font-semibold mb-4" style={{ color: 'var(--dash-text)' }}>Event Quick Stats</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)' }}>
                  <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--dash-muted)' }}>Participants</p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>{participants.length}</p>
                </div>
                <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)' }}>
                  <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--dash-muted)' }}>Assigned Winners</p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>{winners.length}</p>
                </div>
                <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)' }}>
                  <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--dash-muted)' }}>Domains</p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>{selectedEvent.enableDomainSelection ? selectedEvent.participantDomains?.length || 0 : 0}</p>
                </div>
                <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)' }}>
                  <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--dash-muted)' }}>Status</p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>{selectedEvent.status}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {!selectedEvent ? (
            <div className="rounded-3xl border p-10 text-center" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
              <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>Select an event from the left to manage winners.</p>
            </div>
          ) : (
            <>
              <div className="rounded-3xl border p-6" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold" style={{ color: 'var(--dash-text)' }}>{selectedEvent.title}</h2>
                    <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>{selectedEvent.description || 'Assign winners and runner-up placements for this event.'}</p>
                  </div>
                  <Link to={`/dashboard/events/${selectedEvent.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
                    View Event <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)' }}>
                    <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--dash-muted)' }}>Event Date</p>
                    <p className="mt-2 font-semibold" style={{ color: 'var(--dash-text)' }}>{new Date(selectedEvent.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)' }}>
                    <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--dash-muted)' }}>Domain Results</p>
                    <p className="mt-2 font-semibold" style={{ color: 'var(--dash-text)' }}>
                      {selectedEvent.enableDomainSelection ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border p-6" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-semibold" style={{ color: 'var(--dash-text)' }}>Winners Roster</h3>
                    <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>Review assigned winners and remove entries as needed.</p>
                  </div>
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-700">{winners.length} entries</span>
                </div>

                {winners.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: 'var(--dash-border)' }}>
                    <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>No winners assigned for this event yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {winners.map((winner) => (
                      <div key={winner.id} className="rounded-2xl border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--dash-border)', background: 'rgba(255,255,255,0.03)' }}>
                        <div>
                          <p className="font-semibold" style={{ color: 'var(--dash-text)' }}>
                            {winner.position} — {winner.participantName}
                          </p>
                          <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>
                            Rank {winner.rank}{winner.domainName ? ` · ${winner.domainName}` : ''}{winner.prize ? ` · ${winner.prize}` : ''}
                          </p>
                          {winner.participantEmail && (
                            <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>{winner.participantEmail}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveWinner(winner.id)}
                          disabled={loading}
                          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold text-red-600 transition-all hover:bg-red-50"
                          style={{ borderColor: 'rgba(248,113,113,0.25)' }}
                        >
                          <Trash2 className="w-4 h-4" /> Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border p-6" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
                <div className="flex items-center gap-3 mb-4">
                  <Award className="w-5 h-5 text-amber-500" />
                  <div>
                    <h3 className="font-semibold" style={{ color: 'var(--dash-text)' }}>Add Winner / Runner-up</h3>
                    <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>Choose an existing participant or add a manual result entry.</p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <label className="text-sm font-medium" style={{ color: 'var(--dash-text)' }}>Participant</label>
                    <select
                      value={participantId}
                      onChange={(e) => setParticipantId(e.target.value)}
                      className="input-field"
                    >
                      <option value="">Select existing participant</option>
                      {participants.map((participant) => (
                        <option key={participant.id} value={participant.id}>{participant.name} — {participant.email || 'No email'}</option>
                      ))}
                    </select>
                    <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
                      Or leave blank and enter a manual winner name below.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium" style={{ color: 'var(--dash-text)' }}>Winner Name</label>
                    <input
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="input-field"
                      placeholder="Manual entry if no participant available"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium" style={{ color: 'var(--dash-text)' }}>Position</label>
                    <input
                      type="text"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      className="input-field"
                      placeholder="Winner, Runner-up, 3rd Place"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium" style={{ color: 'var(--dash-text)' }}>Rank</label>
                    <input
                      type="number"
                      min="1"
                      value={rank}
                      onChange={(e) => setRank(e.target.value)}
                      className="input-field"
                      placeholder="1"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium" style={{ color: 'var(--dash-text)' }}>Prize / Award</label>
                    <input
                      type="text"
                      value={prize}
                      onChange={(e) => setPrize(e.target.value)}
                      className="input-field"
                      placeholder="Example: ₹5,000 or Certificate"
                    />
                  </div>

                  {selectedEvent.enableDomainSelection && selectedEvent.participantDomains?.length ? (
                    <div className="space-y-3">
                      <label className="text-sm font-medium" style={{ color: 'var(--dash-text)' }}>Domain</label>
                      <select
                        value={domainId}
                        onChange={(e) => setDomainId(e.target.value)}
                        className="input-field"
                      >
                        <option value="">Select domain (optional)</option>
                        {selectedEvent.participantDomains.map((domain) => (
                          <option key={domain.id} value={domain.id}>{domain.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleAddWinner}
                    disabled={loading}
                    className="btn-primary"
                  >
                    <Plus className="w-4 h-4" /> Add Winner
                  </button>
                  <p className="text-xs text-slate-500">Entries are saved instantly and will appear on public result timelines once the event is completed.</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
