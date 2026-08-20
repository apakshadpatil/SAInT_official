import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { subscribePanels } from '../../services/interviewService';
import { archiveApplication, deleteApplication, subscribeApplications } from '../../services/applicationService';
import { subscribeApplicationRating, submitRating, getApplicationRating } from '../../services/ratingService';
import { logActivity } from '../../services/activityService';
import type { InterviewPanel, ClubApplication, ApplicationRating } from '../../types';
import { isSuperAdmin, isCoreMember } from '../../utils/permissions';
import { Trophy, Users, Layers, Printer, CheckCircle2, XCircle, UserCheck, Archive, Trash2, Star } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import PanelRatingCard from '../../components/ui/PanelRatingCard';

type AppStatus = ClubApplication['status'] | 'selected' | 'not_selected';

export default function InterviewAllocationsPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [panels, setPanels] = useState<InterviewPanel[]>([]);
  const [applications, setApplications] = useState<ClubApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [appRatings, setAppRatings] = useState<Record<string, ApplicationRating | null>>({});
  
  /* Rating modal state */
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [selectedAppForRating, setSelectedAppForRating] = useState<ClubApplication | null>(null);
  const [applicationRating, setApplicationRating] = useState<ApplicationRating | null>(null);
  const [ratingSubscription, setRatingSubscription] = useState<(() => void) | null>(null);

  const canEdit = isSuperAdmin(profile) || isCoreMember(profile);

  useEffect(() => {
    const unsubPanels = subscribePanels(setPanels);
    const unsubApps = subscribeApplications((apps) => {
      setApplications(apps);
      setLoading(false);
      
      // Fetch ratings for all applications
      const fetchRatings = async () => {
        const ratings: Record<string, ApplicationRating | null> = {};
        for (const app of apps) {
          try {
            const rating = await getApplicationRating(app.id);
            ratings[app.id] = rating;
          } catch (err) {
            console.error(`Failed to fetch rating for app ${app.id}:`, err);
          }
        }
        setAppRatings(ratings);
      };
      
      fetchRatings();
    });
    return () => { unsubPanels(); unsubApps(); };
  }, []);

  const activeApplications = applications.filter((application) => !application.archivedAt);
  const assignedApplications = activeApplications.filter((a) => a.panelId || a.panelIds?.length);
  const panelAppMap: Record<string, ClubApplication[]> = {};
  for (const app of assignedApplications) {
    const panelIds = app.panelIds?.length ? app.panelIds : app.panelId ? [app.panelId] : [];
    for (const panelId of panelIds) {
      if (!panelAppMap[panelId]) panelAppMap[panelId] = [];
      panelAppMap[panelId].push(app);
    }
  }

  const handleMark = async (appId: string, status: AppStatus) => {
    setUpdatingId(appId);
    try {
      await updateDoc(doc(db, 'applications', appId), { status });
      showToast(status === 'selected' ? 'Marked as selected!' : 'Marked as not selected.', status === 'selected' ? 'success' : 'info');
    } catch (err) {
      showToast('Failed to update status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleArchive = async (application: ClubApplication) => {
    if (!profile || !window.confirm(`Archive ${application.firstName} ${application.lastName}'s application? It can be restored from Archived Applications.`)) return;
    setUpdatingId(application.id);
    try {
      await archiveApplication(application.id, profile.uid);
      await logActivity(profile.uid, profile.displayName, profile.email, 'archive_application', `Archived application from ${application.firstName} ${application.lastName} from final interview allocations`);
      showToast(`${application.firstName} ${application.lastName}'s application was archived.`, 'success');
    } catch {
      showToast('Failed to archive application', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (application: ClubApplication) => {
    if (!profile || !window.confirm(`Permanently delete ${application.firstName} ${application.lastName}'s application? This cannot be undone.`)) return;
    setUpdatingId(application.id);
    try {
      await deleteApplication(application.id);
      await logActivity(profile.uid, profile.displayName, profile.email, 'delete_application', `Permanently deleted application from ${application.firstName} ${application.lastName} from final interview allocations`);
      showToast(`${application.firstName} ${application.lastName}'s application was deleted.`, 'success');
    } catch {
      showToast('Failed to delete application', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  /* Rating handlers */
  const handleOpenRating = (application: ClubApplication) => {
    setSelectedAppForRating(application);
    setRatingModalOpen(true);
    
    // Subscribe to ratings for this application
    if (ratingSubscription) ratingSubscription();
    const unsub = subscribeApplicationRating(application.id, setApplicationRating);
    setRatingSubscription(() => unsub);
  };

  const handleCloseRating = () => {
    setRatingModalOpen(false);
    setSelectedAppForRating(null);
    if (ratingSubscription) {
      ratingSubscription();
      setRatingSubscription(null);
    }
  };

  const handleSubmitRating = async (rating: number, comment?: string) => {
    if (!profile || !selectedAppForRating) return;
    try {
      await submitRating(
        selectedAppForRating.id,
        selectedAppForRating.panelId!,
        selectedAppForRating.panelName || 'Unknown Panel',
        profile.uid,
        profile.displayName,
        rating,
        comment
      );
      await logActivity(
        profile.uid,
        profile.displayName,
        profile.email,
        'submit_rating',
        `Submitted rating of ${rating}/5 for ${selectedAppForRating.firstName} ${selectedAppForRating.lastName}`
      );
      showToast('Rating submitted successfully!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to submit rating', 'error');
      throw err;
    }
  };

  const stats = [
    { label: 'Total Assigned', value: assignedApplications.length, icon: Users, color: '#3b82f6' },
    { label: 'Active Panels', value: panels.length, icon: Layers, color: '#8b5cf6' },
    { label: 'Unassigned', value: activeApplications.filter((a) => !a.panelId).length, icon: UserCheck, color: '#f59e0b' },
    { label: 'Selected', value: activeApplications.filter((a) => (a.status as AppStatus) === 'selected').length, icon: CheckCircle2, color: '#10b981' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(59,130,246,0.14)', color: '#3b82f6' }}
            >
              <Trophy className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>Final Interview Allocations</h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>
            Finalize panel assignments and mark interview outcomes.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{
            background: 'var(--dash-card)',
            border: '1px solid var(--dash-border)',
            color: 'var(--dash-text)',
          }}
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="dash-card animate-fade-in-up"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>{label}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + '18', color }}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold" style={{ color: 'var(--dash-text)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Panel allocations */}
      {panels.length === 0 ? (
        <div
          className="dash-card text-center py-16"
        >
          <Layers className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--dash-muted)' }} />
          <p className="font-semibold" style={{ color: 'var(--dash-text)' }}>No panels created yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>Go to Interview Panels to create and allocate panels.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {panels.map((panel, idx) => {
            const panelApps = panelAppMap[panel.id] || [];
            return (
              <div
                key={panel.id}
                className="dash-card animate-fade-in-up"
                style={{ animationDelay: `${idx * 0.06}s` }}
              >
                {/* Panel header */}
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--dash-text)' }}>{panel.name}</h2>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {panel.sections.map((s) => (
                        <span key={s} className="dash-badge">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs" style={{ color: 'var(--dash-muted)' }}>Interviewers</span>
                    <div className="flex flex-wrap gap-1 mt-1 justify-end">
                      {panel.interviewerNames.map((name) => (
                        <span key={name} className="badge-info" style={{ marginLeft: '4px' }}>{name}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <hr style={{ borderColor: 'var(--dash-border)' }} className="mb-4" />

                {panelApps.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: 'var(--dash-muted)' }}>No applicants assigned to this panel yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="dash-table">
                      <thead>
                        <tr>
                          <th>Applicant</th>
                          <th>RBT No.</th>
                          <th>Applied Sections</th>
                          <th>GD Details</th>
                          <th>Avg Rating</th>
                          <th>Status</th>
                          {canEdit && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {panelApps.map((app) => {
                          const st = app.status as AppStatus;
                          return (
                            <tr key={app.id}>
                              <td>
                                <p className="font-medium" style={{ color: 'var(--dash-text)' }}>
                                  {app.firstName} {app.lastName}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>{app.email}</p>
                              </td>
                              <td>
                                <span className="font-mono text-xs" style={{ color: 'var(--dash-text)' }}>{app.rbtNumber}</span>
                              </td>
                              <td>
                                <div className="flex flex-wrap gap-1">
                                  {app.sections.map((s) => (
                                    <span key={s} className="dash-badge text-xs">{s}</span>
                                  ))}
                                </div>
                              </td>
                              <td>
                                {app.gdPanelName ? (
                                  <div>
                                    <span className="badge-info text-xs">{app.gdPanelName}</span>
                                    {app.gdScore !== undefined && (
                                      <p className="text-[10px] font-bold text-indigo-400 mt-0.5">
                                        Score: {app.gdScore} / {app.gdMaxScore || 40}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs" style={{ color: 'var(--dash-muted)' }}>-</span>
                                )}
                              </td>
                              <td>
                                <div className="flex items-center gap-2">
                                  {appRatings[app.id] && appRatings[app.id]?.averageRating ? (
                                    <>
                                      <Star className="w-4 h-4" style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                                      <span className="font-semibold" style={{ color: 'var(--dash-text)' }}>
                                        {appRatings[app.id]!.averageRating.toFixed(1)} / 5
                                      </span>
                                      <span className="text-xs" style={{ color: 'var(--dash-muted)' }}>
                                        ({appRatings[app.id]!.totalRaters})
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-xs" style={{ color: 'var(--dash-muted)' }}>No ratings yet</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                {st === 'selected' ? (
                                  <span className="badge-success">Selected</span>
                                ) : st === 'not_selected' ? (
                                  <span className="badge-error">Not Selected</span>
                                ) : st === 'interview_scheduled' ? (
                                  <span className="badge-warning">Scheduled</span>
                                ) : (
                                  <span className="badge-info">{st}</span>
                                )}
                              </td>
                              {canEdit && (
                                <td>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleMark(app.id, 'selected')}
                                      disabled={updatingId === app.id || st === 'selected'}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                      style={{
                                        background: st === 'selected' ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.08)',
                                        color: '#10b981',
                                        border: '1px solid rgba(16,185,129,0.2)',
                                        opacity: updatingId === app.id ? 0.5 : 1,
                                      }}
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      Select
                                    </button>
                                    <button
                                      onClick={() => handleMark(app.id, 'not_selected')}
                                      disabled={updatingId === app.id || st === 'not_selected'}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                      style={{
                                        background: st === 'not_selected' ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
                                        color: '#ef4444',
                                        border: '1px solid rgba(239,68,68,0.2)',
                                        opacity: updatingId === app.id ? 0.5 : 1,
                                      }}
                                    >
                                      <XCircle className="w-3 h-3" />
                                      Reject
                                    </button>
                                    <button
                                      onClick={() => handleOpenRating(app)}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                      style={{
                                        background: 'rgba(251,191,36,0.08)',
                                        color: '#f59e0b',
                                        border: '1px solid rgba(251,191,36,0.2)',
                                      }}
                                      title={`Rate ${app.firstName} ${app.lastName}`}
                                    >
                                      <Star className="w-3 h-3" />
                                      Rate
                                    </button>
                                    <button
                                      onClick={() => handleArchive(app)}
                                      disabled={updatingId === app.id}
                                      className="flex items-center justify-center p-1.5 rounded-lg transition-all"
                                      style={{ background: 'rgba(245,158,11,0.08)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)', opacity: updatingId === app.id ? 0.5 : 1 }}
                                      title={`Archive ${app.firstName} ${app.lastName}`}
                                      aria-label={`Archive ${app.firstName} ${app.lastName}`}
                                    >
                                      <Archive className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(app)}
                                      disabled={updatingId === app.id}
                                      className="flex items-center justify-center p-1.5 rounded-lg transition-all"
                                      style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', opacity: updatingId === app.id ? 0.5 : 1 }}
                                      title={`Delete ${app.firstName} ${app.lastName}`}
                                      aria-label={`Delete ${app.firstName} ${app.lastName}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Unassigned applicants */}
      {activeApplications.filter((a) => !a.panelId).length > 0 && (
        <div className="dash-card">
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--dash-text)' }}>⚠️ Unassigned Applicants</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--dash-muted)' }}>These applicants have not been assigned to any panel. Go to Interview Panels to run auto-allocation.</p>
          <div className="overflow-x-auto">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>RBT No.</th>
                  <th>Applied Sections</th>
                  <th>Avg Rating</th>
                  <th>Dept</th>
                  {canEdit && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {activeApplications.filter((a) => !a.panelId).map((app) => (
                  <tr key={app.id}>
                    <td>
                      <p className="font-medium" style={{ color: 'var(--dash-text)' }}>{app.firstName} {app.lastName}</p>
                      <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>{app.email}</p>
                    </td>
                    <td><span className="font-mono text-xs">{app.rbtNumber}</span></td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {app.sections.map((s) => <span key={s} className="dash-badge" style={{ marginLeft: '2px' }}>{s}</span>)}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {appRatings[app.id] && appRatings[app.id]?.averageRating ? (
                          <>
                            <Star className="w-4 h-4" style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                            <span className="font-semibold text-sm" style={{ color: 'var(--dash-text)' }}>
                              {appRatings[app.id]!.averageRating.toFixed(1)} / 5
                            </span>
                            <span className="text-xs" style={{ color: 'var(--dash-muted)' }}>
                              ({appRatings[app.id]!.totalRaters})
                            </span>
                          </>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--dash-muted)' }}>No ratings</span>
                        )}
                      </div>
                    </td>
                    <td style={{ color: 'var(--dash-muted)' }}>{app.department}</td>
                    {canEdit && (
                      <td>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleArchive(app)}
                            disabled={updatingId === app.id}
                            className="flex items-center justify-center p-1.5 rounded-lg transition-all"
                            style={{ background: 'rgba(245,158,11,0.08)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)', opacity: updatingId === app.id ? 0.5 : 1 }}
                            title={`Archive ${app.firstName} ${app.lastName}`}
                            aria-label={`Archive ${app.firstName} ${app.lastName}`}
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(app)}
                            disabled={updatingId === app.id}
                            className="flex items-center justify-center p-1.5 rounded-lg transition-all"
                            style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', opacity: updatingId === app.id ? 0.5 : 1 }}
                            title={`Delete ${app.firstName} ${app.lastName}`}
                            aria-label={`Delete ${app.firstName} ${app.lastName}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {ratingModalOpen && selectedAppForRating && profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl max-h-screen overflow-y-auto rounded-2xl bg-white shadow-xl">
            {/* Modal Header */}
            <div className="sticky top-0 flex items-center justify-between border-b bg-white p-6">
              <h2 className="text-xl font-bold text-slate-900">Rate Application</h2>
              <button
                onClick={handleCloseRating}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <PanelRatingCard
                applicationId={selectedAppForRating.id}
                applicationName={`${selectedAppForRating.firstName} ${selectedAppForRating.lastName}`}
                panelId={selectedAppForRating.panelId || ''}
                panelName={selectedAppForRating.panelName || 'Unknown Panel'}
                currentPanellistId={profile.uid}
                currentPanellistName={profile.displayName}
                rating={applicationRating}
                onSubmit={handleSubmitRating}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

