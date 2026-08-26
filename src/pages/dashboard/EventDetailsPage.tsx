import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { subscribeEventById, subscribeEventTickets, mergeEventWithTickets, updateEvent, deleteEvent } from '../../services/eventService';
import type { EventRecord, EventTicket } from '../../types';
import { isSuperAdmin, isCoreMember } from '../../utils/permissions';
import { ArrowLeft, Ticket, QrCode, Image as ImageIcon, Users, MapPin, Settings, Trash2, Edit2, BarChart3, Layers, Sparkles, CalendarDays, Clock3, BadgeCheck, FormInput, Award, Users2, ClipboardCheck } from 'lucide-react';
import TicketingTab from '../../components/ui/TicketingTab';
import ScanTicketTab from '../../components/ui/ScanTicketTab';
import TicketDesignTab from '../../components/ui/TicketDesignTab';
import CustomFormTab from '../../components/ui/CustomFormTab';
import ParticipantsTab from '../../components/ui/ParticipantsTab';
import SpaceAllocationTab from '../../components/ui/SpaceAllocationTab';
import SettingsTab from '../../components/ui/SettingsTab';
import DomainsTab from '../../components/ui/DomainsTab';
import EventAnalyticsTab from '../../components/ui/EventAnalyticsTab';
import CertificateTab from '../../components/ui/CertificateTab';
import TeamRegistrationTab from '../../components/ui/TeamRegistrationTab';
import RulesTab from '../../components/ui/RulesTab';

type TabType = 'overview' | 'ticketing' | 'scan' | 'design' | 'form' | 'rules' | 'certificates' | 'participants' | 'teams' | 'allocation' | 'domains' | 'analytics' | 'settings';

export default function EventDetailsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showToast } = useToast();
  
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isEditing, setIsEditing] = useState(false);
  
  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  
  const canEdit = isSuperAdmin(profile) || isCoreMember(profile);
  const canDelete = isSuperAdmin(profile);

  useEffect(() => {
    if (!eventId) {
      showToast('Event ID not found', 'error');
      navigate('/dashboard/events');
      return undefined;
    }

    setLoading(true);
    let currentEvent: EventRecord | null = null;
    let currentTickets: EventTicket[] = [];

    const syncCombinedEvent = () => {
      if (!currentEvent) return;
      const combined = mergeEventWithTickets(currentEvent, currentTickets);
      setEvent(combined);
      if (!isEditing) {
        setEditTitle(combined.title);
        setEditDesc(combined.description);
      }
      setLoading(false);
    };

    const unsubscribeEvent = subscribeEventById(eventId, (eventData) => {
      if (!eventData) {
        showToast('Event not found', 'error');
        navigate('/dashboard/events');
        return;
      }
      currentEvent = eventData;
      syncCombinedEvent();
    });

    const unsubscribeTickets = subscribeEventTickets(eventId, (ticketsData) => {
      currentTickets = ticketsData;
      syncCombinedEvent();
    });

    return () => {
      unsubscribeEvent();
      unsubscribeTickets();
    };
  }, [eventId, isEditing, navigate, showToast]);

  const handleSaveChanges = async () => {
    if (!event) return;
    try {
      await updateEvent(event.id, {
        title: editTitle,
        description: editDesc,
      });
      setEvent({ ...event, title: editTitle, description: editDesc });
      setIsEditing(false);
      showToast('Event updated successfully', 'success');
    } catch (err) {
      showToast('Failed to update event', 'error');
    }
  };

  const handleDeleteEvent = async () => {
    if (!event || !canDelete) return;
    if (!window.confirm('Are you sure you want to delete this event? This cannot be undone.')) return;

    try {
      await deleteEvent(event.id);
      showToast('Event deleted successfully', 'success');
      navigate('/dashboard/events');
    } catch (err) {
      showToast('Failed to delete event', 'error');
    }
  };

  const handleEventUpdate = async (updates: Partial<EventRecord>) => {
    if (!event) return;
    await updateEvent(event.id, updates);
    setEvent({ ...event, ...updates });
  };

  const handleParticipantsChange = async (participants: EventRecord['participants']) => {
    if (!event) return;
    await updateEvent(event.id, { participants });
    setEvent({ ...event, participants });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="dash-card text-center py-16">
        <p className="text-lg font-semibold" style={{ color: 'var(--dash-text)' }}>Event not found</p>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: ImageIcon },
    { id: 'ticketing', label: 'Ticketing', icon: Ticket },
    { id: 'scan', label: 'Scan Ticket', icon: QrCode },
    { id: 'design', label: 'Ticket Design', icon: ImageIcon },
    { id: 'form', label: 'Form Builder', icon: FormInput },
    { id: 'rules', label: 'Rules & Rulebook', icon: ClipboardCheck },
    { id: 'certificates', label: 'Certificates', icon: Award },
    { id: 'participants', label: 'Participants', icon: Users },
    { id: 'teams', label: 'Teams', icon: Users2 },
    { id: 'allocation', label: 'Space Allocation', icon: MapPin },
    ...(event.enableDomainSelection ? [{ id: 'domains' as TabType, label: 'Domains', icon: Layers }] : []),
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    ...(canDelete ? [{ id: 'settings' as TabType, label: 'Settings', icon: Settings }] : []),
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="rounded-3xl border p-5 sm:p-6" style={{ borderColor: 'var(--dash-border)', background: 'linear-gradient(135deg, var(--dash-accent-soft), rgba(15, 23, 42, 0.03))' }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate('/dashboard/events')}
              className="rounded-2xl border p-2.5" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
            >
              <ArrowLeft className="w-5 h-5" style={{ color: 'var(--dash-text)' }} />
            </button>
            <div className="flex-1">
              {!isEditing ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
                      <BadgeCheck className="w-3.5 h-3.5" />
                      {event.status}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'rgba(59,130,246,0.12)', color: '#2563eb' }}>
                      <Sparkles className="w-3.5 h-3.5" />
                      Event Studio
                    </span>
                  </div>
                  <h1 className="text-3xl font-bold" style={{ color: 'var(--dash-text)' }}>{event.title}</h1>
                  <p className="text-sm mt-2" style={{ color: 'var(--dash-muted)' }}>
                    {event.description || 'A polished event workspace designed for organized registrations and smooth coordination.'}
                  </p>
                </>
              ) : (
                <div className="space-y-3 mb-4">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="input-field text-2xl font-bold"
                    placeholder="Event title"
                  />
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="input-field"
                    placeholder="Event description"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button onClick={handleSaveChanges} className="btn-primary">Save Changes</button>
                    <button onClick={() => setIsEditing(false)} className="btn-secondary">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
          {canEdit && !isEditing && (
            <div className="flex gap-2">
              <button onClick={() => setIsEditing(true)} className="rounded-2xl border p-2.5" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }} title="Edit event">
                <Edit2 className="w-5 h-5" style={{ color: 'var(--dash-text)' }} />
              </button>
              {canDelete && (
                <button onClick={handleDeleteEvent} className="rounded-2xl border p-2.5" style={{ borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(254,242,242,0.9)' }} title="Delete event">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {event.imageURL && (
        <div className="rounded-3xl overflow-hidden border" style={{ borderColor: 'var(--dash-border)' }}>
          <img src={event.imageURL} alt={event.title} className="w-full h-64 object-cover" />
        </div>
      )}

      <div className="grid md:grid-cols-4 gap-4">
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="w-4 h-4 text-blue-600" />
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--dash-muted)' }}>Date</p>
          </div>
          <p className="text-lg font-bold" style={{ color: 'var(--dash-text)' }}>{new Date(event.date).toLocaleDateString()}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Clock3 className="w-4 h-4 text-indigo-600" />
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--dash-muted)' }}>Time</p>
          </div>
          <p className="text-lg font-bold" style={{ color: 'var(--dash-text)' }}>{event.startTime} - {event.endTime}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--dash-muted)' }}>Location</p>
          </div>
          <p className="text-lg font-bold" style={{ color: 'var(--dash-text)' }}>{event.location}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-amber-600" />
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--dash-muted)' }}>Participants</p>
          </div>
          <p className="text-lg font-bold" style={{ color: 'var(--dash-text)' }}>{event.participantIds?.length || 0}</p>
        </div>
      </div>

      <div className="rounded-2xl border p-1.5" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 rounded-xl px-4 py-3 font-medium text-sm transition-all whitespace-nowrap"
                style={{
                  color: activeTab === tab.id ? '#ffffff' : 'var(--dash-muted)',
                  background: activeTab === tab.id ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'transparent',
                }}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border p-6" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--dash-text)' }}>Description</h3>
              <p style={{ color: 'var(--dash-muted)' }}>{event.description}</p>
            </div>
            <hr style={{ borderColor: 'var(--dash-border)' }} />
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--dash-muted)' }}>Venue</p>
                <p className="text-sm mt-1" style={{ color: 'var(--dash-text)' }}>{event.venue}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--dash-muted)' }}>Budget</p>
                <p className="text-sm mt-1" style={{ color: 'var(--dash-text)' }}>
                  {event.budget ? `₹${event.budget}` : 'Not specified'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--dash-muted)' }}>Created by</p>
                <p className="text-sm mt-1" style={{ color: 'var(--dash-text)' }}>{event.createdByName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--dash-muted)' }}>Status</p>
                <p className="text-sm mt-1" style={{ color: 'var(--dash-text)' }}>
                  <span className={`capsule-tag ${event.status === 'published' ? '!bg-green-100 !text-green-700' : ''}`}>
                    {event.status}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ticketing' && (
          <TicketingTab
            event={event}
            onUpdate={handleEventUpdate}
            canEdit={canEdit}
          />
        )}

        {activeTab === 'scan' && (
          <ScanTicketTab event={event} canEdit={canEdit} />
        )}

        {activeTab === 'design' && (
          <TicketDesignTab
            event={event}
            onUpdate={handleEventUpdate}
            canEdit={canEdit}
          />
        )}

        {activeTab === 'form' && (
          <CustomFormTab
            event={event}
            onUpdate={handleEventUpdate}
            canEdit={canEdit}
          />
        )}

        {activeTab === 'rules' && (
          <RulesTab event={event} canEdit={canEdit} onUpdate={handleEventUpdate} />
        )}

        {activeTab === 'certificates' && (
          <CertificateTab
            event={event}
            onUpdate={handleEventUpdate}
            canEdit={canEdit}
          />
        )}

        {activeTab === 'participants' && (
          <ParticipantsTab
            event={event}
            canEdit={canEdit}
            canDelete={canDelete}
            onParticipantsChange={handleParticipantsChange}
          />
        )}

        {activeTab === 'teams' && (
          <TeamRegistrationTab
            event={event}
            onUpdate={handleEventUpdate}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        )}

        {activeTab === 'allocation' && (
          <SpaceAllocationTab event={event} canEdit={canEdit} onUpdate={handleEventUpdate} />
        )}

        {activeTab === 'domains' && (
          <DomainsTab
            event={event}
            onUpdate={handleEventUpdate}
            canEdit={canEdit}
          />
        )}

        {activeTab === 'analytics' && (
          <EventAnalyticsTab event={event} />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            event={event}
            onUpdate={handleEventUpdate}
            isSuperAdmin={isSuperAdmin(profile)}
          />
        )}
      </div>
    </div>
  );
}
