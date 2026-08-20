import { useEffect, useState } from 'react';
import { subscribeActivity } from '../../services/activityService';
import type { ActivityLog } from '../../types';
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
} from 'recharts';
import { Search, Eye, Filter, Calendar, Activity, Users, ShieldAlert, Award } from 'lucide-react';
import RightPanel from '../../components/ui/RightPanel';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function UserActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  useEffect(() => {
    const unsub = subscribeActivity(setLogs);
    return () => unsub();
  }, []);

  // Filter logs based on search and action dropdown
  const filteredLogs = logs.filter((log) => {
    const query = search.toLowerCase();
    const matchesSearch =
      log.userName.toLowerCase().includes(query) ||
      log.userEmail.toLowerCase().includes(query) ||
      log.details.toLowerCase().includes(query) ||
      log.action.toLowerCase().includes(query);

    const matchesAction = actionFilter === 'all' || log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  // Calculate top metrics
  const totalActions = logs.length;
  const uniqueUsers = new Set(logs.map((l) => l.userId)).size;

  const todayStr = new Date().toISOString().split('T')[0];
  const actionsToday = logs.filter((l) => l.timestamp.startsWith(todayStr)).length;
  const loginsToday = logs.filter((l) => l.action === 'login' && l.timestamp.startsWith(todayStr)).length;

  // Chart 1: Group actions by action type (Pie Chart)
  const actionCounts = logs.reduce<Record<string, number>>((acc, curr) => {
    acc[curr.action] = (acc[curr.action] || 0) + 1;
    return acc;
  }, {});

  const pieChartData = Object.entries(actionCounts).map(([name, value]) => ({
    name: name.replace('_', ' ').toUpperCase(),
    value,
  }));

  // Chart 2: Group actions by date (last 7 days) (Bar Chart)
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const barChartData = last7Days.map((date) => {
    const count = logs.filter((l) => l.timestamp.startsWith(date)).length;
    return {
      date: new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' }),
      Actions: count,
    };
  });

  // Chart 3: Active users leaderboard
  const userStats = logs.reduce<Record<string, { name: string; email: string; count: number }>>((acc, curr) => {
    if (!acc[curr.userId]) {
      acc[curr.userId] = { name: curr.userName, email: curr.userEmail, count: 0 };
    }
    acc[curr.userId].count++;
    return acc;
  }, {});

  const leaderboardData = Object.values(userStats)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'login':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'approve_user':
      case 'create_position':
        return 'bg-green-500/10 text-green-400 border border-green-500/20';
      case 'reject_user':
      case 'remove_user':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      default:
        return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
    }
  };

  const uniqueActions = ['all', ...Array.from(new Set(logs.map((l) => l.action)))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>System Audits & Activity</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>
          Monitor user logs, track operational triggers, and analyze activity metrics across the platform.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="dash-card p-4 border flex items-center gap-4" style={{ borderColor: 'var(--dash-border)' }}>
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--dash-muted)' }}>Total Actions</span>
            <p className="text-xl font-bold" style={{ color: 'var(--dash-text)' }}>{totalActions}</p>
          </div>
        </div>

        <div className="dash-card p-4 border flex items-center gap-4" style={{ borderColor: 'var(--dash-border)' }}>
          <div className="w-10 h-10 rounded-xl bg-green-600/10 border border-green-500/20 flex items-center justify-center text-green-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--dash-muted)' }}>Active Users</span>
            <p className="text-xl font-bold" style={{ color: 'var(--dash-text)' }}>{uniqueUsers}</p>
          </div>
        </div>

        <div className="dash-card p-4 border flex items-center gap-4" style={{ borderColor: 'var(--dash-border)' }}>
          <div className="w-10 h-10 rounded-xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--dash-muted)' }}>Actions Today</span>
            <p className="text-xl font-bold" style={{ color: 'var(--dash-text)' }}>{actionsToday}</p>
          </div>
        </div>

        <div className="dash-card p-4 border flex items-center gap-4" style={{ borderColor: 'var(--dash-border)' }}>
          <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--dash-muted)' }}>Logins Today</span>
            <p className="text-xl font-bold" style={{ color: 'var(--dash-text)' }}>{loginsToday}</p>
          </div>
        </div>
      </div>

      {/* Analytics Charts Panel */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Daily actions bar chart */}
        <div className="dash-card p-5 border lg:col-span-2 space-y-4" style={{ borderColor: 'var(--dash-border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>Daily Action Velocity (Last 7 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3d" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                  }}
                />
                <Bar dataKey="Actions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Action Breakdown Pie */}
        <div className="dash-card p-5 border flex flex-col justify-between" style={{ borderColor: 'var(--dash-border)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--dash-text)' }}>Operations Split</h3>
          <div className="h-48 flex items-center justify-center">
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>No logs available</p>
            )}
          </div>
          <div className="space-y-1.5 max-h-[100px] overflow-y-auto mt-2 text-[10px]" style={{ color: 'var(--dash-muted)' }}>
            {pieChartData.map((d, index) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span>{d.name}</span>
                </div>
                <span className="font-bold">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column: Leaderboard */}
        <div className="dash-card p-5 border space-y-4" style={{ borderColor: 'var(--dash-border)' }}>
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
            <Award className="w-4 h-4 text-yellow-500" /> Active Operations Leaderboard
          </h3>
          <div className="space-y-3">
            {leaderboardData.map((item, index) => (
              <div key={item.email} className="flex items-center justify-between p-3 rounded-xl bg-black/10 border" style={{ borderColor: 'var(--dash-border)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 w-5">#{index + 1}</span>
                  <div>
                    <h4 className="text-xs font-semibold" style={{ color: 'var(--dash-text)' }}>{item.name}</h4>
                    <p className="text-[10px]" style={{ color: 'var(--dash-muted)' }}>{item.email}</p>
                  </div>
                </div>
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400">{item.count} Actions</span>
              </div>
            ))}

            {leaderboardData.length === 0 && (
              <p className="text-xs text-center py-6" style={{ color: 'var(--dash-muted)' }}>No statistics recorded.</p>
            )}
          </div>
        </div>

        {/* Right Column: Searchable Log Feed */}
        <div className="dash-card p-5 border lg:col-span-2 space-y-4" style={{ borderColor: 'var(--dash-border)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>Operational Audit Feed</h3>
            <div className="flex flex-wrap gap-2">
              {/* Action Filter */}
              <div className="relative flex items-center">
                <Filter className="w-3.5 h-3.5 absolute left-2.5 text-slate-400" />
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="input-field !py-1.5 !pl-8 !pr-2 !text-xs !bg-black/20"
                >
                  {uniqueActions.map((act) => (
                    <option key={act} value={act}>
                      {act === 'all' ? 'All Operations' : act.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Text Search */}
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  className="input-field !py-1.5 !pl-8 !text-xs !bg-black/20"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b text-[10px] uppercase font-bold tracking-wider" style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-muted)' }}>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Member</th>
                  <th className="py-2.5 px-3">Operation</th>
                  <th className="py-2.5 px-3">Details</th>
                  <th className="py-2.5 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y">
                {filteredLogs.slice(0, 50).map((log) => (
                  <tr key={log.id} className="hover:bg-black/5" style={{ color: 'var(--dash-text)' }}>
                    <td className="py-3 px-3 whitespace-nowrap" style={{ color: 'var(--dash-muted)' }}>
                      {new Date(log.timestamp).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold">{log.userName}</span>
                      <p className="text-[10px]" style={{ color: 'var(--dash-muted)' }}>{log.userEmail}</p>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${getActionBadgeClass(log.action)}`}>
                        {log.action.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3 max-w-[200px] truncate" style={{ color: 'var(--dash-muted)' }}>
                      {log.details}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 italic">
                      No matching activity logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Inspector Modal */}
      {selectedLog && (
        <RightPanel open={!!selectedLog} onClose={() => setSelectedLog(null)} title="Log Entry Inspector" width="560px">
          <div className="space-y-4">
            <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
              <ShieldAlert className="w-4 h-4 text-amber-400" /> Activity record
            </h3>
            <div className="space-y-3 text-xs" style={{ color: 'var(--dash-text)' }}>
              <div>
                <span className="block text-[10px] uppercase font-bold" style={{ color: 'var(--dash-muted)' }}>Operation Log ID</span>
                <p className="font-mono bg-black/10 p-1.5 rounded border text-[10px]" style={{ borderColor: 'var(--dash-border)' }}>{selectedLog.id}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-[10px] uppercase font-bold" style={{ color: 'var(--dash-muted)' }}>Triggered By</span>
                  <p className="font-semibold">{selectedLog.userName}</p>
                  <p className="text-[10px]" style={{ color: 'var(--dash-muted)' }}>{selectedLog.userEmail}</p>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold" style={{ color: 'var(--dash-muted)' }}>Timestamp</span>
                  <p>{new Date(selectedLog.timestamp).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <span className="block text-[10px] uppercase font-bold" style={{ color: 'var(--dash-muted)' }}>Operation Classification</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold inline-block mt-1 ${getActionBadgeClass(selectedLog.action)}`}>
                  {selectedLog.action.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              <div>
                <span className="block text-[10px] uppercase font-bold" style={{ color: 'var(--dash-muted)' }}>Activity Detail Description</span>
                <div className="bg-black/20 p-3 rounded-xl border mt-1 leading-relaxed whitespace-pre-wrap" style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-muted)' }}>
                  {selectedLog.details}
                </div>
              </div>
            </div>
          </div>
        </RightPanel>
      )}
    </div>
  );
}
