import { useEffect, useState, useMemo } from 'react';
import {
  Users, Eye, Clock, TrendingUp, RefreshCw, Search,
  Globe, Monitor, Smartphone, Tablet, Calendar, Download,
  MapPin, Compass, ShieldCheck, X
} from 'lucide-react';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { isSuperAdmin } from '../../utils/permissions';
import { getVisitorAnalytics } from '../../services/visitorTrackingService';
import type { VisitorStatsOverview, VisitorInteraction } from '../../types';
import { StatGridSkeleton, TableSkeleton, ChartSkeleton, DataStateWrapper } from '../../components/ui/skeleton';
import { useToast } from '../../contexts/ToastContext';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

const panelStyle: React.CSSProperties = {
  background: 'var(--dash-card)',
  border: '1px solid var(--dash-border)',
  borderRadius: '6px',
};

export default function UserInteractionsPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const isSuper = isSuperAdmin(profile);

  const [stats, setStats] = useState<VisitorStatsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d' | 'year' | 'all'>('7d');
  const [searchQuery, setSearchQuery] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorInteraction | null>(null);

  const fetchVisitors = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const data = await getVisitorAnalytics(timeRange);
      setStats(data);
    } catch (err) {
      console.error('Failed to load visitor analytics', err);
      showToast('Failed to load visitor interactions', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, [timeRange]);

  const filteredVisitors = useMemo(() => {
    if (!stats?.recentVisitors) return [];
    let list = [...stats.recentVisitors];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(v =>
        v.pagePath.toLowerCase().includes(q) ||
        (v.userName && v.userName.toLowerCase().includes(q)) ||
        (v.city && v.city.toLowerCase().includes(q)) ||
        (v.browser && v.browser.toLowerCase().includes(q)) ||
        (v.visitorIp && v.visitorIp.includes(q))
      );
    }

    if (deviceFilter !== 'all') {
      list = list.filter(v => v.deviceType === deviceFilter);
    }

    if (roleFilter !== 'all') {
      list = list.filter(v => v.userRole === roleFilter);
    }

    return list;
  }, [stats?.recentVisitors, searchQuery, deviceFilter, roleFilter]);

  const handleExportCSV = () => {
    if (!stats) return;
    try {
      const headers = ['Timestamp', 'Visitor IP', 'Location', 'Device', 'OS', 'Browser', 'Page Path', 'Role', 'Duration (s)'];
      const rows = stats.recentVisitors.map(v => [
        v.timestamp,
        v.visitorIp || 'N/A',
        `${v.city || 'Pune'}, ${v.country || 'India'}`,
        v.deviceType,
        v.os,
        v.browser,
        v.pagePath,
        v.userRole || 'guest',
        v.durationSeconds || 0,
      ]);
      const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const link = document.createElement('a');
      link.setAttribute('href', encodeURI(csv));
      link.setAttribute('download', `saint_visitor_interactions_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      showToast('Visitor data exported to CSV', 'info');
    } catch {
      showToast('Export failed', 'error');
    }
  };

  if (!isSuper) {
    return (
      <div className="p-12 text-center space-y-3">
        <ShieldCheck className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold" style={{ color: 'var(--dash-text)' }}>Access Denied</h2>
        <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>Only Superadmin accounts can view Visitor Interactions.</p>
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

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px' }}>Superadmin</span>
            <span className="text-xs" style={{ color: 'var(--dash-muted)' }}>· Audience Insights</span>
          </div>
          <h1 className="page-header-title">User Interactions & Visitor Analytics</h1>
          <p className="page-header-sub">Detailed metrics of website traffic, devices, pages viewed, and real-time visitor sessions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Range Pills */}
          <div className="flex items-center p-0.5 gap-0.5 text-xs" style={{ background: 'var(--dash-hover)', border: '1px solid var(--dash-border)', borderRadius: '6px' }}>
            {(['today', '7d', '30d', 'year', 'all'] as const).map(r => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className="px-3 py-1 font-medium transition-all"
                style={{
                  borderRadius: '4px',
                  background: timeRange === r ? 'var(--dash-accent)' : 'transparent',
                  color: timeRange === r ? '#fff' : 'var(--dash-muted)',
                }}
              >
                {r === 'today' ? 'Today' : r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : r === 'year' ? '1 Year' : 'All Time'}
              </button>
            ))}
          </div>

          <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium" style={{ ...panelStyle, color: 'var(--dash-text)' }}>
            <Download className="w-3.5 h-3.5" /><span>Export CSV</span>
          </button>

          <button onClick={() => fetchVisitors(true)} disabled={refreshing} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium disabled:opacity-50" style={{ background: 'var(--dash-accent)', color: '#fff', borderRadius: '6px' }}>
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /><span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <DataStateWrapper loading={loading} skeleton={<StatGridSkeleton count={5} columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" />}>
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Total Visits', value: stats.totalVisits.toLocaleString(), sub: `${stats.todayVisits} today`, color: '#3b82f6', icon: <Eye className="w-4 h-4" /> },
              { label: 'Unique Visitors', value: stats.uniqueVisitors.toLocaleString(), sub: `${stats.todayUnique} today`, color: '#10b981', icon: <Users className="w-4 h-4" /> },
              { label: 'Past 7 Days', value: stats.weekVisits.toLocaleString(), sub: 'Rolling week', color: '#8b5cf6', icon: <Calendar className="w-4 h-4" /> },
              { label: 'Past 30 Days', value: stats.monthVisits.toLocaleString(), sub: 'Monthly volume', color: '#f59e0b', icon: <TrendingUp className="w-4 h-4" /> },
              { label: 'Avg. Duration', value: `${stats.avgDurationSeconds}s`, sub: `${stats.bounceRate}% bounce rate`, color: '#ec4899', icon: <Clock className="w-4 h-4" />, extraClass: 'col-span-2 sm:col-span-1' },
            ].map(card => (
              <div key={card.label} className={`stat-card relative overflow-hidden ${card.extraClass || ''}`} style={{ borderRadius: '6px' }}>
                <div className="stat-card-accent-bar" style={{ background: card.color }} />
                <div className="flex items-start justify-between mt-1">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>{card.label}</p>
                    <p className="text-2xl font-black mt-1 tabular-nums" style={{ color: card.color }}>{card.value}</p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--dash-muted)' }}>{card.sub}</p>
                  </div>
                  <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{ background: `${card.color}18`, color: card.color, borderRadius: '4px' }}>
                    {card.icon}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DataStateWrapper>

      {/* Traffic Chart */}
      <DataStateWrapper loading={loading} skeleton={<ChartSkeleton height={260} hasHeader={true} />}>
        {stats && (
          <div className="p-5 space-y-4" style={panelStyle}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  Visitor Traffic Trend
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--dash-muted)' }}>Total visits vs. Unique visitors over time</p>
              </div>
            </div>
            <div className="h-60 sm:h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.dayWiseVisitors} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gVisits" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gUniq" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--dash-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--dash-muted)' }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="visits" name="Total Visits" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#gVisits)" />
                  <Area type="monotone" dataKey="unique" name="Unique Visitors" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#gUniq)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </DataStateWrapper>

      {/* Breakdown Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Device Breakdown */}
        <div className="p-5 space-y-3" style={panelStyle}>
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
            <Monitor className="w-4 h-4 text-purple-500" />
            Device Categories
          </h3>
          <div className="space-y-3 pt-2">
            {stats?.deviceBreakdown.map((d, i) => (
              <div key={d.device} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--dash-text)' }}>
                    {d.device === 'Mobile' ? <Smartphone className="w-3.5 h-3.5 text-blue-500" /> : d.device === 'Desktop' ? <Monitor className="w-3.5 h-3.5 text-purple-500" /> : <Tablet className="w-3.5 h-3.5 text-emerald-500" />}
                    {d.device}
                  </span>
                  <span className="tabular-nums font-mono" style={{ color: 'var(--dash-muted)' }}>{d.count} ({d.percentage}%)</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 overflow-hidden" style={{ borderRadius: '2px' }}>
                  <div className="h-full transition-all" style={{ width: `${d.percentage}%`, background: PIE_COLORS[i % PIE_COLORS.length], borderRadius: '2px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Pages */}
        <div className="p-5 space-y-3" style={panelStyle}>
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
            <Compass className="w-4 h-4 text-pink-500" />
            Most Visited Pages
          </h3>
          <div className="space-y-2 pt-1 text-xs">
            {stats?.topPages.slice(0, 5).map(p => (
              <div key={p.page} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid var(--dash-border)' }}>
                <span className="font-mono truncate max-w-[200px]" style={{ color: 'var(--dash-text)' }}>{p.page}</span>
                <span className="font-bold tabular-nums text-pink-500">{p.count} views</span>
              </div>
            ))}
          </div>
        </div>

        {/* Browsers & OS */}
        <div className="p-5 space-y-3" style={panelStyle}>
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
            <Globe className="w-4 h-4 text-emerald-500" />
            Top Browsers & Locations
          </h3>
          <div className="space-y-2 pt-1 text-xs">
            {stats?.browserBreakdown.slice(0, 3).map(b => (
              <div key={b.browser} className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid var(--dash-border)' }}>
                <span style={{ color: 'var(--dash-text)' }}>{b.browser}</span>
                <span className="font-mono tabular-nums text-emerald-500">{b.count} ({b.percentage}%)</span>
              </div>
            ))}
            <div className="pt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--dash-muted)' }}>Top Locations</span>
              {stats?.topCountries.slice(0, 2).map(c => (
                <div key={c.country} className="flex items-center justify-between text-xs py-0.5">
                  <span className="flex items-center gap-1" style={{ color: 'var(--dash-muted)' }}><MapPin className="w-3 h-3 text-blue-500" />{c.country}</span>
                  <span className="font-mono text-xs font-semibold" style={{ color: 'var(--dash-text)' }}>{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Visitor Feed / Live Interactions Table */}
      <div className="space-y-3">
        <div className="p-3 flex flex-col md:flex-row items-center justify-between gap-3" style={panelStyle}>
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--dash-muted)' }} />
            <input
              type="text"
              placeholder="Search route, city, browser, IP..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="dash-input !pl-9 !py-1.5 !text-xs !w-full"
              style={{ borderRadius: '4px' }}
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--dash-muted)' }}>
              <span>Device:</span>
              <select
                value={deviceFilter}
                onChange={e => setDeviceFilter(e.target.value)}
                className="dash-input !py-1 !px-2 !text-xs"
                style={{ borderRadius: '4px' }}
              >
                <option value="all">All Devices</option>
                <option value="desktop">Desktop</option>
                <option value="mobile">Mobile</option>
                <option value="tablet">Tablet</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--dash-muted)' }}>
              <span>User:</span>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="dash-input !py-1 !px-2 !text-xs"
                style={{ borderRadius: '4px' }}
              >
                <option value="all">All Types</option>
                <option value="guest">Guest (Anonymous)</option>
                <option value="member">Member</option>
                <option value="core">Core</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>
          </div>
        </div>

        <DataStateWrapper
          loading={loading}
          isEmpty={filteredVisitors.length === 0}
          emptyTitle="No Visitor Sessions Recorded"
          emptyDescription="No visitor sessions matching the current filters were found."
          skeleton={<TableSkeleton rows={8} cols={7} hasSearch={false} />}
        >
          <div className="overflow-hidden" style={panelStyle}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--dash-border)', background: 'var(--dash-hover)' }}>
                    {['Timestamp', 'Visitor / User', 'Location', 'Device & OS', 'Browser', 'Page Landed', 'Duration', 'Action'].map((h, i) => (
                      <th key={h} className={`py-2.5 px-4 text-[10px] font-semibold uppercase tracking-wider ${i === 6 ? 'text-right' : i === 7 ? 'text-center' : ''}`} style={{ color: 'var(--dash-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredVisitors.map(v => (
                    <tr
                      key={v.id}
                      style={{ borderBottom: '1px solid var(--dash-border)' }}
                      className="cursor-pointer transition-colors"
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--dash-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => setSelectedVisitor(v)}
                    >
                      <td className="py-2.5 px-4 font-mono text-[11px] whitespace-nowrap" style={{ color: 'var(--dash-muted)' }}>
                        {new Date(v.timestamp).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                      </td>
                      <td className="py-2.5 px-4 font-semibold" style={{ color: 'var(--dash-text)' }}>
                        <div className="flex items-center gap-1.5">
                          <span>{v.userName || 'Anonymous Visitor'}</span>
                          <span className="text-[9px] px-1.5 py-0.2 uppercase font-bold" style={{ background: v.userRole === 'guest' ? 'rgba(100,116,139,0.1)' : 'rgba(59,130,246,0.1)', color: v.userRole === 'guest' ? 'var(--dash-muted)' : '#3b82f6', borderRadius: '3px' }}>
                            {v.userRole || 'guest'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4" style={{ color: 'var(--dash-muted)' }}>
                        {v.city ? `${v.city}, ${v.country}` : 'India'}
                      </td>
                      <td className="py-2.5 px-4 capitalize" style={{ color: 'var(--dash-text)' }}>
                        {v.deviceType} · {v.os}
                      </td>
                      <td className="py-2.5 px-4" style={{ color: 'var(--dash-muted)' }}>
                        {v.browser}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] max-w-xs truncate" style={{ color: 'var(--dash-text)' }}>
                        {v.pagePath}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-medium text-emerald-500">
                        {v.durationSeconds}s
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedVisitor(v); }}
                          className="px-2 py-0.5 text-[11px] font-semibold"
                          style={{ background: 'var(--dash-accent-soft)', color: 'var(--dash-accent)', borderRadius: '4px' }}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DataStateWrapper>
      </div>

      {/* Visitor Details Modal */}
      {selectedVisitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedVisitor(null)}>
          <div className="w-full max-w-lg p-6 space-y-4 shadow-2xl" style={{ background: 'var(--dash-card)', border: '1px solid var(--dash-border)', borderRadius: '6px' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid var(--dash-border)' }}>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold" style={{ color: 'var(--dash-text)' }}>Visitor Session Details</h3>
              </div>
              <button onClick={() => setSelectedVisitor(null)} className="p-1 rounded" style={{ color: 'var(--dash-muted)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {[
                { label: 'Session ID', value: selectedVisitor.sessionId },
                { label: 'User / Identity', value: selectedVisitor.userName ? `${selectedVisitor.userName} (${selectedVisitor.userEmail})` : 'Anonymous Guest' },
                { label: 'Visitor IP (Simulated)', value: selectedVisitor.visitorIp || '103.21.124.52' },
                { label: 'Geo Location', value: `${selectedVisitor.city || 'Pune'}, ${selectedVisitor.country || 'India'}` },
                { label: 'Device & Screen', value: `${selectedVisitor.deviceType.toUpperCase()} (${selectedVisitor.screenResolution || '1920x1080'})` },
                { label: 'Browser & Engine', value: `${selectedVisitor.browser} on ${selectedVisitor.os}` },
                { label: 'Target Page', value: selectedVisitor.pagePath },
                { label: 'Referrer Source', value: selectedVisitor.referrer || 'Direct Entry' },
                { label: 'Session Duration', value: `${selectedVisitor.durationSeconds} seconds` },
                { label: 'Timestamp', value: new Date(selectedVisitor.timestamp).toLocaleString('en-IN') },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid var(--dash-border)' }}>
                  <span style={{ color: 'var(--dash-muted)' }}>{item.label}</span>
                  <span className="font-semibold font-mono text-right max-w-[260px] truncate" style={{ color: 'var(--dash-text)' }}>{item.value}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setSelectedVisitor(null)} className="px-4 py-1.5 text-xs font-semibold" style={{ background: 'var(--dash-hover)', color: 'var(--dash-text)', borderRadius: '4px', border: '1px solid var(--dash-border)' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
