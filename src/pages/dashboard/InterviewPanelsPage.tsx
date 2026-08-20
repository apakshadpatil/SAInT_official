import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  subscribeSections,
  subscribePanels,
  createSection,
  deleteSection,
  createPanel,
  deletePanel,
  updatePanel,
  allocateApplications,
} from '../../services/interviewService';
import { archiveApplication, deleteApplication, subscribeApplications } from '../../services/applicationService';
import { getAllUsers } from '../../services/authService';
import { logActivity } from '../../services/activityService';
import type { InterviewSection, InterviewPanel, UserProfile, ClubApplication } from '../../types';
import { isSuperAdmin } from '../../utils/permissions';
import RightPanel from '../../components/ui/RightPanel';
import {
  Plus,
  Trash2,
  Users,
  Briefcase,
  ChevronRight,
  UserPlus,
  CheckCircle,
  HelpCircle,
  X,
  Zap,
  ClipboardList,
  Edit3,
  UserMinus,
  Loader2,
  Archive,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────
   Inline styles / shared constants
───────────────────────────────────────────────────────── */
const glass: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(10,10,12,0.52), rgba(24,24,28,0.38))',
  border: '1px solid rgba(255,255,255,0.14)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  borderRadius: '1.15rem',
  boxShadow: '0 20px 60px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)',
};

const heroShell: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '1.35rem',
  background: 'linear-gradient(135deg, rgba(10,10,12,0.8), rgba(34,34,38,0.72))',
  border: '1px solid rgba(255,255,255,0.14)',
  boxShadow: '0 24px 70px rgba(0,0,0,0.36)',
  padding: '1.2rem 1.3rem',
};

const badgePill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.35rem 0.7rem',
  borderRadius: '999px',
  fontSize: '0.67rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  background: 'rgba(129,140,248,0.18)',
  color: '#c7d2fe',
  border: '1px solid rgba(129,140,248,0.3)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.14)',
  color: 'var(--dash-text)',
  borderRadius: '0.625rem',
  padding: '0.45rem 0.75rem',
  fontSize: '0.78rem',
  outline: 'none',
  transition: 'border-color 0.2s',
};

const sectionChipBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: '0.65rem',
  fontWeight: 700,
  padding: '0.2rem 0.55rem',
  borderRadius: '999px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  border: '1px solid',
  transition: 'all 0.15s',
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
};

/* Accent palette for section chips */
const CHIP_COLORS = [
  { bg: 'rgba(99,102,241,0.15)', text: '#a5b4fc', border: 'rgba(99,102,241,0.35)' },
  { bg: 'rgba(59,130,246,0.15)', text: '#93c5fd', border: 'rgba(59,130,246,0.35)' },
  { bg: 'rgba(168,85,247,0.15)', text: '#d8b4fe', border: 'rgba(168,85,247,0.35)' },
  { bg: 'rgba(16,185,129,0.15)', text: '#6ee7b7', border: 'rgba(16,185,129,0.35)' },
  { bg: 'rgba(245,158,11,0.15)', text: '#fcd34d', border: 'rgba(245,158,11,0.35)' },
  { bg: 'rgba(236,72,153,0.15)', text: '#f9a8d4', border: 'rgba(236,72,153,0.35)' },
];

const chipColor = (index: number) => CHIP_COLORS[index % CHIP_COLORS.length];

const ambientNodes = [
  { left: '8%', top: '12%', size: '7px', delay: '0s', duration: '8s' },
  { left: '20%', top: '26%', size: '10px', delay: '1.5s', duration: '9s' },
  { left: '36%', top: '16%', size: '6px', delay: '0.7s', duration: '7s' },
  { left: '52%', top: '32%', size: '8px', delay: '2.2s', duration: '10s' },
  { left: '68%', top: '18%', size: '9px', delay: '1s', duration: '8.5s' },
  { left: '82%', top: '30%', size: '7px', delay: '2.8s', duration: '9.5s' },
  { left: '12%', top: '72%', size: '8px', delay: '1.8s', duration: '8s' },
  { left: '74%', top: '74%', size: '10px', delay: '0.3s', duration: '9s' },
  { left: '58%', top: '78%', size: '6px', delay: '2.1s', duration: '7.5s' },
  { left: '90%', top: '78%', size: '7px', delay: '1.4s', duration: '8.2s' },
];

const ambientConnections = [
  { left: '10%', top: '18%', width: '24%', height: '1px', rotate: '18deg' },
  { left: '28%', top: '24%', width: '16%', height: '1px', rotate: '-10deg' },
  { left: '44%', top: '20%', width: '22%', height: '1px', rotate: '12deg' },
  { left: '58%', top: '28%', width: '18%', height: '1px', rotate: '-16deg' },
  { left: '16%', top: '70%', width: '24%', height: '1px', rotate: '-12deg' },
  { left: '56%', top: '72%', width: '24%', height: '1px', rotate: '10deg' },
];

/* ─────────────────────────────────────────────────────────
   Helper: initials avatar
───────────────────────────────────────────────────────── */
function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      title={name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--dash-accent, #6366f1), #8b5cf6)',
        color: '#fff',
        fontSize: size * 0.36,
        fontWeight: 700,
        flexShrink: 0,
        border: '1.5px solid rgba(255,255,255,0.15)',
      }}
    >
      {initials || '?'}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────── */
export default function InterviewPanelsPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [sections, setSections] = useState<InterviewSection[]>([]);
  const [panels, setPanels] = useState<InterviewPanel[]>([]);
  const [applications, setApplications] = useState<ClubApplication[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allocating, setAllocating] = useState(false);

  /* Creation state */
  const [newSectionLabel, setNewSectionLabel] = useState('');
  const [newPanelName, setNewPanelName] = useState('');
  const [selectedPanelSections, setSelectedPanelSections] = useState<string[]>([]);

  /* Edit panel modal */
  const [editingPanel, setEditingPanel] = useState<InterviewPanel | null>(null);
  const [editPanelName, setEditPanelName] = useState('');
  const [editPanelSections, setEditPanelSections] = useState<string[]>([]);

  /* Allocation result modal */
  const [allocResult, setAllocResult] = useState<{ count: number; details: string[] } | null>(null);

  /* Slide-over: view applicants + manage interviewers for a panel */
  const [managingPanel, setManagingPanel] = useState<InterviewPanel | null>(null);

  const isSuper = isSuperAdmin(profile);

  /* ── Data subscriptions ── */
  useEffect(() => {
    const unsubSec = subscribeSections(setSections);
    const unsubPan = subscribePanels(setPanels);
    const unsubApp = subscribeApplications(setApplications);
    getAllUsers()
      .then((all) => setUsers(all.filter((u) => u.status === 'approved')))
      .catch(console.error);
    return () => {
      unsubSec();
      unsubPan();
      unsubApp();
    };
  }, []);

  /* Keep managingPanel in sync when panels update from Firestore */
  useEffect(() => {
    if (managingPanel) {
      const updated = panels.find((p) => p.id === managingPanel.id);
      if (updated) setManagingPanel(updated);
    }
  }, [panels]);

  /* ── Section CRUD ── */
  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionLabel.trim()) return;
    try {
      await createSection(newSectionLabel.trim());
      await logActivity(
        profile!.uid,
        profile!.displayName,
        profile!.email,
        'create_section',
        `Created new interview section "${newSectionLabel.trim()}"`
      );
      showToast(`Section "${newSectionLabel.trim()}" created.`, 'success');
      setNewSectionLabel('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create section', 'error');
    }
  };

  const handleDeleteSection = async (id: string, label: string) => {
    if (!window.confirm(`Delete section "${label}"?`)) return;
    try {
      await deleteSection(id);
      await logActivity(
        profile!.uid,
        profile!.displayName,
        profile!.email,
        'delete_section',
        `Deleted interview section "${label}"`
      );
      showToast(`Section "${label}" deleted.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete section', 'error');
    }
  };

  /* ── Panel CRUD ── */
  const handleCreatePanel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPanelName.trim()) return;
    if (selectedPanelSections.length === 0) {
      showToast('Select at least one section focus for the panel.', 'error');
      return;
    }
    try {
      await createPanel(newPanelName.trim(), selectedPanelSections);
      await logActivity(
        profile!.uid,
        profile!.displayName,
        profile!.email,
        'create_panel',
        `Created interview panel "${newPanelName.trim()}" targeting: ${selectedPanelSections.join(', ')}`
      );
      showToast(`Panel "${newPanelName.trim()}" created.`, 'success');
      setNewPanelName('');
      setSelectedPanelSections([]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create panel', 'error');
    }
  };

  const handleUpdatePanel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPanel || !editPanelName.trim()) return;
    if (editPanelSections.length === 0) {
      showToast('Select at least one section focus.', 'error');
      return;
    }
    try {
      await updatePanel(editingPanel.id, {
        name: editPanelName.trim(),
        sections: editPanelSections,
      });
      await logActivity(
        profile!.uid,
        profile!.displayName,
        profile!.email,
        'update_panel',
        `Updated panel "${editingPanel.name}" → "${editPanelName.trim()}" sections: ${editPanelSections.join(', ')}`
      );
      showToast(`Panel "${editPanelName.trim()}" updated.`, 'success');
      setEditingPanel(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update panel', 'error');
    }
  };

  const handleDeletePanel = async (id: string, name: string) => {
    if (!window.confirm(`Delete interview panel "${name}"?`)) return;
    try {
      await deletePanel(id);
      await logActivity(
        profile!.uid,
        profile!.displayName,
        profile!.email,
        'delete_panel',
        `Deleted interview panel "${name}"`
      );
      showToast(`Panel "${name}" deleted.`, 'success');
      if (managingPanel?.id === id) setManagingPanel(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete panel', 'error');
    }
  };

  /* ── Interviewer assignment ── */
  const handleAssignInterviewer = async (panel: InterviewPanel, userId: string) => {
    if (!userId) return;
    const targetUser = users.find((u) => u.uid === userId);
    if (!targetUser) return;
    if (panel.interviewerIds.includes(userId)) {
      showToast('Interviewer already assigned to this panel.', 'error');
      return;
    }
    try {
      const updatedIds = [...panel.interviewerIds, userId];
      const updatedNames = [...panel.interviewerNames, targetUser.displayName];
      await updatePanel(panel.id, { interviewerIds: updatedIds, interviewerNames: updatedNames });
      await logActivity(
        profile!.uid,
        profile!.displayName,
        profile!.email,
        'assign_interviewer',
        `Assigned "${targetUser.displayName}" to panel "${panel.name}"`
      );
      showToast(`${targetUser.displayName} assigned to ${panel.name}.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to assign interviewer', 'error');
    }
  };

  const handleUnassignInterviewer = async (
    panel: InterviewPanel,
    userId: string,
    userName: string
  ) => {
    if (!window.confirm(`Unassign "${userName}" from "${panel.name}"?`)) return;
    try {
      const updatedIds = panel.interviewerIds.filter((id) => id !== userId);
      const updatedNames = panel.interviewerNames.filter(
        (_, idx) => panel.interviewerIds[idx] !== userId
      );
      await updatePanel(panel.id, { interviewerIds: updatedIds, interviewerNames: updatedNames });
      await logActivity(
        profile!.uid,
        profile!.displayName,
        profile!.email,
        'unassign_interviewer',
        `Unassigned "${userName}" from panel "${panel.name}"`
      );
      showToast(`${userName} unassigned from ${panel.name}.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to unassign interviewer', 'error');
    }
  };

  const handleArchiveApplication = async (application: ClubApplication) => {
    if (!profile || !window.confirm(`Archive ${application.firstName} ${application.lastName}'s application? It can be restored from Archived Applications.`)) return;
    try {
      await archiveApplication(application.id, profile.uid);
      await logActivity(profile.uid, profile.displayName, profile.email, 'archive_application', `Archived application from ${application.firstName} ${application.lastName} from the interview queue`);
      showToast(`${application.firstName} ${application.lastName}'s application was archived.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to archive application', 'error');
    }
  };

  const handleDeleteApplication = async (application: ClubApplication) => {
    if (!profile || !window.confirm(`Permanently delete ${application.firstName} ${application.lastName}'s application? This cannot be undone.`)) return;
    try {
      await deleteApplication(application.id);
      await logActivity(profile.uid, profile.displayName, profile.email, 'delete_application', `Permanently deleted application from ${application.firstName} ${application.lastName} in the interview queue`);
      showToast(`${application.firstName} ${application.lastName}'s application was deleted.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete application', 'error');
    }
  };

  /* ── Auto-allocation ── */
  const handleAllocate = async () => {
    setAllocating(true);
    try {
      const result = await allocateApplications();
      await logActivity(
        profile!.uid,
        profile!.displayName,
        profile!.email,
        'allocate_applications',
        `Ran auto-allocation. Allocated ${result.allocatedCount} candidates.`
      );
      setAllocResult({ count: result.allocatedCount, details: result.details });
    } catch {
      showToast('Auto-allocation algorithm failed. Please try again.', 'error');
    } finally {
      setAllocating(false);
    }
  };

  const togglePanelSection = (val: string) => {
    setSelectedPanelSections((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  };

  const toggleEditPanelSection = (val: string) => {
    setEditPanelSections((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  };

  const activeApplications = applications.filter((application) => !application.archivedAt);
  const getPanelApplications = (panelId: string) =>
    activeApplications.filter((application) => {
      const assignedPanelIds = application.panelIds?.length ? application.panelIds : application.panelId ? [application.panelId] : [];
      return assignedPanelIds.includes(panelId);
    });

  /* ═══════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════ */
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative', overflow: 'hidden' }}
      className="animate-fade-in-up"
    >
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 15% 15%, rgba(59,130,246,0.17), transparent 26%), radial-gradient(circle at 85% 10%, rgba(16,185,129,0.16), transparent 22%), radial-gradient(circle at 50% 90%, rgba(168,85,247,0.15), transparent 24%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {ambientConnections.map((line, idx) => (
          <div
            key={`line-${idx}`}
            style={{
              position: 'absolute',
              left: line.left,
              top: line.top,
              width: line.width,
              height: line.height,
              borderTop: '1px solid rgba(255,255,255,0.16)',
              transform: `rotate(${line.rotate})`,
              opacity: 0.7,
              animation: `connectPulse 6s ease-in-out infinite`,
              animationDelay: `${idx * 0.5}s`,
            }}
          />
        ))}
        {ambientNodes.map((node, idx) => (
          <div
            key={`node-${idx}`}
            style={{
              position: 'absolute',
              left: node.left,
              top: node.top,
              width: node.size,
              height: node.size,
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.85)',
              boxShadow: '0 0 16px rgba(255,255,255,0.4)',
              animation: `floatNode ${node.duration} ease-in-out infinite`,
              animationDelay: node.delay,
            }}
          />
        ))}
      </div>
      <div style={{ ...heroShell, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 20%, rgba(59,130,246,0.16), transparent 28%), radial-gradient(circle at 80% 0%, rgba(16,185,129,0.14), transparent 24%), radial-gradient(circle at 50% 100%, rgba(168,85,247,0.14), transparent 24%)', animation: 'pulseGlow 7s ease-in-out infinite alternate' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '760px' }}>
          <div style={{ ...badgePill, marginBottom: '0.7rem' }}>
            <Zap style={{ width: 12, height: 12 }} />
            Interview Studio
          </div>
          <h1 style={{ color: '#f8fafc', fontSize: '1.4rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Organize your interview flow in a calmer, clearer workspace.
          </h1>
          <p style={{ color: 'rgba(226,232,240,0.84)', fontSize: '0.8rem', marginTop: '0.42rem', lineHeight: 1.6 }}>
            Build sections, shape panels, and keep every interview lane visible in one elegant board.
          </p>
        </div>

        <button
          onClick={handleAllocate}
          disabled={allocating || panels.length === 0}
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.72rem 1.05rem',
            borderRadius: '999px',
            background: allocating ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #34d399, #2563eb)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.16)',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: allocating || panels.length === 0 ? 'not-allowed' : 'pointer',
            opacity: panels.length === 0 ? 0.75 : 1,
            transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: '0 10px 28px rgba(37,99,235,0.24)',
          }}
        >
          {allocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {allocating ? 'Allocating…' : 'Auto-Allocate'}
        </button>
      </div>

      <div style={{ display: 'grid', gap: '0.9rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div style={{ ...glass, padding: '0.95rem 1rem' }}>
          <p style={{ color: 'rgba(255,255,255,0.56)', fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.14em', margin: 0 }}>Sections</p>
          <p style={{ color: '#f8fafc', fontSize: '1.25rem', fontWeight: 800, margin: '0.3rem 0 0' }}>{sections.length}</p>
        </div>
        <div style={{ ...glass, padding: '0.95rem 1rem' }}>
          <p style={{ color: 'rgba(255,255,255,0.56)', fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.14em', margin: 0 }}>Panels</p>
          <p style={{ color: '#f8fafc', fontSize: '1.25rem', fontWeight: 800, margin: '0.3rem 0 0' }}>{panels.length}</p>
        </div>
        <div style={{ ...glass, padding: '0.95rem 1rem' }}>
          <p style={{ color: 'rgba(255,255,255,0.56)', fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.14em', margin: 0 }}>Allocated</p>
          <p style={{ color: '#f8fafc', fontSize: '1.25rem', fontWeight: 800, margin: '0.3rem 0 0' }}>{activeApplications.filter((application) => application.panelIds?.length || application.panelId).length}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1.05fr 0.95fr' }} className="lg-two-col">
        <div style={{ ...glass, padding: '1rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.04), transparent 60%)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.56)', fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.14em', margin: 0 }}>Section Library</p>
                <h2 style={{ color: '#f8fafc', fontSize: '0.95rem', fontWeight: 800, margin: '0.25rem 0 0' }}>Create and manage interview lanes</h2>
              </div>
              <span style={{ ...badgePill, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.78)', borderColor: 'rgba(255,255,255,0.12)' }}>{sections.length} live</span>
            </div>

            {isSuper ? (
              <form onSubmit={handleCreateSection} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem' }}>
                <input
                  type="text"
                  placeholder="New section name…"
                  value={newSectionLabel}
                  onChange={(e) => setNewSectionLabel(e.target.value)}
                  style={{ ...inputStyle, flex: 1, fontSize: '0.72rem' }}
                />
                <button
                  type="submit"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.45rem 0.7rem',
                    borderRadius: '0.6rem',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#f8fafc',
                    border: '1px solid rgba(255,255,255,0.15)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Plus style={{ width: 12, height: 12 }} /> Add
                </button>
              </form>
            ) : (
              <p style={{ color: 'var(--dash-muted)', fontSize: '0.67rem', marginTop: '0.9rem', fontStyle: 'italic' }}>
                * Section management requires Super Admin.
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.9rem' }}>
              {sections.length === 0 && (
                <p style={{ color: 'var(--dash-muted)', fontSize: '0.7rem', textAlign: 'center', padding: '1rem 0', fontStyle: 'italic' }}>
                  No sections defined yet.
                </p>
              )}
              {sections.map((sec, i) => {
                const c = chipColor(i);
                return (
                  <div
                    key={sec.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.55rem 0.7rem',
                      borderRadius: '0.7rem',
                      background: 'rgba(255,255,255,0.05)',
                      border: `1px solid ${c.border}`,
                      animation: `fadeSlideIn 0.25s ease ${i * 0.04}s both`,
                    }}
                  >
                    <span style={{ color: c.text, fontSize: '0.72rem', fontWeight: 700 }}>
                      {sec.label}
                      <span style={{ color: 'rgba(255,255,255,0.58)', fontWeight: 500, marginLeft: '0.3rem', fontSize: '0.62rem' }}>
                        ({sec.value})
                      </span>
                    </span>
                    {isSuper && (
                      <button
                        onClick={() => handleDeleteSection(sec.id, sec.label)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f87171',
                          cursor: 'pointer',
                          padding: '0.15rem',
                          borderRadius: '0.35rem',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Delete section"
                      >
                        <Trash2 style={{ width: 12, height: 12 }} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ ...glass, padding: '1rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.04), transparent 60%)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.56)', fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.14em', margin: 0 }}>Panel Composer</p>
                <h2 style={{ color: '#f8fafc', fontSize: '0.95rem', fontWeight: 800, margin: '0.25rem 0 0' }}>Create a fresh interview lane</h2>
              </div>
              <span style={{ ...badgePill, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.78)', borderColor: 'rgba(255,255,255,0.12)' }}>Easy setup</span>
            </div>

            <form onSubmit={handleCreatePanel} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.9rem' }}>
              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.66)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.35rem' }}>
                  Panel Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Panel A – Management"
                  value={newPanelName}
                  onChange={(e) => setNewPanelName(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.66)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.4rem' }}>
                  Section Coverage
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {sections.map((sec, i) => {
                    const isSelected = selectedPanelSections.includes(sec.value);
                    const c = chipColor(i);
                    return (
                      <button
                        type="button"
                        key={sec.value}
                        onClick={() => togglePanelSection(sec.value)}
                        style={{
                          ...sectionChipBase,
                          background: isSelected ? c.bg : 'rgba(255,255,255,0.04)',
                          color: isSelected ? c.text : 'rgba(255,255,255,0.74)',
                          borderColor: isSelected ? c.border : 'rgba(255,255,255,0.12)',
                          opacity: isSelected ? 1 : 0.75,
                        }}
                      >
                        {sec.label}
                      </button>
                    );
                  })}
                  {sections.length === 0 && (
                    <span style={{ color: 'var(--dash-muted)', fontSize: '0.7rem', fontStyle: 'italic' }}>
                      No sections yet.
                    </span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem',
                  borderRadius: '0.7rem',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#f8fafc',
                  border: '1px solid rgba(255,255,255,0.14)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <Plus style={{ width: 14, height: 14 }} />
                Create Interview Panel
              </button>
            </form>
          </div>
        </div>
      </div>

      <div style={{ ...glass, padding: '1rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.05), transparent 60%)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 10% 10%, rgba(255,255,255,0.08) 0 1px, transparent 1px), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.05) 0 1px, transparent 1px), radial-gradient(circle at 20% 80%, rgba(255,255,255,0.04) 0 1px, transparent 1px)', backgroundSize: '22px 22px, 30px 30px, 26px 26px', animation: 'driftGrid 16s linear infinite' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.9rem' }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.56)', fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.14em', margin: 0 }}>Panel Board</p>
              <h2 style={{ color: '#f8fafc', fontSize: '0.95rem', fontWeight: 800, margin: '0.25rem 0 0' }}>Every panel is a clear lane for interviews</h2>
            </div>
            <span style={{ ...badgePill, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.78)', borderColor: 'rgba(255,255,255,0.12)' }}>{panels.length} active</span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1rem',
            }}
          >
            {panels.length === 0 && (
              <div
                style={{
                  gridColumn: '1 / -1',
                  ...glass,
                  padding: '2.2rem',
                  textAlign: 'center',
                  borderStyle: 'dashed',
                  opacity: 0.8,
                }}
              >
                <HelpCircle style={{ width: 28, height: 28, color: 'rgba(255,255,255,0.56)', margin: '0 auto 0.75rem' }} />
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.8rem' }}>
                  No interview panels defined yet.
                </p>
                <p style={{ color: 'rgba(255,255,255,0.56)', fontSize: '0.68rem', marginTop: '0.25rem' }}>
                  Create your first panel from the composer above.
                </p>
              </div>
            )}

            {panels.map((panel, panelIdx) => {
              const allocated = getPanelApplications(panel.id);
              return (
                <PanelCard
                  key={panel.id}
                  panel={panel}
                  allocatedCount={allocated.length}
                  sections={sections}
                  isSuper={isSuper}
                  animDelay={panelIdx * 0.06}
                  onManage={() => setManagingPanel(panel)}
                  onEdit={() => {
                    setEditingPanel(panel);
                    setEditPanelName(panel.name);
                    setEditPanelSections(panel.sections);
                  }}
                  onDelete={() => handleDeletePanel(panel.id, panel.name)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════
          SLIDE-OVER: Manage Panel
      ════════════════════════════════ */}
      {managingPanel && (
        <RightPanel open={!!managingPanel} onClose={() => setManagingPanel(null)} title={`Manage ${managingPanel.name}`} width="620px">
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.1rem 1.25rem',
                borderBottom: '1px solid var(--dash-border)',
                flexShrink: 0,
              }}
            >
              <div>
                <p style={{ color: 'var(--dash-muted)', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.15rem' }}>
                  Managing Panel
                </p>
                <h2 style={{ color: 'var(--dash-text)', fontSize: '1rem', fontWeight: 800, margin: 0 }}>
                  {managingPanel.name}
                </h2>
              </div>
              <button
                onClick={() => setManagingPanel(null)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--dash-border)',
                  color: 'var(--dash-muted)',
                  borderRadius: '0.5rem',
                  padding: '0.35rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Section chips */}
              <div>
                <p style={{ color: 'var(--dash-muted)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>
                  Section Coverage
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {managingPanel.sections.map((s, i) => {
                    const idx = sections.findIndex((sec) => sec.value === s);
                    const c = chipColor(idx >= 0 ? idx : i);
                    return (
                      <span key={s} style={{ ...sectionChipBase, background: c.bg, color: c.text, borderColor: c.border, cursor: 'default' }}>
                        {s.replace(/_/g, ' ')}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Assign Interviewer */}
              <div>
                <p style={{ color: 'var(--dash-muted)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>
                  Assign Interviewer
                </p>
                <div style={{ position: 'relative' }}>
                  <UserPlus style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--dash-muted)' }} />
                  <select
                    style={{ ...inputStyle, paddingLeft: '1.85rem' }}
                    defaultValue=""
                    onChange={(e) => {
                      handleAssignInterviewer(managingPanel, e.target.value);
                      e.target.value = '';
                    }}
                  >
                    <option value="" disabled>Select member to assign…</option>
                    {users.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.displayName} ({u.positionTitle || 'Member'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Interviewers list */}
              <div>
                <p style={{ color: 'var(--dash-muted)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>
                  Assigned Panelists ({managingPanel.interviewerIds.length})
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {managingPanel.interviewerIds.length === 0 && (
                    <p style={{ color: 'var(--dash-muted)', fontSize: '0.72rem', fontStyle: 'italic' }}>
                      No interviewers assigned yet.
                    </p>
                  )}
                  {managingPanel.interviewerIds.map((id, idx) => {
                    const name = managingPanel.interviewerNames[idx] || 'Panelist';
                    return (
                      <div
                        key={id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '0.65rem',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid var(--dash-border)',
                          animation: `fadeSlideIn 0.2s ease ${idx * 0.04}s both`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <Avatar name={name} size={28} />
                          <span style={{ color: 'var(--dash-text)', fontSize: '0.75rem', fontWeight: 600 }}>
                            {name}
                          </span>
                        </div>
                        <button
                          onClick={() => handleUnassignInterviewer(managingPanel, id, name)}
                          style={{
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.25)',
                            color: '#f87171',
                            borderRadius: '0.4rem',
                            padding: '0.25rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title="Unassign"
                        >
                          <UserMinus style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Allocated applicants */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <p style={{ color: 'var(--dash-muted)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Allocated Candidates
                  </p>
                  <span
                    style={{
                      background: 'rgba(59,130,246,0.15)',
                      color: '#93c5fd',
                      border: '1px solid rgba(59,130,246,0.3)',
                      borderRadius: '999px',
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      padding: '0.08rem 0.45rem',
                    }}
                  >
                    {getPanelApplications(managingPanel.id).length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {getPanelApplications(managingPanel.id).length === 0 && (
                    <p style={{ color: 'var(--dash-muted)', fontSize: '0.72rem', fontStyle: 'italic', textAlign: 'center', padding: '1.5rem 0' }}>
                      No candidates allocated yet. Run Auto-Allocate to assign candidates.
                    </p>
                  )}
                  {getPanelApplications(managingPanel.id)
                    .map((app, appIdx) => (
                      <div
                        key={app.id}
                        style={{
                          padding: '0.7rem 0.85rem',
                          borderRadius: '0.7rem',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--dash-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          animation: `fadeSlideIn 0.2s ease ${appIdx * 0.03}s both`,
                        }}
                      >
                        <div>
                          <p style={{ color: 'var(--dash-text)', fontWeight: 700, fontSize: '0.78rem', margin: 0 }}>
                            {app.firstName} {app.lastName}
                          </p>
                          <p style={{ color: 'var(--dash-muted)', fontSize: '0.65rem', margin: '0.1rem 0 0.35rem' }}>
                            RBT: {app.rbtNumber} · {app.department}
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {app.sections.map((s, si) => {
                              const idx = sections.findIndex((sec) => sec.value === s);
                              const c = chipColor(idx >= 0 ? idx : si);
                              return (
                                <span key={s} style={{ ...sectionChipBase, background: c.bg, color: c.text, borderColor: c.border, cursor: 'default', fontSize: '0.58rem' }}>
                                  {s.replace(/_/g, ' ')}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                          <span
                            style={{
                              background: 'rgba(59,130,246,0.12)',
                              color: '#60a5fa',
                              border: '1px solid rgba(59,130,246,0.25)',
                              borderRadius: '999px',
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.6rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {app.status}
                          </span>
                          <button
                            onClick={() => handleArchiveApplication(app)}
                            title={`Archive ${app.firstName} ${app.lastName}`}
                            aria-label={`Archive ${app.firstName} ${app.lastName}`}
                            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.28)', color: '#fbbf24', borderRadius: '0.45rem', padding: '0.35rem', cursor: 'pointer', display: 'flex' }}
                          >
                            <Archive style={{ width: 13, height: 13 }} />
                          </button>
                          <button
                            onClick={() => handleDeleteApplication(app)}
                            title={`Delete ${app.firstName} ${app.lastName}`}
                            aria-label={`Delete ${app.firstName} ${app.lastName}`}
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.28)', color: '#f87171', borderRadius: '0.45rem', padding: '0.35rem', cursor: 'pointer', display: 'flex' }}
                          >
                            <Trash2 style={{ width: 13, height: 13 }} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div
              style={{
                padding: '0.9rem 1.25rem',
                borderTop: '1px solid var(--dash-border)',
                display: 'flex',
                gap: '0.6rem',
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => {
                  setManagingPanel(null);
                  const p = panels.find((x) => x.id === managingPanel.id) ?? managingPanel;
                  setEditingPanel(p);
                  setEditPanelName(p.name);
                  setEditPanelSections(p.sections);
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem',
                  borderRadius: '0.6rem',
                  background: 'transparent',
                  color: '#93c5fd',
                  border: '1px solid rgba(59,130,246,0.3)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Edit3 style={{ width: 13, height: 13 }} />
                Edit Panel
              </button>
              {isSuper && (
                <button
                  onClick={() => handleDeletePanel(managingPanel.id, managingPanel.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '0.55rem 0.9rem',
                    borderRadius: '0.6rem',
                    background: 'rgba(239,68,68,0.1)',
                    color: '#f87171',
                    border: '1px solid rgba(239,68,68,0.25)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 style={{ width: 13, height: 13 }} />
                  Delete
                </button>
              )}
            </div>
          </div>
        </RightPanel>
      )}

      {/* ════════════════════════════════
          MODAL: Edit Panel
      ════════════════════════════════ */}
      {editingPanel && (
        <RightPanel open={!!editingPanel} onClose={() => setEditingPanel(null)} title="Edit Panel Details" width="440px">
          <form
            onSubmit={handleUpdatePanel}
            style={{
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--dash-border)' }}>
              <h3 style={{ color: 'var(--dash-text)', fontWeight: 800, fontSize: '0.9rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Edit3 style={{ width: 15, height: 15, color: '#60a5fa' }} />
                Edit Panel Details
              </h3>
              <button
                type="button"
                onClick={() => setEditingPanel(null)}
                style={{ background: 'none', border: 'none', color: 'var(--dash-muted)', cursor: 'pointer', display: 'flex' }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Name input */}
            <div>
              <label style={{ display: 'block', color: 'var(--dash-muted)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.35rem' }}>
                Panel Name
              </label>
              <input
                type="text"
                value={editPanelName}
                onChange={(e) => setEditPanelName(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            {/* Section coverage */}
            <div>
              <label style={{ display: 'block', color: 'var(--dash-muted)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>
                Section Coverage
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {sections.map((sec, i) => {
                  const isSelected = editPanelSections.includes(sec.value);
                  const c = chipColor(i);
                  return (
                    <button
                      type="button"
                      key={sec.value}
                      onClick={() => toggleEditPanelSection(sec.value)}
                      style={{
                        ...sectionChipBase,
                        background: isSelected ? c.bg : 'transparent',
                        color: isSelected ? c.text : 'var(--dash-muted)',
                        borderColor: isSelected ? c.border : 'var(--dash-border)',
                        opacity: isSelected ? 1 : 0.6,
                      }}
                    >
                      {sec.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--dash-border)' }}>
              <button
                type="button"
                onClick={() => setEditingPanel(null)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.55rem',
                  background: 'transparent',
                  color: 'var(--dash-muted)',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.55rem',
                  background: 'rgba(59,130,246,0.18)',
                  color: '#93c5fd',
                  border: '1px solid rgba(59,130,246,0.35)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Save Changes
              </button>
            </div>
          </form>
        </RightPanel>
      )}

      {/* ════════════════════════════════
          MODAL: Allocation Result
      ════════════════════════════════ */}
      {allocResult && (
        <RightPanel open={!!allocResult} onClose={() => setAllocResult(null)} title="Auto-Allocation Complete" width="500px">
          <div
            style={{
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--dash-border)' }}>
              <h3 style={{ color: 'var(--dash-text)', fontWeight: 800, fontSize: '0.9rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle style={{ width: 16, height: 16, color: '#34d399' }} />
                Auto-Allocation Complete
              </h3>
              <button
                onClick={() => setAllocResult(null)}
                style={{ background: 'none', border: 'none', color: 'var(--dash-muted)', cursor: 'pointer', display: 'flex' }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Summary */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <p style={{ color: 'var(--dash-text)', fontSize: '0.78rem', margin: 0 }}>
                Scanned public applications and matched interest targets to defined panels.
              </p>
              <span
                style={{
                  background: 'rgba(52,211,153,0.12)',
                  color: '#34d399',
                  border: '1px solid rgba(52,211,153,0.3)',
                  borderRadius: '0.6rem',
                  padding: '0.3rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {allocResult.count} Application{allocResult.count !== 1 ? 's' : ''} Allocated
              </span>
            </div>

            {/* Details */}
            <div
              style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid var(--dash-border)',
                borderRadius: '0.7rem',
                padding: '0.75rem',
                maxHeight: 240,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
              }}
            >
              {allocResult.details.length === 0 ? (
                <p style={{ color: 'var(--dash-muted)', fontSize: '0.72rem', fontStyle: 'italic', textAlign: 'center', padding: '1rem 0' }}>
                  No candidates required reallocation.
                </p>
              ) : (
                allocResult.details.map((line, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.3rem 0',
                      borderBottom: idx < allocResult.details.length - 1 ? '1px solid var(--dash-border)' : 'none',
                    }}
                  >
                    <ChevronRight style={{ width: 11, height: 11, color: 'var(--dash-muted)', flexShrink: 0 }} />
                    <span style={{ color: 'var(--dash-muted)', fontSize: '0.7rem' }}>{line}</span>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setAllocResult(null)}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.55rem',
                  background: 'rgba(52,211,153,0.12)',
                  color: '#34d399',
                  border: '1px solid rgba(52,211,153,0.3)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </RightPanel>
      )}

      {/* Keyframe animations injected once */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeScaleIn {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes pulseGlow {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.05); opacity: 1; }
        }
        @keyframes driftGrid {
          0% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-10px) translateX(8px); }
          100% { transform: translateY(0px) translateX(0px); }
        }
        @keyframes floatNode {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.7; }
          50% { transform: translateY(-10px) scale(1.2); opacity: 1; }
        }
        @keyframes connectPulse {
          0%, 100% { opacity: 0.4; transform: rotate(var(--rotation, 0deg)) scaleX(0.95); }
          50% { opacity: 0.95; transform: rotate(var(--rotation, 0deg)) scaleX(1.05); }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   PanelCard sub-component
───────────────────────────────────────────────────────── */
interface PanelCardProps {
  panel: InterviewPanel;
  allocatedCount: number;
  sections: InterviewSection[];
  isSuper: boolean;
  animDelay: number;
  onManage: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function PanelCard({
  panel,
  allocatedCount,
  sections,
  isSuper,
  animDelay,
  onManage,
  onEdit,
  onDelete,
}: PanelCardProps) {
  return (
    <div
      style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
        border: '1px solid rgba(255,255,255,0.16)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderRadius: '1.1rem',
        padding: '1.1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        animation: `fadeSlideIn 0.28s ease ${animDelay}s both`,
        transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
        boxShadow: '0 18px 40px rgba(2,8,23,0.22), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      {/* Panel name + actions */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '0.55rem',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.26), rgba(16,185,129,0.16))',
              border: '1px solid rgba(129,140,248,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Briefcase style={{ width: 14, height: 14, color: '#a5b4fc' }} />
          </div>
          <h3
            style={{
              color: 'var(--dash-text)',
              fontWeight: 800,
              fontSize: '0.82rem',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {panel.name}
          </h3>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
          <button
            onClick={onEdit}
            style={{
              background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.25)',
              color: '#93c5fd',
              borderRadius: '0.45rem',
              padding: '0.25rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Edit panel"
          >
            <Edit3 style={{ width: 12, height: 12 }} />
          </button>
          {isSuper && (
            <button
              onClick={onDelete}
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#f87171',
                borderRadius: '0.45rem',
                padding: '0.25rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Delete panel"
            >
              <Trash2 style={{ width: 12, height: 12 }} />
            </button>
          )}
        </div>
      </div>

      {/* Section chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
        {panel.sections.map((s, i) => {
          const idx = sections.findIndex((sec) => sec.value === s);
          const c = chipColor(idx >= 0 ? idx : i);
          return (
            <span key={s} style={{ ...{ display: 'inline-flex', alignItems: 'center', fontSize: '0.6rem', fontWeight: 700, padding: '0.18rem 0.5rem', borderRadius: '999px', textTransform: 'uppercase' as const, letterSpacing: '0.04em', border: '1px solid', whiteSpace: 'nowrap' as const }, background: c.bg, color: c.text, borderColor: c.border }}>
              {s.replace(/_/g, ' ')}
            </span>
          );
        })}
      </div>

      {/* Interviewer avatars */}
      <div>
        <p style={{ color: 'var(--dash-muted)', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.4rem' }}>
          Panelists
        </p>
        {panel.interviewerIds.length === 0 ? (
          <p style={{ color: 'var(--dash-muted)', fontSize: '0.68rem', fontStyle: 'italic' }}>
            None assigned
          </p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
            {panel.interviewerIds.map((id, idx) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }} title={panel.interviewerNames[idx]}>
                <Avatar name={panel.interviewerNames[idx] || '?'} size={24} />
              </div>
            ))}
            <span style={{ color: 'var(--dash-muted)', fontSize: '0.65rem', marginLeft: '0.2rem' }}>
              {panel.interviewerIds.length} panelist{panel.interviewerIds.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Footer: applicant count + manage button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '0.6rem',
          borderTop: '1px solid var(--dash-border)',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ClipboardList style={{ width: 13, height: 13, color: '#60a5fa' }} />
          <span style={{ color: 'var(--dash-muted)', fontSize: '0.68rem' }}>Candidates</span>
          <span
            style={{
              background: 'rgba(59,130,246,0.15)',
              color: '#93c5fd',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: '999px',
              fontSize: '0.62rem',
              fontWeight: 700,
              padding: '0.08rem 0.45rem',
            }}
          >
            {allocatedCount}
          </span>
        </div>

        <button
          onClick={onManage}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '0.5rem',
            background: 'rgba(16,185,129,0.12)',
            color: '#6ee7b7',
            border: '1px solid rgba(16,185,129,0.25)',
            fontSize: '0.7rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          <Users style={{ width: 12, height: 12 }} />
          Manage
        </button>
      </div>
    </div>
  );
}
