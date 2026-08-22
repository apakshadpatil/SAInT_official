import { useState, useEffect } from 'react';
import type { EventRecord, EventParticipant } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { Download, Trash2, UserCheck } from 'lucide-react';

interface ParticipantsTabProps {
  event: EventRecord;
  canEdit: boolean;
  canDelete: boolean;
  onParticipantsChange?: (participants: EventParticipant[]) => Promise<void>;
}

export default function ParticipantsTab({ event, canEdit, canDelete, onParticipantsChange }: ParticipantsTabProps) {
  const { showToast } = useToast();
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'arrived' | 'pending'>('all');

  useEffect(() => {
    // Load participants from event
    if (event.participants) {
      setParticipants(event.participants);
    }
  }, [event.participants]);

  const filteredParticipants = participants.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' ? true :
                          filterStatus === 'arrived' ? p.arrived :
                          !p.arrived;
    return matchesSearch && matchesStatus;
  });

  const markAsArrived = async (participantId: string) => {
    setLoading(true);
    try {
      const updated = participants.map((p) =>
        p.id === participantId
          ? { ...p, arrived: true, arrivedAt: new Date().toISOString() }
          : p
      );
      setParticipants(updated);
      if (onParticipantsChange) {
        await onParticipantsChange(updated);
      }
      showToast('Participant marked as arrived', 'success');
    } catch (err) {
      showToast('Failed to mark arrival', 'error');
    } finally {
      setLoading(false);
    }
  };

  const removeParticipant = async (participantId: string) => {
    if (!window.confirm('Remove this participant from the event?')) return;

    setLoading(true);
    try {
      const updated = participants.filter((p) => p.id !== participantId);
      setParticipants(updated);
      if (onParticipantsChange) {
        await onParticipantsChange(updated);
      }
      showToast('Participant removed', 'success');
    } catch (err) {
      showToast('Failed to remove participant', 'error');
    } finally {
      setLoading(false);
    }
  };

  const customFieldLabels = (event.customFields || []).map((f) => f.label);

  const downloadTicket = (participant: EventParticipant) => {
    if (!participant.ticketId) {
      showToast('Ticket not generated yet', 'error');
      return;
    }

    const customVals = (event.customFields || []).map((f) => participant.customResponses?.[f.id] || '');

    const rows = [[
      'Name', 'Email', 'Ticket ID', 'College', 'Department', 'Domain', ...customFieldLabels, 'Arrived', 'Arrival Time', 'Allocated Lab', 'Allocated Classroom'
    ], [
      participant.name,
      participant.email,
      participant.ticketId,
      participant.college || '',
      participant.department || '',
      participant.domain || '',
      ...customVals,
      participant.arrived ? 'Arrived' : 'Pending',
      participant.arrivedAt || '',
      participant.allocatedLab || '',
      participant.allocatedClassroom || '',
    ]];

    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket-${participant.name.replace(/\s+/g, '_')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('Ticket data downloaded', 'success');
  };

  const downloadAllTickets = () => {
    const rows = [
      ['Name', 'Email', 'Ticket ID', 'College', 'Department', 'Domain', ...customFieldLabels, 'Arrived', 'Arrival Time', 'Allocated Lab', 'Allocated Classroom'],
      ...(participants.map((participant) => [
        participant.name,
        participant.email,
        participant.ticketId || '',
        participant.college || '',
        participant.department || '',
        participant.domain || '',
        ...(event.customFields || []).map((f) => participant.customResponses?.[f.id] || ''),
        participant.arrived ? 'Arrived' : 'Pending',
        participant.arrivedAt || '',
        participant.allocatedLab || '',
        participant.allocatedClassroom || '',
      ])),
    ];

    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all-tickets-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('Tickets export downloaded', 'success');
  };

  const exportParticipantCsv = () => {
    const rows = [
      ['Name', 'Email', 'College', 'Department', 'Domain', ...customFieldLabels, 'Arrived', 'Arrival Time', 'Allocated Lab', 'Allocated Classroom'],
      ...(participants.map((participant) => [
        participant.name,
        participant.email,
        participant.college || '',
        participant.department || '',
        participant.domain || '',
        ...(event.customFields || []).map((f) => participant.customResponses?.[f.id] || ''),
        participant.arrived ? 'Arrived' : 'Pending',
        participant.arrivedAt || '',
        participant.allocatedLab || '',
        participant.allocatedClassroom || '',
      ])),
    ];

    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `participants-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('Participants exported', 'success');
  };

  const stats = {
    total: participants.length,
    arrived: participants.filter(p => p.arrived).length,
    pending: participants.filter(p => !p.arrived).length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)' }}>
          <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>Total Participants</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--dash-text)' }}>
            {stats.total}
          </p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)' }}>
          <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>Arrived</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{stats.arrived}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)' }}>
          <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>Pending</p>
          <p className="text-2xl font-bold mt-1 text-amber-600">{stats.pending}</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field flex-1 min-w-0 w-full md:flex-[2] md:min-w-[280px]"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="input-field w-full md:w-36"
        >
          <option value="all">All Status</option>
          <option value="arrived">Arrived</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Participants Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--dash-border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ background: 'var(--dash-card)', borderBottom: '1px solid var(--dash-border)' }}>
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>
                  Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>
                  Email
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>
                  College / Department
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>
                  Status
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredParticipants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <p style={{ color: 'var(--dash-muted)' }}>No participants found</p>
                  </td>
                </tr>
              ) : (
                filteredParticipants.map((participant) => (
                  <tr
                    key={participant.id}
                    style={{
                      borderBottom: '1px solid var(--dash-border)',
                      background: participant.arrived ? 'rgba(16,185,129,0.05)' : 'transparent',
                    }}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium" style={{ color: 'var(--dash-text)' }}>
                        {participant.name}
                      </p>
                      {participant.tierName && (
                        <span className="inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400">
                          {participant.tierName}
                        </span>
                      )}
                      {participant.teamMembers && participant.teamMembers.length > 0 && (
                        <p className="text-[11px] mt-0.5 text-slate-400">
                          +{participant.teamMembers.length} teammates: {participant.teamMembers.map((m) => m.name).join(', ')}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>
                        {participant.email}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>
                        {participant.college || '-'} {participant.department ? `/ ${participant.department}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold"
                        style={{
                          background: participant.arrived ? 'rgba(16,185,129,0.15)' : 'rgba(251,146,60,0.15)',
                          color: participant.arrived ? '#10b981' : '#fb923c',
                        }}
                      >
                        {participant.arrived ? '✓ Arrived' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        {canEdit && !participant.arrived && (
                          <button
                            onClick={() => markAsArrived(participant.id)}
                            disabled={loading}
                            className="p-1.5 rounded-lg transition-colors hover:bg-green-100"
                            title="Mark as arrived"
                          >
                            <UserCheck className="w-4 h-4 text-green-600" />
                          </button>
                        )}
                        <button
                          onClick={() => downloadTicket(participant)}
                          disabled={loading}
                          className="p-1.5 rounded-lg transition-colors hover:bg-blue-100"
                          title="Download ticket"
                        >
                          <Download className="w-4 h-4 text-blue-600" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => removeParticipant(participant.id)}
                            disabled={loading}
                            className="p-1.5 rounded-lg transition-colors hover:bg-red-100"
                            title="Remove participant"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Actions */}
      {stats.total > 0 && canEdit && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={downloadAllTickets}
            className="btn-primary"
          >
            <Download className="w-4 h-4" />
            Download All Tickets
          </button>
          <button
            type="button"
            onClick={exportParticipantCsv}
            className="btn-secondary"
          >
            <Download className="w-4 h-4" />
            Export Participants CSV
          </button>
        </div>
      )}
    </div>
  );
}
