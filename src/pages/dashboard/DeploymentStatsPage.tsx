import { useEffect, useState } from 'react';
import {
  Database, HardDrive, ShieldCheck, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle, Cpu,
  Activity, Lock, Globe
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isSuperAdmin } from '../../utils/permissions';
import { runSystemDiagnostics } from '../../services/deploymentService';
import type { DeploymentHealthReport } from '../../types';
import { CardSkeleton, DataStateWrapper } from '../../components/ui/skeleton';
import { useToast } from '../../contexts/ToastContext';

const panelStyle: React.CSSProperties = {
  background: 'var(--dash-card)',
  border: '1px solid var(--dash-border)',
  borderRadius: '6px',
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
        <ShieldCheck className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold" style={{ color: 'var(--dash-text)' }}>Access Denied</h2>
        <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>Only Superadmin accounts can view Deployment & System Health.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px' }}>Superadmin</span>
            <span className="text-xs" style={{ color: 'var(--dash-muted)' }}>· Production Infrastructure</span>
          </div>
          <h1 className="page-header-title">Deployment & Service Health</h1>
          <p className="page-header-sub">Live health status for Firestore database, hosting, edge CDN, and storage subsystems.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runTest}
            disabled={runningTest}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-50"
            style={{ background: 'var(--dash-accent)', color: '#fff', borderRadius: '6px' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningTest ? 'animate-spin' : ''}`} />
            <span>{runningTest ? 'Auditing Services...' : 'Run Live Diagnostic'}</span>
          </button>
        </div>
      </div>

      {/* Main Status Banners */}
      <DataStateWrapper loading={loading} skeleton={<div className="grid grid-cols-1 md:grid-cols-4 gap-3"><CardSkeleton height={110} /><CardSkeleton height={110} /><CardSkeleton height={110} /><CardSkeleton height={110} /></div>}>
        {report && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Website Status */}
            <div className="p-4 relative overflow-hidden" style={panelStyle}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>Website Platform</span>
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>
              <p className="text-xl font-black mt-2 text-emerald-500 flex items-center gap-1.5">
                <Globe className="w-5 h-5" /> Online & Active
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--dash-muted)' }}>
                DOM Ready in {report.website.domLoadTimeMs}ms · SSL active
              </p>
            </div>

            {/* Firestore Status */}
            <div className="p-4 relative overflow-hidden" style={panelStyle}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>Cloud Firestore</span>
                <div className="w-6 h-6 flex items-center justify-center text-blue-500 bg-blue-500/10" style={{ borderRadius: '4px' }}>
                  <Database className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-xl font-black mt-2 text-blue-500 tabular-nums">
                {report.firestore.latencyMs}ms Latency
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--dash-muted)' }}>
                {report.firestore.status === 'operational' ? 'Operational · Realtime enabled' : 'Service degraded'}
              </p>
            </div>

            {/* Storage Status */}
            <div className="p-4 relative overflow-hidden" style={panelStyle}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>Storage Subsystem</span>
                <div className="w-6 h-6 flex items-center justify-center text-purple-500 bg-purple-500/10" style={{ borderRadius: '4px' }}>
                  <HardDrive className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-xl font-black mt-2 text-purple-500">
                {report.storage.provider} Storage
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--dash-muted)' }}>
                Buckets online · Media pipeline active
              </p>
            </div>

            {/* Overall Health Status */}
            <div className="p-4 relative overflow-hidden" style={panelStyle}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>System State</span>
                <div className="w-6 h-6 flex items-center justify-center text-amber-500 bg-amber-500/10" style={{ borderRadius: '4px' }}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-xl font-black mt-2 text-amber-500">
                {report.status === 'healthy' ? '100% Healthy' : 'Degraded State'}
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--dash-muted)' }}>
                {report.checks.filter(c => c.status === 'pass').length}/{report.checks.length} Checks passed
              </p>
            </div>
          </div>
        )}
      </DataStateWrapper>

      {/* Diagnostic Service Checks Table */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
          <Activity className="w-4 h-4 text-blue-500" />
          Infrastructure Diagnostic Checkpoints
        </h2>
        {report && (
          <div className="overflow-hidden" style={panelStyle}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--dash-border)', background: 'var(--dash-hover)' }}>
                    <th className="py-2.5 px-4 text-[10px] font-semibold uppercase" style={{ color: 'var(--dash-muted)' }}>Service Check</th>
                    <th className="py-2.5 px-4 text-[10px] font-semibold uppercase" style={{ color: 'var(--dash-muted)' }}>Provider</th>
                    <th className="py-2.5 px-4 text-[10px] font-semibold uppercase text-right" style={{ color: 'var(--dash-muted)' }}>Latency</th>
                    <th className="py-2.5 px-4 text-[10px] font-semibold uppercase" style={{ color: 'var(--dash-muted)' }}>Diagnostics Detail</th>
                    <th className="py-2.5 px-4 text-[10px] font-semibold uppercase text-center" style={{ color: 'var(--dash-muted)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.checks.map(check => (
                    <tr key={check.id} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                      <td className="py-3 px-4 font-semibold" style={{ color: 'var(--dash-text)' }}>{check.name}</td>
                      <td className="py-3 px-4" style={{ color: 'var(--dash-muted)' }}>{check.service}</td>
                      <td className="py-3 px-4 text-right tabular-nums font-mono font-medium text-amber-500">{check.latencyMs ? `${check.latencyMs}ms` : '—'}</td>
                      <td className="py-3 px-4" style={{ color: 'var(--dash-muted)' }}>{check.message}</td>
                      <td className="py-3 px-4 text-center">
                        {check.status === 'pass' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-500 text-[10px] font-bold uppercase px-2 py-0.5" style={{ background: 'rgba(16,185,129,0.08)', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.2)' }}>
                            <CheckCircle2 className="w-3 h-3" /> Pass
                          </span>
                        ) : check.status === 'warn' ? (
                          <span className="inline-flex items-center gap-1 text-amber-500 text-[10px] font-bold uppercase px-2 py-0.5" style={{ background: 'rgba(245,158,11,0.08)', borderRadius: '4px', border: '1px solid rgba(245,158,11,0.2)' }}>
                            <AlertTriangle className="w-3 h-3" /> Warn
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-500 text-[10px] font-bold uppercase px-2 py-0.5" style={{ background: 'rgba(239,68,68,0.08)', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.2)' }}>
                            <XCircle className="w-3 h-3" /> Fail
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Build & Runtime Specifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 space-y-3" style={panelStyle}>
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
            <Cpu className="w-4 h-4 text-purple-500" />
            Environment & Runtime Specs
          </h3>
          <div className="space-y-2 text-xs">
            {[
              { label: 'Environment Mode', value: 'Production (Live)' },
              { label: 'Frontend Framework', value: 'React 18.3 + TypeScript' },
              { label: 'Bundler Engine', value: 'Vite 5.4.2' },
              { label: 'Database Service', value: 'Google Cloud Firestore v10.14' },
              { label: 'Storage Engine', value: 'Supabase S3 Compatible Storage' },
              { label: 'CSS Architecture', value: 'TailwindCSS + Dynamic CSS Custom Properties' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid var(--dash-border)' }}>
                <span style={{ color: 'var(--dash-muted)' }}>{row.label}</span>
                <span className="font-semibold font-mono" style={{ color: 'var(--dash-text)' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-3" style={panelStyle}>
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
            <Lock className="w-4 h-4 text-emerald-500" />
            Security & Compliance Matrices
          </h3>
          <div className="space-y-2 text-xs">
            {[
              { label: 'Authentication Mode', value: 'Firebase Auth (Email + Google OAuth)' },
              { label: 'Role-Based Access Control', value: 'Superadmin, Core, Member, Pending' },
              { label: 'Database Security Rules', value: 'Strict UID & Role Scoped' },
              { label: 'Transport Layer Security', value: 'TLS 1.3 / Strict-Transport-Security' },
              { label: 'Telemetry Ring Buffer', value: '500 Traces Rolling Memory Limit' },
              { label: 'Cache Strategy', value: 'Session Cache + Smart Expiration' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid var(--dash-border)' }}>
                <span style={{ color: 'var(--dash-muted)' }}>{row.label}</span>
                <span className="font-semibold font-mono text-emerald-500">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
