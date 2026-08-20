import { useState } from 'react';
import type { EventRecord, EventDomain, EventSpace } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { Archive, Send, Download, BarChart3, Plus, Boxes } from 'lucide-react';

interface SettingsTabProps {
  event: EventRecord;
  onUpdate: (updates: Partial<EventRecord>) => Promise<void>;
  isSuperAdmin: boolean;
}

export default function SettingsTab({ event, onUpdate, isSuperAdmin }: SettingsTabProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [emailSubject, setEmailSubject] = useState(`Updates about ${event.title}`);
  const [emailBody, setEmailBody] = useState('Dear participants, ');
  const [domainName, setDomainName] = useState('');
  const [domainDesc, setDomainDesc] = useState('');
  const [spaceName, setSpaceName] = useState('');
  const [spaceCapacity, setSpaceCapacity] = useState('20');
  const [selectedDomainId, setSelectedDomainId] = useState('');

  if (!isSuperAdmin) {
    return (
      <div className="rounded-2xl border p-12 text-center" style={{ borderColor: 'var(--dash-border)' }}>
        <p style={{ color: 'var(--dash-muted)' }}>Only superadmins can access event settings</p>
      </div>
    );
  }

  const handleToggleDomainSelection = async () => {
    try {
      await onUpdate({ enableDomainSelection: !event.enableDomainSelection });
      showToast('Domain selection setting updated', 'success');
    } catch {
      showToast('Failed to update domain selection setting', 'error');
    }
  };

  const handleCreateDomain = async () => {
    if (!domainName.trim()) {
      showToast('Please enter a domain name', 'error');
      return;
    }

    const newDomain: EventDomain = {
      id: `domain-${Date.now()}`,
      eventId: event.id,
      name: domainName.trim(),
      description: domainDesc.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const domains = [...(event.participantDomains || []), newDomain];
    await onUpdate({ participantDomains: domains });
    setDomainName('');
    setDomainDesc('');
    showToast('Domain created successfully', 'success');
  };

  const handleCreateSpace = async () => {
    if (!spaceName.trim()) {
      showToast('Please enter a space name', 'error');
      return;
    }

    const newSpace: EventSpace = {
      id: `space-${Date.now()}`,
      name: spaceName.trim(),
      capacity: Number(spaceCapacity) || 20,
      domainId: selectedDomainId || undefined,
      domainName: event.participantDomains?.find((domain) => domain.id === selectedDomainId)?.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const spaces = [...(event.spaces || []), newSpace];
    await onUpdate({ spaces });
    setSpaceName('');
    setSpaceCapacity('20');
    setSelectedDomainId('');
    showToast('Space created successfully', 'success');
  };

  const handleArchiveEvent = async () => {
    if (!window.confirm('Archive this event? It will no longer appear in the active events list.')) return;

    setLoading(true);
    try {
      await onUpdate({
        status: 'cancelled',
      });
      showToast('Event archived successfully', 'success');
    } catch (err) {
      showToast('Failed to archive event', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkEmail = async () => {
    if (!emailBody.trim()) {
      showToast('Please enter an email message', 'error');
      return;
    }

    setLoading(true);
    try {
      const recipientEmails = (event.participants || [])
        .map((participant) => participant.email)
        .filter(Boolean)
        .join(',');

      if (recipientEmails) {
        const mailtoLink = `mailto:${recipientEmails}?subject=${encodeURIComponent(emailSubject || 'Event update')}&body=${encodeURIComponent(emailBody)}`;
        window.location.href = mailtoLink;
      }
      showToast(`Opening your email app for ${event.participants?.length || 0} participants`, 'success');
    } catch (err) {
      showToast('Failed to send emails', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportAttendees = () => {
    try {
      const rows = (event.participants || []).map((participant) => [
        participant.name,
        participant.email,
        participant.arrived ? 'Arrived' : 'Pending',
        participant.arrivedAt || '',
        [participant.college, participant.department].filter(Boolean).join(' / '),
      ]);

      const attendeeData = [
        ['Name', 'Email', 'Status', 'Arrival Time', 'Department'].join(','),
        ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob([attendeeData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendees-${event.title}-${Date.now()}.csv`;
      a.click();
      showToast('Attendee list exported', 'success');
    } catch (err) {
      showToast('Failed to export attendees', 'error');
    }
  };

  const getEventStatistics = () => {
    const participants = event.participants || [];
    const checkedIn = participants.filter((participant) => participant.arrived).length;
    return {
      totalParticipants: participants.length,
      ticketsGenerated: participants.length,
      checkedIn,
      checkedInPercentage: participants.length ? Math.round((checkedIn / participants.length) * 100) : 0,
    };
  };

  const stats = getEventStatistics();

  return (
    <div className="space-y-6">
      {/* Event Statistics */}
      <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--dash-border)' }}>
        <h4 className="font-semibold flex items-center gap-2 mb-4" style={{ color: 'var(--dash-text)' }}>
          <BarChart3 className="w-5 h-5" />
          Event Statistics
        </h4>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>Total Participants</p>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--dash-text)' }}>
              {stats.totalParticipants}
            </p>
          </div>
          <div>
            <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>Tickets Generated</p>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--dash-text)' }}>
              {stats.ticketsGenerated}
            </p>
          </div>
          <div>
            <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>Checked In</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{stats.checkedIn}</p>
          </div>
          <div>
            <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>Check-in Rate</p>
            <p className="text-2xl font-bold mt-1 text-blue-600">{stats.checkedInPercentage}%</p>
          </div>
        </div>
      </div>

      {/* Event Configuration */}
      <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--dash-border)' }}>
        <h4 className="font-semibold flex items-center gap-2 mb-4" style={{ color: 'var(--dash-text)' }}>
          <Boxes className="w-5 h-5" />
          Event Configuration
        </h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl p-4" style={{ background: 'var(--dash-card)' }}>
            <div>
              <p className="font-medium" style={{ color: 'var(--dash-text)' }}>Enable Domain Selection</p>
              <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>Show a domain field on the registration page and unlock domain-based controls.</p>
            </div>
            <button onClick={handleToggleDomainSelection} className={`px-3 py-2 rounded-lg text-sm font-semibold ${event.enableDomainSelection ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {event.enableDomainSelection ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      </div>

      {/* Domain Management */}
      <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--dash-border)' }}>
        <h4 className="font-semibold flex items-center gap-2 mb-4" style={{ color: 'var(--dash-text)' }}>
          <Plus className="w-5 h-5" />
          Create Domains
        </h4>
        <div className="space-y-3">
          <input value={domainName} onChange={(e) => setDomainName(e.target.value)} className="input-field w-full" placeholder="Domain name e.g. Core Team" />
          <textarea value={domainDesc} onChange={(e) => setDomainDesc(e.target.value)} className="input-field w-full min-h-24" placeholder="Short description" />
          <button onClick={handleCreateDomain} className="btn-primary">Create Domain</button>
        </div>
        {event.participantDomains && event.participantDomains.length > 0 && (
          <div className="mt-4 space-y-2">
            {event.participantDomains.map((domain) => (
              <div key={domain.id} className="rounded-lg p-3" style={{ background: 'var(--dash-card)' }}>
                <p className="font-medium" style={{ color: 'var(--dash-text)' }}>{domain.name}</p>
                {domain.description && <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>{domain.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Space Management */}
      <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--dash-border)' }}>
        <h4 className="font-semibold flex items-center gap-2 mb-4" style={{ color: 'var(--dash-text)' }}>
          <Boxes className="w-5 h-5" />
          Create Spaces
        </h4>
        <div className="space-y-3">
          <input value={spaceName} onChange={(e) => setSpaceName(e.target.value)} className="input-field w-full" placeholder="Space name e.g. Lab A" />
          <input type="number" min="1" value={spaceCapacity} onChange={(e) => setSpaceCapacity(e.target.value)} className="input-field w-full" placeholder="Capacity" />
          {event.participantDomains && event.participantDomains.length > 0 && (
            <select value={selectedDomainId} onChange={(e) => setSelectedDomainId(e.target.value)} className="input-field w-full">
              <option value="">Select domain (optional)</option>
              {event.participantDomains.map((domain) => (
                <option key={domain.id} value={domain.id}>{domain.name}</option>
              ))}
            </select>
          )}
          <button onClick={handleCreateSpace} className="btn-primary">Create Space</button>
        </div>
      </div>

      {/* Bulk Email */}
      <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--dash-border)' }}>
        <h4 className="font-semibold flex items-center gap-2 mb-4" style={{ color: 'var(--dash-text)' }}>
          <Send className="w-5 h-5" />
          Send Bulk Email
        </h4>
        <p className="text-sm mb-4" style={{ color: 'var(--dash-muted)' }}>
          Send an email to all {event.participantIds?.length || 0} registered participants
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium" style={{ color: 'var(--dash-text)' }}>
              Email Subject
            </label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="input-field mt-1 w-full"
              placeholder="Email subject..."
            />
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: 'var(--dash-text)' }}>
              Email Body
            </label>
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              className="input-field mt-1 w-full min-h-32"
              placeholder="Email message..."
            />
          </div>
          <button
            onClick={handleBulkEmail}
            disabled={loading || !emailBody.trim()}
            className="btn-primary w-full"
          >
            {loading ? 'Sending...' : 'Send Email to All Participants'}
          </button>
        </div>
      </div>

      {/* Export Data */}
      <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--dash-border)' }}>
        <h4 className="font-semibold flex items-center gap-2 mb-4" style={{ color: 'var(--dash-text)' }}>
          <Download className="w-5 h-5" />
          Export Data
        </h4>
        <p className="text-sm mb-4" style={{ color: 'var(--dash-muted)' }}>
          Export event data in various formats for analysis or record-keeping
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleExportAttendees}
            className="btn-secondary"
          >
            Export Attendees (CSV)
          </button>
          <button
            className="btn-secondary"
          >
            Export Registrations (CSV)
          </button>
          <button
            className="btn-secondary"
          >
            Export Tickets (PDF)
          </button>
          <button
            className="btn-secondary"
          >
            Export Allocation Report
          </button>
        </div>
      </div>

      {/* Archive Event */}
      <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--dash-border)' }}>
        <h4 className="font-semibold flex items-center gap-2 mb-3" style={{ color: 'var(--dash-text)' }}>
          <Archive className="w-5 h-5" />
          Archive Event
        </h4>
        <p className="text-sm mb-4" style={{ color: 'var(--dash-muted)' }}>
          Archive this event to hide it from the active events list. It will be preserved in your archives for future reference.
        </p>
        <button
          onClick={handleArchiveEvent}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
          style={{
            background: 'rgba(239,68,68,0.08)',
            color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          <Archive className="w-4 h-4" />
          {loading ? 'Archiving...' : 'Archive Event'}
        </button>
      </div>

      {/* Event ID Reference */}
      <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--dash-border)' }}>
        <h4 className="font-semibold mb-3" style={{ color: 'var(--dash-text)' }}>
          Event Reference
        </h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--dash-card)' }}>
            <span className="text-sm" style={{ color: 'var(--dash-muted)' }}>Event ID:</span>
            <span className="font-mono text-sm" style={{ color: 'var(--dash-text)' }}>
              {event.id}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--dash-card)' }}>
            <span className="text-sm" style={{ color: 'var(--dash-muted)' }}>Created:</span>
            <span className="text-sm" style={{ color: 'var(--dash-text)' }}>
              {new Date(event.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--dash-card)' }}>
            <span className="text-sm" style={{ color: 'var(--dash-muted)' }}>Last Updated:</span>
            <span className="text-sm" style={{ color: 'var(--dash-text)' }}>
              {new Date(event.updatedAt).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
