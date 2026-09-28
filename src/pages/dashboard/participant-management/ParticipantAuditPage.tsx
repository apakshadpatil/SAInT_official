import { useEffect, useState, useMemo } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { subscribeActivity } from '../../../services/activityService';
import type { ActivityLog } from '../../../types';
import {
  Activity,
  Search,
  Clock,
  User,
  Ticket,
  KeyRound,
  Download,
  Users,
  ShieldAlert,
  X,
  Eye,
  FileCheck,
  Radio,
  FileText,
  Shield,
} from 'lucide-react';
import { TableSkeleton } from '../../../components/ui/skeleton';

export default function ParticipantAuditPage() {
  const { showToast } = useToast();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionCategory, setActionCategory] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'last7' | 'last30'>('all');
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  useEffect(() => {
    const unsub = subscribeActivity((data) => {
      setLogs(data);
      setLoading(false);
    }, 400);
    return () => unsub();
  }, []);

  // Filter logs to participant-related and admin-participant actions
  const participantLogs = useMemo(() => {
    return logs.filter((log) => {
      // Is it a participant-related action?
      const action = (log.action || '').toLowerCase();
      const details = (log.details || '').toLowerCase();
      const email = (log.userEmail || '').toLowerCase();

      const isParticipantAction =
        action === 'login' ||
        action === 'participant_login' ||
        action === 'register' ||
        action === 'view_pass' ||
        action === 'ticket_view' ||
        action === 'download_ticket' ||
        action === 'update_team' ||
        action === 'upload_payment_proof' ||
        action === 'download_certificate' ||
        action.startsWith('admin_') ||
        action.includes('participant') ||
        action.includes('ticket') ||
        email.includes('.saint.local') ||
        details.includes('participant') ||
        details.includes('pass') ||
        details.includes('ticket');

      return isParticipantAction;
    });
  }, [logs]);

  // Apply User Filters
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return participantLogs.filter((log) => {
      // Search query
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        log.userName.toLowerCase().includes(query) ||
        log.userEmail.toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query) ||
        log.details.toLowerCase().includes(query) ||
        (log.targetName && log.targetName.toLowerCase().includes(query)) ||
        (log.targetId && log.targetId.toLowerCase().includes(query));

      // Action category filter
      let matchesCategory = true;
      if (actionCategory === 'logins') {
        matchesCategory = log.action === 'login' || log.action === 'participant_login' || log.action === 'register';
      } else if (actionCategory === 'passes') {
        matchesCategory =
          log.action === 'view_pass' ||
          log.action === 'ticket_view' ||
          log.action === 'download_ticket' ||
          log.details.toLowerCase().includes('pass') ||
          log.details.toLowerCase().includes('ticket');
      } else if (actionCategory === 'teams') {
        matchesCategory = log.action === 'update_team' || log.details.toLowerCase().includes('team');
      } else if (actionCategory === 'payments') {
        matchesCategory =
          log.action === 'upload_payment_proof' ||
          log.action.includes('payment') ||
          log.details.toLowerCase().includes('payment');
      } else if (actionCategory === 'certificates') {
        matchesCategory =
          log.action === 'download_certificate' || log.details.toLowerCase().includes('certificate');
      } else if (actionCategory === 'admin') {
        matchesCategory =
          log.action.startsWith('admin_') ||
          log.action.includes('status') ||
          log.details.toLowerCase().includes('created participant');
      }

      // Date range filter
      let matchesDate = true;
      if (dateFilter === 'today') {
        matchesDate = log.timestamp.startsWith(todayStr);
      } else if (dateFilter === 'last7') {
        const d = new Date(log.timestamp).getTime();
        matchesDate = now.getTime() - d <= 7 * 24 * 60 * 60 * 1000;
      } else if (dateFilter === 'last30') {
        const d = new Date(log.timestamp).getTime();
        matchesDate = now.getTime() - d <= 30 * 24 * 60 * 60 * 1000;
      }

      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [participantLogs, searchQuery, actionCategory, dateFilter]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      showToast('No logs to export', 'error');
      return;
    }
    const headers = ['Log ID', 'Timestamp (ISO)', 'Date & Time', 'User Name', 'User Email', 'Action', 'Target Resource', 'Details'];
    const rows = filteredLogs.map((l) => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${new Date(l.timestamp).toLocaleString()}"`,
      `"${l.userName.replace(/"/g, '""')}"`,
      `"${l.userEmail}"`,
      `"${l.action}"`,
      `"${(l.targetName || l.targetType || '').replace(/"/g, '""')}"`,
      `"${l.details.replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `participant_audit_log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Audit log exported to CSV', 'success');
  };

  // Helper for badge styling
  const getActionBadge = (action: string) => {
    const act = action.toLowerCase();
    if (act === 'login' || act === 'participant_login') {
      return {
        label: 'Participant Login',
        className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        icon: KeyRound,
      };
    }
    if (act === 'view_pass' || act === 'ticket_view') {
      return {
        label: 'Viewed Pass QR',
        className: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        icon: Ticket,
      };
    }
    if (act === 'download_ticket') {
      return {
        label: 'Downloaded Pass Badge',
        className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        icon: Download,
      };
    }
    if (act === 'update_team') {
      return {
        label: 'Updated Team Roster',
        className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        icon: Users,
      };
    }
    if (act === 'upload_payment_proof') {
      return {
        label: 'Uploaded Payment Proof',
        className: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        icon: FileText,
      };
    }
    if (act === 'download_certificate') {
      return {
        label: 'Downloaded Certificate',
        className: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
        icon: FileCheck,
      };
    }
    if (act.startsWith('admin_')) {
      return {
        label: 'Admin Operation',
        className: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        icon: ShieldAlert,
      };
    }
    return {
      label: action.replace(/_/g, ' '),
      className: 'bg-slate-700 text-slate-300 border-slate-600',
      icon: Activity,
    };
  };

  const getRelativeTime = (isoString?: string) => {
    if (!isoString) return '';
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
      return `${diffDays}d ago`;
    } catch {
      return '';
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
            <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
              <Radio size={12} className="animate-pulse" /> Real-time Audit Stream
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--dash-text)]">
            Access & Activity Audit Trail
          </h1>
          <p className="text-sm text-[var(--dash-muted)] mt-1">
            Forensic timeline of who accessed what when: sign-ins, ticket pass views, team modifications, and certificate downloads.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[var(--dash-card)] hover:bg-[var(--dash-hover)] text-[var(--dash-text)] border border-[var(--dash-card-border)] transition-all cursor-pointer"
          >
            <Download size={14} className="text-emerald-400" />
            <span>Export Audit Log ({filteredLogs.length})</span>
          </button>
        </div>
      </div>

      {/* ── Filter Toolbar ── */}
      <div className="stat-card p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dash-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search who (name, email), what (ticket, event, action), or keywords..."
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

          {/* Action Category Selector */}
          <select
            value={actionCategory}
            onChange={(e) => setActionCategory(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg bg-[var(--dash-bg)] border border-[var(--dash-card-border)] text-[var(--dash-text)] focus:outline-none focus:border-blue-500 shrink-0"
          >
            <option value="all">All Action Categories</option>
            <option value="logins">Participant Logins & Sign-ups</option>
            <option value="passes">Pass & QR Ticket Views</option>
            <option value="teams">Team Roster Updates</option>
            <option value="payments">Payment Proof Uploads</option>
            <option value="certificates">Certificate Downloads</option>
            <option value="admin">Admin Modifications</option>
          </select>

          {/* Date Selector */}
          <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
            {(
              [
                { id: 'all', label: 'All Time' },
                { id: 'today', label: 'Today' },
                { id: 'last7', label: 'Last 7 Days' },
                { id: 'last30', label: 'Last 30 Days' },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                onClick={() => setDateFilter(d.id)}
                className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  dateFilter === d.id
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-[var(--dash-bg)] text-[var(--dash-muted)] hover:text-[var(--dash-text)] border border-[var(--dash-card-border)]'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-[var(--dash-muted)] pt-2 border-t border-[var(--dash-card-border)]">
          <span>
            Telemetry stream active • Showing <strong>{filteredLogs.length}</strong> events
          </span>
          {(searchQuery || actionCategory !== 'all' || dateFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setActionCategory('all');
                setDateFilter('all');
              }}
              className="text-blue-400 hover:underline font-semibold"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* ── Audit Table ── */}
      {loading ? (
        <TableSkeleton rows={10} />
      ) : filteredLogs.length === 0 ? (
        <div className="stat-card p-12 text-center space-y-3">
          <Activity size={40} className="mx-auto text-slate-500" />
          <h3 className="text-base font-bold text-[var(--dash-text)]">No audit activity matching filters</h3>
          <p className="text-xs text-[var(--dash-muted)] max-w-sm mx-auto">
            Try choosing a different date range or search keyword.
          </p>
        </div>
      ) : (
        <div className="stat-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--dash-card-border)] bg-[var(--dash-hover)] text-[var(--dash-muted)] uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">When (Timestamp)</th>
                  <th className="py-3 px-4">Who (Participant / Admin)</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">What Was Accessed</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--dash-card-border)]">
                {filteredLogs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const Icon = badge.icon;

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-[var(--dash-hover)] transition-colors group cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-[var(--dash-text)]">
                          {new Date(log.timestamp).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[10px] text-[var(--dash-muted)] flex items-center gap-1 mt-0.5">
                          <Clock size={10} className="text-slate-500" />
                          <span>
                            {new Date(log.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}{' '}
                            <span className="text-blue-400 font-semibold">({getRelativeTime(log.timestamp)})</span>
                          </span>
                        </div>
                      </td>

                      {/* Who */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-[var(--dash-text)] flex items-center gap-1.5">
                          <User size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate max-w-[160px]">{log.userName || 'Anonymous'}</span>
                        </div>
                        <div className="text-[11px] text-[var(--dash-muted)] truncate max-w-[180px]">
                          {log.userEmail}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${badge.className}`}
                        >
                          <Icon size={12} />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* What was accessed */}
                      <td className="py-3 px-4">
                        {log.targetName ? (
                          <div className="font-semibold text-[var(--dash-text)] truncate max-w-[200px]">
                            {log.targetName}
                          </div>
                        ) : log.targetType ? (
                          <span className="font-mono text-[10px] uppercase text-slate-400">
                            {log.targetType}
                          </span>
                        ) : (
                          <span className="text-[var(--dash-muted)]">—</span>
                        )}
                        {log.targetId && (
                          <div className="text-[10px] font-mono text-slate-500 truncate max-w-[160px]">
                            ID: {log.targetId}
                          </div>
                        )}
                      </td>

                      {/* Details */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="text-slate-300 text-xs line-clamp-2 leading-relaxed">
                          {log.details}
                        </div>
                      </td>

                      {/* Inspect */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
                          title="View raw log details & payload"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Log Inspection Modal ── */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-[var(--dash-card)] border border-[var(--dash-card-border)] rounded-2xl p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--dash-card-border)]">
              <div>
                <h3 className="text-base font-bold text-[var(--dash-text)] flex items-center gap-2">
                  <Activity size={18} className="text-blue-400" />
                  Audit Event Details
                </h3>
                <span className="text-[11px] font-mono text-slate-400">Event ID: {selectedLog.id}</span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[var(--dash-bg)] border border-[var(--dash-card-border)]">
                <div>
                  <span className="text-[10px] text-slate-500 block">Exact Timestamp</span>
                  <span className="font-semibold text-[var(--dash-text)]">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                  <span className="text-[10px] text-blue-400 block font-mono">({selectedLog.timestamp})</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Action Type</span>
                  <span className="font-mono font-bold text-emerald-400">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">User Name</span>
                  <span className="font-bold text-[var(--dash-text)]">{selectedLog.userName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">User Email</span>
                  <span className="font-mono text-slate-300 break-all">{selectedLog.userEmail}</span>
                </div>
                {selectedLog.targetName && (
                  <div className="col-span-2">
                    <span className="text-[10px] text-slate-500 block">Target Resource</span>
                    <span className="font-bold text-[var(--dash-text)]">{selectedLog.targetName}</span>
                  </div>
                )}
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                  Action Summary
                </span>
                <p className="p-3 rounded-lg bg-[var(--dash-bg)] border border-[var(--dash-card-border)] text-slate-200 leading-relaxed font-sans">
                  {selectedLog.details}
                </p>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                    Metadata Payload
                  </span>
                  <pre className="p-3 rounded-lg bg-black/50 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-40">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[var(--dash-card-border)] flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
