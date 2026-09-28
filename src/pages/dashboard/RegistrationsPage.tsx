import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Users,
  Calendar,
  Search,
  RefreshCw,
  Download,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Eye,
  X,
  XCircle,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  getUnifiedRegistrations,
  computeEventSummaries,
  computeOverviewStats,
  exportRegistrationsToCSV,
  exportEventSummariesToCSV,
  isDateInRange,
  toLocalYMD,
  type UnifiedRegistrationItem,
  type EventRegistrationSummary,
  type RegistrationOverviewStats,
  type DateFilterType,
} from '../../services/registrationService';
import type { EventRecord } from '../../types';
import { StatGridSkeleton, DataStateWrapper } from '../../components/ui/skeleton';

export default function RegistrationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  // Data state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [registrations, setRegistrations] = useState<UnifiedRegistrationItem[]>([]);

  // Active view tab: 'events' (event-wise summary table) or 'registrations' (all registrations list)
  const [activeViewTab, setActiveViewTab] = useState<'events' | 'registrations'>('events');

  // Date Filter state
  const initialDateParam = searchParams.get('date') as DateFilterType;
  const initialEventParam = searchParams.get('event') || 'all';

  const [dateFilter, setDateFilter] = useState<DateFilterType>(
    initialDateParam && ['all', 'today', 'yesterday', 'last7', 'last30', 'custom'].includes(initialDateParam)
      ? initialDateParam
      : 'all'
  );

  const [customRange, setCustomRange] = useState<{ start: string; end: string }>({
    start: toLocalYMD(new Date()),
    end: toLocalYMD(new Date()),
  });

  // Search & Filter state for "All Registrations"
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventParam);
  const [registrationTypeFilter, setRegistrationTypeFilter] = useState<'all' | 'solo' | 'team'>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'verified' | 'pending' | 'rejected'>('all');
  const [checkInFilter, setCheckInFilter] = useState<'all' | 'arrived' | 'pending'>('all');

  // Expanded team row IDs in the registrations table
  const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(new Set());

  // Detail Modal state for inspecting a single registration
  const [detailModalItem, setDetailModalItem] = useState<UnifiedRegistrationItem | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Load Data
  const loadData = useCallback(async (force = false) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);

      const result = await getUnifiedRegistrations(force);
      setEvents(result.events);
      setRegistrations(result.registrations);
    } catch (err: unknown) {
      console.error('Failed to load registrations data:', err);
      const msg = err instanceof Error ? err.message : 'Failed to load registration records';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync date param if present in URL
  useEffect(() => {
    const dParam = searchParams.get('date') as DateFilterType;
    if (dParam && ['all', 'today', 'yesterday', 'last7', 'last30', 'custom'].includes(dParam)) {
      setDateFilter(dParam);
    }
    const evParam = searchParams.get('event');
    if (evParam) {
      setSelectedEventId(evParam);
      setActiveViewTab('registrations');
    }
  }, [searchParams]);

  // Handler to set Date Filter and update search params cleanly
  const handleDateFilterChange = (filter: DateFilterType) => {
    setDateFilter(filter);
    setCurrentPage(1);
    const nextParams = new URLSearchParams(searchParams);
    if (filter === 'all') {
      nextParams.delete('date');
    } else {
      nextParams.set('date', filter);
    }
    setSearchParams(nextParams, { replace: true });
  };

  // Compute Overview Stats
  const overviewStats: RegistrationOverviewStats = useMemo(() => {
    return computeOverviewStats(
      events,
      registrations,
      dateFilter,
      dateFilter === 'custom' ? customRange : undefined
    );
  }, [events, registrations, dateFilter, customRange]);

  // Compute Event Summaries
  const eventSummaries: EventRegistrationSummary[] = useMemo(() => {
    return computeEventSummaries(
      events,
      registrations,
      dateFilter,
      dateFilter === 'custom' ? customRange : undefined
    );
  }, [events, registrations, dateFilter, customRange]);

  // Filtered registrations for the "All Registrations" table
  const filteredRegistrations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return registrations.filter((item) => {
      // 1. Date Filter
      const matchesDate = isDateInRange(
        item.createdAt,
        dateFilter,
        dateFilter === 'custom' ? customRange : undefined
      );
      if (!matchesDate) return false;

      // 2. Event Filter
      if (selectedEventId !== 'all' && item.eventId !== selectedEventId) {
        return false;
      }

      // 3. Type Filter
      if (registrationTypeFilter !== 'all' && item.type !== registrationTypeFilter) {
        return false;
      }

      // 4. Payment Status Filter
      if (paymentStatusFilter !== 'all' && item.paymentStatus !== paymentStatusFilter) {
        return false;
      }

      // 5. Check-in Filter
      if (checkInFilter === 'arrived' && !item.arrived) return false;
      if (checkInFilter === 'pending' && item.arrived) return false;

      // 6. Text Search (matches Name, Email, Phone, Team Name, Event Name, Member names)
      if (q) {
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesEmail = item.email.toLowerCase().includes(q);
        const matchesPhone = item.phone?.toLowerCase().includes(q) || false;
        const matchesTeam = item.teamName?.toLowerCase().includes(q) || false;
        const matchesEvent = item.eventName.toLowerCase().includes(q);
        const matchesTransaction = item.transactionId?.toLowerCase().includes(q) || false;
        const matchesTicket = item.ticketNumber?.toLowerCase().includes(q) || false;

        const matchesMembers = item.members?.some(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            (m.email && m.email.toLowerCase().includes(q)) ||
            (m.phone && m.phone.toLowerCase().includes(q))
        ) || false;

        if (
          !matchesName &&
          !matchesEmail &&
          !matchesPhone &&
          !matchesTeam &&
          !matchesEvent &&
          !matchesTransaction &&
          !matchesTicket &&
          !matchesMembers
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    registrations,
    dateFilter,
    customRange,
    selectedEventId,
    registrationTypeFilter,
    paymentStatusFilter,
    checkInFilter,
    searchQuery,
  ]);

  // Paginated registrations
  const paginatedRegistrations = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRegistrations.slice(startIndex, startIndex + pageSize);
  }, [filteredRegistrations, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredRegistrations.length / pageSize) || 1;

  // Toggle expanded team
  const toggleTeamExpand = (teamId: string) => {
    setExpandedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  // Export Handlers
  const handleExportFiltered = () => {
    const filename = `Registrations_${dateFilter}_${Date.now()}.csv`;
    const ok = exportRegistrationsToCSV(filteredRegistrations, filename);
    if (ok) showToast(`Exported ${filteredRegistrations.length} registrations to CSV!`, 'success');
    else showToast('No registrations to export.', 'info');
  };

  const handleExportAll = () => {
    const filename = `All_Registrations_${Date.now()}.csv`;
    const ok = exportRegistrationsToCSV(registrations, filename);
    if (ok) showToast(`Exported all ${registrations.length} registrations to CSV!`, 'success');
    else showToast('No registrations to export.', 'info');
  };

  const handleExportSummaries = () => {
    const isToday = dateFilter === 'today';
    const filename = `Event_Summary_${dateFilter}_${Date.now()}.csv`;
    const ok = exportEventSummariesToCSV(eventSummaries, isToday, filename);
    if (ok) showToast('Exported event registration summaries to CSV!', 'success');
    else showToast('No event summaries to export.', 'info');
  };

  // Quick Action from Event-wise Table to switch to All Registrations filtered by that event
  const handleViewEventRegistrations = (eventId: string) => {
    setSelectedEventId(eventId);
    setActiveViewTab('registrations');
    setCurrentPage(1);
  };

  // Helper date formatter
  const formatDateTime = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateOnly = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6 animate-fade-in-up pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-md"
              style={{
                background: 'rgba(59, 130, 246, 0.12)',
                color: '#3b82f6',
                border: '1px solid rgba(59, 130, 246, 0.25)',
              }}
            >
              Centralized Administration
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1" style={{ color: 'var(--dash-text)' }}>
            Registration Overview
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--dash-muted)' }}>
            Real-time registration statistics, solo & team registries, and verified attendance across all SAInT events.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer hover:opacity-90"
            style={{
              background: 'var(--dash-card)',
              borderColor: 'var(--dash-border)',
              color: 'var(--dash-text)',
            }}
            title="Refresh Registration Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-500' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {/* Export Dropdown / Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportFiltered}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition-all cursor-pointer hover:opacity-95"
              style={{
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              }}
              title="Export Current Filtered Results"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleExportAll}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer hover:opacity-90"
              style={{
                background: 'var(--dash-card)',
                borderColor: 'var(--dash-border)',
                color: 'var(--dash-text)',
              }}
              title="Export Full Database Registrations"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
              <span>Export All</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Date Filter Bar ── */}
      <div
        className="rounded-2xl border p-3.5 sm:p-4 transition-all"
        style={{
          borderColor: 'var(--dash-border)',
          background: 'var(--dash-card)',
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
              Registration Date Filter:
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none flex-wrap sm:flex-nowrap">
            {([
              { id: 'all' as DateFilterType, label: 'All Time' },
              { id: 'today' as DateFilterType, label: "Today's", badge: overviewStats.todayRegistrations },
              { id: 'yesterday' as DateFilterType, label: 'Yesterday' },
              { id: 'last7' as DateFilterType, label: 'Last 7 Days' },
              { id: 'last30' as DateFilterType, label: 'Last 30 Days' },
              { id: 'custom' as DateFilterType, label: 'Custom Range' },
            ] as Array<{ id: DateFilterType; label: string; badge?: number }>).map((item) => {
              const active = dateFilter === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleDateFilterChange(item.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer"
                  style={{
                    background: active
                      ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                      : 'var(--dash-hover)',
                    color: active ? '#ffffff' : 'var(--dash-text)',
                    border: active ? '1px solid transparent' : '1px solid var(--dash-border)',
                  }}
                >
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        active ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Range Inputs (shown when dateFilter === 'custom') */}
        {dateFilter === 'custom' && (
          <div
            className="mt-3 pt-3 flex flex-wrap items-center gap-3 border-t text-xs"
            style={{ borderColor: 'var(--dash-border)' }}
          >
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--dash-muted)' }}>From:</span>
              <input
                type="date"
                value={customRange.start}
                onChange={(e) => setCustomRange((prev) => ({ ...prev, start: e.target.value }))}
                className="px-2.5 py-1.5 rounded-lg border text-xs"
                style={{
                  background: 'var(--dash-hover)',
                  borderColor: 'var(--dash-border)',
                  color: 'var(--dash-text)',
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--dash-muted)' }}>To:</span>
              <input
                type="date"
                value={customRange.end}
                onChange={(e) => setCustomRange((prev) => ({ ...prev, end: e.target.value }))}
                className="px-2.5 py-1.5 rounded-lg border text-xs"
                style={{
                  background: 'var(--dash-hover)',
                  borderColor: 'var(--dash-border)',
                  color: 'var(--dash-text)',
                }}
              />
            </div>
            <button
              onClick={() => {
                setCurrentPage(1);
                showToast(`Applied range: ${customRange.start} to ${customRange.end}`, 'info');
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold cursor-pointer hover:bg-blue-700 transition-colors"
            >
              Apply Range
            </button>
          </div>
        )}
      </div>

      {/* ── Today's Banner (prominent notice when Date = Today) ── */}
      {dateFilter === 'today' && (
        <div
          className="rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border"
          style={{
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1), rgba(16, 185, 129, 0.08))',
            borderColor: 'rgba(59, 130, 246, 0.3)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-600 text-white font-bold">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider font-extrabold text-blue-500">
                Active Date Filter: Today
              </p>
              <h3 className="text-base sm:text-lg font-bold" style={{ color: 'var(--dash-text)' }}>
                Today's Registrations: <span className="text-blue-500 font-black">{overviewStats.todayRegistrations}</span>
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--dash-muted)' }}>
                Breakdown: {overviewStats.todaySolo} Solo Registrations · {overviewStats.todayTeams} Teams ({overviewStats.todayParticipants - overviewStats.todaySolo} members) · {overviewStats.todayParticipants} Total Attendees
              </p>
            </div>
          </div>
          <button
            onClick={() => handleDateFilterChange('all')}
            className="self-start sm:self-center px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity"
            style={{
              borderColor: 'var(--dash-border)',
              background: 'var(--dash-card)',
              color: 'var(--dash-text)',
            }}
          >
            Clear Date Filter
          </button>
        </div>
      )}

      {/* ── 2. Registration Overview Cards (Summary Cards) ── */}
      <DataStateWrapper
        loading={loading}
        skeleton={<StatGridSkeleton count={6} columns="grid-cols-2 md:grid-cols-3 lg:grid-cols-6" />}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Upcoming / Ongoing Events */}
          <div className="stat-card">
            <div className="stat-card-accent-bar" style={{ background: '#8b5cf6' }} />
            <div className="mt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                Upcoming / Ongoing
              </p>
              <p className="text-2xl sm:text-3xl font-black mt-1 tabular-nums text-purple-500">
                {eventSummaries.length}
              </p>
              <p className="text-[11px] mt-1 truncate" style={{ color: 'var(--dash-muted)' }}>
                {overviewStats.totalEvents} total in database
              </p>
            </div>
          </div>

          {/* Card 2: Total Registrations */}
          <div className="stat-card">
            <div className="stat-card-accent-bar" style={{ background: '#2563eb' }} />
            <div className="mt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                Total Registrations
              </p>
              <p className="text-2xl sm:text-3xl font-black mt-1 tabular-nums text-blue-500">
                {overviewStats.totalRegistrations}
              </p>
              <p className="text-[11px] mt-1 truncate" style={{ color: 'var(--dash-muted)' }}>
                {dateFilter === 'all' ? 'Solo + Teams all-time' : 'In selected period'}
              </p>
            </div>
          </div>

          {/* Card 3: Solo Registrations */}
          <div className="stat-card">
            <div className="stat-card-accent-bar" style={{ background: '#06b6d4' }} />
            <div className="mt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                Solo Registrations
              </p>
              <p className="text-2xl sm:text-3xl font-black mt-1 tabular-nums" style={{ color: 'var(--dash-text)' }}>
                {overviewStats.soloRegistrations}
              </p>
              <p className="text-[11px] mt-1 truncate" style={{ color: 'var(--dash-muted)' }}>
                Individual entries
              </p>
            </div>
          </div>

          {/* Card 4: Team Registrations */}
          <div className="stat-card">
            <div className="stat-card-accent-bar" style={{ background: '#f59e0b' }} />
            <div className="mt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                Team Registrations
              </p>
              <p className="text-2xl sm:text-3xl font-black mt-1 tabular-nums" style={{ color: 'var(--dash-text)' }}>
                {overviewStats.teamRegistrations}
              </p>
              <p className="text-[11px] mt-1 truncate font-medium text-amber-500">
                {overviewStats.totalTeamMembers} members inside
              </p>
            </div>
          </div>

          {/* Card 5: Total Participants */}
          <div className="stat-card">
            <div className="stat-card-accent-bar" style={{ background: '#10b981' }} />
            <div className="mt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                Total Participants
              </p>
              <p className="text-2xl sm:text-3xl font-black mt-1 tabular-nums text-emerald-500">
                {overviewStats.totalParticipants}
              </p>
              <p className="text-[11px] mt-1 truncate" style={{ color: 'var(--dash-muted)' }}>
                Human attendees
              </p>
            </div>
          </div>

          {/* Card 6: Today's Registrations (Clickable per Requirement 10) */}
          <button
            onClick={() => handleDateFilterChange('today')}
            className={`stat-card text-left transition-all cursor-pointer group ${
              dateFilter === 'today'
                ? 'ring-2 ring-blue-500 shadow-md'
                : 'hover:border-blue-500/50'
            }`}
            title="Click to view Today's Registrations"
          >
            <div className="stat-card-accent-bar" style={{ background: '#ec4899' }} />
            <div className="mt-1 flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 text-pink-500">
                  Today's Regs
                  <Sparkles className="w-3 h-3 group-hover:rotate-12 transition-transform" />
                </p>
                <p className="text-2xl sm:text-3xl font-black mt-1 tabular-nums text-pink-500">
                  {overviewStats.todayRegistrations}
                </p>
                <p className="text-[11px] mt-1 truncate text-blue-500 font-semibold group-hover:underline">
                  Click to filter today →
                </p>
              </div>
            </div>
          </button>
        </div>
      </DataStateWrapper>

      {/* ── 9. Registration Health / Quick Information Bar ── */}
      <div
        className="rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3 text-xs"
        style={{
          borderColor: 'var(--dash-border)',
          background: 'var(--dash-card)',
        }}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="font-bold uppercase tracking-wider" style={{ color: 'var(--dash-text)' }}>
            Payment & Verification Health:
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span style={{ color: 'var(--dash-muted)' }}>Verified Payments:</span>
            <span className="font-bold text-emerald-500 tabular-nums">
              {overviewStats.verifiedPayments}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span style={{ color: 'var(--dash-muted)' }}>Pending Verification:</span>
            <span className="font-bold text-amber-500 tabular-nums">
              {overviewStats.pendingPayments}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span style={{ color: 'var(--dash-muted)' }}>Failed / Rejected:</span>
            <span className="font-bold text-red-500 tabular-nums">
              {overviewStats.rejectedPayments}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span style={{ color: 'var(--dash-muted)' }}>Arrived / Checked In:</span>
            <span className="font-bold text-blue-500 tabular-nums">
              {overviewStats.arrivedCount}
            </span>
          </div>

          {overviewStats.missingProofCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium">
              <AlertTriangle className="w-3 h-3" />
              <span>{overviewStats.missingProofCount} Missing Proof</span>
            </div>
          )}
        </div>
      </div>

      {/* ── View Navigation Tabs ── */}
      <div className="flex border-b" style={{ borderColor: 'var(--dash-border)' }}>
        <button
          onClick={() => setActiveViewTab('events')}
          className="flex items-center gap-2 px-5 py-3 font-bold text-sm border-b-2 transition-all cursor-pointer"
          style={{
            borderColor: activeViewTab === 'events' ? '#2563eb' : 'transparent',
            color: activeViewTab === 'events' ? 'var(--dash-text)' : 'var(--dash-muted)',
          }}
        >
          <Calendar className="w-4 h-4 text-blue-500" />
          <span>Upcoming & Ongoing Events</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1"
            style={{ background: 'var(--dash-hover)', color: 'var(--dash-muted)' }}
          >
            {eventSummaries.length}
          </span>
        </button>

        <button
          onClick={() => setActiveViewTab('registrations')}
          className="flex items-center gap-2 px-5 py-3 font-bold text-sm border-b-2 transition-all cursor-pointer"
          style={{
            borderColor: activeViewTab === 'registrations' ? '#2563eb' : 'transparent',
            color: activeViewTab === 'registrations' ? 'var(--dash-text)' : 'var(--dash-muted)',
          }}
        >
          <Users className="w-4 h-4 text-emerald-500" />
          <span>All Registrations List</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1"
            style={{ background: 'var(--dash-hover)', color: 'var(--dash-muted)' }}
          >
            {filteredRegistrations.length}
          </span>
        </button>
      </div>

      {/* ── 3. Event-wise Registration Table ── */}
      {activeViewTab === 'events' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold" style={{ color: 'var(--dash-text)' }}>
                  Upcoming & Ongoing Events Summary
                </h2>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  Active Events ({eventSummaries.length})
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--dash-muted)' }}>
                {dateFilter === 'today'
                  ? "Showing registrations registered TODAY for upcoming and ongoing events. Past events are excluded."
                  : "Showing active registration metrics for upcoming and ongoing events. Events that have ended are excluded."}
              </p>
            </div>
            <button
              onClick={handleExportSummaries}
              className="self-start sm:self-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer hover:opacity-90"
              style={{
                borderColor: 'var(--dash-border)',
                background: 'var(--dash-card)',
                color: 'var(--dash-text)',
              }}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Event Summary</span>
            </button>
          </div>

          <div
            className="rounded-2xl border overflow-hidden"
            style={{
              borderColor: 'var(--dash-border)',
              background: 'var(--dash-card)',
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr
                    className="border-b text-[11px] font-bold uppercase tracking-wider"
                    style={{
                      borderColor: 'var(--dash-border)',
                      background: 'var(--dash-hover)',
                      color: 'var(--dash-muted)',
                    }}
                  >
                    <th className="py-3 px-4">Event Name</th>
                    <th className="py-3 px-4">Event Date</th>
                    <th className="py-3 px-4 text-center">
                      {dateFilter === 'today' ? 'Solo Today' : 'Solo Registrations'}
                    </th>
                    <th className="py-3 px-4 text-center">
                      {dateFilter === 'today' ? 'Teams Today' : 'Total Teams'}
                    </th>
                    <th className="py-3 px-4 text-center">
                      {dateFilter === 'today' ? 'Participants Today' : 'Total Participants'}
                    </th>
                    <th className="py-3 px-4 text-center">All-Time Total</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--dash-border)' }}>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
                          Loading event registration records...
                        </p>
                      </td>
                    </tr>
                  ) : eventSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
                        <p className="font-semibold text-sm" style={{ color: 'var(--dash-text)' }}>
                          No upcoming or ongoing events found
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
                          Events whose date/time has passed are excluded from this overview. All historical records remain accessible in the "All Registrations List" tab.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    eventSummaries.map((summary) => {
                      const isTodayFilter = dateFilter === 'today';
                      const soloCount = isTodayFilter ? summary.periodSoloCount : summary.soloCount;
                      const teamCount = isTodayFilter ? summary.periodTeamCount : summary.teamCount;
                      const participantCount = isTodayFilter
                        ? summary.periodParticipants
                        : summary.totalParticipants;

                      return (
                        <tr
                          key={summary.eventId}
                          className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                          {/* Event Name */}
                          <td className="py-3.5 px-4 font-semibold">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-blue-600/10 text-blue-500 font-bold">
                                {summary.eventName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-sm block" style={{ color: 'var(--dash-text)' }}>
                                  {summary.eventName}
                                </span>
                                <span
                                  className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded ${
                                    summary.eventStatus === 'published'
                                      ? 'bg-emerald-500/10 text-emerald-500'
                                      : 'bg-amber-500/10 text-amber-500'
                                  }`}
                                >
                                  {summary.eventStatus}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Event Date */}
                          <td className="py-3.5 px-4" style={{ color: 'var(--dash-muted)' }}>
                            {formatDateOnly(summary.eventDate)}
                          </td>

                          {/* Solo Registrations */}
                          <td className="py-3.5 px-4 text-center font-bold tabular-nums" style={{ color: 'var(--dash-text)' }}>
                            {soloCount}
                          </td>

                          {/* Team Registrations */}
                          <td className="py-3.5 px-4 text-center tabular-nums">
                            <span className="font-bold" style={{ color: 'var(--dash-text)' }}>
                              {teamCount}
                            </span>
                            {teamCount > 0 && (
                              <span className="block text-[10px] text-amber-500 font-medium">
                                ({isTodayFilter ? summary.periodTeamMembersCount : summary.teamMembersCount} members)
                              </span>
                            )}
                          </td>

                          {/* Total Participants */}
                          <td className="py-3.5 px-4 text-center tabular-nums">
                            <span className="font-bold text-emerald-500 text-sm">
                              {participantCount}
                            </span>
                          </td>

                          {/* All-time Total Registrations */}
                          <td className="py-3.5 px-4 text-center tabular-nums font-semibold" style={{ color: 'var(--dash-muted)' }}>
                            {summary.totalRegistrations}
                          </td>

                          {/* Action Column */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Quick View in Registrations table */}
                              <button
                                onClick={() => handleViewEventRegistrations(summary.eventId)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer hover:bg-blue-600 hover:text-white transition-all"
                                style={{
                                  borderColor: 'var(--dash-border)',
                                  background: 'var(--dash-hover)',
                                  color: 'var(--dash-text)',
                                }}
                                title="Filter all registrations to this event"
                              >
                                View Registrations
                              </button>

                              {/* Direct Jump to Event's Participants Tab */}
                              <Link
                                to={`/dashboard/events/${summary.eventId}?tab=participants`}
                                className="p-1.5 rounded-lg text-xs font-semibold border cursor-pointer hover:bg-blue-600 hover:text-white transition-all text-blue-500 flex items-center gap-1"
                                style={{
                                  borderColor: 'var(--dash-border)',
                                  background: 'var(--dash-hover)',
                                }}
                                title="Open Event Participants Tab directly"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
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
        </div>
      )}

      {/* ── 5 & 6. “All Registrations” View & Search/Filters ── */}
      {activeViewTab === 'registrations' && (
        <div className="space-y-4">
          {/* Filters Toolbar */}
          <div
            className="rounded-2xl border p-4 space-y-3"
            style={{
              borderColor: 'var(--dash-border)',
              background: 'var(--dash-card)',
            }}
          >
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--dash-muted)' }} />
                <input
                  type="text"
                  placeholder="Search by participant name, email, phone, team name, or event name..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-xs sm:text-sm border transition-all"
                  style={{
                    background: 'var(--dash-hover)',
                    borderColor: 'var(--dash-border)',
                    color: 'var(--dash-text)',
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Event Filter Dropdown */}
              <div className="w-full md:w-56 shrink-0">
                <select
                  value={selectedEventId}
                  onChange={(e) => {
                    setSelectedEventId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-all cursor-pointer"
                  style={{
                    background: 'var(--dash-hover)',
                    borderColor: 'var(--dash-border)',
                    color: 'var(--dash-text)',
                  }}
                >
                  <option value="all">All Events ({events.length})</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div className="w-full md:w-36 shrink-0">
                <select
                  value={registrationTypeFilter}
                  onChange={(e) => {
                    setRegistrationTypeFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-all cursor-pointer"
                  style={{
                    background: 'var(--dash-hover)',
                    borderColor: 'var(--dash-border)',
                    color: 'var(--dash-text)',
                  }}
                >
                  <option value="all">Type: All</option>
                  <option value="solo">Solo Only</option>
                  <option value="team">Teams Only</option>
                </select>
              </div>

              {/* Payment Status Filter */}
              <div className="w-full md:w-40 shrink-0">
                <select
                  value={paymentStatusFilter}
                  onChange={(e) => {
                    setPaymentStatusFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-all cursor-pointer"
                  style={{
                    background: 'var(--dash-hover)',
                    borderColor: 'var(--dash-border)',
                    color: 'var(--dash-text)',
                  }}
                >
                  <option value="all">Payment: All</option>
                  <option value="verified">Verified</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Failed / Rejected</option>
                </select>
              </div>

              {/* Check-in Filter */}
              <div className="w-full md:w-36 shrink-0">
                <select
                  value={checkInFilter}
                  onChange={(e) => {
                    setCheckInFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-all cursor-pointer"
                  style={{
                    background: 'var(--dash-hover)',
                    borderColor: 'var(--dash-border)',
                    color: 'var(--dash-text)',
                  }}
                >
                  <option value="all">Arrival: All</option>
                  <option value="arrived">Checked In</option>
                  <option value="pending">Pending Arrival</option>
                </select>
              </div>
            </div>

            {/* Active Filters readout & Reset */}
            {(selectedEventId !== 'all' ||
              registrationTypeFilter !== 'all' ||
              paymentStatusFilter !== 'all' ||
              checkInFilter !== 'all' ||
              searchQuery ||
              dateFilter !== 'all') && (
              <div
                className="pt-2.5 flex items-center justify-between border-t text-xs flex-wrap gap-2"
                style={{ borderColor: 'var(--dash-border)' }}
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span style={{ color: 'var(--dash-muted)' }}>Active Filters:</span>
                  {dateFilter !== 'all' && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-semibold">
                      Date: {dateFilter}
                    </span>
                  )}
                  {selectedEventId !== 'all' && (
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 font-semibold">
                      Event: {events.find((e) => e.id === selectedEventId)?.title || selectedEventId}
                    </span>
                  )}
                  {registrationTypeFilter !== 'all' && (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 font-semibold">
                      Type: {registrationTypeFilter}
                    </span>
                  )}
                  {paymentStatusFilter !== 'all' && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-semibold">
                      Payment: {paymentStatusFilter}
                    </span>
                  )}
                  {checkInFilter !== 'all' && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold">
                      Arrival: {checkInFilter}
                    </span>
                  )}
                  {searchQuery && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 font-semibold">
                      Query: "{searchQuery}"
                    </span>
                  )}
                </div>

                <button
                  onClick={() => {
                    setSelectedEventId('all');
                    setRegistrationTypeFilter('all');
                    setPaymentStatusFilter('all');
                    setCheckInFilter('all');
                    setSearchQuery('');
                    handleDateFilterChange('all');
                  }}
                  className="text-xs text-red-400 hover:text-red-500 font-semibold cursor-pointer underline"
                >
                  Reset All Filters
                </button>
              </div>
            )}
          </div>

          {/* Registrations Table */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{
              borderColor: 'var(--dash-border)',
              background: 'var(--dash-card)',
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr
                    className="border-b text-[11px] font-bold uppercase tracking-wider"
                    style={{
                      borderColor: 'var(--dash-border)',
                      background: 'var(--dash-hover)',
                      color: 'var(--dash-muted)',
                    }}
                  >
                    <th className="py-3 px-4">Participant / Team Lead</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Event</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Team Name</th>
                    <th className="py-3 px-4 text-center">Payment</th>
                    <th className="py-3 px-4 text-center">Arrival</th>
                    <th className="py-3 px-4">Registered At</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--dash-border)' }}>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center">
                        <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
                          Loading registrations...
                        </p>
                      </td>
                    </tr>
                  ) : filteredRegistrations.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center" style={{ color: 'var(--dash-muted)' }}>
                        No registrations match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedRegistrations.map((item) => {
                      const isTeam = item.type === 'team';
                      const isExpanded = expandedTeamIds.has(item.id);

                      return (
                        <>
                          <tr
                            key={item.id}
                            className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          >
                            {/* Participant Name */}
                            <td className="py-3.5 px-4 font-semibold">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs"
                                  style={{
                                    background: isTeam
                                      ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                                      : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                                    color: '#ffffff',
                                  }}
                                >
                                  {item.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                                      {item.name}
                                    </span>
                                    {isTeam && (
                                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                        Leader
                                      </span>
                                    )}
                                  </div>
                                  {(item.college || item.department) && (
                                    <span className="text-[11px] block truncate max-w-[200px]" style={{ color: 'var(--dash-muted)' }}>
                                      {[item.department, item.college].filter(Boolean).join(' · ')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Contact Details */}
                            <td className="py-3.5 px-4">
                              <span className="text-xs block" style={{ color: 'var(--dash-text)' }}>
                                {item.email || '—'}
                              </span>
                              {item.phone && (
                                <span className="text-[11px] block font-mono" style={{ color: 'var(--dash-muted)' }}>
                                  {item.phone}
                                </span>
                              )}
                            </td>

                            {/* Event */}
                            <td className="py-3.5 px-4">
                              <Link
                                to={`/dashboard/events/${item.eventId}?tab=participants`}
                                className="font-semibold text-xs hover:text-blue-500 hover:underline transition-colors block"
                                style={{ color: 'var(--dash-text)' }}
                              >
                                {item.eventName}
                              </Link>
                              <span className="text-[10px] block" style={{ color: 'var(--dash-muted)' }}>
                                {formatDateOnly(item.eventDate)}
                              </span>
                            </td>

                            {/* Registration Type */}
                            <td className="py-3.5 px-4">
                              {isTeam ? (
                                <button
                                  onClick={() => toggleTeamExpand(item.id)}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-xs bg-amber-500/10 text-amber-500 border border-amber-500/30 cursor-pointer hover:bg-amber-500/20 transition-all"
                                >
                                  <Users className="w-3 h-3" />
                                  <span>Team ({item.memberCount})</span>
                                  {isExpanded ? (
                                    <ChevronDown className="w-3 h-3 ml-0.5" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3 ml-0.5" />
                                  )}
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-xs bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                  <span>Solo</span>
                                </span>
                              )}
                            </td>

                            {/* Team Name */}
                            <td className="py-3.5 px-4 font-medium" style={{ color: 'var(--dash-text)' }}>
                              {item.teamName || '—'}
                            </td>

                            {/* Payment Status */}
                            <td className="py-3.5 px-4 text-center">
                              {item.paymentStatus === 'verified' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Verified</span>
                                </span>
                              ) : item.paymentStatus === 'rejected' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                                  <XCircle className="w-3 h-3" />
                                  <span>Failed</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                  <Clock className="w-3 h-3" />
                                  <span>Pending</span>
                                </span>
                              )}
                            </td>

                            {/* Arrival / Check-in Status */}
                            <td className="py-3.5 px-4 text-center">
                              {item.arrived ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500">
                                  <span>Arrived</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-400">
                                  <span>Pending</span>
                                </span>
                              )}
                            </td>

                            {/* Registered At Timestamp */}
                            <td className="py-3.5 px-4 text-xs font-mono" style={{ color: 'var(--dash-muted)' }}>
                              {formatDateTime(item.createdAt)}
                            </td>

                            {/* Action Buttons */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isTeam && (
                                  <button
                                    onClick={() => toggleTeamExpand(item.id)}
                                    className="p-1.5 rounded-lg border text-xs font-semibold cursor-pointer hover:bg-amber-500 hover:text-white transition-all text-amber-500"
                                    style={{
                                      borderColor: 'var(--dash-border)',
                                      background: 'var(--dash-hover)',
                                    }}
                                    title={isExpanded ? 'Hide team roster' : 'Expand team roster'}
                                  >
                                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                                <button
                                  onClick={() => setDetailModalItem(item)}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1"
                                  style={{
                                    borderColor: 'var(--dash-border)',
                                    background: 'var(--dash-hover)',
                                    color: 'var(--dash-text)',
                                  }}
                                  title="View full registration details"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>View</span>
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* ── 7. Team Expanded In-line View (Roster Breakdown) ── */}
                          {isTeam && isExpanded && (
                            <tr key={`${item.id}_roster`} style={{ background: 'var(--dash-hover)' }}>
                              <td colSpan={9} className="py-3 px-6 border-b" style={{ borderColor: 'var(--dash-border)' }}>
                                <div className="space-y-3 p-3 rounded-xl border" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2" style={{ borderColor: 'var(--dash-border)' }}>
                                    <div>
                                      <h4 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
                                        <Users className="w-4 h-4 text-amber-500" />
                                        <span>Team Roster: {item.teamName}</span>
                                        <span className="text-xs font-normal text-amber-500">
                                          ({item.memberCount} Total Participants)
                                        </span>
                                      </h4>
                                      <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
                                        Registered by team lead <strong>{item.name}</strong> ({item.email}) on {formatDateTime(item.createdAt)}
                                      </p>
                                    </div>
                                    {item.transactionId && (
                                      <div className="text-xs font-mono px-2 py-1 rounded bg-slate-500/10">
                                        TxID: {item.transactionId}
                                      </div>
                                    )}
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b" style={{ borderColor: 'var(--dash-border)' }}>
                                          <th className="py-2 pr-3">Role</th>
                                          <th className="py-2 px-3">Member Name</th>
                                          <th className="py-2 px-3">Email</th>
                                          <th className="py-2 px-3">Phone</th>
                                          <th className="py-2 px-3">College & Department</th>
                                          <th className="py-2 px-3">Year</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y" style={{ borderColor: 'var(--dash-border)' }}>
                                        {/* Team Leader Row */}
                                        <tr className="bg-amber-500/5">
                                          <td className="py-2 pr-3 font-bold text-amber-500 flex items-center gap-1">
                                            <Sparkles className="w-3 h-3" />
                                            <span>Team Leader</span>
                                          </td>
                                          <td className="py-2 px-3 font-semibold" style={{ color: 'var(--dash-text)' }}>
                                            {item.name}
                                          </td>
                                          <td className="py-2 px-3" style={{ color: 'var(--dash-muted)' }}>
                                            {item.email || '—'}
                                          </td>
                                          <td className="py-2 px-3 font-mono" style={{ color: 'var(--dash-muted)' }}>
                                            {item.phone || '—'}
                                          </td>
                                          <td className="py-2 px-3" style={{ color: 'var(--dash-muted)' }}>
                                            {[item.college, item.department].filter(Boolean).join(' · ') || '—'}
                                          </td>
                                          <td className="py-2 px-3" style={{ color: 'var(--dash-muted)' }}>
                                            {item.year || '—'}
                                          </td>
                                        </tr>

                                        {/* Other Members */}
                                        {item.members && item.members.length > 0 ? (
                                          item.members.map((m, mIdx) => (
                                            <tr key={mIdx}>
                                              <td className="py-2 pr-3 text-slate-400 font-medium">
                                                Member #{mIdx + 1}
                                              </td>
                                              <td className="py-2 px-3 font-semibold" style={{ color: 'var(--dash-text)' }}>
                                                {m.name}
                                              </td>
                                              <td className="py-2 px-3" style={{ color: 'var(--dash-muted)' }}>
                                                {m.email || '—'}
                                              </td>
                                              <td className="py-2 px-3 font-mono" style={{ color: 'var(--dash-muted)' }}>
                                                {m.phone || '—'}
                                              </td>
                                              <td className="py-2 px-3" style={{ color: 'var(--dash-muted)' }}>
                                                {[m.college || item.college, m.department || item.department].filter(Boolean).join(' · ') || '—'}
                                              </td>
                                              <td className="py-2 px-3" style={{ color: 'var(--dash-muted)' }}>
                                                {m.year || item.year || '—'}
                                              </td>
                                            </tr>
                                          ))
                                        ) : (
                                          <tr>
                                            <td colSpan={6} className="py-2 px-3 text-slate-400 italic">
                                              No additional team members listed in roster.
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div
              className="p-3.5 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              style={{
                borderColor: 'var(--dash-border)',
                background: 'var(--dash-hover)',
              }}
            >
              <div className="flex items-center gap-2" style={{ color: 'var(--dash-muted)' }}>
                <span>
                  Showing{' '}
                  <strong style={{ color: 'var(--dash-text)' }}>
                    {filteredRegistrations.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                  </strong>{' '}
                  to{' '}
                  <strong style={{ color: 'var(--dash-text)' }}>
                    {Math.min(currentPage * pageSize, filteredRegistrations.length)}
                  </strong>{' '}
                  of{' '}
                  <strong style={{ color: 'var(--dash-text)' }}>{filteredRegistrations.length}</strong> registrations
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="ml-2 px-2 py-1 rounded border text-xs"
                  style={{
                    background: 'var(--dash-card)',
                    borderColor: 'var(--dash-border)',
                    color: 'var(--dash-text)',
                  }}
                >
                  <option value={10}>10 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 rounded-lg border font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  style={{
                    borderColor: 'var(--dash-border)',
                    background: 'var(--dash-card)',
                    color: 'var(--dash-text)',
                  }}
                >
                  Previous
                </button>
                <span className="px-3 py-1 font-semibold" style={{ color: 'var(--dash-text)' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 rounded-lg border font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  style={{
                    borderColor: 'var(--dash-border)',
                    background: 'var(--dash-card)',
                    color: 'var(--dash-text)',
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal (Requirement 7 & Full Inspection) ── */}
      {detailModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border p-6 shadow-2xl relative space-y-5"
            style={{
              borderColor: 'var(--dash-border)',
              background: 'var(--dash-card)',
            }}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b pb-4" style={{ borderColor: 'var(--dash-border)' }}>
              <div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                    detailModalItem.type === 'team'
                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                  }`}
                >
                  {detailModalItem.type === 'team' ? 'Team Registration' : 'Solo Registration'}
                </span>
                <h3 className="text-xl font-black mt-1" style={{ color: 'var(--dash-text)' }}>
                  {detailModalItem.type === 'team'
                    ? detailModalItem.teamName
                    : detailModalItem.name}
                </h3>
                <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
                  Registered for <strong>{detailModalItem.eventName}</strong> on {formatDateTime(detailModalItem.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setDetailModalItem(null)}
                className="p-1.5 rounded-xl border hover:opacity-80 cursor-pointer"
                style={{
                  borderColor: 'var(--dash-border)',
                  background: 'var(--dash-hover)',
                  color: 'var(--dash-muted)',
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Badges Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 rounded-xl border" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-hover)' }}>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Payment Status</span>
                <span className="font-bold text-sm mt-0.5 block capitalize" style={{ color: detailModalItem.paymentStatus === 'verified' ? '#10b981' : detailModalItem.paymentStatus === 'rejected' ? '#ef4444' : '#f59e0b' }}>
                  {detailModalItem.paymentStatus}
                </span>
              </div>
              <div className="p-3 rounded-xl border" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-hover)' }}>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Arrival / Check-in</span>
                <span className="font-bold text-sm mt-0.5 block" style={{ color: detailModalItem.arrived ? '#10b981' : 'var(--dash-muted)' }}>
                  {detailModalItem.arrived ? 'Checked In' : 'Pending Arrival'}
                </span>
              </div>
              <div className="p-3 rounded-xl border" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-hover)' }}>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Participants Count</span>
                <span className="font-bold text-sm mt-0.5 block" style={{ color: 'var(--dash-text)' }}>
                  {detailModalItem.memberCount} {detailModalItem.memberCount === 1 ? 'Person' : 'People'}
                </span>
              </div>
              <div className="p-3 rounded-xl border" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-hover)' }}>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Ticket Ref</span>
                <span className="font-bold text-xs mt-0.5 block font-mono truncate" style={{ color: 'var(--dash-text)' }}>
                  {detailModalItem.ticketNumber || detailModalItem.ticketId || detailModalItem.id.slice(0, 8)}
                </span>
              </div>
            </div>

            {/* Primary Registrant / Team Leader Details */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">
                {detailModalItem.type === 'team' ? 'Team Leader / Primary Contact' : 'Participant Information'}
              </h4>
              <div className="p-4 rounded-xl border space-y-2 text-xs" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-hover)' }}>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Full Name:</span>
                    <span className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>{detailModalItem.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Email Address:</span>
                    <span className="font-semibold" style={{ color: 'var(--dash-text)' }}>{detailModalItem.email || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Phone Number:</span>
                    <span className="font-mono font-semibold" style={{ color: 'var(--dash-text)' }}>{detailModalItem.phone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">College / University:</span>
                    <span className="font-semibold" style={{ color: 'var(--dash-text)' }}>{detailModalItem.college || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Department & Year:</span>
                    <span className="font-semibold" style={{ color: 'var(--dash-text)' }}>
                      {[detailModalItem.department, detailModalItem.year].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Tier / Category:</span>
                    <span className="font-semibold" style={{ color: 'var(--dash-text)' }}>{detailModalItem.tierName || 'Standard'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* If Team, Show full roster */}
            {detailModalItem.type === 'team' && (
              <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Team Members ({detailModalItem.members?.length || 0} members + 1 leader)</span>
                  <span className="text-amber-500 font-semibold">{detailModalItem.memberCount} Total Participants</span>
                </h4>
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--dash-border)' }}>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b text-[10px] uppercase font-bold text-slate-400" style={{ background: 'var(--dash-hover)', borderColor: 'var(--dash-border)' }}>
                        <th className="py-2 px-3">Role</th>
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3">Email</th>
                        <th className="py-2 px-3">Phone</th>
                        <th className="py-2 px-3">College / Dept</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--dash-border)' }}>
                      <tr className="bg-amber-500/5">
                        <td className="py-2 px-3 font-bold text-amber-500">Leader</td>
                        <td className="py-2 px-3 font-semibold" style={{ color: 'var(--dash-text)' }}>{detailModalItem.name}</td>
                        <td className="py-2 px-3" style={{ color: 'var(--dash-muted)' }}>{detailModalItem.email}</td>
                        <td className="py-2 px-3 font-mono" style={{ color: 'var(--dash-muted)' }}>{detailModalItem.phone || '—'}</td>
                        <td className="py-2 px-3" style={{ color: 'var(--dash-muted)' }}>{[detailModalItem.college, detailModalItem.department].filter(Boolean).join(', ') || '—'}</td>
                      </tr>
                      {detailModalItem.members?.map((m, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 text-slate-400">Member #{idx + 1}</td>
                          <td className="py-2 px-3 font-semibold" style={{ color: 'var(--dash-text)' }}>{m.name}</td>
                          <td className="py-2 px-3" style={{ color: 'var(--dash-muted)' }}>{m.email || '—'}</td>
                          <td className="py-2 px-3 font-mono" style={{ color: 'var(--dash-muted)' }}>{m.phone || '—'}</td>
                          <td className="py-2 px-3" style={{ color: 'var(--dash-muted)' }}>{[m.college || detailModalItem.college, m.department || detailModalItem.department].filter(Boolean).join(', ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payment Proof / Transaction Section */}
            {(detailModalItem.transactionId || detailModalItem.paymentScreenshotUrl) && (
              <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--dash-border)' }}>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">
                  Payment Verification Proof
                </h4>
                <div className="p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-hover)' }}>
                  <div>
                    {detailModalItem.transactionId && (
                      <p className="font-mono text-xs">
                        Transaction ID: <strong style={{ color: 'var(--dash-text)' }}>{detailModalItem.transactionId}</strong>
                      </p>
                    )}
                    {detailModalItem.paymentVerifiedAt && (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Verified at: {formatDateTime(detailModalItem.paymentVerifiedAt)}
                      </p>
                    )}
                  </div>
                  {detailModalItem.paymentScreenshotUrl && (
                    <a
                      href={detailModalItem.paymentScreenshotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Payment Proof</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Footer with quick action link */}
            <div className="border-t pt-4 flex items-center justify-between text-xs" style={{ borderColor: 'var(--dash-border)' }}>
              <Link
                to={`/dashboard/events/${detailModalItem.eventId}?tab=participants`}
                className="text-blue-500 hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Open event in Event Management</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setDetailModalItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-700 text-white font-semibold cursor-pointer hover:bg-slate-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
