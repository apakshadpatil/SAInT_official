import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  subscribeGDPanels,
  createGDPanel,
  updateGDPanel,
  deleteGDPanel,
  allocateApplicationsToGDPanels,
  allocateSelectedStudentsToInterviewPanels,
  exportGDPanelsToCSV,
} from '../../services/gdService';
import {
  subscribeRubrics,
  createRubric,
  deleteRubric,
  submitRubricEvaluation,
  subscribeAllRubricEvaluations,
} from '../../services/rubricService';
import { subscribeApplications } from '../../services/applicationService';
import { getAllUsers } from '../../services/authService';
import { logActivity } from '../../services/activityService';
import type {
  GDPanel,
  GDRubric,
  ClubApplication,
  UserProfile,
  StudentRubricEvaluation,
} from '../../types';
import { isSuperAdmin, isCoreMember, hasTabAccess } from '../../utils/permissions';
import {
  Users,
  Plus,
  Trash2,
  Edit3,
  Zap,
  Download,
  CheckCircle,
  Search,
  Award,
  Sliders,
  Briefcase,
  X,
  Loader2,
  MapPin,
  Clock,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

/* Glassmorphism styling tokens matching SAInT aesthetics */
const glassCard: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(15,23,42,0.65), rgba(30,41,59,0.45))',
  border: '1px solid rgba(255,255,255,0.12)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: '1.25rem',
  boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
};

const badgeStyle = (bgColor: string, textColor: string, borderColor: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.25rem 0.65rem',
  borderRadius: '999px',
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.03em',
  background: bgColor,
  color: textColor,
  border: `1px solid ${borderColor}`,
});

export default function GDPanelsPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [gdPanels, setGdPanels] = useState<GDPanel[]>([]);
  const [rubrics, setRubrics] = useState<GDRubric[]>([]);
  const [applications, setApplications] = useState<ClubApplication[]>([]);
  const [allEvaluations, setAllEvaluations] = useState<Record<string, StudentRubricEvaluation[]>>({});
  const [users, setUsers] = useState<UserProfile[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'panels' | 'evaluation' | 'rubrics' | 'interview_alloc'>('panels');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPanelFilter, setSelectedPanelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);

  // Selected panel for deep-dive live scoring workspace modal
  const [livePanel, setLivePanel] = useState<GDPanel | null>(null);

  // Auto Allocate Modal State
  const [autoAllocateModalOpen, setAutoAllocateModalOpen] = useState(false);
  const [allocationMode, setAllocationMode] = useState<'capacity' | 'equal'>('capacity');
  const [maxPerPanelInput, setMaxPerPanelInput] = useState<number>(10);

  // Modals state
  const [panelModalOpen, setPanelModalOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<GDPanel | null>(null);
  const [panelName, setPanelName] = useState('');
  const [panelVenue, setPanelVenue] = useState('');
  const [panelTimeSlot, setPanelTimeSlot] = useState('');
  const [selectedPanellistIds, setSelectedPanellistIds] = useState<string[]>([]);

  const [rubricModalOpen, setRubricModalOpen] = useState(false);
  const [rubricTitle, setRubricTitle] = useState('');
  const [rubricDesc, setRubricDesc] = useState('');
  const [rubricMaxMarks, setRubricMaxMarks] = useState(10);
  const [rubricCategory, setRubricCategory] = useState<'gd' | 'interview' | 'general'>('gd');

  // Interactive evaluation drafting state per applicant: applicationId -> { rubricId -> score }
  const [evaluationDrafts, setEvaluationDrafts] = useState<Record<string, Record<string, number>>>({});
  const [evaluationComments, setEvaluationComments] = useState<Record<string, string>>({});
  const [savingAppId, setSavingAppId] = useState<string | null>(null);

  // Core Members and Superadmin strictly authorized
  const isAuthorized = isSuperAdmin(profile) || isCoreMember(profile) || hasTabAccess(profile, 'gdPanels');

  useEffect(() => {
    const unsubPanels = subscribeGDPanels(setGdPanels);
    const unsubRubrics = subscribeRubrics(setRubrics);
    const unsubApps = subscribeApplications((apps) => {
      setApplications(apps);
      setLoading(false);
    });
    const unsubEvals = subscribeAllRubricEvaluations(setAllEvaluations);

    // Fetch registered users for panellist assignment
    getAllUsers()
      .then(setUsers)
      .catch((err) => console.error('Failed to fetch users', err));

    return () => {
      unsubPanels();
      unsubRubrics();
      unsubApps();
      unsubEvals();
    };
  }, []);

  if (!isAuthorized) {
    return (
      <div className="p-12 text-center rounded-2xl max-w-xl mx-auto my-12" style={glassCard}>
        <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-100">Access Restricted</h2>
        <p className="text-xs text-slate-400 mt-2">
          The Group Discussion (GD) Panels & Assessment module is restricted to Core Members, Superadmins, or users explicitly granted permission in Access Control.
        </p>
      </div>
    );
  }

  const activeApplications = applications.filter((app) => !app.archivedAt);

  // Statistics
  const totalGdPanels = gdPanels.length;
  const assignedAppsCount = activeApplications.filter((a) => a.gdPanelId).length;
  const evaluatedAppsCount = activeApplications.filter((a) => a.gdStatus === 'evaluated' || a.gdStatus === 'selected').length;
  const selectedAppsCount = activeApplications.filter((a) => a.gdStatus === 'selected').length;

  /* ─────────────────────────────────────────────────────────
     Handlers for GD Panels
  ───────────────────────────────────────────────────────── */
  const handleOpenPanelModal = (panel?: GDPanel) => {
    if (panel) {
      setEditingPanel(panel);
      setPanelName(panel.name);
      setPanelVenue(panel.venue || '');
      setPanelTimeSlot(panel.timeSlot || '');
      setSelectedPanellistIds(panel.interviewerIds || []);
    } else {
      setEditingPanel(null);
      setPanelName('');
      setPanelVenue('');
      setPanelTimeSlot('');
      setSelectedPanellistIds([]);
    }
    setPanelModalOpen(true);
  };

  const handleSavePanel = async () => {
    if (!panelName.trim()) {
      showToast('Please enter a GD Panel Name', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const interviewerNames = selectedPanellistIds.map(
        (id) => users.find((u) => u.uid === id)?.displayName || 'Unknown Member'
      );

      if (editingPanel) {
        await updateGDPanel(editingPanel.id, {
          name: panelName.trim(),
          venue: panelVenue.trim(),
          timeSlot: panelTimeSlot.trim(),
          interviewerIds: selectedPanellistIds,
          interviewerNames,
        });
        showToast('GD Panel updated successfully!', 'success');
      } else {
        await createGDPanel(
          panelName.trim(),
          panelVenue.trim(),
          panelTimeSlot.trim(),
          selectedPanellistIds,
          interviewerNames
        );
        showToast('GD Panel created successfully!', 'success');
      }

      if (profile) {
        await logActivity(
          profile.uid,
          profile.displayName,
          profile.email,
          editingPanel ? 'update_gd_panel' : 'create_gd_panel',
          `${editingPanel ? 'Updated' : 'Created'} GD Panel ${panelName}`
        );
      }
      setPanelModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save GD panel', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePanel = async (panel: GDPanel) => {
    if (!window.confirm(`Are you sure you want to delete GD Panel "${panel.name}"?`)) return;
    setActionLoading(true);
    try {
      await deleteGDPanel(panel.id);
      showToast(`Deleted GD Panel "${panel.name}"`, 'success');
      if (livePanel?.id === panel.id) setLivePanel(null);
    } catch (err) {
      showToast('Failed to delete GD Panel', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenAutoAllocateModal = () => {
    if (gdPanels.length === 0) {
      showToast('Please create at least one GD Panel before auto-allocating.', 'error');
      return;
    }
    setAutoAllocateModalOpen(true);
  };

  const handleConfirmAutoAllocateGD = async () => {
    if (gdPanels.length === 0) {
      showToast('Please create at least one GD Panel before auto-allocating.', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const capLimit = allocationMode === 'capacity' ? Math.max(1, Number(maxPerPanelInput) || 10) : undefined;
      const res = await allocateApplicationsToGDPanels(capLimit);
      showToast(
        capLimit
          ? `Auto-allocated ${res.allocatedCount} candidates to GD Panels with max ${capLimit} per panel!`
          : `Auto-allocated ${res.allocatedCount} candidates equally across GD Panels!`,
        'success'
      );
      if (profile) {
        await logActivity(
          profile.uid,
          profile.displayName,
          profile.email,
          'auto_allocate_gd',
          `Auto-allocated ${res.allocatedCount} candidates to GD Panels (${capLimit ? `max ${capLimit}/panel` : 'equal distribution'})`
        );
      }
      setAutoAllocateModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to auto-allocate candidates', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCSV = () => {
    exportGDPanelsToCSV(gdPanels, activeApplications, allEvaluations);
    showToast('Exported GD Panels and candidate allocations to CSV!', 'success');
  };

  /* ─────────────────────────────────────────────────────────
     Handlers for Custom Rubrics
  ───────────────────────────────────────────────────────── */
  const handleSaveRubric = async () => {
    if (!rubricTitle.trim()) {
      showToast('Please enter a rubric title', 'error');
      return;
    }
    setActionLoading(true);
    try {
      await createRubric(rubricTitle.trim(), rubricDesc.trim(), rubricMaxMarks, rubricCategory);
      showToast('Custom Rubric created successfully!', 'success');
      setRubricModalOpen(false);
      setRubricTitle('');
      setRubricDesc('');
      setRubricMaxMarks(10);
    } catch (err) {
      showToast('Failed to create rubric', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRubric = async (rubric: GDRubric) => {
    if (!window.confirm(`Delete rubric "${rubric.title}"?`)) return;
    setActionLoading(true);
    try {
      await deleteRubric(rubric.id);
      showToast(`Deleted rubric "${rubric.title}"`, 'success');
    } catch (err) {
      showToast('Failed to delete rubric', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  /* ─────────────────────────────────────────────────────────
     Handlers for Evaluation Scoring
  ───────────────────────────────────────────────────────── */
  const handleScoreChange = (appId: string, rubricId: string, value: number) => {
    setEvaluationDrafts((prev) => ({
      ...prev,
      [appId]: {
        ...(prev[appId] || {}),
        [rubricId]: value,
      },
    }));
  };

  const handleCommentChange = (appId: string, text: string) => {
    setEvaluationComments((prev) => ({
      ...prev,
      [appId]: text,
    }));
  };

  const handleSaveStudentEvaluation = async (app: ClubApplication, targetGdPanelId?: string) => {
    if (!profile) return;
    setSavingAppId(app.id);
    try {
      const currentDraft = evaluationDrafts[app.id] || {};
      const comment = evaluationComments[app.id] || '';

      await submitRubricEvaluation(
        app.id,
        profile.uid,
        profile.displayName,
        currentDraft,
        rubrics,
        comment,
        app.panelId,
        targetGdPanelId || app.gdPanelId
      );

      showToast(`Evaluation score submitted by ${profile.displayName} for ${app.firstName} ${app.lastName}!`, 'success');
    } catch (err) {
      showToast('Failed to save evaluation score', 'error');
    } finally {
      setSavingAppId(null);
    }
  };

  const handleToggleStudentSelection = async (appId: string, currentGdStatus?: string) => {
    const newStatus = currentGdStatus === 'selected' ? 'pending' : 'selected';
    try {
      await updateDoc(doc(db, 'applications', appId), {
        gdStatus: newStatus,
      });
      showToast(newStatus === 'selected' ? 'Marked candidate as Selected for Interview!' : 'Selection revoked.', 'info');
    } catch {
      showToast('Failed to update selection status', 'error');
    }
  };

  const handleAllocateSelectedToInterviewPanels = async () => {
    setActionLoading(true);
    try {
      const res = await allocateSelectedStudentsToInterviewPanels(selectedAppIds.length > 0 ? selectedAppIds : undefined);
      showToast(`Successfully auto-allocated ${res.allocatedCount} selected candidates into Interview Panels!`, 'success');
      if (profile) {
        await logActivity(
          profile.uid,
          profile.displayName,
          profile.email,
          'allocate_selected_interview',
          `Allocated ${res.allocatedCount} selected GD candidates to Interview Panels`
        );
      }
      setSelectedAppIds([]);
    } catch (err) {
      // Clear, informative error displayed when no interview panels exist
      showToast(err instanceof Error ? err.message : 'Failed to allocate selected candidates', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  /* ─────────────────────────────────────────────────────────
     Filtered Applicants List for Evaluation Sheet
  ───────────────────────────────────────────────────────── */
  const filteredApplications = activeApplications.filter((app) => {
    const matchesSearch =
      `${app.firstName} ${app.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.rbtNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.department?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPanel =
      selectedPanelFilter === 'all' ||
      (selectedPanelFilter === 'unassigned' ? !app.gdPanelId : app.gdPanelId === selectedPanelFilter);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'selected' && app.gdStatus === 'selected') ||
      (statusFilter === 'evaluated' && app.gdStatus === 'evaluated') ||
      (statusFilter === 'pending' && (!app.gdStatus || app.gdStatus === 'pending'));

    return matchesSearch && matchesPanel && matchesStatus;
  });

  const toggleSelectAllApps = () => {
    if (selectedAppIds.length === filteredApplications.length) {
      setSelectedAppIds([]);
    } else {
      setSelectedAppIds(filteredApplications.map((a) => a.id));
    }
  };

  const toggleSelectApp = (id: string) => {
    setSelectedAppIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-9 h-9 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in-up pb-12">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.18)', color: '#818cf8' }}
            >
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--dash-text)' }}>
                Group Discussion (GD) Panels & Assessment
              </h1>
              <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
                Create GD panels, enter real-time panellist scores with average score calculation, export allocations, and auto-allocate to Interview Panels.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleOpenPanelModal()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-md hover:scale-105 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #3b82f6)' }}
          >
            <Plus className="w-4 h-4" />
            New GD Panel
          </button>

          <button
            onClick={handleOpenAutoAllocateModal}
            disabled={actionLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-md hover:scale-105 cursor-pointer disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
          >
            <Zap className="w-4 h-4 text-emerald-200" />
            Auto Allocate GD
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-white/10 cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: 'var(--dash-text)' }}
          >
            <Download className="w-4 h-4 text-blue-400" />
            Export CSV
          </button>

          <button
            onClick={handleAllocateSelectedToInterviewPanels}
            disabled={actionLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-md hover:scale-105 cursor-pointer disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #9333ea, #c084fc)' }}
          >
            <Briefcase className="w-4 h-4 text-purple-200" />
            Allocate Selected to Interviews
          </button>
        </div>
      </div>

      {/* Analytics / Stats Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl" style={glassCard}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--dash-muted)' }}>GD Panels</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black mt-2" style={{ color: 'var(--dash-text)' }}>{totalGdPanels}</p>
          <span className="text-[10px] text-indigo-300">Active GD rooms</span>
        </div>

        <div className="p-4 rounded-2xl" style={glassCard}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--dash-muted)' }}>Assigned Applicants</span>
            <Award className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-black mt-2" style={{ color: 'var(--dash-text)' }}>{assignedAppsCount}</p>
          <span className="text-[10px] text-blue-300">Allocated in GD panels</span>
        </div>

        <div className="p-4 rounded-2xl" style={glassCard}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--dash-muted)' }}>Evaluated</span>
            <Sliders className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black mt-2" style={{ color: 'var(--dash-text)' }}>{evaluatedAppsCount}</p>
          <span className="text-[10px] text-emerald-300">Rubric scores submitted</span>
        </div>

        <div className="p-4 rounded-2xl" style={glassCard}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--dash-muted)' }}>Selected for Interviews</span>
            <CheckCircle className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black mt-2" style={{ color: 'var(--dash-text)' }}>{selectedAppsCount}</p>
          <span className="text-[10px] text-purple-300">Ready for Interview Panels</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <button
          onClick={() => setActiveTab('panels')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'panels' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4" />
          GD Panels ({gdPanels.length})
        </button>

        <button
          onClick={() => setActiveTab('evaluation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'evaluation' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Global Evaluation Sheet
        </button>

        <button
          onClick={() => setActiveTab('rubrics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'rubrics' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Custom Rubrics Builder ({rubrics.length})
        </button>

        <button
          onClick={() => setActiveTab('interview_alloc')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'interview_alloc' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Interview Auto Allocation
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────
          TAB 1: GD PANELS CARDS GRID
      ───────────────────────────────────────────────────────── */}
      {activeTab === 'panels' && (
        <div className="space-y-6">
          {gdPanels.length === 0 ? (
            <div className="p-12 text-center rounded-2xl" style={glassCard}>
              <Users className="w-12 h-12 text-indigo-400 mx-auto mb-3 opacity-60" />
              <h3 className="text-lg font-bold" style={{ color: 'var(--dash-text)' }}>No GD Panels Created Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-6">
                Get started by creating your first GD Panel to assign panellists and auto-allocate candidates.
              </p>
              <button
                onClick={() => handleOpenPanelModal()}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all cursor-pointer inline-flex items-center gap-2 shadow-lg"
              >
                <Plus className="w-4 h-4" /> Create First GD Panel
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {gdPanels.map((panel) => {
                const assignedCandidates = activeApplications.filter((a) => a.gdPanelId === panel.id);
                return (
                  <div
                    key={panel.id}
                    className="p-5 rounded-2xl flex flex-col justify-between group hover:border-indigo-500/50 transition-all cursor-pointer"
                    style={glassCard}
                    onClick={() => setLivePanel(panel)}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                              {panel.name}
                            </h3>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                            {panel.venue && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-indigo-400" /> {panel.venue}
                              </span>
                            )}
                            {panel.timeSlot && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-blue-400" /> {panel.timeSlot}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenPanelModal(panel)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                            title="Edit Panel"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePanel(panel)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Delete Panel"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Panellists List */}
                      <div className="mt-4 pt-3 border-t border-white/10">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-2">
                          Assigned Panellists ({panel.interviewerNames?.length || 0})
                        </span>
                        {panel.interviewerNames && panel.interviewerNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {panel.interviewerNames.map((name, i) => (
                              <span key={i} style={badgeStyle('rgba(99,102,241,0.15)', '#a5b4fc', 'rgba(99,102,241,0.3)')}>
                                {name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">No panellists assigned yet</span>
                        )}
                      </div>

                      {/* Candidates Count & Live Score Overview */}
                      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300">
                          {assignedCandidates.length} Candidate(s) Assigned
                        </span>

                        <span className="px-3 py-1 rounded-xl text-xs font-bold text-white bg-indigo-600/80 group-hover:bg-indigo-500 transition-all inline-flex items-center gap-1">
                          Open Live Evaluation <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          TAB 2: GLOBAL EVALUATION SHEET WITH CUSTOM RUBRICS
      ───────────────────────────────────────────────────────── */}
      {activeTab === 'evaluation' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4" style={glassCard}>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, RBT, department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={selectedPanelFilter}
                onChange={(e) => setSelectedPanelFilter(e.target.value)}
                className="bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
              >
                <option value="all">All GD Panels</option>
                <option value="unassigned">Unassigned Applicants</option>
                {gdPanels.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="selected">Selected for Interview</option>
                <option value="evaluated">Evaluated</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                Showing {filteredApplications.length} of {activeApplications.length}
              </span>
              {selectedAppIds.length > 0 && (
                <button
                  onClick={handleAllocateSelectedToInterviewPanels}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition-all"
                >
                  Allocate Selected ({selectedAppIds.length})
                </button>
              )}
            </div>
          </div>

          {/* Applicants Table Sheet */}
          <div className="rounded-2xl overflow-hidden overflow-x-auto" style={glassCard}>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/80 text-slate-300 font-semibold border-b border-white/10">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedAppIds.length === filteredApplications.length && filteredApplications.length > 0}
                      onChange={toggleSelectAllApps}
                      className="rounded accent-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-3 min-w-[160px]">Applicant</th>
                  <th className="p-3">RBT / Dept</th>
                  <th className="p-3">GD Panel</th>
                  {rubrics.map((r) => (
                    <th key={r.id} className="p-3 min-w-[120px] text-center">
                      <span>{r.title}</span>
                      <span className="block text-[10px] text-indigo-400 font-normal">(Max: {r.maxMarks})</span>
                    </th>
                  ))}
                  <th className="p-3 text-center min-w-[130px]">Avg Score / Total</th>
                  <th className="p-3 min-w-[140px]">Comment / Notes</th>
                  <th className="p-3 text-center">Interview Selection</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredApplications.length === 0 ? (
                  <tr>
                    <td colSpan={7 + rubrics.length} className="p-8 text-center text-slate-400">
                      No matching applicants found.
                    </td>
                  </tr>
                ) : (
                  filteredApplications.map((app) => {
                    const drafts = evaluationDrafts[app.id] || {};
                    const appEvals = allEvaluations[app.id] || [];

                    // Calculate live draft total score or saved total score
                    let currentTotalScore = 0;
                    let maxTotalPossible = 0;

                    rubrics.forEach((r) => {
                      maxTotalPossible += r.maxMarks;
                      const val = drafts[r.id] !== undefined ? drafts[r.id] : (appEvals[0]?.rubricScores?.[r.id] || 0);
                      currentTotalScore += Number(val) || 0;
                    });

                    // Calculate Average Score across all panellists for real-time display
                    const avgScore =
                      appEvals.length > 0
                        ? Math.round((appEvals.reduce((sum, e) => sum + e.totalScore, 0) / appEvals.length) * 10) / 10
                        : currentTotalScore;

                    const percentage = maxTotalPossible > 0 ? Math.round((avgScore / maxTotalPossible) * 100) : 0;
                    const isSaving = savingAppId === app.id;
                    const isChecked = selectedAppIds.includes(app.id);

                    return (
                      <tr key={app.id} className={`hover:bg-white/5 transition-colors ${isChecked ? 'bg-indigo-950/20' : ''}`}>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectApp(app.id)}
                            className="rounded accent-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-3">
                          <p className="font-bold text-slate-200">{app.firstName} {app.lastName}</p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{app.email}</p>
                        </td>
                        <td className="p-3">
                          <p className="font-semibold text-slate-300">{app.rbtNumber || '-'}</p>
                          <p className="text-[10px] text-slate-400">{app.department}</p>
                        </td>
                        <td className="p-3 font-medium text-slate-300">
                          {app.gdPanelName ? (
                            <span style={badgeStyle('rgba(99,102,241,0.15)', '#a5b4fc', 'rgba(99,102,241,0.3)')}>
                              {app.gdPanelName}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">Unassigned</span>
                          )}
                        </td>

                        {/* Dynamic Custom Rubrics Input Columns */}
                        {rubrics.map((r) => {
                          const val = drafts[r.id] !== undefined ? drafts[r.id] : (appEvals[0]?.rubricScores?.[r.id] || 0);
                          return (
                            <td key={r.id} className="p-3 text-center">
                              <input
                                type="number"
                                min={0}
                                max={r.maxMarks}
                                value={val}
                                onChange={(e) => handleScoreChange(app.id, r.id, Math.min(r.maxMarks, Math.max(0, Number(e.target.value))))}
                                className="w-16 bg-slate-900/80 border border-slate-700/80 rounded-lg px-2 py-1 text-center font-bold text-slate-200 outline-none focus:border-indigo-500 text-xs"
                              />
                            </td>
                          );
                        })}

                        {/* Calculated Average & Total Score */}
                        <td className="p-3 text-center">
                          <div className="font-black text-sm text-indigo-300">
                            Avg: {avgScore} <span className="text-[10px] text-slate-400">/ {maxTotalPossible}</span>
                          </div>
                          <div className="flex items-center justify-center gap-1.5 mt-0.5">
                            <span className={`text-[10px] font-bold ${percentage >= 70 ? 'text-emerald-400' : percentage >= 40 ? 'text-amber-400' : 'text-slate-400'}`}>
                              {percentage}%
                            </span>
                            <span className="text-[9px] text-slate-400">({appEvals.length} rater{appEvals.length !== 1 ? 's' : ''})</span>
                          </div>
                        </td>

                        {/* Comment Input */}
                        <td className="p-3">
                          <input
                            type="text"
                            placeholder="Add evaluation note..."
                            value={evaluationComments[app.id] !== undefined ? evaluationComments[app.id] : (appEvals[0]?.comment || '')}
                            onChange={(e) => handleCommentChange(app.id, e.target.value)}
                            className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-indigo-500"
                          />
                        </td>

                        {/* Interview Selection Toggle */}
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleToggleStudentSelection(app.id, app.gdStatus)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                              app.gdStatus === 'selected'
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                            }`}
                          >
                            {app.gdStatus === 'selected' ? (
                              <>
                                <CheckCircle className="w-3.5 h-3.5" /> Selected
                              </>
                            ) : (
                              'Select'
                            )}
                          </button>
                        </td>

                        {/* Save Score Button */}
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleSaveStudentEvaluation(app)}
                            disabled={isSaving}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all disabled:opacity-50 cursor-pointer inline-flex items-center gap-1"
                          >
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Score'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          TAB 3: CUSTOM RUBRICS BUILDER
      ───────────────────────────────────────────────────────── */}
      {activeTab === 'rubrics' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--dash-text)' }}>Assessment Rubrics Configuration</h3>
              <p className="text-xs text-slate-400">
                Define the criteria and parameters on which students are assessed during Group Discussions and Interviews.
              </p>
            </div>
            <button
              onClick={() => setRubricModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" /> Add Custom Rubric
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rubrics.map((r) => (
              <div key={r.id} className="p-5 rounded-2xl flex flex-col justify-between" style={glassCard}>
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="font-bold text-sm text-slate-200">{r.title}</h4>
                    <span style={badgeStyle('rgba(99,102,241,0.18)', '#a5b4fc', 'rgba(99,102,241,0.3)')}>
                      Max: {r.maxMarks} Marks
                    </span>
                  </div>
                  {r.description && <p className="text-xs text-slate-400 mt-1">{r.description}</p>}
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Category: {r.category}
                  </span>
                  <button
                    onClick={() => handleDeleteRubric(r)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="Delete Rubric"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          TAB 4: INTERVIEW AUTO ALLOCATION FOR SELECTED CANDIDATES
      ───────────────────────────────────────────────────────── */}
      {activeTab === 'interview_alloc' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl space-y-4" style={glassCard}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold" style={{ color: 'var(--dash-text)' }}>
                  Auto Allocate Shortlisted Candidates to Interview Panels
                </h3>
                <p className="text-xs text-slate-400">
                  Automatically assign applicants who cleared the GD round directly into matching Interview Panels based on their requested application domains.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/60 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-200">Candidates Selected in GD Round</p>
                <p className="text-xs text-slate-400">{selectedAppsCount} candidate(s) currently marked as Selected</p>
              </div>

              <button
                onClick={handleAllocateSelectedToInterviewPanels}
                disabled={actionLoading || selectedAppsCount === 0}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-lg"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Auto Allocate Selected Candidates
              </button>
            </div>
          </div>

          {/* Selected Candidates Summary List */}
          <div className="p-6 rounded-2xl space-y-4" style={glassCard}>
            <h4 className="font-bold text-sm text-slate-200">Shortlisted Candidates List ({selectedAppsCount})</h4>

            {selectedAppsCount === 0 ? (
              <p className="text-xs text-slate-400 italic">No candidates marked as selected yet. Mark candidates as "Selected" in the Evaluation Sheet tab.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeApplications
                  .filter((a) => a.gdStatus === 'selected')
                  .map((cand) => (
                    <div key={cand.id} className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-slate-200">{cand.firstName} {cand.lastName}</p>
                        <p className="text-xs text-slate-400">{cand.rbtNumber} • {cand.department}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {cand.sections?.map((sec, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {sec}
                            </span>
                          ))}
                        </div>
                      </div>
                      <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          MODAL / WORKSPACE: DEDICATED GD PANEL LIVE SCORING VIEW
      ───────────────────────────────────────────────────────── */}
      {livePanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg overflow-y-auto">
          <div className="w-full max-w-5xl p-6 rounded-2xl space-y-6 my-8 animate-scale-in" style={glassCard}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Live Panel Workspace
                  </span>
                  <h2 className="text-xl font-bold text-slate-100">{livePanel.name}</h2>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                  {livePanel.venue && (
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-indigo-400" /> {livePanel.venue}</span>
                  )}
                  {livePanel.timeSlot && (
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-blue-400" /> {livePanel.timeSlot}</span>
                  )}
                  <span>Panellists: {livePanel.interviewerNames?.join(', ') || 'Unassigned'}</span>
                </div>
              </div>

              <button
                onClick={() => setLivePanel(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Candidate List & Real-time Panellist Scoring */}
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-slate-200">
                Assigned Candidates & Real-time Panellist Scores
              </h3>

              {activeApplications.filter((a) => a.gdPanelId === livePanel.id).length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-white/5 rounded-xl border border-white/10">
                  No candidates currently assigned to {livePanel.name}. Click "Auto Allocate GD" to assign candidates.
                </div>
              ) : (
                <div className="space-y-4 max-h-[550px] overflow-y-auto pr-2">
                  {activeApplications
                    .filter((a) => a.gdPanelId === livePanel.id)
                    .map((app) => {
                      const drafts = evaluationDrafts[app.id] || {};
                      const appEvals = allEvaluations[app.id] || [];

                      let currentDraftTotal = 0;
                      let maxPossible = 0;
                      rubrics.forEach((r) => {
                        maxPossible += r.maxMarks;
                        const val = drafts[r.id] !== undefined ? drafts[r.id] : 0;
                        currentDraftTotal += Number(val) || 0;
                      });

                      // Real-time Average Score calculation across all panellists
                      const avgScore =
                        appEvals.length > 0
                          ? Math.round((appEvals.reduce((sum, e) => sum + e.totalScore, 0) / appEvals.length) * 10) / 10
                          : currentDraftTotal;

                      const avgMaxScore = appEvals[0]?.maxTotalScore || maxPossible;
                      const avgPercentage = avgMaxScore > 0 ? Math.round((avgScore / avgMaxScore) * 100) : 0;
                      const isSaving = savingAppId === app.id;

                      return (
                        <div key={app.id} className="p-5 rounded-xl bg-slate-900/80 border border-slate-700/80 space-y-4">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-white/10 pb-3">
                            <div>
                              <h4 className="font-bold text-base text-slate-100">{app.firstName} {app.lastName}</h4>
                              <p className="text-xs text-slate-400">{app.rbtNumber || app.department} • {app.email}</p>
                            </div>

                            {/* Average Score Banner */}
                            <div className="flex items-center gap-4">
                              <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-center">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-300 block">
                                  Average Score
                                </span>
                                <p className="text-lg font-black text-indigo-200">
                                  {avgScore} <span className="text-xs text-slate-400">/ {avgMaxScore}</span>
                                </p>
                                <span className="text-[10px] font-bold text-emerald-400">{avgPercentage}%</span>
                              </div>

                              <button
                                onClick={() => handleToggleStudentSelection(app.id, app.gdStatus)}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                                  app.gdStatus === 'selected'
                                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                              >
                                {app.gdStatus === 'selected' ? <CheckCircle className="w-4 h-4" /> : 'Select'}
                                {app.gdStatus === 'selected' ? 'Selected' : 'Select'}
                              </button>
                            </div>
                          </div>

                          {/* Individual Panellist Submissions Breakdown */}
                          {appEvals.length > 0 && (
                            <div className="p-3 rounded-lg bg-white/5 space-y-2">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                Submitted Scores by Panellists ({appEvals.length})
                              </span>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                {appEvals.map((ev) => (
                                  <div key={ev.id} className="p-2 rounded-md bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
                                    <div>
                                      <span className="font-semibold text-slate-200">{ev.evaluatorName}</span>
                                      {ev.comment && <p className="text-[10px] text-slate-400 italic mt-0.5">"{ev.comment}"</p>}
                                    </div>
                                    <span className="font-bold text-indigo-300">{ev.totalScore} / {ev.maxTotalScore} ({ev.percentage}%)</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Interactive Score Inputs for current Panellist */}
                          <div className="space-y-3 pt-2">
                            <span className="text-xs font-semibold text-slate-300 block">
                              Enter Your Evaluation ({profile?.displayName}):
                            </span>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                              {rubrics.map((r) => {
                                const val = drafts[r.id] !== undefined ? drafts[r.id] : 0;
                                return (
                                  <div key={r.id} className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 space-y-1">
                                    <label className="text-[11px] font-medium text-slate-300 block truncate">{r.title}</label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        min={0}
                                        max={r.maxMarks}
                                        value={val}
                                        onChange={(e) =>
                                          handleScoreChange(app.id, r.id, Math.min(r.maxMarks, Math.max(0, Number(e.target.value))))
                                        }
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-bold text-slate-200 text-xs outline-none focus:border-indigo-500"
                                      />
                                      <span className="text-[10px] text-slate-400 font-semibold">/ {r.maxMarks}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                              <input
                                type="text"
                                placeholder="Add Panellist comment..."
                                value={evaluationComments[app.id] !== undefined ? evaluationComments[app.id] : ''}
                                onChange={(e) => handleCommentChange(app.id, e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                              />

                              <button
                                onClick={() => handleSaveStudentEvaluation(app, livePanel.id)}
                                disabled={isSaving}
                                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all disabled:opacity-50 flex items-center gap-1 shadow-md cursor-pointer"
                              >
                                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Submit Score'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-white/10">
              <button
                onClick={() => setLivePanel(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
              >
                Close Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          MODAL: CREATE / EDIT GD PANEL
      ───────────────────────────────────────────────────────── */}
      {panelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-2xl space-y-5 animate-scale-in" style={glassCard}>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-base text-slate-100">
                {editingPanel ? 'Edit GD Panel' : 'Create New GD Panel'}
              </h3>
              <button onClick={() => setPanelModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">GD Panel Name *</label>
                <input
                  type="text"
                  placeholder="e.g. GD Panel Alpha, Room 101"
                  value={panelName}
                  onChange={(e) => setPanelName(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Venue / Location</label>
                <input
                  type="text"
                  placeholder="e.g. Seminar Hall A, Ground Floor"
                  value={panelVenue}
                  onChange={(e) => setPanelVenue(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Time Slot</label>
                <input
                  type="text"
                  placeholder="e.g. 10:00 AM - 11:30 AM"
                  value={panelTimeSlot}
                  onChange={(e) => setPanelTimeSlot(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Assign Panellists (Members)</label>
                <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-slate-900/80 border border-slate-700/80">
                  {users.map((u) => {
                    const isSelected = selectedPanellistIds.includes(u.uid);
                    return (
                      <div
                        key={u.uid}
                        onClick={() =>
                          setSelectedPanellistIds((prev) =>
                            isSelected ? prev.filter((id) => id !== u.uid) : [...prev, u.uid]
                          )
                        }
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                          isSelected ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40' : 'hover:bg-white/5 text-slate-300'
                        }`}
                      >
                        <span className="font-semibold">{u.displayName}</span>
                        {isSelected && <CheckCircle className="w-4 h-4 text-indigo-400" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setPanelModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePanel}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : editingPanel ? 'Update Panel' : 'Create Panel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          MODAL: CREATE CUSTOM RUBRIC
      ───────────────────────────────────────────────────────── */}
      {rubricModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-2xl space-y-5 animate-scale-in" style={glassCard}>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-base text-slate-100">Create Custom Rubric</h3>
              <button onClick={() => setRubricModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Rubric Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Communication & Articulation"
                  value={rubricTitle}
                  onChange={(e) => setRubricTitle(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description / Guidelines</label>
                <textarea
                  placeholder="Describe evaluation criteria for panellists..."
                  value={rubricDesc}
                  onChange={(e) => setRubricDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Maximum Marks</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={rubricMaxMarks}
                    onChange={(e) => setRubricMaxMarks(Number(e.target.value))}
                    className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-indigo-500 font-bold text-center"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Category</label>
                  <select
                    value={rubricCategory}
                    onChange={(e) => setRubricCategory(e.target.value as any)}
                    className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-indigo-500"
                  >
                    <option value="gd">Group Discussion (GD)</option>
                    <option value="interview">Interview</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setRubricModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRubric}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md disabled:opacity-50"
              >
                {actionLoading ? 'Creating...' : 'Save Rubric'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          MODAL: AUTO ALLOCATION CAPACITY & DISTRIBUTION CONFIG
      ───────────────────────────────────────────────────────── */}
      {autoAllocateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-2xl space-y-5 animate-scale-in" style={glassCard}>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-slate-100">Auto Allocate to GD Panels</h3>
              </div>
              <button onClick={() => setAutoAllocateModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Active Metrics Overview */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/80 grid grid-cols-2 gap-3 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">Total Active Applicants</span>
                  <p className="text-base font-bold text-slate-200">{activeApplications.length}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">Available GD Panels</span>
                  <p className="text-base font-bold text-indigo-300">{gdPanels.length}</p>
                </div>
              </div>

              {/* Strategy Selection */}
              <div className="space-y-2">
                <label className="block text-slate-300 font-semibold">Allocation Strategy</label>

                <label
                  onClick={() => setAllocationMode('capacity')}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    allocationMode === 'capacity' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200' : 'bg-slate-900/60 border-slate-700/60 text-slate-400'
                  }`}
                >
                  <div>
                    <p className="font-bold text-xs">Specify Max Capacity per GD Panel</p>
                    <p className="text-[10px] opacity-80">Limit candidates per GD panel (remaining candidates will be evenly distributed)</p>
                  </div>
                  <input
                    type="radio"
                    name="allocMode"
                    checked={allocationMode === 'capacity'}
                    onChange={() => setAllocationMode('capacity')}
                    className="accent-indigo-500"
                  />
                </label>

                <label
                  onClick={() => setAllocationMode('equal')}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    allocationMode === 'equal' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200' : 'bg-slate-900/60 border-slate-700/60 text-slate-400'
                  }`}
                >
                  <div>
                    <p className="font-bold text-xs">Equal Round-Robin Distribution</p>
                    <p className="text-[10px] opacity-80">Balance all candidates equally across all GD panels without a fixed limit</p>
                  </div>
                  <input
                    type="radio"
                    name="allocMode"
                    checked={allocationMode === 'equal'}
                    onChange={() => setAllocationMode('equal')}
                    className="accent-indigo-500"
                  />
                </label>
              </div>

              {/* Capacity Input field if capacity strategy selected */}
              {allocationMode === 'capacity' && (
                <div className="space-y-1.5 p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20">
                  <label className="block text-slate-200 font-semibold">
                    Max Applicants per GD Panel:
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={maxPerPanelInput}
                      onChange={(e) => setMaxPerPanelInput(Math.max(1, Number(e.target.value)))}
                      className="w-24 bg-slate-900 border border-indigo-500/50 rounded-xl px-3 py-2 text-center font-bold text-sm text-indigo-200 outline-none"
                    />
                    <span className="text-[11px] text-slate-300">
                      candidates / panel
                    </span>
                  </div>
                  <p className="text-[10px] text-indigo-300/80 mt-1">
                    * If total candidates exceed {gdPanels.length * maxPerPanelInput}, the remaining candidates will be distributed evenly among all panels.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setAutoAllocateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAutoAllocateGD}
                disabled={actionLoading}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {actionLoading ? 'Allocating...' : 'Start Auto Allocation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
