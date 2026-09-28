import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../../../contexts/ToastContext';
import {
  getEnhancedParticipantAccounts,
  generateParticipantLoginInstructions,
  type EnhancedParticipantAccount,
} from '../../../services/participantAccountService';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Radio,
  Search,
  RefreshCw,
  Copy,
  Check,
  Mail,
  Send,
  Ticket,
  Shield,
} from 'lucide-react';
import { TableSkeleton } from '../../../components/ui/skeleton';

export default function ParticipantLoginsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'all';

  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accounts, setAccounts] = useState<EnhancedParticipantAccount[]>([]);

  // Filters
  const [statusTab, setStatusTab] = useState<'all' | 'logged_in' | 'never_logged_in' | 'online_now'>(
    initialFilter === 'never_logged_in' ? 'never_logged_in' : 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedUid, setCopiedUid] = useState<string | null>(null);
  const [copiedBatch, setCopiedBatch] = useState(false);

  const loadData = async (force = false) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);

      const data = await getEnhancedParticipantAccounts(force);
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load participant login data:', err);
      showToast('Failed to load participant login status', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync tab with URL
  useEffect(() => {
    const f = searchParams.get('filter');
    if (f === 'never_logged_in' || f === 'logged_in' || f === 'online_now') {
      setStatusTab(f);
    }
  }, [searchParams]);

  // Overall counts
  const totalCount = accounts.length;
  const loggedInCount = accounts.filter((a) => a.hasLoggedIn).length;
  const neverLoggedInCount = totalCount - loggedInCount;
  const onlineCount = accounts.filter((a) => a.isOnline).length;
  const adoptionPercentage =
    totalCount > 0 ? Math.round((loggedInCount / totalCount) * 1000) / 10 : 0;
  const allLoggedIn = totalCount > 0 && loggedInCount === totalCount;

  // Filtered accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        acc.displayName.toLowerCase().includes(q) ||
        acc.username.toLowerCase().includes(q) ||
        acc.participantEmail.toLowerCase().includes(q) ||
        acc.tickets.some((t) => t.eventTitle.toLowerCase().includes(q));

      let matchesTab = true;
      if (statusTab === 'logged_in') matchesTab = acc.hasLoggedIn;
      else if (statusTab === 'never_logged_in') matchesTab = !acc.hasLoggedIn;
      else if (statusTab === 'online_now') matchesTab = acc.isOnline;

      return matchesSearch && matchesTab;
    });
  }, [accounts, searchQuery, statusTab]);

  const handleCopyNudge = (account: EnhancedParticipantAccount) => {
    const text = generateParticipantLoginInstructions(account);
    navigator.clipboard.writeText(text);
    setCopiedUid(account.uid);
    showToast(`Copied login instructions for @${account.username}`, 'success');
    setTimeout(() => setCopiedUid(null), 3000);
  };

  // Copy all pending participants emails for batch reminder
  const handleCopyAllPendingEmails = () => {
    const pendingEmails = accounts
      .filter((a) => !a.hasLoggedIn && a.participantEmail)
      .map((a) => a.participantEmail)
      .filter((e, idx, arr) => arr.indexOf(e) === idx);

    if (pendingEmails.length === 0) {
      showToast('No pending participants found', 'info');
      return;
    }

    navigator.clipboard.writeText(pendingEmails.join(', '));
    setCopiedBatch(true);
    showToast(`Copied ${pendingEmails.length} participant emails to clipboard`, 'success');
    setTimeout(() => setCopiedBatch(false), 3500);
  };

  // Relative time helper
  const formatTime = (iso?: string) => {
    if (!iso) return 'Never';
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return iso;
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
            Login & Space Adoption Status
          </h1>
          <p className="text-sm text-[var(--dash-muted)] mt-1">
            Real-time verification of whether all participants have signed in to the participant space or are still pending first login.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-[var(--dash-card)] hover:bg-[var(--dash-hover)] text-[var(--dash-text)] border border-[var(--dash-card-border)] transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-blue-400' : ''} />
            <span>Refresh</span>
          </button>

          {neverLoggedInCount > 0 && (
            <button
              onClick={handleCopyAllPendingEmails}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all cursor-pointer"
              title="Copy comma-separated list of all participants who have never logged in"
            >
              {copiedBatch ? <Check size={14} className="text-emerald-400" /> : <Mail size={14} />}
              <span>{copiedBatch ? 'Emails Copied!' : `Copy Pending Emails (${neverLoggedInCount})`}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Executive Status Verdict Banner ── */}
      <div
        className={`p-5 rounded-2xl border transition-all ${
          allLoggedIn
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : neverLoggedInCount > 0
            ? 'bg-[var(--dash-card)] border-amber-500/30'
            : 'bg-[var(--dash-card)] border-[var(--dash-card-border)]'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                allLoggedIn
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {allLoggedIn ? <CheckCircle2 size={26} /> : <AlertTriangle size={26} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[var(--dash-text)]">
                  {allLoggedIn
                    ? 'All Participants Have Logged In to Participant Space!'
                    : `${loggedInCount} of ${totalCount} Participants Have Logged In (${adoptionPercentage}%)`}
                </h2>
              </div>
              <p className="text-xs text-[var(--dash-muted)] mt-1 max-w-2xl leading-relaxed">
                {allLoggedIn
                  ? 'Every single registered participant account has successfully authenticated and accessed their passes, team rosters, and certificates.'
                  : `${neverLoggedInCount} participant${
                      neverLoggedInCount > 1 ? 's have' : ' has'
                    } never signed into their account yet. You can copy their credentials or send reminders below.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0 self-end md:self-auto">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--dash-muted)] block">
                Space Adoption
              </span>
              <span className="text-2xl font-black text-emerald-400">{adoptionPercentage}%</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800 rounded-full h-2.5 mt-4 overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all duration-700 ${
              allLoggedIn ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'bg-emerald-400'
            }`}
            style={{ width: `${adoptionPercentage}%` }}
          />
        </div>
      </div>

      {/* ── Status Tab Pills & Search ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => {
              setStatusTab('all');
              setSearchParams({});
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              statusTab === 'all'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-[var(--dash-card)] text-[var(--dash-muted)] hover:text-white border border-[var(--dash-card-border)]'
            }`}
          >
            <span>All Participants</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
              {totalCount}
            </span>
          </button>

          <button
            onClick={() => {
              setStatusTab('never_logged_in');
              setSearchParams({ filter: 'never_logged_in' });
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              statusTab === 'never_logged_in'
                ? 'bg-amber-600 text-white shadow'
                : 'bg-[var(--dash-card)] text-amber-400 hover:bg-amber-500/10 border border-amber-500/30'
            }`}
          >
            <AlertTriangle size={13} />
            <span>Never Logged In</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
              {neverLoggedInCount}
            </span>
          </button>

          <button
            onClick={() => {
              setStatusTab('logged_in');
              setSearchParams({ filter: 'logged_in' });
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              statusTab === 'logged_in'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-[var(--dash-card)] text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/30'
            }`}
          >
            <CheckCircle2 size={13} />
            <span>Logged In (Active)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
              {loggedInCount}
            </span>
          </button>

          <button
            onClick={() => {
              setStatusTab('online_now');
              setSearchParams({ filter: 'online_now' });
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              statusTab === 'online_now'
                ? 'bg-purple-600 text-white shadow'
                : 'bg-[var(--dash-card)] text-purple-400 hover:bg-purple-500/10 border border-purple-500/30'
            }`}
          >
            <Radio size={13} className="animate-pulse" />
            <span>Online Now</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
              {onlineCount}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dash-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search participant name, email, pass..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--dash-card)] border border-[var(--dash-card-border)] text-[var(--dash-text)] placeholder-[var(--dash-muted)] focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* ── Table View ── */}
      {loading ? (
        <TableSkeleton rows={8} />
      ) : filteredAccounts.length === 0 ? (
        <div className="stat-card p-12 text-center space-y-3">
          <CheckCircle2 size={40} className="mx-auto text-emerald-400" />
          <h3 className="text-base font-bold text-[var(--dash-text)]">
            {statusTab === 'never_logged_in'
              ? 'Great news! No participants are pending first login.'
              : 'No participants found in this view.'}
          </h3>
          <p className="text-xs text-[var(--dash-muted)] max-w-sm mx-auto">
            {searchQuery ? `No participants matching "${searchQuery}".` : 'All accounts are accounted for.'}
          </p>
        </div>
      ) : (
        <div className="stat-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--dash-card-border)] bg-[var(--dash-hover)] text-[var(--dash-muted)] uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Participant</th>
                  <th className="py-3 px-4">Portal Username</th>
                  <th className="py-3 px-4">Space Login Status</th>
                  <th className="py-3 px-4">Account Created</th>
                  <th className="py-3 px-4">Last Activity / Session</th>
                  <th className="py-3 px-4 text-right">Quick Nudge & Login Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--dash-card-border)]">
                {filteredAccounts.map((account) => (
                  <tr key={account.uid} className="hover:bg-[var(--dash-hover)] transition-colors">
                    {/* Participant */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-[var(--dash-text)] flex items-center gap-1.5">
                        <span>{account.displayName}</span>
                        {account.isOnline && (
                          <span
                            className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"
                            title="Online right now in participant space"
                          />
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--dash-muted)]">{account.participantEmail}</div>
                      {account.tickets.length > 0 && (
                        <div className="text-[10px] text-blue-400 mt-0.5 flex items-center gap-1">
                          <Ticket size={10} />
                          <span>{account.tickets[0].eventTitle}</span>
                        </div>
                      )}
                    </td>

                    {/* Username */}
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-blue-400">@{account.username}</div>
                      <span className="text-[10px] text-slate-500 block">
                        Password: Set on portal / default
                      </span>
                    </td>

                    {/* Space Login Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {account.isOnline ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          Online Now
                        </span>
                      ) : account.hasLoggedIn ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          <CheckCircle2 size={13} className="text-emerald-400" />
                          Logged In
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <Clock size={13} />
                          Never Logged In
                        </span>
                      )}
                    </td>

                    {/* Account Created */}
                    <td className="py-3 px-4 whitespace-nowrap text-[var(--dash-muted)]">
                      <div>{formatTime(account.createdAt)}</div>
                      <span className="text-[10px] text-slate-500">
                        Via {account.creationSource === 'admin_created' ? 'Admin' : 'Self-Signup'}
                      </span>
                    </td>

                    {/* Last Login / Activity */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {account.lastLoginAt || account.lastSeen ? (
                        <div>
                          <div className="font-medium text-[var(--dash-text)]">
                            {formatTime(account.lastLoginAt || account.lastSeen)}
                          </div>
                          {account.lastActivity && (
                            <span className="text-[10px] text-purple-400 font-mono block">
                              {account.lastActivity.action.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-amber-400 text-xs font-semibold">No logins recorded</span>
                      )}
                    </td>

                    {/* Quick Nudge Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleCopyNudge(account)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 transition-all cursor-pointer"
                          title="Copy login instructions with username & link"
                        >
                          {copiedUid === account.uid ? (
                            <>
                              <Check size={13} className="text-emerald-400" />
                              <span className="text-emerald-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={13} />
                              <span>Copy Credentials</span>
                            </>
                          )}
                        </button>

                        <a
                          href={`mailto:${account.participantEmail}?subject=Your SAInT Participant Space Access&body=${encodeURIComponent(
                            generateParticipantLoginInstructions(account)
                          )}`}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                          title="Send prefilled email reminder"
                        >
                          <Send size={14} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
