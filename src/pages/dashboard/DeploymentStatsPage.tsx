import { useEffect, useState } from 'react';
import {
  Server, Database, HardDrive, ShieldCheck, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle, Clock, Zap, Cpu,
  Activity, ArrowUpRight, Lock, Globe, Terminal, Play,
  Wifi, Layers, Sparkles, Radio, CheckCircle, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isSuperAdmin } from '../../utils/permissions';
import { runSystemDiagnostics } from '../../services/deploymentService';
import type { DeploymentHealthReport } from '../../types';
import { CardSkeleton, DataStateWrapper } from '../../components/ui/skeleton';
import { useToast } from '../../contexts/ToastContext';

const SERVICE_THEMES: Record<string, { color: string; bg: string; border: string; glow: string; badgeBg: string; badgeText: string }> = {
  'Cloud Firestore': {
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.08)',
    border: 'rgba(59, 130, 246, 0.25)',
    glow: 'rgba(59, 130, 246, 0.15)',
    badgeBg: 'rgba(59, 130, 246, 0.12)',
    badgeText: '#60a5fa',
  },
  'Supabase Storage': {
    color: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.08)',
    border: 'rgba(168, 85, 247, 0.25)',
    glow: 'rgba(168, 85, 247, 0.15)',
    badgeBg: 'rgba(168, 85, 247, 0.12)',
    badgeText: '#c084fc',
  },
  'Storage': {
    color: '#8b5cf6',
    bg: 'rgba(139, 92, 246, 0.08)',
    border: 'rgba(139, 92, 246, 0.25)',
    glow: 'rgba(139, 92, 246, 0.15)',
    badgeBg: 'rgba(139, 92, 246, 0.12)',
    badgeText: '#a78bfa',
  },
  'Vite + React 18': {
    color: '#06b6d4',
    bg: 'rgba(6, 182, 212, 0.08)',
    border: 'rgba(6, 182, 212, 0.25)',
    glow: 'rgba(6, 182, 212, 0.15)',
    badgeBg: 'rgba(6, 182, 212, 0.12)',
    badgeText: '#22d3ee',
  },
  'Auth & RBAC': {
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.25)',
    glow: 'rgba(245, 158, 11, 0.15)',
    badgeBg: 'rgba(245, 158, 11, 0.12)',
    badgeText: '#fbbf24',
  },
  'Edge Network': {
    color: '#ec4899',
    bg: 'rgba(236, 72, 153, 0.08)',
    border: 'rgba(236, 72, 153, 0.25)',
    glow: 'rgba(236, 72, 153, 0.15)',
    badgeBg: 'rgba(236, 72, 153, 0.12)',
    badgeText: '#f472b6',
  },
  'default': {
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.08)',
    border: 'rgba(16, 185, 129, 0.25)',
    glow: 'rgba(16, 185, 129, 0.15)',
    badgeBg: 'rgba(16, 185, 129, 0.12)',
    badgeText: '#34d399',
  }
};

export default function DeploymentStatsPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const isSuper = isSuperAdmin(profile);

  const [report, setReport] = useState<DeploymentHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningTest, setRunningTest] = useState(false);

  const runTest = async () => {
    setRunningTest(true);
    try {
      const res = await runSystemDiagnostics();
      setReport(res);
      showToast('System diagnostics complete — all checks refreshed', 'info');
    } catch {
      showToast('Failed to complete system diagnostics', 'error');
    } finally {
      setLoading(false);
      setRunningTest(false);
    }
  };

  useEffect(() => {
    runTest();
  }, []);

  if (!isSuper) {
    return (
      <div className="p-12 text-center space-y-3">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold" style={{ color: 'var(--dash-text)' }}>Access Denied</h2>
        <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>Only Superadmin accounts can view Deployment & System Health.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-500 border border-red-500/20 rounded">
              Superadmin Mission Control
            </span>
            <span className="text-xs text-blue-500 font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Realtime Infrastructure Telemetry
            </span>
          </div>
          <h1 className="page-header-title text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--dash-text)' }}>
            Deployment &amp; Service Health
          </h1>
          <p className="page-header-sub">
            Realtime monitoring for Firestore database queries, Supabase storage buckets, edge CDN, and React virtual DOM runtime.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={runTest}
            disabled={runningTest}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all shadow-md hover:scale-105 active:scale-95 disabled:opacity-50 text-white rounded-md"
            style={{
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              boxShadow: '0 4px 15px rgba(37,99,235,0.3)',
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningTest ? 'animate-spin' : ''}`} />
            <span>{runningTest ? 'Auditing Nodes...' : 'Run Live Diagnostic'}</span>
          </button>
        </div>
      </div>

      {/* ── Main Status KPI Cards with Differentiated Colors ── */}
      <DataStateWrapper loading={loading} skeleton={<div className="grid grid-cols-1 md:grid-cols-4 gap-3.5"><CardSkeleton height={120} /><CardSkeleton height={120} /><CardSkeleton height={120} /><CardSkeleton height={120} /></div>}>
        {report && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Website Platform — Emerald / Teal */}
            <div
              className="p-4 relative overflow-hidden rounded-md border transition-all duration-300 hover:translate-y-[-2px] hover:shadow-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.09) 0%, rgba(6, 182, 212, 0.05) 100%)',
                borderColor: 'rgba(16, 185, 129, 0.35)',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.06)'
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Website Platform
                </span>
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-8 h-8 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                    Online &amp; Active
                  </p>
                  <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80">
                    HTTP/2 · TLS 1.3 Active
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-emerald-500/20 flex items-center justify-between text-[11px]">
                <span style={{ color: 'var(--dash-muted)' }}>DOM Ready:</span>
                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{report.website.domLoadTimeMs}ms</span>
              </div>
            </div>

            {/* Card 2: Cloud Firestore — Electric Blue */}
            <div
              className="p-4 relative overflow-hidden rounded-md border transition-all duration-300 hover:translate-y-[-2px] hover:shadow-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.09) 0%, rgba(99, 102, 241, 0.05) 100%)',
                borderColor: 'rgba(59, 130, 246, 0.35)',
                boxShadow: '0 4px 20px rgba(59, 130, 246, 0.06)'
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Cloud Firestore
                </span>
                <div className="w-6 h-6 flex items-center justify-center text-blue-500 bg-blue-500/15 rounded">
                  <Database className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-8 h-8 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-lg font-black text-blue-600 dark:text-blue-400 leading-tight tabular-nums">
                    {report.firestore.latencyMs}ms Latency
                  </p>
                  <p className="text-[10px] text-blue-700/80 dark:text-blue-300/80">
                    {report.firestore.status === 'operational' ? 'Live Query Handshake OK' : 'Degraded'}
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-blue-500/20 flex items-center justify-between text-[11px]">
                <span style={{ color: 'var(--dash-muted)' }}>Active Listeners:</span>
                <span className="font-bold font-mono text-blue-600 dark:text-blue-400">{report.firestore.activeListeners} Streams</span>
              </div>
            </div>

            {/* Card 3: Storage Subsystem — Rich Violet / Purple */}
            <div
              className="p-4 relative overflow-hidden rounded-md border transition-all duration-300 hover:translate-y-[-2px] hover:shadow-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.09) 0%, rgba(217, 70, 239, 0.05) 100%)',
                borderColor: 'rgba(168, 85, 247, 0.35)',
                boxShadow: '0 4px 20px rgba(168, 85, 247, 0.06)'
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Storage Engine
                </span>
                <div className="w-6 h-6 flex items-center justify-center text-purple-500 bg-purple-500/15 rounded">
                  <HardDrive className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-8 h-8 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-lg font-black text-purple-600 dark:text-purple-400 leading-tight">
                    {report.storage.provider} S3
                  </p>
                  <p className="text-[10px] text-purple-700/80 dark:text-purple-300/80">
                    Bucket CDN Pipeline Active
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-purple-500/20 flex items-center justify-between text-[11px]">
                <span style={{ color: 'var(--dash-muted)' }}>Status:</span>
                <span className="font-bold font-mono text-purple-600 dark:text-purple-400">Operational</span>
              </div>
            </div>

            {/* Card 4: System State & Audits — Vibrant Amber / Orange */}
            <div
              className="p-4 relative overflow-hidden rounded-md border transition-all duration-300 hover:translate-y-[-2px] hover:shadow-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.09) 0%, rgba(249, 115, 22, 0.05) 100%)',
                borderColor: 'rgba(245, 158, 11, 0.35)',
                boxShadow: '0 4px 20px rgba(245, 158, 11, 0.06)'
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  System Health
                </span>
                <div className="w-6 h-6 flex items-center justify-center text-amber-500 bg-amber-500/15 rounded">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-8 h-8 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-lg font-black text-amber-600 dark:text-amber-400 leading-tight">
                    {report.status === 'healthy' ? '100% Operational' : 'Degraded State'}
                  </p>
                  <p className="text-[10px] text-amber-700/80 dark:text-amber-300/80">
                    Production Build v2.4
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-amber-500/20 flex items-center justify-between text-[11px]">
                <span style={{ color: 'var(--dash-muted)' }}>Checks Passed:</span>
                <span className="font-bold font-mono text-amber-600 dark:text-amber-400">
                  {report.checks.filter(c => c.status === 'pass').length}/{report.checks.length} Checkpoints
                </span>
              </div>
            </div>
          </div>
        )}
      </DataStateWrapper>

      {/* ── Diagnostic Service Checks Table with Colorful Badges ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
            <Activity className="w-4 h-4 text-blue-500" />
            Infrastructure Diagnostic Checkpoints
          </h2>
          <span className="text-[11px] font-semibold text-slate-400">
            Auto-audited across all services
          </span>
        </div>

        {report && (
          <div className="overflow-hidden rounded-md border" style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--dash-border)', background: 'var(--dash-hover)' }}>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>Service Check</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>Provider / Engine</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-right" style={{ color: 'var(--dash-muted)' }}>Latency</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>Diagnostics Telemetry Detail</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-center" style={{ color: 'var(--dash-muted)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.checks.map(check => {
                    const theme = SERVICE_THEMES[check.service] || SERVICE_THEMES.default;
                    return (
                      <tr
                        key={check.id}
                        className="transition-colors"
                        style={{ borderBottom: '1px solid var(--dash-border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--dash-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td className="py-3 px-4 font-bold" style={{ color: 'var(--dash-text)' }}>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: theme.color }} />
                            <span>{check.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className="px-2.5 py-0.5 rounded text-[11px] font-bold"
                            style={{
                              background: theme.badgeBg,
                              color: theme.badgeText,
                              border: `1px solid ${theme.border}`,
                            }}
                          >
                            {check.service}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-mono font-bold" style={{ color: theme.color }}>
                          {check.latencyMs ? `${check.latencyMs}ms` : '—'}
                        </td>
                        <td className="py-3 px-4 font-medium" style={{ color: 'var(--dash-muted)' }}>
                          {check.message}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {check.status === 'pass' ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-500 text-[10px] font-black uppercase px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/25">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                            </span>
                          ) : check.status === 'warn' ? (
                            <span className="inline-flex items-center gap-1.5 text-amber-500 text-[10px] font-black uppercase px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/25">
                              <AlertTriangle className="w-3.5 h-3.5" /> Warn
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-red-500 text-[10px] font-black uppercase px-2.5 py-1 rounded bg-red-500/10 border border-red-500/25">
                              <XCircle className="w-3.5 h-3.5" /> Fail
                            </span>
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
      </div>

      {/* ── Colorful Specs & Security Matrices ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Environment & Runtime Specs — Cyber Violet & Cyan Accent */}
        <div
          className="p-5 space-y-4 rounded-md border"
          style={{
            background: 'var(--dash-card)',
            borderColor: 'var(--dash-border)',
            boxShadow: '0 4px 20px rgba(124, 58, 237, 0.04)'
          }}
        >
          <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: 'var(--dash-border)' }}>
            <div className="w-7 h-7 rounded bg-purple-500/15 text-purple-500 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--dash-text)' }}>
                Environment &amp; Runtime Specs
              </h3>
              <p className="text-[10px]" style={{ color: 'var(--dash-muted)' }}>Vite 5 build target and client runtime configuration</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            {[
              { label: 'Environment Mode', value: 'Production (Live)', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
              { label: 'Frontend Framework', value: 'React 18.3 + TypeScript', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
              { label: 'Bundler Engine', value: 'Vite 5.4.2 (ESM Rollup)', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
              { label: 'Database Service', value: 'Google Cloud Firestore v10.14', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
              { label: 'Storage Engine', value: 'Supabase S3 Compatible Storage', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
              { label: 'CSS Architecture', value: 'TailwindCSS + Dynamic CSS Variables', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-1.5 px-2.5 rounded transition-colors hover:bg-slate-500/5" style={{ borderBottom: '1px solid var(--dash-border)' }}>
                <span style={{ color: 'var(--dash-muted)' }}>{row.label}</span>
                <span
                  className="font-bold font-mono text-[11px] px-2 py-0.5 rounded"
                  style={{ color: row.color, background: row.bg }}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Security & Compliance Matrices — Emerald & Gold Accent */}
        <div
          className="p-5 space-y-4 rounded-md border"
          style={{
            background: 'var(--dash-card)',
            borderColor: 'var(--dash-border)',
            boxShadow: '0 4px 20px rgba(16, 185, 129, 0.04)'
          }}
        >
          <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: 'var(--dash-border)' }}>
            <div className="w-7 h-7 rounded bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--dash-text)' }}>
                Security &amp; Compliance Matrices
              </h3>
              <p className="text-[10px]" style={{ color: 'var(--dash-muted)' }}>Role-based access verification and rule policies</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            {[
              { label: 'Authentication Mode', value: 'Firebase Auth (Email + OAuth)', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
              { label: 'Role-Based Access Control', value: 'Superadmin, Core, Member, Pending', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
              { label: 'Database Security Rules', value: 'Strict UID & Role Scoped', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
              { label: 'Transport Layer Security', value: 'TLS 1.3 / Strict-Transport-Security', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
              { label: 'Telemetry Ring Buffer', value: '500 Traces Rolling Memory Limit', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
              { label: 'Cache Strategy', value: 'IndexedDB Multi-Tab + Deduplication', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-1.5 px-2.5 rounded transition-colors hover:bg-slate-500/5" style={{ borderBottom: '1px solid var(--dash-border)' }}>
                <span style={{ color: 'var(--dash-muted)' }}>{row.label}</span>
                <span
                  className="font-bold font-mono text-[11px] px-2 py-0.5 rounded"
                  style={{ color: row.color, background: row.bg }}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

