import { useEffect, useState, useMemo } from 'react';
import {
  Activity, Database, TrendingUp, Users, RefreshCw,
  Search, ShieldAlert, CheckCircle2, Calendar, Zap,
  Layers, HardDrive, Download, X, BarChart3, Sparkles
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { isSuperAdmin } from '../../utils/permissions';
import { getSystemStatsOverview } from '../../services/dbTrackingService';
import type { SystemStatsOverview, UserDBAnalyticsSummary } from '../../types';
import { StatGridSkeleton, TableSkeleton, ChartSkeleton, DataStateWrapper } from '../../components/ui/skeleton';
import { useToast } from '../../contexts/ToastContext';

const panelStyle: React.CSSProperties = {
  background: 'var(--dash-card)',
  border: '1px solid var(--dash-border)',
  borderRadius: '6px',
};

export default function SystemStatsPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const isSuper = isSuperAdmin(profile);

  const [overview, setOverview] = useState<SystemStatsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d' | 'month'>('7d');
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'days' | 'inspector'>('overview');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userSortBy, setUserSortBy] = useState<'calls' | 'reads' | 'activity'>('calls');
  const [selectedUser, setSelectedUser] = useState<UserDBAnalyticsSummary | null>(null);
  const [inspectorSearch, setInspectorSearch] = useState('');
  const [inspectorOpFilter, setInspectorOpFilter] = useState('all');
  const [inspectorResourceFilter, setInspectorResourceFilter] = useState('all');

  const fetchStats = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      let dateRange: { startDate?: string; endDate?: string } | undefined;
      if (timeRange === 'today') { dateRange = { startDate: todayStr, endDate: todayStr }; }
      else if (timeRange === '7d') { const d = new Date(); d.setDate(d.getDate() - 7); dateRange = { startDate: d.toISOString().split('T')[0], endDate: todayStr }; }
      else if (timeRange === '30d') { const d = new Date(); d.setDate(d.getDate() - 30); dateRange = { startDate: d.toISOString().split('T')[0], endDate: todayStr }; }
      else if (timeRange === 'month') { dateRange = { startDate: `${todayStr.slice(0, 7)}-01`, endDate: todayStr }; }
      const data = await getSystemStatsOverview(dateRange);
      setOverview(data);
    } catch (err) {
      console.error('Failed to load system stats', err);
      showToast('Failed to load database stats', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStats(); }, [timeRange]);

  const filteredUsers = useMemo(() => {
    if (!overview?.topUsers) return [];
    let list = [...overview.topUsers];
    if (userSearch.trim()) { const q = userSearch.toLowerCase(); list = list.filter(u => u.userName.toLowerCase().includes(q) || u.userEmail.toLowerCase().includes(q)); }
    if (userRoleFilter !== 'all') list = list.filter(u => u.userRole === userRoleFilter);
    if (userSortBy === 'calls') list.sort((a, b) => b.totalCalls - a.totalCalls);
    else if (userSortBy === 'reads') list.sort((a, b) => b.totalReads - a.totalReads);
    else list.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
    return list;
  }, [overview?.topUsers, userSearch, userRoleFilter, userSortBy]);

  const filteredTraces = useMemo(() => {
    if (!overview?.recentTraces) return [];
    let traces = [...overview.recentTraces];
    if (inspectorSearch.trim()) { const q = inspectorSearch.toLowerCase(); traces = traces.filter(t => t.resource.toLowerCase().includes(q) || t.action.toLowerCase().includes(q) || t.page.toLowerCase().includes(q) || t.userName.toLowerCase().includes(q)); }
    if (inspectorOpFilter !== 'all') traces = traces.filter(t => t.operation === inspectorOpFilter);
    if (inspectorResourceFilter !== 'all') traces = traces.filter(t => t.resource === inspectorResourceFilter);
    return traces;
  }, [overview?.recentTraces, inspectorSearch, inspectorOpFilter, inspectorResourceFilter]);

  const handleExportCSV = () => {
    if (!overview) return;
    try {
      const headers = ['Date','Total Calls','Total Reads','Total Writes','Cached Reads','Active Users'];
      const rows = overview.dayWiseStats.map(d => [d.date, d.totalCalls, d.totalReads, d.totalWrites, d.cachedReads, d.activeUsersCount]);
      const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const link = document.createElement('a');
      link.setAttribute('href', encodeURI(csv));
      link.setAttribute('download', `saint_db_analytics_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      showToast('CSV exported successfully', 'info');
    } catch { showToast('Export failed', 'error'); }
  };

  if (!isSuper) {
    return (
      <div className="p-12 text-center space-y-3">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold" style={{ color: 'var(--dash-text)' }}>Access Denied</h2>
        <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>Only Superadmin accounts can view System Stats.</p>
      </div>
    );
  }

  const tooltipStyle = {
    backgroundColor: 'var(--dash-card)',
    border: '1px solid var(--dash-border)',
    borderRadius: '4px',
    fontSize: '12px',
    color: 'var(--dash-text)',
  };

  const kpiCards = overview ? [
    { label: 'Total DB Calls', value: overview.totalCalls.toLocaleString(), sub: `${overview.todayCalls} today`, color: '#3b82f6', icon: <Database className="w-4 h-4" />, subIcon: <TrendingUp className="w-3 h-3" /> },
    { label: 'Network Reads', value: overview.totalReads.toLocaleString(), sub: `${overview.todayReads} today`, color: '#f59e0b', icon: <HardDrive className="w-4 h-4" /> },
    { label: 'Cache Savings', value: overview.cachedReads.toLocaleString(), sub: `${overview.cacheSavingsRate}% reads saved`, color: '#10b981', icon: <Zap className="w-4 h-4" />, subIcon: <Sparkles className="w-3 h-3" />, highlight: true },
    { label: 'Total Writes', value: overview.totalWrites.toLocaleString(), sub: 'Inserts & Updates', color: '#8b5cf6', icon: <Layers className="w-4 h-4" /> },
    { label: 'Active Users', value: String(overview.activeUsersCount), sub: `~${overview.avgCallsPerUser} calls/user`, color: '#ec4899', icon: <Users className="w-4 h-4" />, extraClass: 'col-span-2 sm:col-span-1' },
  ] : [];

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px' }}>Superadmin</span>
            <span className="text-xs" style={{ color: 'var(--dash-muted)' }}>· Real-time Telemetry</span>
          </div>
          <h1 className="page-header-title">System Stats & DB Analytics</h1>
          <p className="page-header-sub">Monitor query efficiency, cache savings, user activity, and day-by-day telemetry.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-0.5 gap-0.5 text-xs" style={{ background: 'var(--dash-hover)', border: '1px solid var(--dash-border)', borderRadius: '6px' }}>
            {(['today','7d','30d','month'] as const).map(r => (
              <button key={r} onClick={() => setTimeRange(r)} className="px-3 py-1 font-medium transition-all" style={{ borderRadius: '4px', background: timeRange === r ? 'var(--dash-accent)' : 'transparent', color: timeRange === r ? '#fff' : 'var(--dash-muted)' }}>
                {r === 'today' ? 'Today' : r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : 'This Month'}
              </button>
            ))}
          </div>
          <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium" style={{ ...panelStyle, color: 'var(--dash-text)' }}>
            <Download className="w-3.5 h-3.5" /><span>Export CSV</span>
          </button>
          <button onClick={() => fetchStats(true)} disabled={refreshing} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium disabled:opacity-50" style={{ background: 'var(--dash-accent)', color: '#fff', borderRadius: '6px' }}>
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /><span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <DataStateWrapper loading={loading} skeleton={<StatGridSkeleton count={5} columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" />}>
        {overview && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {kpiCards.map(card => (
              <div key={card.label} className={`stat-card relative overflow-hidden ${card.extraClass || ''}`} style={card.highlight ? { border: `1px solid ${card.color}33`, background: `${card.color}08`, borderRadius: '6px' } : { borderRadius: '6px' }}>
                <div className="stat-card-accent-bar" style={{ background: card.color }} />
                <div className="flex items-start justify-between mt-1">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: card.highlight ? card.color : 'var(--dash-muted)' }}>{card.label}</p>
                    <p className="text-2xl font-black mt-1 tabular-nums" style={{ color: card.color }}>{card.value}</p>
                    <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: card.highlight ? card.color : 'var(--dash-muted)' }}>
                      {card.subIcon}<span>{card.sub}</span>
                    </p>
                  </div>
                  <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{ background: `${card.color}18`, color: card.color, borderRadius: '4px' }}>{card.icon}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DataStateWrapper>

      {/* Tabs */}
      <div className="flex items-center gap-1" style={{ borderBottom: '1px solid var(--dash-border)', paddingBottom: '1px' }}>
        {[
          { key: 'overview', label: 'Analytics', icon: <BarChart3 className="w-3.5 h-3.5" /> },
          { key: 'users', label: `Users (${overview?.topUsers.length || 0})`, icon: <Users className="w-3.5 h-3.5" /> },
          { key: 'days', label: 'Day-Wise', icon: <Calendar className="w-3.5 h-3.5" /> },
          { key: 'inspector', label: `Inspector (${overview?.recentTraces.length || 0})`, icon: <Activity className="w-3.5 h-3.5" /> },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all" style={{ borderRadius: '4px', background: activeTab === tab.key ? 'var(--dash-accent)' : 'transparent', color: activeTab === tab.key ? '#fff' : 'var(--dash-muted)' }}>
            {tab.icon}<span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Analytics */}
      {activeTab === 'overview' && (
        <div className="space-y-5 animate-fade-in">
          <DataStateWrapper loading={loading} skeleton={<ChartSkeleton height={280} hasHeader={true} />}>
            {overview && (
              <div className="p-5 space-y-4" style={panelStyle}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}><TrendingUp className="w-4 h-4 text-blue-500" />Database Operations Over Time</h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--dash-muted)' }}>Network Reads vs. Cache Hits day-by-day</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <span className="flex items-center gap-1.5 text-blue-500"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Total Calls</span>
                    <span className="flex items-center gap-1.5 text-amber-500"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Network Reads</span>
                    <span className="flex items-center gap-1.5 text-emerald-500"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Cached</span>
                  </div>
                </div>
                <div className="h-64 sm:h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[...overview.dayWiseStats].reverse()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gCalls" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                        <linearGradient id="gReads" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient>
                        <linearGradient id="gCached" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--dash-muted)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--dash-muted)' }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="totalCalls" name="Total Calls" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#gCalls)" />
                      <Area type="monotone" dataKey="totalReads" name="Network Reads" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#gReads)" />
                      <Area type="monotone" dataKey="cachedReads" name="Cached Reads" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#gCached)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </DataStateWrapper>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="p-5 space-y-3" style={panelStyle}>
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}><Database className="w-4 h-4 text-purple-500" />Top Collections</h3>
              <div className="h-56 w-full">
                {overview && overview.topResources.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overview.topResources} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--dash-muted)' }} />
                      <YAxis dataKey="resource" type="category" tick={{ fontSize: 11, fill: 'var(--dash-muted)' }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" name="Queries" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-full flex items-center justify-center text-xs" style={{ color: 'var(--dash-muted)' }}>No resource traffic yet</div>}
              </div>
            </div>

            <div className="p-5 space-y-3" style={panelStyle}>
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}><Layers className="w-4 h-4 text-pink-500" />Most Intensive Pages</h3>
              <div className="h-56 w-full">
                {overview && overview.topPages.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overview.topPages} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="page" tick={{ fontSize: 10, fill: 'var(--dash-muted)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--dash-muted)' }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" name="Requests" fill="#ec4899" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-full flex items-center justify-center text-xs" style={{ color: 'var(--dash-muted)' }}>No page traffic yet</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Users */}
      {activeTab === 'users' && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-3 flex flex-col md:flex-row items-center justify-between gap-3" style={panelStyle}>
            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--dash-muted)' }} />
              <input type="text" placeholder="Search name, email or ID..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="dash-input !pl-9 !py-1.5 !text-xs !w-full" style={{ borderRadius: '4px' }} />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--dash-muted)' }}>
                <span>Role:</span>
                <select value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)} className="dash-input !py-1 !px-2 !text-xs" style={{ borderRadius: '4px' }}>
                  <option value="all">All Roles</option>
                  <option value="superadmin">Super Admin</option>
                  <option value="core">Core</option>
                  <option value="member">Member</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--dash-muted)' }}>
                <span>Sort:</span>
                <select value={userSortBy} onChange={e => setUserSortBy(e.target.value as any)} className="dash-input !py-1 !px-2 !text-xs" style={{ borderRadius: '4px' }}>
                  <option value="calls">Highest Calls</option>
                  <option value="reads">Highest Reads</option>
                  <option value="activity">Most Recent</option>
                </select>
              </div>
            </div>
          </div>

          <DataStateWrapper loading={loading} isEmpty={filteredUsers.length === 0} emptyTitle="No User Activity" emptyDescription="No users matching your filters have recorded database requests." skeleton={<TableSkeleton rows={6} cols={6} hasSearch={false} />}>
            <div className="overflow-hidden" style={panelStyle}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--dash-border)', background: 'var(--dash-hover)' }}>
                      {['User','Role','Total Calls','Reads','Writes','Cache Hits','Last Active',''].map((h, i) => (
                        <th key={i} className={`py-2.5 px-4 text-[10px] font-semibold uppercase tracking-wider ${i >= 2 && i < 7 ? 'text-right' : ''}`} style={{ color: 'var(--dash-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => (
                      <tr key={user.userId} className="cursor-pointer transition-colors" style={{ borderBottom: '1px solid var(--dash-border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--dash-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        onClick={() => setSelectedUser(user)}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 flex items-center justify-center shrink-0 text-white font-bold text-xs" style={{ background: 'linear-gradient(135deg,#3b82f6,#4f46e5)', borderRadius: '4px' }}>{user.userName?.[0] || 'U'}</div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate" style={{ color: 'var(--dash-text)' }}>{user.userName}</p>
                              <p className="text-[10px] truncate" style={{ color: 'var(--dash-muted)' }}>{user.userEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase" style={{ borderRadius: '3px', background: user.userRole==='superadmin'?'rgba(239,68,68,0.08)':user.userRole==='core'?'rgba(139,92,246,0.08)':'rgba(59,130,246,0.08)', color: user.userRole==='superadmin'?'#ef4444':user.userRole==='core'?'#8b5cf6':'#3b82f6', border: `1px solid ${user.userRole==='superadmin'?'rgba(239,68,68,0.2)':user.userRole==='core'?'rgba(139,92,246,0.2)':'rgba(59,130,246,0.2)'}` }}>{user.userRole}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold tabular-nums" style={{ color: 'var(--dash-text)' }}>{user.totalCalls.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-medium tabular-nums text-amber-500">{user.totalReads.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-medium tabular-nums text-purple-500">{user.totalWrites.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-medium tabular-nums text-emerald-500">{user.cachedReads.toLocaleString()}</td>
                        <td className="py-3 px-4 tabular-nums text-right" style={{ color: 'var(--dash-muted)' }}>{new Date(user.lastActivity).toLocaleString('en-IN',{ hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short' })}</td>
                        <td className="py-3 px-4 text-center">
                          <button onClick={e => { e.stopPropagation(); setSelectedUser(user); }} className="px-2.5 py-1 text-xs font-semibold" style={{ background: 'var(--dash-accent-soft)', color: 'var(--dash-accent)', borderRadius: '4px' }}>Inspect</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </DataStateWrapper>
        </div>
      )}

      {/* Tab 3: Day-Wise */}
      {activeTab === 'days' && (
        <div className="space-y-4 animate-fade-in">
          <DataStateWrapper loading={loading} isEmpty={overview?.dayWiseStats.length === 0} skeleton={<TableSkeleton rows={7} cols={7} hasSearch={false} />}>
            {overview && (
              <div className="overflow-hidden" style={panelStyle}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--dash-border)', background: 'var(--dash-hover)' }}>
                        {['Date','Total Calls','Network Reads','Writes','Cached','Active Users','Top Resource'].map((h,i) => (
                          <th key={h} className={`py-2.5 px-4 text-[10px] font-semibold uppercase tracking-wider ${i>=1&&i<6?'text-right':''}`} style={{ color: 'var(--dash-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {overview.dayWiseStats.map(day => {
                        const topRes = Object.entries(day.resources || {}).sort((a,b) => b[1]-a[1])[0];
                        return (
                          <tr key={day.date} style={{ borderBottom: '1px solid var(--dash-border)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--dash-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span className="font-semibold" style={{ color: 'var(--dash-text)' }}>{day.date}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-bold tabular-nums" style={{ color: 'var(--dash-text)' }}>{day.totalCalls.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-medium tabular-nums text-amber-500">{day.totalReads.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-medium tabular-nums text-purple-500">{day.totalWrites.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-medium tabular-nums text-emerald-500">{day.cachedReads.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-medium tabular-nums text-pink-500">{day.activeUsersCount}</td>
                            <td className="py-3 px-4 font-mono text-[11px]" style={{ color: 'var(--dash-muted)' }}>{topRes ? `${topRes[0]} (${topRes[1]})` : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </DataStateWrapper>
        </div>
      )}

      {/* Tab 4: Inspector */}
      {activeTab === 'inspector' && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-3 flex flex-col md:flex-row items-center justify-between gap-3" style={panelStyle}>
            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--dash-muted)' }} />
              <input type="text" placeholder="Search collection, route, user..." value={inspectorSearch} onChange={e => setInspectorSearch(e.target.value)} className="dash-input !pl-9 !py-1.5 !text-xs !w-full" style={{ borderRadius: '4px' }} />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--dash-muted)' }}>
                <span>Op:</span>
                <select value={inspectorOpFilter} onChange={e => setInspectorOpFilter(e.target.value)} className="dash-input !py-1 !px-2 !text-xs" style={{ borderRadius: '4px' }}>
                  <option value="all">All Ops</option><option value="read">Read</option><option value="fetch">Fetch</option><option value="write">Write</option><option value="update">Update</option><option value="delete">Delete</option><option value="listener">Listener</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--dash-muted)' }}>
                <span>Resource:</span>
                <select value={inspectorResourceFilter} onChange={e => setInspectorResourceFilter(e.target.value)} className="dash-input !py-1 !px-2 !text-xs" style={{ borderRadius: '4px' }}>
                  <option value="all">All</option><option value="events">events</option><option value="users">users</option><option value="applications">applications</option><option value="tasks">tasks</option><option value="transactions">transactions</option><option value="documents">documents</option><option value="positions">positions</option>
                </select>
              </div>
            </div>
          </div>

          <DataStateWrapper loading={loading} isEmpty={filteredTraces.length === 0} emptyTitle="No Traces Recorded" emptyDescription="No query traces found in the memory ring buffer." skeleton={<TableSkeleton rows={8} cols={7} hasSearch={false} />}>
            <div className="overflow-hidden" style={panelStyle}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--dash-border)', background: 'var(--dash-hover)' }}>
                      {['Timestamp','Operation','Resource','Docs','Origin Page','User','Status'].map((h,i) => (
                        <th key={h} className={`py-2.5 px-4 text-[10px] font-semibold uppercase tracking-wider ${i===3?'text-right':i===6?'text-center':''}`} style={{ color: 'var(--dash-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTraces.map(trace => (
                      <tr key={trace.id} style={{ borderBottom: '1px solid var(--dash-border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--dash-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td className="py-2.5 px-4 font-mono whitespace-nowrap" style={{ color: 'var(--dash-muted)' }}>{new Date(trace.timestamp).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase" style={{ borderRadius:'3px', background: trace.operation==='write'||trace.operation==='update'?'rgba(139,92,246,0.1)':trace.operation==='delete'?'rgba(239,68,68,0.1)':trace.cached?'rgba(16,185,129,0.1)':'rgba(59,130,246,0.1)', color: trace.operation==='write'||trace.operation==='update'?'#8b5cf6':trace.operation==='delete'?'#ef4444':trace.cached?'#10b981':'#3b82f6' }}>
                            {trace.cached ? 'CACHE' : trace.operation}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-semibold" style={{ color: 'var(--dash-text)' }}>{trace.resource}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums" style={{ color: 'var(--dash-text)' }}>{trace.documentCount}</td>
                        <td className="py-2.5 px-4 max-w-xs truncate" style={{ color: 'var(--dash-muted)' }}>{trace.page}</td>
                        <td className="py-2.5 px-4" style={{ color: 'var(--dash-text)' }}>{trace.userName}</td>
                        <td className="py-2.5 px-4 text-center">
                          {trace.status === 'success' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-500 text-[10px] font-semibold"><CheckCircle2 className="w-3 h-3" /> OK</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-500 text-[10px] font-semibold"><ShieldAlert className="w-3 h-3" /> ERR</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </DataStateWrapper>
        </div>
      )}

      {/* User Deep-Dive Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedUser(null)}>
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl" style={{ background: 'var(--dash-card)', border: '1px solid var(--dash-border)', borderRadius: '6px' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4" style={{ borderBottom: '1px solid var(--dash-border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center text-white font-black text-sm" style={{ background: 'var(--dash-accent)', borderRadius: '4px' }}>{selectedUser.userName?.[0] || 'U'}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black" style={{ color: 'var(--dash-text)' }}>{selectedUser.userName}</h2>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: 'var(--dash-accent-soft)', color: 'var(--dash-accent)', borderRadius: '3px' }}>{selectedUser.userRole}</span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>{selectedUser.userEmail} · {selectedUser.userId}</p>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-1.5 transition-colors" style={{ color: 'var(--dash-muted)', borderRadius: '4px' }} onMouseEnter={e => e.currentTarget.style.background='var(--dash-hover)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Calls', value: selectedUser.totalCalls.toLocaleString(), color: 'var(--dash-text)', lc: 'var(--dash-muted)' },
                { label: 'Network Reads', value: selectedUser.totalReads.toLocaleString(), color: '#f59e0b', lc: '#f59e0b' },
                { label: 'Writes', value: selectedUser.totalWrites.toLocaleString(), color: '#8b5cf6', lc: '#8b5cf6' },
                { label: 'Cache Hits', value: selectedUser.cachedReads.toLocaleString(), color: '#10b981', lc: '#10b981' },
              ].map(m => (
                <div key={m.label} className="p-3" style={{ background: 'var(--dash-hover)', border: '1px solid var(--dash-border)', borderRadius: '6px' }}>
                  <p className="text-[10px] font-bold uppercase" style={{ color: m.lc }}>{m.label}</p>
                  <p className="text-xl font-black mt-1 tabular-nums" style={{ color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--dash-muted)' }}><Calendar className="w-3.5 h-3.5 text-blue-500" />Day-by-Day Activity</h3>
              <div className="overflow-hidden" style={{ border: '1px solid var(--dash-border)', borderRadius: '4px' }}>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--dash-border)', background: 'var(--dash-hover)' }}>
                      {['Date','DB Calls','Reads','Fetches','Pages Used'].map((h,i) => (<th key={h} className={`py-2.5 px-3 text-[10px] font-semibold uppercase ${i>=1&&i<4?'text-right':''}`} style={{ color: 'var(--dash-muted)' }}>{h}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedUser.dayWiseBreakdown.map(day => (
                      <tr key={day.date} style={{ borderBottom: '1px solid var(--dash-border)' }} onMouseEnter={e => e.currentTarget.style.background='var(--dash-hover)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <td className="py-2.5 px-3 font-semibold" style={{ color: 'var(--dash-text)' }}>{day.date}</td>
                        <td className="py-2.5 px-3 text-right font-bold tabular-nums" style={{ color: 'var(--dash-text)' }}>{day.calls}</td>
                        <td className="py-2.5 px-3 text-right font-medium tabular-nums text-amber-500">{day.reads}</td>
                        <td className="py-2.5 px-3 text-right font-medium tabular-nums text-blue-500">{day.fetches}</td>
                        <td className="py-2.5 px-3 truncate max-w-xs" style={{ color: 'var(--dash-muted)' }}>{day.pages.join(', ') || 'Dashboard'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button onClick={() => setSelectedUser(null)} className="px-4 py-2 text-xs font-semibold transition-colors" style={{ background: 'var(--dash-hover)', color: 'var(--dash-text)', borderRadius: '4px', border: '1px solid var(--dash-border)' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
