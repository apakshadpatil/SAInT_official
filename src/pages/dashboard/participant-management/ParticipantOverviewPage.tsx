import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  KeyRound,
  Activity,
  Ticket,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  Shield,
  ChevronRight,
  TrendingUp,
  Radio,
  FileSpreadsheet,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useToast } from '../../../contexts/ToastContext';
import {
  getEnhancedParticipantAccounts,
  computeParticipantMetrics,
  generateParticipantLoginInstructions,
  exportParticipantsToCSV,
  type EnhancedParticipantAccount,
  type ParticipantOverviewMetrics,
} from '../../../services/participantAccountService';
import { StatGridSkeleton } from '../../../components/ui/skeleton';

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

export default function ParticipantOverviewPage() {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accounts, setAccounts] = useState<EnhancedParticipantAccount[]>([]);
  const [metrics, setMetrics] = useState<ParticipantOverviewMetrics | null>(null);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  const loadData = async (force = false) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);

      const data = await getEnhancedParticipantAccounts(force);
      setAccounts(data);
      setMetrics(computeParticipantMetrics(data));
    } catch (err) {
      console.error('Failed to load participant overview data:', err);
      showToast('Failed to load participant data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopyNudge = (account: EnhancedParticipantAccount) => {
    const text = generateParticipantLoginInstructions(account);
    navigator.clipboard.writeText(text);
    setCopiedUid(account.uid);
    showToast(`Copied login instructions for @${account.username}`, 'success');
    setTimeout(() => setCopiedUid(null), 3000);
  };

  const handleExportCSV = () => {
    if (accounts.length === 0) {
      showToast('No participants to export', 'error');
      return;
    }
    exportParticipantsToCSV(accounts);
    showToast('Participant directory exported to CSV', 'success');
  };

  // Pie chart data: Logged in vs Never Logged in
  const pieData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: 'Logged In to Space', value: metrics.loggedInCount },
      { name: 'Never Logged In (Pending)', value: metrics.neverLoggedInCount },
    ].filter((d) => d.value > 0);
  }, [metrics]);

  // Never logged in with tickets (high priority)
  const pendingWithTickets = useMemo(() => {
    return accounts.filter((a) => !a.hasLoggedIn && a.tickets.length > 0);
  }, [accounts]);

  // Quick stats navigation cards
  const subModules = [
    {
      title: 'Account Directory',
      path: '/dashboard/participant-accounts',
      desc: 'View all participant accounts, creation dates, usernames, edit profiles, and reset credentials.',
      icon: UserCheck,
      badge: `${metrics?.totalParticipants || 0} Accounts`,
      color: '#3b82f6',
    },
    {
      title: 'Login & Space Status',
      path: '/dashboard/participant-logins',
      desc: 'Verify if all participants have logged into the participant space, check live presence, and send reminders.',
      icon: KeyRound,
      badge: `${metrics?.adoptionPercentage || 0}% Adoption`,
      color: '#10b981',
    },
    {
      title: 'Access & Audit Log',
      path: '/dashboard/participant-audit',
      desc: 'Audit trail of who accessed what when: pass views, QR scans, team updates, cert downloads.',
      icon: Activity,
      badge: 'Live Telemetry',
      color: '#8b5cf6',
    },
    {
      title: 'Passes & Tickets',
      path: '/dashboard/participant-access',
      desc: 'Manage ticket passes, payment verifications, QR check-in status, and grant or revoke access.',
      icon: Ticket,
      badge: `${metrics?.totalLinkedTickets || 0} Passes`,
      color: '#f59e0b',
    },
  ];

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 bg-slate-800 rounded animate-pulse" />
          <div className="h-9 w-24 bg-slate-800 rounded animate-pulse" />
        </div>
        <StatGridSkeleton />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* ── Top Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[var(--dash-card-border)]">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
              <Shield size={12} /> SuperAdmin Exclusive
            </span>
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <Radio size={12} className="text-emerald-400 animate-pulse" /> Live Telemetry
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--dash-text)]">
            Participants Account Management
          </h1>
          <p className="text-sm text-[var(--dash-muted)] mt-1">
            Master control centre to monitor participant creation timestamps, track space login adoption, and audit who accessed what when.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-[var(--dash-card)] hover:bg-[var(--dash-hover)] text-[var(--dash-text)] border border-[var(--dash-card-border)] transition-all cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-blue-400' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-[var(--dash-card)] hover:bg-[var(--dash-hover)] text-[var(--dash-text)] border border-[var(--dash-card-border)] transition-all cursor-pointer"
          >
            <FileSpreadsheet size={14} className="text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <Link
            to="/dashboard/participant-accounts"
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg text-white transition-all shadow-lg shadow-blue-500/20"
            style={{ background: 'var(--dash-accent)' }}
          >
            <Users size={14} />
            <span>Manage Accounts</span>
          </Link>
        </div>
      </div>

      {/* ── Key Metrics Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Accounts */}
        <div className="stat-card relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--dash-muted)]">
              Total Participants
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Users size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[var(--dash-text)] tracking-tight">
            {metrics?.totalParticipants || 0}
          </div>
          <div className="mt-2 text-xs text-[var(--dash-muted)] flex items-center gap-1.5">
            <span className="text-emerald-400 font-semibold">{metrics?.approvedCount || 0} approved</span>
            <span>•</span>
            <span>{metrics?.pendingCount || 0} pending</span>
          </div>
        </div>

        {/* Space Login Adoption */}
        <div className="stat-card relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--dash-muted)]">
              Space Adoption Rate
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 tracking-tight">
            {metrics?.adoptionPercentage || 0}%
          </div>
          <div className="mt-2 text-xs text-[var(--dash-muted)] flex items-center gap-1">
            <span className="font-semibold text-emerald-300">{metrics?.loggedInCount || 0}</span> of{' '}
            {metrics?.totalParticipants || 0} logged in
          </div>
          {/* Visual Mini Progress Bar */}
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${metrics?.adoptionPercentage || 0}%` }}
            />
          </div>
        </div>

        {/* Never Logged In (Pending) */}
        <div className="stat-card relative overflow-hidden group border-amber-500/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-amber-400">
              Pending First Login
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-amber-400 tracking-tight">
            {metrics?.neverLoggedInCount || 0}
          </div>
          <div className="mt-2 text-xs text-[var(--dash-muted)] flex items-center gap-1">
            <span className="font-semibold text-amber-300">{metrics?.neverLoggedInWithTicketsCount || 0}</span> have active event tickets
          </div>
        </div>

        {/* Online Live Presence */}
        <div className="stat-card relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--dash-muted)]">
              Currently Online
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Radio size={16} className="text-purple-400 animate-pulse" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[var(--dash-text)] tracking-tight flex items-center gap-2">
            <span>{metrics?.currentlyOnlineCount || 0}</span>
            {metrics?.currentlyOnlineCount && metrics.currentlyOnlineCount > 0 ? (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            ) : null}
          </div>
          <div className="mt-2 text-xs text-[var(--dash-muted)]">
            Active sessions in participant space
          </div>
        </div>
      </div>

      {/* ── Sub-module Navigation Cards ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-[var(--dash-text)] flex items-center gap-2">
            <Sparkles size={16} className="text-blue-400" />
            Participants Account Management Sections
          </h2>
          <span className="text-xs text-[var(--dash-muted)]">Multiple sidebar options</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {subModules.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="p-4 rounded-xl border border-[var(--dash-card-border)] bg-[var(--dash-card)] hover:border-blue-500/50 hover:bg-[var(--dash-hover)] transition-all flex flex-col justify-between group text-left relative"
                style={{ textDecoration: 'none' }}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ background: `${item.color}15`, color: item.color }}
                    >
                      <Icon size={18} />
                    </div>
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${item.color}15`, color: item.color }}
                    >
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[var(--dash-text)] group-hover:text-blue-400 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[var(--dash-muted)] mt-1.5 leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="flex items-center gap-1 text-xs font-semibold text-blue-400 mt-4 pt-3 border-t border-[var(--dash-card-border)] group-hover:translate-x-0.5 transition-transform">
                  <span>Open Section</span>
                  <ChevronRight size={14} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Visual Charts Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Adoption Distribution Chart */}
        <div className="stat-card lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-[var(--dash-text)]">
                Participant Space Adoption
              </h3>
              <KeyRound size={16} className="text-emerald-400" />
            </div>
            <p className="text-xs text-[var(--dash-muted)] mb-4">
              Ratio of participants who have signed in vs pending first login
            </p>

            <div className="h-56 w-full flex items-center justify-center">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#f8fafc',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(val) => <span className="text-xs text-slate-300">{val}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-xs text-[var(--dash-muted)]">No participant data recorded yet</div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--dash-card-border)] text-xs text-[var(--dash-muted)] flex items-center justify-between">
            <span>Adoption status:</span>
            <span className="font-bold text-emerald-400">
              {metrics?.loggedInCount} active / {metrics?.totalParticipants} total
            </span>
          </div>
        </div>

        {/* 7-Day Trend Chart */}
        <div className="stat-card lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-[var(--dash-text)]">
                Registrations vs First Logins (Last 7 Days)
              </h3>
              <TrendingUp size={16} className="text-blue-400" />
            </div>
            <p className="text-xs text-[var(--dash-muted)] mb-4">
              Compare new account creations with participants logging in
            </p>

            <div className="h-56 w-full">
              {metrics?.dailyRegistrations && metrics.dailyRegistrations.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.dailyRegistrations}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#f8fafc',
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={28}
                      formatter={(val) => <span className="text-xs text-slate-300">{val}</span>}
                    />
                    <Bar dataKey="created" name="Accounts Created" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="loggedIn" name="First Logins" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-[var(--dash-muted)]">
                  No activity in the last 7 days
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--dash-card-border)] text-xs text-[var(--dash-muted)] flex items-center justify-between">
            <span>Overall adoption readiness</span>
            <Link to="/dashboard/participant-logins" className="text-blue-400 hover:underline flex items-center gap-1 font-semibold">
              View Detailed Logins <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── High-Priority Table: Never Logged In with Tickets ── */}
      <div className="stat-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-[var(--dash-text)] flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-400" />
              Participants Never Logged In (With Active Event Tickets)
            </h3>
            <p className="text-xs text-[var(--dash-muted)] mt-0.5">
              These participants have registered event tickets but have NOT logged in to access their digital QR pass.
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 self-start sm:self-auto">
            {pendingWithTickets.length} Participants Need Nudge
          </span>
        </div>

        {pendingWithTickets.length === 0 ? (
          <div className="p-8 text-center rounded-lg border border-dashed border-[var(--dash-card-border)] bg-[var(--dash-hover)]">
            <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-2" />
            <p className="text-sm font-semibold text-[var(--dash-text)]">
              All ticket holders have accessed their participant space!
            </p>
            <p className="text-xs text-[var(--dash-muted)] mt-1">
              Zero participants with active passes are pending first-time sign in.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--dash-card-border)] text-[var(--dash-muted)] uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Participant</th>
                  <th className="py-2.5 px-3">Username & Contact</th>
                  <th className="py-2.5 px-3">Created On</th>
                  <th className="py-2.5 px-3">Linked Event Pass</th>
                  <th className="py-2.5 px-3">Login Status</th>
                  <th className="py-2.5 px-3 text-right">Quick Nudge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--dash-card-border)]">
                {pendingWithTickets.slice(0, 6).map((part) => (
                  <tr key={part.uid} className="hover:bg-[var(--dash-hover)] transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[var(--dash-text)]">{part.displayName}</div>
                      <div className="text-[10px] text-[var(--dash-muted)]">UID: {part.uid.slice(0, 14)}...</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-mono text-blue-400 font-semibold">@{part.username}</div>
                      <div className="text-[11px] text-[var(--dash-muted)]">{part.participantEmail}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-[var(--dash-text)]">
                        {new Date(part.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-[10px] text-[var(--dash-muted)]">
                        {new Date(part.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {part.tickets.length > 0 ? (
                        <div className="space-y-0.5">
                          <span className="font-medium text-[var(--dash-text)] block truncate max-w-[200px]">
                            {part.tickets[0].eventTitle}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {part.tickets[0].ticketNumber}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[var(--dash-muted)]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock size={10} /> Never Logged In
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleCopyNudge(part)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all cursor-pointer"
                        title="Copy ready-to-paste login credentials message"
                      >
                        {copiedUid === part.uid ? (
                          <>
                            <Check size={12} className="text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Copy Credentials</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pendingWithTickets.length > 6 && (
          <div className="pt-2 text-center">
            <Link
              to="/dashboard/participant-logins?filter=never_logged_in"
              className="text-xs font-bold text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              <span>View all {pendingWithTickets.length} pending participants in Login Status</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
