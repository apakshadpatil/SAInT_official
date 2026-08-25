import { useState, useEffect } from 'react';
import type { EventRecord, EventParticipant } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { Download, Trash2, UserCheck, RotateCcw, CheckSquare, Square, Clock } from 'lucide-react';
import { updateParticipantArrivalStatus, batchUpdateParticipantsArrival } from '../../services/eventService';

interface ParticipantsTabProps {
  event: EventRecord;
  canEdit: boolean;
  canDelete: boolean;
  onParticipantsChange?: (participants: EventParticipant[]) => Promise<void>;
}

export default function ParticipantsTab({ event, canEdit, canDelete, onParticipantsChange }: ParticipantsTabProps) {
  const { showToast } = useToast();
  const { profile } = useAuth();
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'arrived' | 'pending'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (event.participants) {
      setParticipants(event.participants);
    }
  }, [event.participants]);

  const filteredParticipants = participants.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (p.ticketId && p.ticketId.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (p.college && p.college.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'all' ? true :
                          filterStatus === 'arrived' ? p.arrived :
                          !p.arrived;
    return matchesSearch && matchesStatus;
  });

  const toggleArrival = async (participant: EventParticipant) => {
    const targetArrived = !participant.arrived;
    const participantId = participant.id;
    setProcessingId(participantId);

    // Optimistic UI update
    const updated = participants.map((p) =>
      p.id === participantId
        ? { ...p, arrived: targetArrived, arrivedAt: targetArrived ? new Date().toISOString() : undefined }
        : p
    );
    setParticipants(updated);

    try {
      await updateParticipantArrivalStatus(
        event.id,
        participant.ticketId || participant.id,
        targetArrived,
        profile?.uid
      );
      if (onParticipantsChange) {
        await onParticipantsChange(updated);
      }
      showToast(
        targetArrived
          ? `Marked ${participant.name} as arrived!`
          : `Marked ${participant.name} as pending (unarrived).`,
        'success'
      );
    } catch (err: any) {
      // Revert on error
      setParticipants(participants);
      showToast(err.message || 'Failed to update arrival status', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleBatchArrival = async (arrived: boolean) => {
    if (selectedIds.length === 0) {
      showToast('Please select at least one participant', 'info');
      return;
    }

    setLoading(true);
    const selectedSet = new Set(selectedIds);
    const updated = participants.map((p) =>
      selectedSet.has(p.id)
        ? { ...p, arrived, arrivedAt: arrived ? new Date().toISOString() : undefined }
        : p
    );
    setParticipants(updated);

    try {
      await batchUpdateParticipantsArrival(event.id, selectedIds, arrived, profile?.uid);
      if (onParticipantsChange) {
        await onParticipantsChange(updated);
      }
      showToast(
        `Successfully marked ${selectedIds.length} participant(s) as ${arrived ? 'arrived' : 'pending'}!`,
        'success'
      );
      setSelectedIds([]);
    } catch (err: any) {
      setParticipants(participants);
      showToast(err.message || 'Failed to batch update attendance', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredParticipants.length && filteredParticipants.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredParticipants.map((p) => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4 transition-all" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
          <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--dash-muted)' }}>Total Participants</p>
          <p className="text-3xl font-extrabold mt-1" style={{ color: 'var(--dash-text)' }}>
            {stats.total}
          </p>
        </div>
        <div className="rounded-2xl border p-4 transition-all" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.04)' }}>
          <p className="text-xs uppercase tracking-wider font-semibold text-emerald-500">Arrived</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{stats.arrived}</p>
            {stats.total > 0 && (
              <span className="text-xs font-semibold text-emerald-500">
                ({Math.round((stats.arrived / stats.total) * 100)}%)
              </span>
            )}
          </div>
        </div>
        <div className="rounded-2xl border p-4 transition-all" style={{ borderColor: 'rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.04)' }}>
          <p className="text-xs uppercase tracking-wider font-semibold text-amber-500">Pending Arrival</p>
          <p className="text-3xl font-extrabold mt-1 text-amber-600 dark:text-amber-400">{stats.pending}</p>
        </div>
      </div>

      {/* Search, Filter, and Bulk Actions Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <input
            type="text"
            placeholder="Search by name, email, ticket ID, college..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field flex-1 min-w-0"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'border-[var(--dash-border)] text-[var(--dash-muted)] hover:text-[var(--dash-text)]'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('arrived')}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                filterStatus === 'arrived'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'border-[var(--dash-border)] text-[var(--dash-muted)] hover:text-emerald-500'
              }`}
            >
              Arrived ({stats.arrived})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                filterStatus === 'pending'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                  : 'border-[var(--dash-border)] text-[var(--dash-muted)] hover:text-amber-500'
              }`}
            >
              Pending ({stats.pending})
            </button>
          </div>
        </div>

        {canEdit && selectedIds.length > 0 && (
          <div className="flex items-center gap-2 p-1.5 rounded-2xl border bg-slate-900/40 backdrop-blur-md" style={{ borderColor: 'var(--dash-border)' }}>
            <span className="text-xs font-semibold px-2 text-slate-300">
              {selectedIds.length} Selected
            </span>
            <button
              type="button"
              onClick={() => handleBatchArrival(true)}
              disabled={loading}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Mark Arrived
            </button>
            <button
              type="button"
              onClick={() => handleBatchArrival(false)}
              disabled={loading}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Mark Unarrived
            </button>
          </div>
        )}
      </div>

      {/* Participants Table */}
      <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--dash-border)' }}>
              <tr>
                {canEdit && (
                  <th className="w-10 px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-slate-200 transition-colors"
                      title="Select all"
                    >
                      {selectedIds.length > 0 && selectedIds.length === filteredParticipants.length ? (
                        <CheckSquare className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                )}
                <th className="px-4 py-3 font-semibold" style={{ color: 'var(--dash-text)' }}>
                  Participant
                </th>
                <th className="px-4 py-3 font-semibold" style={{ color: 'var(--dash-text)' }}>
                  Contact & Ticket
                </th>
                <th className="px-4 py-3 font-semibold" style={{ color: 'var(--dash-text)' }}>
                  Institution / Dept
                </th>
                <th className="px-4 py-3 font-semibold" style={{ color: 'var(--dash-text)' }}>
                  Arrival Status
                </th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--dash-text)' }}>
                  Studio Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--dash-border)' }}>
              {filteredParticipants.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium" style={{ color: 'var(--dash-muted)' }}>No participants found matching current filters</p>
                  </td>
                </tr>
              ) : (
                filteredParticipants.map((participant) => {
                  const isSelected = selectedIds.includes(participant.id);
                  const isBusy = processingId === participant.id;

                  return (
                    <tr
                      key={participant.id}
                      className="transition-colors hover:bg-white/[0.02]"
                      style={{
                        background: participant.arrived ? 'rgba(16,185,129,0.03)' : undefined,
                      }}
                    >
                      {canEdit && (
                        <td className="w-10 px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSelectOne(participant.id)}
                            className="text-slate-400 hover:text-slate-200"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-500" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-sm" style={{ color: 'var(--dash-text)' }}>
                          {participant.name}
                        </div>
                        {participant.tierName && (
                          <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {participant.tierName}
                          </span>
                        )}
                        {participant.teamMembers && participant.teamMembers.length > 0 && (
                          <p className="text-xs mt-1 text-slate-400">
                            +{participant.teamMembers.length} teammates: {participant.teamMembers.map((m) => m.name).join(', ')}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-mono" style={{ color: 'var(--dash-text)' }}>
                          {participant.email}
                        </p>
                        {participant.ticketId && (
                          <span className="text-[11px] font-mono text-slate-400">
                            ID: {participant.ticketId.slice(0, 10)}...
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
                          {participant.college || '—'}
                        </p>
                        {participant.department && (
                          <p className="text-[11px] text-slate-500">
                            {participant.department}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              participant.arrived
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {participant.arrived ? (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                Arrived
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5" />
                                Pending
                              </>
                            )}
                          </span>
                          {participant.arrived && participant.arrivedAt && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                              {new Date(participant.arrivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {/* Toggle Arrival Button */}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => toggleArrival(participant)}
                              disabled={isBusy || loading}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm ${
                                participant.arrived
                                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              }`}
                              title={participant.arrived ? 'Mark as Unarrived / Pending' : 'Mark as Arrived'}
                            >
                              {participant.arrived ? (
                                <>
                                  <RotateCcw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                                  <span>Unarrived</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                                  <span>Check In</span>
                                </>
                              )}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => downloadTicket(participant)}
                            disabled={loading}
                            className="p-1.5 rounded-xl border transition-colors hover:bg-blue-500/10 text-blue-400 border-blue-500/20"
                            title="Download ticket"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => removeParticipant(participant.id)}
                              disabled={loading}
                              className="p-1.5 rounded-xl border transition-colors hover:bg-red-500/10 text-red-400 border-red-500/20"
                              title="Remove participant"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Exports */}
      {stats.total > 0 && canEdit && (
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={downloadAllTickets}
            className="btn-primary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download All Tickets
          </button>
          <button
            type="button"
            onClick={exportParticipantCsv}
            className="btn-secondary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Participants CSV
          </button>
        </div>
      )}
    </div>
  );
}

