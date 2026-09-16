import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  getEvents,
  getEventTickets,
  updateParticipantAccessStatus,
  batchUpdateParticipantsAccess,
} from '../../services/eventService';
import { getParticipantUsers } from '../../services/authService';
import type { EventRecord, UserProfile } from '../../types';
import { hasTabAccess, isSuperAdmin } from '../../utils/permissions';
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Calendar,
  Ticket,
  Lock,
  Unlock,
  CheckSquare,
  Square,
  MinusSquare,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { TableSkeleton } from '../../components/ui/skeleton';

export interface ParticipantItem {
  id: string; // unique composite key: `${eventId}_${ticketId}`
  eventId: string;
  eventName: string;
  ticketId: string;
  ticketNumber: string;
  name: string;
  email: string;
  username?: string;
  phone?: string;
  college?: string;
  department?: string;
  teamName?: string;
  tierName?: string;
  checkedIn: boolean;
  participantUid?: string;
  accessStatus: 'granted' | 'revoked';
  accessUpdatedAt?: string;
  accessUpdatedBy?: string;
  createdAt: string;
}

export default function ParticipantAccessPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();

  // Authorization check
  const isAuthorized = isSuperAdmin(profile) || hasTabAccess(profile, 'participants');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [participantItems, setParticipantItems] = useState<ParticipantItem[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'granted' | 'revoked'>('all');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // In-flight operation state
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Confirmation Modal
  const [bulkConfirmAction, setBulkConfirmAction] = useState<'revoke' | 'grant' | null>(null);

  const loadData = useCallback(async (force = false) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);

      const [fetchedEvents, partUsers] = await Promise.all([
        getEvents(force),
        getParticipantUsers(force).catch(() => [] as UserProfile[]),
      ]);

      setEvents(fetchedEvents);

      // Create a map of participant accounts by email and uid for quick lookup
      const userByEmail = new Map<string, UserProfile>();
      const userByUid = new Map<string, UserProfile>();
      partUsers.forEach((u) => {
        if (u.uid) userByUid.set(u.uid, u);
        const email = (u.participantEmail || u.email || '').toLowerCase().trim();
        if (email) userByEmail.set(email, u);
      });

      // Fetch all event tickets in parallel
      const ticketResults = await Promise.allSettled(
        fetchedEvents.map(async (ev) => {
          const tickets = await getEventTickets(ev.id);
          return { event: ev, tickets };
        })
      );

      const items: ParticipantItem[] = [];

      ticketResults.forEach((res) => {
        if (res.status === 'fulfilled') {
          const { event, tickets } = res.value;
          tickets.forEach((t) => {
            const guestEmail = (t.guestEmail || '').toLowerCase().trim();
            const linkedUser =
              (t.participantUid ? userByUid.get(t.participantUid) : null) ||
              (guestEmail ? userByEmail.get(guestEmail) : null);

            // Determine effective access status:
            // Explicit ticket accessStatus takes precedence; if undefined, checks linked user status, defaults to 'granted'
            let status: 'granted' | 'revoked' = 'granted';
            if (t.accessStatus === 'revoked' || linkedUser?.status === 'rejected') {
              status = 'revoked';
            } else if (t.accessStatus === 'granted') {
              status = 'granted';
            }

            items.push({
              id: `${event.id}_${t.id}`,
              eventId: event.id,
              eventName: event.title || 'Untitled Event',
              ticketId: t.id,
              ticketNumber: t.ticketNumber || t.id.slice(0, 8),
              name: t.guestName || linkedUser?.displayName || 'Unnamed Participant',
              email: t.guestEmail || linkedUser?.participantEmail || linkedUser?.email || 'No email',
              username: linkedUser?.participantUsername,
              phone: t.guestPhone,
              college: t.college,
              department: t.department,
              teamName: t.teamName,
              tierName: t.tierName,
              checkedIn: Boolean(t.checkedIn),
              participantUid: t.participantUid || linkedUser?.uid,
              accessStatus: status,
              accessUpdatedAt: t.accessUpdatedAt,
              accessUpdatedBy: t.accessUpdatedBy,
              createdAt: t.createdAt,
            });
          });
        }
      });

      // Sort newest registration first
      items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setParticipantItems(items);
    } catch (err) {
      console.error('Failed to load participant access data:', err);
      showToast('Failed to load participants data.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isAuthorized) {
      void loadData();
    }
  }, [isAuthorized, loadData]);

  // Filtered participants
  const filteredItems = useMemo(() => {
    return participantItems.filter((item) => {
      // Event filter
      if (selectedEventId !== 'all' && item.eventId !== selectedEventId) {
        return false;
      }

      // Access status filter
      if (selectedStatusFilter !== 'all' && item.accessStatus !== selectedStatusFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesEmail = item.email.toLowerCase().includes(query);
        const matchesUsername = item.username?.toLowerCase().includes(query) ?? false;
        const matchesTicket = item.ticketNumber.toLowerCase().includes(query);
        const matchesEvent = item.eventName.toLowerCase().includes(query);
        const matchesTeam = item.teamName?.toLowerCase().includes(query) ?? false;
        const matchesCollege = item.college?.toLowerCase().includes(query) ?? false;

        return (
          matchesName ||
          matchesEmail ||
          matchesUsername ||
          matchesTicket ||
          matchesEvent ||
          matchesTeam ||
          matchesCollege
        );
      }

      return true;
    });
  }, [participantItems, selectedEventId, selectedStatusFilter, searchQuery]);

  // Selection helpers
  const filteredIds = useMemo(() => filteredItems.map((i) => i.id), [filteredItems]);
  const selectedFilteredCount = useMemo(
    () => filteredIds.filter((id) => selectedIds.has(id)).length,
    [filteredIds, selectedIds]
  );
  const isAllSelected = filteredIds.length > 0 && selectedFilteredCount === filteredIds.length;
  const isIndeterminate = selectedFilteredCount > 0 && !isAllSelected;

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      // Deselect all filtered items
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      // Select all filtered items
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Single Grant / Revoke Action
  const handleToggleAccess = async (item: ParticipantItem) => {
    if (!profile) return;
    const nextStatus: 'granted' | 'revoked' = item.accessStatus === 'granted' ? 'revoked' : 'granted';

    setProcessingIds((prev) => new Set(prev).add(item.id));
    try {
      await updateParticipantAccessStatus(item.eventId, item.ticketId, nextStatus, profile);

      // Optimistic update local state
      setParticipantItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                accessStatus: nextStatus,
                accessUpdatedAt: new Date().toISOString(),
                accessUpdatedBy: profile.displayName || profile.email,
              }
            : i
        )
      );

      showToast(
        nextStatus === 'granted'
          ? `Access granted to ${item.name}!`
          : `Access revoked from ${item.name}.`,
        nextStatus === 'granted' ? 'success' : 'info'
      );
    } catch (err: any) {
      console.error('Failed to update participant access status:', err);
      showToast(err.message || 'Failed to update access status', 'error');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  // Bulk Actions
  const handleExecuteBulkAction = async (action: 'grant' | 'revoke') => {
    if (!profile || selectedIds.size === 0) return;

    // Filter down to the selected items that actually need updating
    const itemsToUpdate = participantItems.filter(
      (item) => selectedIds.has(item.id) && item.accessStatus !== (action === 'grant' ? 'granted' : 'revoked')
    );

    if (itemsToUpdate.length === 0) {
      showToast(
        action === 'grant'
          ? 'All selected participants already have access granted.'
          : 'All selected participants already have access revoked.',
        'info'
      );
      setBulkConfirmAction(null);
      return;
    }

    setBulkProcessing(true);
    setBulkConfirmAction(null);

    try {
      const payload = itemsToUpdate.map((i) => ({
        eventId: i.eventId,
        ticketId: i.ticketId,
        participantName: i.name,
        guestEmail: i.email,
        participantUid: i.participantUid,
      }));

      const targetStatus = action === 'grant' ? 'granted' : 'revoked';
      const { successCount, failCount } = await batchUpdateParticipantsAccess(payload, targetStatus, profile);

      // Update local state for successfully processed items
      const updatedItemIds = new Set(itemsToUpdate.map((i) => i.id));
      setParticipantItems((prev) =>
        prev.map((i) =>
          updatedItemIds.has(i.id)
            ? {
                ...i,
                accessStatus: targetStatus,
                accessUpdatedAt: new Date().toISOString(),
                accessUpdatedBy: profile.displayName || profile.email,
              }
            : i
        )
      );

      if (failCount === 0) {
        showToast(
          action === 'grant'
            ? `Successfully granted access to ${successCount} participant(s)!`
            : `Successfully revoked access from ${successCount} participant(s).`,
          'success'
        );
      } else {
        showToast(
          `Updated ${successCount} participant(s), but ${failCount} operation(s) failed.`,
          'error'
        );
      }

      handleClearSelection();
    } catch (err: any) {
      console.error('Bulk operation failed:', err);
      showToast(err.message || 'Bulk operation failed', 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  // Export CSV
  const exportCSV = () => {
    const headers = [
      'Ticket Number',
      'Participant Name',
      'Username',
      'Email',
      'Phone',
      'Event',
      'Access Status',
      'Checked In',
      'Team',
      'College',
      'Registration Date',
    ];

    const rows = filteredItems.map((item) => [
      `"${item.ticketNumber}"`,
      `"${item.name.replace(/"/g, '""')}"`,
      item.username || '',
      item.email,
      item.phone || '',
      `"${item.eventName.replace(/"/g, '""')}"`,
      item.accessStatus.toUpperCase(),
      item.checkedIn ? 'YES' : 'NO',
      item.teamName ? `"${item.teamName.replace(/"/g, '""')}"` : '',
      item.college ? `"${item.college.replace(/"/g, '""')}"` : '',
      item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `saint_participant_access_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedCount = selectedIds.size;

  // Block unauthorized members
  if (!isAuthorized) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-400 mb-1">
            <ShieldCheck className="w-4 h-4" /> Participant Permission & Access Control
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            Participant Access
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {participantItems.length} Records
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Manage event attendee credentials, inspect event ticket authorizations, and grant or revoke access for individual or bulk participants.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            disabled={filteredItems.length === 0}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="dash-card p-4 border rounded-2xl space-y-3" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card-bg)' }}>
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by participant name, email, username, ticket number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Event Filter */}
          <div className="flex items-center gap-2 min-w-[220px]">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200 text-xs font-medium focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="all">All Events ({events.length})</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </div>

          {/* Access Status Filter */}
          <div className="flex items-center gap-2 min-w-[160px]">
            <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200 text-xs font-medium focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="all">All Access</option>
              <option value="granted">Granted Only</option>
              <option value="revoked">Revoked Only</option>
            </select>
          </div>
        </div>

        {/* Results summary & Active Filter Pills */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1">
          <div>
            Showing <span className="text-white font-semibold">{filteredItems.length}</span> of{' '}
            <span className="text-white font-semibold">{participantItems.length}</span> participants
            {selectedEventId !== 'all' && (
              <span className="ml-2 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Event: {events.find((e) => e.id === selectedEventId)?.title || selectedEventId}
              </span>
            )}
            {selectedStatusFilter !== 'all' && (
              <span
                className={`ml-2 px-2 py-0.5 rounded-md border ${
                  selectedStatusFilter === 'granted'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}
              >
                Access: {selectedStatusFilter.toUpperCase()}
              </span>
            )}
          </div>

          {(searchQuery || selectedEventId !== 'all' || selectedStatusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedEventId('all');
                setSelectedStatusFilter('all');
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ── Bulk Actions Floating Toolbar ── */}
      {selectedCount > 0 && (
        <div className="sticky top-4 z-30 flex items-center justify-between flex-wrap gap-3 px-4 py-3 rounded-2xl bg-indigo-950/90 border border-indigo-500/40 shadow-xl backdrop-blur-md animate-slide-down">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-indigo-500 text-white font-black text-xs flex items-center justify-center">
              {selectedCount}
            </span>
            <span className="text-sm font-semibold text-white">
              {selectedCount} participant{selectedCount === 1 ? '' : 's'} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExecuteBulkAction('grant')}
              disabled={bulkProcessing}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
            >
              <Unlock className="w-3.5 h-3.5" />
              Grant Access
            </button>
            <button
              onClick={() => setBulkConfirmAction('revoke')}
              disabled={bulkProcessing}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
              Revoke Access
            </button>
            <button
              onClick={handleClearSelection}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Participants Table ── */}
      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : filteredItems.length === 0 ? (
        <div className="dash-card p-12 text-center border rounded-2xl space-y-3" style={{ borderColor: 'var(--dash-border)' }}>
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No participants found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery || selectedEventId !== 'all' || selectedStatusFilter !== 'all'
              ? 'Try modifying your search or clearing your active filters to view participants.'
              : 'No participants have registered for events yet.'}
          </p>
        </div>
      ) : (
        <div className="dash-card border rounded-2xl overflow-hidden" style={{ borderColor: 'var(--dash-border)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="text-[11px] uppercase tracking-wider bg-slate-900/90 text-slate-400 border-b border-slate-800">
                <tr>
                  <th scope="col" className="p-4 w-10">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-slate-400 hover:text-white transition-colors"
                      title={isAllSelected ? 'Deselect all' : 'Select all filtered'}
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-400" />
                      ) : isIndeterminate ? (
                        <MinusSquare className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th scope="col" className="py-3 px-4 font-bold">Participant</th>
                  <th scope="col" className="py-3 px-4 font-bold">Event</th>
                  <th scope="col" className="py-3 px-4 font-bold">Registration</th>
                  <th scope="col" className="py-3 px-4 font-bold">Access Status</th>
                  <th scope="col" className="py-3 px-4 font-bold">Registered Date</th>
                  <th scope="col" className="py-3 px-4 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredItems.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  const isProcessing = processingIds.has(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors hover:bg-slate-800/40 ${
                        isSelected ? 'bg-indigo-950/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-4 w-10">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(item.id)}
                          className="text-slate-400 hover:text-white transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Participant Name & Username */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white text-[13px]">{item.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <span>{item.email}</span>
                          {item.username && (
                            <span className="text-indigo-400 font-medium">@{item.username}</span>
                          )}
                        </div>
                        {item.teamName && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Team: <span className="text-slate-300 font-medium">{item.teamName}</span>
                          </div>
                        )}
                      </td>

                      {/* Event */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-200 text-xs truncate max-w-[200px]">
                          {item.eventName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Pass: {item.ticketNumber}
                        </div>
                      </td>

                      {/* Registration Status */}
                      <td className="py-3 px-4">
                        {item.checkedIn ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Checked In
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                            <Ticket className="w-3.5 h-3.5" /> Registered
                          </span>
                        )}
                      </td>

                      {/* Access Status Badge */}
                      <td className="py-3 px-4">
                        {item.accessStatus === 'granted' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            Granted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <XCircle className="w-3 h-3" />
                            Revoked
                          </span>
                        )}
                      </td>

                      {/* Registration Date */}
                      <td className="py-3 px-4 text-[11px] text-slate-400">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
                      </td>

                      {/* Action Button */}
                      <td className="py-3 px-4 text-right">
                        {item.accessStatus === 'granted' ? (
                          <button
                            type="button"
                            onClick={() => handleToggleAccess(item)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 text-xs font-bold transition-all disabled:opacity-50"
                          >
                            {isProcessing ? 'Updating...' : 'Revoke'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleAccess(item)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all disabled:opacity-50"
                          >
                            {isProcessing ? 'Updating...' : 'Grant'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Bulk Confirmation Dialog ── */}
      {bulkConfirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirm Revoke Access</h3>
                <p className="text-xs text-slate-400 mt-0.5">Destructive Access Modification</p>
              </div>
            </div>

            <p className="text-sm text-slate-300">
              Are you sure you want to revoke access for{' '}
              <strong className="text-white font-bold">{selectedCount}</strong> selected participant
              {selectedCount === 1 ? '' : 's'}?
            </p>

            <p className="text-xs text-slate-400">
              Revoked participants will lose access to their tickets, passes, and portal functionality for these events until access is explicitly re-granted.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBulkConfirmAction(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExecuteBulkAction('revoke')}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/20"
              >
                Yes, Revoke Access
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
