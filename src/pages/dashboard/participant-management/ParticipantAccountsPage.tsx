import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import {
  getEnhancedParticipantAccounts,
  createParticipantAccountSuperadmin,
  updateParticipantAccountSuperadmin,
  deleteParticipantAccountSuperadmin,
  setParticipantStatusSuperadmin,
  exportParticipantsToCSV,
  generateParticipantLoginInstructions,
  type EnhancedParticipantAccount,
} from '../../../services/participantAccountService';
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  Mail,
  Shield,
  Ticket,
  Calendar,
  Clock,
  Download,
  Copy,
  Check,
  Eye,
  ArrowUpDown,
} from 'lucide-react';
import { TableSkeleton } from '../../../components/ui/skeleton';

export default function ParticipantAccountsPage() {
  const { profile: adminProfile } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accounts, setAccounts] = useState<EnhancedParticipantAccount[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'self_signup' | 'admin_created' | 'event_registration'>('all');
  const [sortBy, setSortBy] = useState<'created_desc' | 'created_asc' | 'name' | 'username'>('created_desc');

  // Modals & Drawers
  const [selectedAccount, setSelectedAccount] = useState<EnhancedParticipantAccount | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EnhancedParticipantAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<EnhancedParticipantAccount | null>(null);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  // Form states
  const [createFormData, setCreateFormData] = useState({
    username: '',
    name: '',
    registrationEmail: '',
    status: 'approved' as 'approved' | 'pending' | 'rejected',
  });
  const [editFormData, setEditFormData] = useState({
    displayName: '',
    participantEmail: '',
    status: 'approved' as 'approved' | 'pending' | 'rejected',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadData = async (force = false) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);

      const data = await getEnhancedParticipantAccounts(force);
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load participant accounts:', err);
      showToast('Failed to load participant accounts', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered & Sorted accounts
  const filteredAccounts = useMemo(() => {
    return accounts
      .filter((acc) => {
        const query = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !query ||
          acc.displayName.toLowerCase().includes(query) ||
          acc.username.toLowerCase().includes(query) ||
          acc.email.toLowerCase().includes(query) ||
          acc.participantEmail.toLowerCase().includes(query) ||
          acc.uid.toLowerCase().includes(query) ||
          acc.tickets.some((t) => t.eventTitle.toLowerCase().includes(query) || t.ticketNumber.toLowerCase().includes(query));

        const matchesStatus = statusFilter === 'all' || acc.status === statusFilter;
        const matchesSource = sourceFilter === 'all' || acc.creationSource === sourceFilter;

        return matchesQuery && matchesStatus && matchesSource;
      })
      .sort((a, b) => {
        if (sortBy === 'created_desc') {
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        }
        if (sortBy === 'created_asc') {
          return (a.createdAt || '').localeCompare(b.createdAt || '');
        }
        if (sortBy === 'name') {
          return a.displayName.localeCompare(b.displayName);
        }
        if (sortBy === 'username') {
          return a.username.localeCompare(b.username);
        }
        return 0;
      });
  }, [accounts, searchQuery, statusFilter, sourceFilter, sortBy]);

  // Handle Create Participant
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminProfile) return;
    setFormError('');
    setSubmitting(true);

    try {
      if (!createFormData.username.trim() || !createFormData.name.trim() || !createFormData.registrationEmail.trim()) {
        throw new Error('Please fill in all required fields.');
      }
      await createParticipantAccountSuperadmin(adminProfile, createFormData);
      showToast(`Participant @${createFormData.username} created successfully!`, 'success');
      setIsCreateModalOpen(false);
      setCreateFormData({ username: '', name: '', registrationEmail: '', status: 'approved' });
      await loadData(true);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create participant');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Edit Participant
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminProfile || !editingAccount) return;
    setFormError('');
    setSubmitting(true);

    try {
      const [firstName, ...rest] = editFormData.displayName.trim().split(/\s+/);
      await updateParticipantAccountSuperadmin(adminProfile, editingAccount.uid, {
        displayName: editFormData.displayName.trim(),
        firstName: firstName || '',
        lastName: rest.join(' '),
        participantEmail: editFormData.participantEmail.trim().toLowerCase(),
        status: editFormData.status,
      });

      showToast(`Updated account for @${editingAccount.username}`, 'success');
      setEditingAccount(null);
      await loadData(true);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update account');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Participant
  const handleDelete = async () => {
    if (!adminProfile || !deletingAccount) return;
    setSubmitting(true);
    try {
      await deleteParticipantAccountSuperadmin(adminProfile, deletingAccount);
      showToast(`Permanently deleted @${deletingAccount.username}`, 'success');
      setDeletingAccount(null);
      if (selectedAccount?.uid === deletingAccount.uid) {
        setSelectedAccount(null);
      }
      await loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete participant', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Status Toggle
  const handleQuickStatusChange = async (account: EnhancedParticipantAccount, newStatus: 'approved' | 'rejected') => {
    if (!adminProfile) return;
    try {
      await setParticipantStatusSuperadmin(adminProfile, account, newStatus);
      showToast(`Status for @${account.username} set to ${newStatus}`, 'success');
      setAccounts((prev) =>
        prev.map((a) => (a.uid === account.uid ? { ...a, status: newStatus } : a))
      );
      if (selectedAccount?.uid === account.uid) {
        setSelectedAccount({ ...selectedAccount, status: newStatus });
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const handleCopyCredentials = (account: EnhancedParticipantAccount) => {
    const text = generateParticipantLoginInstructions(account);
    navigator.clipboard.writeText(text);
    setCopiedUid(account.uid);
    showToast(`Copied login instructions for @${account.username}`, 'success');
    setTimeout(() => setCopiedUid(null), 3000);
  };

  // Relative time helper
  const getRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Unknown';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHr / 24);

      if (diffSec < 60) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHr < 24) return `${diffHr}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 30) return `${diffDays}d ago`;
      return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[var(--dash-card-border)]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
              <Shield size={12} /> Participants Account Management
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--dash-text)]">
            Participant Account Directory
          </h1>
          <p className="text-sm text-[var(--dash-muted)] mt-1">
            Complete registry of all participant accounts, exact creation timestamps, security status, and connected event credentials.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-[var(--dash-card)] hover:bg-[var(--dash-hover)] text-[var(--dash-text)] border border-[var(--dash-card-border)] transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-blue-400' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => exportParticipantsToCSV(filteredAccounts)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-[var(--dash-card)] hover:bg-[var(--dash-hover)] text-[var(--dash-text)] border border-[var(--dash-card-border)] transition-all cursor-pointer"
          >
            <Download size={14} className="text-emerald-400" />
            <span>Export ({filteredAccounts.length})</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg text-white transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
            style={{ background: 'var(--dash-accent)' }}
          >
            <Plus size={14} />
            <span>Create Participant</span>
          </button>
        </div>
      </div>

      {/* ── Filters & Search Toolbar ── */}
      <div className="stat-card p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dash-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by participant name, username, email, UID, or ticket..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg bg-[var(--dash-bg)] border border-[var(--dash-card-border)] text-[var(--dash-text)] placeholder-[var(--dash-muted)] focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
            {(['all', 'approved', 'pending', 'rejected'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-[var(--dash-bg)] text-[var(--dash-muted)] hover:text-[var(--dash-text)] border border-[var(--dash-card-border)]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <ArrowUpDown size={14} className="text-[var(--dash-muted)]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--dash-bg)] border border-[var(--dash-card-border)] text-[var(--dash-text)] focus:outline-none focus:border-blue-500"
            >
              <option value="created_desc">Newest Created First</option>
              <option value="created_asc">Oldest Created First</option>
              <option value="name">Sort by Name</option>
              <option value="username">Sort by Username</option>
            </select>
          </div>
        </div>

        {/* Source Filter pills */}
        <div className="flex items-center gap-2 text-xs text-[var(--dash-muted)] pt-2 border-t border-[var(--dash-card-border)] flex-wrap">
          <span className="font-semibold text-slate-400">Account Origin:</span>
          {(
            [
              { id: 'all', label: 'All Origins' },
              { id: 'self_signup', label: 'Self-Registered (Portal)' },
              { id: 'admin_created', label: 'Admin Provisioned' },
              { id: 'event_registration', label: 'Event Checkout' },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              onClick={() => setSourceFilter(s.id as any)}
              className={`px-2 py-0.5 text-[11px] rounded transition-all cursor-pointer ${
                sourceFilter === s.id
                  ? 'bg-slate-700 text-white font-bold'
                  : 'hover:text-[var(--dash-text)] text-slate-400'
              }`}
            >
              {s.label}
            </button>
          ))}
          <span className="ml-auto text-[11px] font-semibold text-blue-400">
            Showing {filteredAccounts.length} of {accounts.length} accounts
          </span>
        </div>
      </div>

      {/* ── Table View ── */}
      {loading ? (
        <TableSkeleton rows={8} />
      ) : filteredAccounts.length === 0 ? (
        <div className="stat-card p-12 text-center space-y-3">
          <Users size={40} className="mx-auto text-slate-500" />
          <h3 className="text-base font-bold text-[var(--dash-text)]">No participant accounts found</h3>
          <p className="text-xs text-[var(--dash-muted)] max-w-sm mx-auto">
            {searchQuery
              ? `No accounts matching "${searchQuery}". Try adjusting your search term or filters.`
              : 'No participant accounts created yet. Click Create Participant to add one.'}
          </p>
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setSourceFilter('all');
              }}
              className="text-xs font-semibold text-blue-400 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="stat-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--dash-card-border)] bg-[var(--dash-hover)] text-[var(--dash-muted)] uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Participant Profile</th>
                  <th className="py-3 px-4">Username & Auth</th>
                  <th className="py-3 px-4">When Created</th>
                  <th className="py-3 px-4">Status & Space Access</th>
                  <th className="py-3 px-4">Tickets & Passes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--dash-card-border)]">
                {filteredAccounts.map((account) => (
                  <tr
                    key={account.uid}
                    className="hover:bg-[var(--dash-hover)] transition-colors group cursor-pointer"
                    onClick={() => setSelectedAccount(account)}
                  >
                    {/* Participant Profile */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 uppercase text-xs border border-blue-500/30">
                          {account.displayName?.[0] || account.username?.[0] || 'P'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[var(--dash-text)] truncate flex items-center gap-1.5">
                            <span>{account.displayName}</span>
                            {account.isOnline && (
                              <span
                                className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                                title="Currently online in participant space"
                              />
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--dash-muted)] truncate flex items-center gap-1">
                            <Mail size={11} className="text-slate-500" />
                            <span>{account.participantEmail}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Username & Auth */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-blue-400 font-bold flex items-center gap-1">
                        <span>@{account.username}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {account.creationSource === 'admin_created'
                          ? 'Admin Provisioned'
                          : account.creationSource === 'event_registration'
                          ? 'Checkout Auto-Created'
                          : 'Self-Registered'}
                      </span>
                    </td>

                    {/* When Created */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-medium text-[var(--dash-text)] flex items-center gap-1">
                        <Calendar size={12} className="text-slate-400" />
                        <span>
                          {new Date(account.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--dash-muted)] flex items-center gap-1 mt-0.5">
                        <Clock size={11} className="text-slate-500" />
                        <span>
                          {new Date(account.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          ({getRelativeTime(account.createdAt)})
                        </span>
                      </div>
                    </td>

                    {/* Status & Space Login */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                            account.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : account.status === 'pending'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}
                        >
                          {account.status}
                        </span>

                        {/* Space Login status */}
                        {account.hasLoggedIn ? (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            ✓ Space Active
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-amber-500/20">
                            Pending First Login
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Tickets & Passes */}
                    <td className="py-3.5 px-4">
                      {account.tickets.length > 0 ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 font-semibold text-blue-400 text-[11px]">
                            <Ticket size={12} />
                            <span>{account.tickets.length} pass{account.tickets.length > 1 ? 'es' : ''}</span>
                          </span>
                          <div className="text-[10px] text-[var(--dash-muted)] truncate max-w-[180px]">
                            {account.tickets[0].eventTitle}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px]">No passes linked</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleCopyCredentials(account)}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition-colors"
                          title="Copy login instructions for participant"
                        >
                          {copiedUid === account.uid ? (
                            <Check size={14} className="text-emerald-400" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>

                        <button
                          onClick={() => setSelectedAccount(account)}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                          title="View detailed account drawer"
                        >
                          <Eye size={14} />
                        </button>

                        <button
                          onClick={() => {
                            setEditingAccount(account);
                            setEditFormData({
                              displayName: account.displayName,
                              participantEmail: account.participantEmail,
                              status: account.status,
                            });
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                          title="Edit participant account"
                        >
                          <Edit2 size={14} />
                        </button>

                        <button
                          onClick={() => setDeletingAccount(account)}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete participant account"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Detail Drawer (Right Panel) ── */}
      {selectedAccount && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-[var(--dash-card)] h-full overflow-y-auto border-l border-[var(--dash-card-border)] p-6 space-y-6 animate-slideLeft shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[var(--dash-card-border)]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 font-extrabold flex items-center justify-center text-lg border border-blue-500/30">
                  {selectedAccount.displayName?.[0] || 'P'}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--dash-text)]">{selectedAccount.displayName}</h2>
                  <p className="text-xs font-mono text-blue-400 font-semibold">@{selectedAccount.username}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAccount(null)}
                className="p-1.5 rounded-lg hover:bg-[var(--dash-hover)] text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopyCredentials(selectedAccount)}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-600/30 transition-all cursor-pointer"
              >
                <Copy size={13} />
                <span>Copy Login Message</span>
              </button>
              {selectedAccount.status === 'approved' ? (
                <button
                  onClick={() => handleQuickStatusChange(selectedAccount, 'rejected')}
                  className="py-2 px-3 text-xs font-semibold rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-600/30 transition-all cursor-pointer"
                >
                  Revoke Access
                </button>
              ) : (
                <button
                  onClick={() => handleQuickStatusChange(selectedAccount, 'approved')}
                  className="py-2 px-3 text-xs font-semibold rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 transition-all cursor-pointer"
                >
                  Approve Access
                </button>
              )}
            </div>

            {/* Account Metadata Card */}
            <div className="space-y-3 p-4 rounded-xl bg-[var(--dash-bg)] border border-[var(--dash-card-border)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--dash-muted)]">
                Account Credentials & Timestamps
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">Exact Created Time</span>
                  <span className="font-medium text-[var(--dash-text)]">
                    {new Date(selectedAccount.createdAt).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-blue-400 block font-semibold">
                    ({getRelativeTime(selectedAccount.createdAt)})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Space Login Status</span>
                  <span
                    className={`font-bold ${
                      selectedAccount.hasLoggedIn ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {selectedAccount.hasLoggedIn ? 'Logged In' : 'Never Logged In'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Last Seen / Active</span>
                  <span className="text-[var(--dash-text)]">
                    {selectedAccount.lastSeen
                      ? `${getRelativeTime(selectedAccount.lastSeen)}`
                      : 'Never active'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Real-time Presence</span>
                  <span className="flex items-center gap-1 font-semibold text-[var(--dash-text)]">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selectedAccount.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'
                      }`}
                    />
                    {selectedAccount.isOnline ? 'Online Now' : 'Offline'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Registered Contact Email</span>
                  <span className="font-mono text-slate-300 break-all">{selectedAccount.participantEmail}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Internal Auth Address</span>
                  <span className="font-mono text-slate-400 break-all">{selectedAccount.email}</span>
                </div>
              </div>
            </div>

            {/* Linked Event Passes */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--dash-muted)] flex items-center justify-between">
                <span>Linked Event Passes ({selectedAccount.tickets.length})</span>
                <Ticket size={14} className="text-blue-400" />
              </h3>
              {selectedAccount.tickets.length === 0 ? (
                <div className="p-4 text-center rounded-lg bg-[var(--dash-bg)] text-xs text-slate-500 border border-[var(--dash-card-border)]">
                  No event tickets associated with this account.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedAccount.tickets.map((t) => (
                    <div
                      key={t.ticketId}
                      className="p-3 rounded-lg bg-[var(--dash-bg)] border border-[var(--dash-card-border)] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-[var(--dash-text)]">{t.eventTitle}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded capitalize ${
                            t.accessStatus === 'granted'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {t.accessStatus}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[var(--dash-muted)]">
                        <span className="font-mono text-slate-400">Pass: {t.ticketNumber}</span>
                        <span>{t.checkedIn ? '✓ Checked In' : 'Not Checked In'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Participant Activity Logs */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--dash-muted)] flex items-center justify-between">
                <span>Recent Participant Telemetry ({selectedAccount.activityCount})</span>
                <Clock size={14} className="text-purple-400" />
              </h3>
              {selectedAccount.activities.length === 0 ? (
                <div className="p-4 text-center rounded-lg bg-[var(--dash-bg)] text-xs text-slate-500 border border-[var(--dash-card-border)]">
                  No activity logged yet for this participant.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {selectedAccount.activities.map((act) => (
                    <div
                      key={act.id}
                      className="p-2.5 rounded-lg bg-[var(--dash-bg)] border border-[var(--dash-card-border)] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-blue-400 text-[11px] uppercase">
                          {act.action.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-slate-500">{getRelativeTime(act.timestamp)}</span>
                      </div>
                      <p className="text-[11px] text-slate-300">{act.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create Participant Modal ── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[var(--dash-card)] border border-[var(--dash-card-border)] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--dash-card-border)]">
              <h3 className="text-base font-bold text-[var(--dash-text)] flex items-center gap-2">
                <Plus size={18} className="text-blue-400" /> Create Participant Account
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[var(--dash-text)] mb-1">
                  Participant Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                  placeholder="e.g. Alex Johnson"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--dash-bg)] border border-[var(--dash-card-border)] text-[var(--dash-text)] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--dash-text)] mb-1">
                  Participant Username *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono">@</span>
                  <input
                    type="text"
                    required
                    value={createFormData.username}
                    onChange={(e) =>
                      setCreateFormData({
                        ...createFormData,
                        username: e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''),
                      })
                    }
                    placeholder="alex_j"
                    className="w-full pl-8 pr-3 py-2 font-mono rounded-lg bg-[var(--dash-bg)] border border-[var(--dash-card-border)] text-[var(--dash-text)] focus:outline-none focus:border-blue-500"
                  />
                </div>
                <span className="text-[10px] text-[var(--dash-muted)] mt-1 block">
                  3–30 lowercase letters, numbers, dots, or underscores.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-[var(--dash-text)] mb-1">
                  Registration / Contact Email *
                </label>
                <input
                  type="email"
                  required
                  value={createFormData.registrationEmail}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, registrationEmail: e.target.value })
                  }
                  placeholder="alex@college.edu"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--dash-bg)] border border-[var(--dash-card-border)] text-[var(--dash-text)] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--dash-text)] mb-1">Initial Status</label>
                <select
                  value={createFormData.status}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, status: e.target.value as any })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--dash-bg)] border border-[var(--dash-card-border)] text-[var(--dash-text)] focus:outline-none focus:border-blue-500"
                >
                  <option value="approved">Approved (Can access immediately)</option>
                  <option value="pending">Pending Approval</option>
                  <option value="rejected">Rejected / Disabled</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--dash-card-border)]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--dash-card-border)] hover:bg-[var(--dash-hover)] text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow cursor-pointer"
                >
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Participant Modal ── */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[var(--dash-card)] border border-[var(--dash-card-border)] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--dash-card-border)]">
              <div>
                <h3 className="text-base font-bold text-[var(--dash-text)]">Edit Participant</h3>
                <span className="text-xs font-mono text-blue-400">@{editingAccount.username}</span>
              </div>
              <button
                onClick={() => setEditingAccount(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[var(--dash-text)] mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={editFormData.displayName}
                  onChange={(e) => setEditFormData({ ...editFormData, displayName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--dash-bg)] border border-[var(--dash-card-border)] text-[var(--dash-text)] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--dash-text)] mb-1">Contact Email</label>
                <input
                  type="email"
                  required
                  value={editFormData.participantEmail}
                  onChange={(e) => setEditFormData({ ...editFormData, participantEmail: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--dash-bg)] border border-[var(--dash-card-border)] text-[var(--dash-text)] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--dash-text)] mb-1">Status</label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--dash-bg)] border border-[var(--dash-card-border)] text-[var(--dash-text)] focus:outline-none focus:border-blue-500"
                >
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected (Revoke access)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--dash-card-border)]">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-4 py-2 rounded-lg border border-[var(--dash-card-border)] hover:bg-[var(--dash-hover)] text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deletingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-[var(--dash-card)] border border-red-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-[var(--dash-text)]">Delete Participant Account?</h3>
              <p className="text-xs text-[var(--dash-muted)] mt-1.5">
                Are you sure you want to permanently delete <strong className="text-white">@{deletingAccount.username}</strong> ({deletingAccount.displayName})? This cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingAccount(null)}
                className="flex-1 py-2 text-xs font-semibold rounded-lg border border-[var(--dash-card-border)] hover:bg-[var(--dash-hover)] text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="flex-1 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-all shadow cursor-pointer"
              >
                {submitting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
