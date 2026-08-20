import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSiteSettings, updateSiteSettings } from '../../services/applicationService';
import {
  Settings,
  ShieldCheck,
  Shield,
  Users,
  Activity,
  FileCheck,
  ChevronRight,
  Globe,
  Radio,
} from 'lucide-react';
import Toggle from '../../components/ui/Toggle';
import { useToast } from '../../contexts/ToastContext';
import RightPanel from '../../components/ui/RightPanel';

export default function ControlCentrePage() {
  const { showToast } = useToast();
  const [open, setOpen] = useState(true);
  const [clubDescription, setClubDescription] = useState('');
  const [aboutText, setAboutText] = useState('');
  const [whatsappGroupLink, setWhatsappGroupLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getSiteSettings()
      .then((settings) => {
        setOpen(settings.applicationsOpen !== false);
        setClubDescription(settings.clubDescription || '');
        setAboutText(settings.aboutText || '');
        setWhatsappGroupLink(typeof settings.whatsappGroupLink === 'string' ? settings.whatsappGroupLink : '');
      })
      .catch(console.error);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateSiteSettings({
        applicationsOpen: open,
        clubDescription,
        aboutText,
        whatsappGroupLink,
      });
      showToast('Website settings saved successfully!', 'success');
      setIsEditing(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const navCards = [
    {
      label: 'Member Approvals',
      description: 'Approve, reject, revoke, and assign member roles or positions.',
      icon: Users,
      path: '/dashboard/user-approvals',
      badge: 'Access',
    },
    {
      label: 'Access Control',
      description: 'Set granular page permissions and finance access keys.',
      icon: Shield,
      path: '/dashboard/access-control',
      badge: 'Security',
    },
    {
      label: 'Positions & Hierarchy',
      description: 'Define club governance chain, titles, and office holders.',
      icon: ShieldCheck,
      path: '/dashboard/positions',
      badge: 'Roles',
    },
    {
      label: 'Application Pipeline',
      description: 'Review applicants and progress them through interview stages.',
      icon: FileCheck,
      path: '/dashboard/manage-applications',
      badge: 'Recruitment',
    },
    {
      label: 'Audit & Telemetry',
      description: 'Inspect administrative actions, logs, and activity telemetry.',
      icon: Activity,
      path: '/dashboard/monitor-activity',
      badge: 'Logs',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Super Admin Control Centre</h1>
          <p className="page-header-sub">
            Master governance console for website parameters, membership security, and club operations
          </p>
        </div>

        <button onClick={() => setIsEditing(true)} className="btn-primary">
          <Settings className="w-4 h-4" />
          <span>Website Settings</span>
        </button>
      </div>

      {/* ── System Status Banner ── */}
      <div className="grid md:grid-cols-3 gap-3">
        <div className="stat-card">
          <div className="stat-card-accent-bar" style={{ background: 'var(--dash-accent)' }} />
          <div className="flex items-start justify-between mt-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                System Authority
              </p>
              <p className="text-xl font-bold mt-1" style={{ color: 'var(--dash-text)' }}>
                Super Admin Root
              </p>
              <p className="text-[11px] mt-1 text-emerald-500 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Full Access Active
              </p>
            </div>
            <div
              className="w-9 h-9 flex items-center justify-center shrink-0"
              style={{ background: 'var(--dash-accent-soft)', borderRadius: '6px' }}
            >
              <ShieldCheck className="w-4 h-4" style={{ color: 'var(--dash-accent)' }} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-accent-bar" style={{ background: open ? '#10b981' : '#ef4444' }} />
          <div className="flex items-start justify-between mt-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                Application Gate
              </p>
              <p
                className="text-xl font-bold mt-1"
                style={{ color: open ? '#10b981' : '#ef4444' }}
              >
                {open ? 'Accepting Applicants' : 'Gateways Closed'}
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--dash-muted)' }}>
                Public registration /apply route
              </p>
            </div>
            <div
              className="w-9 h-9 flex items-center justify-center shrink-0"
              style={{ background: open ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}
            >
              <Radio className="w-4 h-4" style={{ color: open ? '#10b981' : '#ef4444' }} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-accent-bar" style={{ background: '#8b5cf6' }} />
          <div className="flex items-start justify-between mt-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                Recruitment Community
              </p>
              <p className="text-xl font-bold mt-1 truncate max-w-[180px]" style={{ color: 'var(--dash-text)' }}>
                {whatsappGroupLink ? 'Linked Group' : 'Unconfigured'}
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--dash-muted)' }}>
                Auto-redirect for candidates
              </p>
            </div>
            <div
              className="w-9 h-9 flex items-center justify-center shrink-0"
              style={{ background: 'rgba(139, 92, 246, 0.1)', borderRadius: '6px' }}
            >
              <Globe className="w-4 h-4 text-purple-500" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Governance Direct Navigation Modules ── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--dash-muted)' }}>
          Administration Modules
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {navCards.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="dash-card text-left flex flex-col justify-between group transition-all duration-150"
              style={{ borderRadius: '6px', borderColor: 'var(--dash-card-border)', cursor: 'pointer' }}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-8 h-8 flex items-center justify-center"
                    style={{
                      background: 'var(--dash-accent-soft)',
                      borderRadius: '4px',
                    }}
                  >
                    <item.icon className="w-4 h-4" style={{ color: 'var(--dash-accent)' }} />
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5"
                    style={{
                      background: 'var(--dash-hover)',
                      color: 'var(--dash-muted)',
                      border: '1px solid var(--dash-border)',
                      borderRadius: '4px',
                    }}
                  >
                    {item.badge}
                  </span>
                </div>

                <h3
                  className="font-bold text-sm leading-snug group-hover:text-purple-400 transition-colors"
                  style={{ color: 'var(--dash-text)' }}
                >
                  {item.label}
                </h3>
                <p className="text-xs line-clamp-2 mt-1.5 leading-relaxed" style={{ color: 'var(--dash-muted)' }}>
                  {item.description}
                </p>
              </div>

              <div
                className="flex items-center justify-between pt-3 mt-4 border-t text-xs font-medium"
                style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-accent)' }}
              >
                <span>Launch Console</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Settings Drawer ── */}
      <RightPanel
        open={isEditing}
        onClose={() => setIsEditing(false)}
        title="Website Configuration"
        width="540px"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div
            className="p-3.5 border"
            style={{
              borderColor: 'var(--dash-border)',
              background: 'var(--dash-hover)',
              borderRadius: '6px',
            }}
          >
            <Toggle
              checked={open}
              onChange={setOpen}
              label="Accepting Interview Applications"
              description="Toggle public applicant registrations on /apply"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
              Club Summary (Hero & Meta)
            </label>
            <textarea
              className="dash-input min-h-[85px] resize-none"
              value={clubDescription}
              onChange={(e) => setClubDescription(e.target.value)}
              placeholder="Short elevator pitch for public landing pages..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
              Detailed Mission & About Section
            </label>
            <textarea
              className="dash-input min-h-[140px] resize-none"
              value={aboutText}
              onChange={(e) => setAboutText(e.target.value)}
              placeholder="Full description of club vision, domain specializations, and faculty advisory..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
              Recruitment WhatsApp Group URL
            </label>
            <input
              className="dash-input font-mono text-xs"
              value={whatsappGroupLink}
              onChange={(e) => setWhatsappGroupLink(e.target.value)}
              placeholder="https://chat.whatsapp.com/..."
            />
          </div>

          <div className="pt-3 border-t" style={{ borderColor: 'var(--dash-border)' }}>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full !py-2.5 !text-xs font-bold"
            >
              {loading ? 'Saving Changes...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </RightPanel>
    </div>
  );
}
