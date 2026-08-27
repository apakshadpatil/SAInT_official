import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getParticipantUsers,
  updateParticipantAccount,
  deleteParticipantAccount,
  createParticipantAccountAdmin,
} from '../../services/authService';
import { getEvents, getEventTickets } from '../../services/eventService';
import { logActivity } from '../../services/activityService';
import type { UserProfile, EventRecord, EventTicket } from '../../types';
import {
  Users,
  UserCheck,
  Search,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  Mail,
  ShieldCheck,
  Ticket,
  Calendar,
  QrCode,
  Download,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import QRCode from 'qrcode';

interface ParticipantWithTickets extends UserProfile {
  tickets?: { event: EventRecord; ticket: EventTicket }[];
}

export default function ManageParticipantsPage() {
  const { profile: currentAdmin } = useAuth();
  const [participants, setParticipants] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [allTickets, setAllTickets] = useState<{ event: EventRecord; ticket: EventTicket }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantWithTickets | null>(null);
  const [qrModalTicket, setQrModalTicket] = useState<{ event: EventRecord; ticket: EventTicket; qrUrl: string } | null>(null);
  
  // Create / Edit modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    status: 'approved' as 'approved' | 'pending' | 'rejected',
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  const loadData = async (force = false) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);

      const [partUsers, fetchedEvents] = await Promise.all([
        getParticipantUsers(force),
        getEvents(force),
      ]);

      setParticipants(partUsers);
      setEvents(fetchedEvents);

      // Fetch all event tickets in parallel to link to participants
      const ticketLists = await Promise.all(
        fetchedEvents.map(async (ev) => {
          try {
            const t = await getEventTickets(ev.id);
            return t.map((ticket) => ({ event: ev, ticket }));
          } catch {
            return [];
          }
        })
      );
      setAllTickets(ticketLists.flat());
    } catch (err) {
      console.error('Failed to load participants data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered participants list
  const filteredParticipants = useMemo(() => {
    return participants.filter((p) => {
      const matchesSearch =
        searchQuery === '' ||
        (p.displayName && p.displayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.participantUsername && p.participantUsername.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.participantEmail && p.participantEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all' || p.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [participants, searchQuery, statusFilter]);

  // Map participant tickets helper
  const getParticipantTickets = (user: UserProfile) => {
    const userEmail = (user.participantEmail || user.email || '').toLowerCase().trim();
    return allTickets.filter(
      (item) =>
        item.ticket.participantUid === user.uid ||
        (item.ticket.guestEmail && item.ticket.guestEmail.toLowerCase().trim() === userEmail)
    );
  };

  const handleOpenCreate = () => {
    setFormData({ name: '', username: '', email: '', status: 'approved' });
    setFormError('');
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({
      name: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      username: user.participantUsername || '',
      email: user.participantEmail || user.email || '',
      status: user.status || 'approved',
    });
    setFormError('');
  };

  const handleSaveParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      if (editingUser) {
        // Update
        const [firstName, ...rest] = formData.name.trim().split(/\s+/);
        await updateParticipantAccount(editingUser.uid, {
          displayName: formData.name.trim(),
          firstName: firstName || formData.username,
          lastName: rest.join(' '),
          participantUsername: formData.username.trim().toLowerCase(),
          participantEmail: formData.email.trim().toLowerCase(),
          status: formData.status,
        });

        if (currentAdmin) {
          await logActivity(
            currentAdmin.uid,
            currentAdmin.displayName,
            currentAdmin.email,
            'update_user',
            `Updated participant account for ${formData.name}`
          );
        }
        setActionSuccess('Participant updated successfully.');
        setEditingUser(null);
      } else {
        // Create
        await createParticipantAccountAdmin({
          name: formData.name,
          username: formData.username,
          registrationEmail: formData.email,
          status: formData.status,
        });

        if (currentAdmin) {
          await logActivity(
            currentAdmin.uid,
            currentAdmin.displayName,
            currentAdmin.email,
            'create_user',
            `Created new participant account ${formData.username}`
          );
        }
        setActionSuccess('Participant account created successfully.');
        setIsCreateOpen(false);
      }

      await loadData(true);
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save participant');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (user: UserProfile) => {
    if (!window.confirm(`Are you sure you want to delete participant account @${user.participantUsername || user.displayName}?`)) {
      return;
    }
    try {
      await deleteParticipantAccount(user.uid);
      if (currentAdmin) {
        await logActivity(
          currentAdmin.uid,
          currentAdmin.displayName,
          currentAdmin.email,
          'delete_user',
          `Deleted participant account ${user.participantUsername || user.email}`
        );
      }
      setActionSuccess('Participant account deleted.');
      await loadData(true);
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      alert('Failed to delete participant account');
    }
  };

  const handleShowQR = async (item: { event: EventRecord; ticket: EventTicket }) => {
    try {
      const qrUrl = await QRCode.toDataURL(item.ticket.qrPayload || item.ticket.ticketNumber, {
        width: 320,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      setQrModalTicket({ ...item, qrUrl });
    } catch (err) {
      console.error('Failed generating QR code', err);
    }
  };

  const exportCSV = () => {
    const headers = ['UID', 'Name', 'Username', 'Registration Email', 'Status', 'Joined Date', 'Tickets Count'];
    const rows = participants.map((p) => {
      const ticketsCount = getParticipantTickets(p).length;
      return [
        p.uid,
        `"${p.displayName || ''}"`,
        p.participantUsername || '',
        p.participantEmail || p.email || '',
        p.status || 'approved',
        p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'N/A',
        ticketsCount,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `saint_participants_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-400 mb-1">
            <ShieldCheck className="w-4 h-4" /> Superadmin Command
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            Manage Participants
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {participants.length} Accounts
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            View participant accounts, manage login credentials, and inspect registered tickets and teams.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            Add Participant
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          {actionSuccess}
        </div>
      )}

      {/* ── KPI Stats Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Participants</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white mt-2">{participants.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Registered portal credentials</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Status</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-2">
            {participants.filter((p) => p.status === 'approved' || !p.status).length}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Approved & ready for login</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Event Tickets</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-400 mt-2">{allTickets.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Issued across all events</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Events</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-purple-400 mt-2">{events.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Active department programs</p>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, username, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {(['all', 'approved', 'pending', 'rejected'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all shrink-0 ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* ── Participants Table ── */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-400 mb-2" />
            <p className="text-xs font-semibold">Loading participant accounts...</p>
          </div>
        ) : filteredParticipants.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-300">No participants found</p>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your search query or filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="px-5 py-3.5">Participant</th>
                  <th className="px-5 py-3.5">Username</th>
                  <th className="px-5 py-3.5">Registration Email</th>
                  <th className="px-5 py-3.5">Tickets Linked</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredParticipants.map((p) => {
                  const tickets = getParticipantTickets(p);
                  return (
                    <tr key={p.uid} className="hover:bg-slate-800/30 transition-colors">
                      {/* Name & Avatar */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs shadow-md shrink-0">
                            {p.displayName?.[0]?.toUpperCase() || p.firstName?.[0]?.toUpperCase() || 'P'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-100">{p.displayName || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Participant'}</p>
                            <p className="text-[10px] text-slate-500">Joined {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'Recent'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="px-5 py-4 font-mono font-bold text-indigo-400">
                        @{p.participantUsername || 'no-username'}
                      </td>

                      {/* Registration Email */}
                      <td className="px-5 py-4 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate max-w-[200px]">{p.participantEmail || p.email}</span>
                        </div>
                      </td>

                      {/* Tickets Linked */}
                      <td className="px-5 py-4">
                        {tickets.length > 0 ? (
                          <button
                            onClick={() => setSelectedParticipant({ ...p, tickets })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold text-[11px] hover:bg-amber-500/20 transition-colors"
                          >
                            <Ticket className="w-3 h-3 text-amber-400" />
                            {tickets.length} {tickets.length === 1 ? 'Pass' : 'Passes'}
                          </button>
                        ) : (
                          <span className="text-slate-600 text-[11px]">0 passes</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            p.status === 'rejected'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : p.status === 'pending'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {p.status || 'approved'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedParticipant({ ...p, tickets })}
                            title="Inspect Tickets & Details"
                            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          >
                            <Ticket className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(p)}
                            title="Edit Account Details"
                            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            title="Delete Account"
                            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create / Edit Participant Modal ── */}
      {(isCreateOpen || editingUser) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                {editingUser ? 'Edit Participant Account' : 'Create Participant Account'}
              </h2>
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingUser(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveParticipant} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1.5">
                  Participant Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. john.doe (lowercase, numbers, dots)"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1.5">
                  Registration Contact Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="email used on event registration"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1.5">
                  Account Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="approved">Approved (Active Login)</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Suspended / Rejected</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
                >
                  {submitting ? 'Saving...' : editingUser ? 'Update Account' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Participant Details & Tickets Modal ── */}
      {selectedParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white text-base">
                  {selectedParticipant.displayName?.[0]?.toUpperCase() || 'P'}
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">{selectedParticipant.displayName}</h2>
                  <p className="text-xs text-indigo-400 font-mono">@{selectedParticipant.participantUsername}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedParticipant(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile snapshot */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">Contact Email</p>
                <p className="font-semibold text-slate-200 truncate">{selectedParticipant.participantEmail || selectedParticipant.email}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">Status</p>
                <p className="font-semibold text-emerald-400 capitalize">{selectedParticipant.status || 'approved'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">User ID</p>
                <p className="font-mono text-[10px] text-slate-400 truncate">{selectedParticipant.uid}</p>
              </div>
            </div>

            {/* Linked Passes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Ticket className="w-4 h-4 text-amber-400" />
                  Linked Event Passes ({selectedParticipant.tickets?.length || 0})
                </h3>
              </div>

              {!selectedParticipant.tickets || selectedParticipant.tickets.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-950 border border-slate-800/60 text-slate-500 text-xs">
                  No event passes currently linked to this email or UID.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedParticipant.tickets.map(({ event, ticket }) => (
                    <div
                      key={ticket.id}
                      className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{event.title}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {ticket.tierName || 'Pass'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 flex items-center gap-2">
                          <span>Ticket: <strong className="text-amber-400 font-mono">{ticket.ticketNumber}</strong></span>
                          <span>•</span>
                          <span>{event.date}</span>
                        </p>
                        {ticket.teamName && (
                          <p className="text-[11px] text-slate-400">
                            Team: <strong className="text-slate-200">{ticket.teamName}</strong> ({ticket.teamMembers?.length ? `${ticket.teamMembers.length + 1} members` : 'Solo'})
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleShowQR({ event, ticket })}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          View QR
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── QR Code Preview Modal ── */}
      {qrModalTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-center space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Pass QR Code</span>
              <button
                onClick={() => setQrModalTicket(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-sm font-bold text-white">{qrModalTicket.event.title}</h3>
            <p className="text-xs font-mono text-amber-400">{qrModalTicket.ticket.ticketNumber}</p>

            <div className="p-3 bg-white rounded-xl inline-block shadow-lg mx-auto">
              <img src={qrModalTicket.qrUrl} alt="Pass QR" className="w-48 h-48 mx-auto" />
            </div>

            <p className="text-[11px] text-slate-400">
              Registered Attendee: <strong className="text-slate-200">{qrModalTicket.ticket.guestName}</strong>
            </p>

            <button
              onClick={() => setQrModalTicket(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
