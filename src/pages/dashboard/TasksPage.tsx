import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  subscribeUserTasks,
  subscribeAllTasks,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
} from '../../services/taskService';
import { getAllUsers } from '../../services/authService';
import type { TaskRecord, TaskPriority, UserProfile } from '../../types';
import { isCoreMember } from '../../utils/permissions';
import { fileToDataUrl } from '../../utils/fileUtils';
import { uploadFileToSupabase } from '../../utils/supabase';
import {
  Calendar,
  Plus,
  FileText,
  Download,
  CheckCircle2,
  Clock,
  Search,
  LayoutGrid,
  List,
  Award,
  ChevronRight,
  Layers,
} from 'lucide-react';
import RightPanel from '../../components/ui/RightPanel';
import { useToast } from '../../contexts/ToastContext';

const PRIORITY_THEMES: Record<TaskPriority, { label: string; text: string; bg: string; border: string }> = {
  urgent: { label: 'Urgent', text: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)' },
  high:   { label: 'High',   text: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.2)' },
  medium: { label: 'Medium', text: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.2)' },
  low:    { label: 'Low',    text: '#8b949e', bg: 'rgba(139, 148, 158, 0.08)', border: 'rgba(139, 148, 158, 0.2)' },
};

export default function TasksPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);

  // Form State (Assign Task)
  const [isAssigning, setIsAssigning] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [points, setPoints] = useState(10);
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Member Task Completion Proof Upload State
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofError, setProofError] = useState('');

  // Filters & Controls
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (!profile) return;
    const unsub = isCoreMember(profile)
      ? subscribeAllTasks(setTasks)
      : subscribeUserTasks(profile.uid, setTasks);

    if (isCoreMember(profile)) {
      getAllUsers()
        .then((users) => {
          setAllUsers(users.filter((u) => u.status === 'approved'));
        })
        .catch(console.error);
    }
    return unsub;
  }, [profile]);

  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !assigneeId || !taskTitle.trim()) return;

    const assignee = allUsers.find((u) => u.uid === assigneeId);
    if (!assignee) return;

    setSubmittingAssign(true);
    try {
      await createTask({
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        assigneeId,
        assigneeName: assignee.displayName,
        assignedBy: profile.uid,
        assignedByName: profile.displayName,
        deadline,
        priority,
        points: Number(points) || 10,
      });
      showToast('Task assigned successfully.', 'success');
      setIsAssigning(false);
      resetAssignForm();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to assign task', 'error');
    } finally {
      setSubmittingAssign(false);
    }
  };

  const handleUnassignTask = async (id: string) => {
    if (!window.confirm('Are you sure you want to unassign (delete) this task?')) return;
    try {
      await deleteTask(id);
      setSelectedTask(null);
      showToast('Task unassigned and removed.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete task', 'error');
    }
  };

  const handleCompleteTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    setSubmittingProof(true);
    setProofError('');

    try {
      let dataUrl: string | undefined;
      let fileName: string | undefined;

      if (proofFile) {
        fileName = proofFile.name;
        const dest = `proofs/${selectedTask.id}_${Date.now()}_${proofFile.name.replace(/\s+/g, '_')}`;
        try {
          dataUrl = await uploadFileToSupabase(proofFile, dest, 'banners');
        } catch (e) {
          console.warn('Supabase proof upload failed, falling back to data URL:', e);
          const fileResult = await fileToDataUrl(proofFile);
          dataUrl = fileResult.dataUrl;
        }
      }

      await completeTask(selectedTask.id, dataUrl, fileName);
      showToast(`Task completed! +${selectedTask.points} points awarded.`, 'success');
      setSelectedTask(null);
      setProofFile(null);
    } catch (err) {
      setProofError(err instanceof Error ? err.message : 'Failed to submit proof');
      showToast('Submission error occurred.', 'error');
    } finally {
      setSubmittingProof(false);
    }
  };

  const handleDownloadProof = (task: TaskRecord) => {
    if (!task.proofDataUrl) return;
    if (task.proofDataUrl.startsWith('http://') || task.proofDataUrl.startsWith('https://')) {
      window.open(task.proofDataUrl, '_blank');
      return;
    }
    const link = document.createElement('a');
    link.href = task.proofDataUrl;
    link.download = task.proofFileName || 'task_proof';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateTaskField = async (id: string, data: Partial<TaskRecord>) => {
    try {
      await updateTask(id, data);
      if (selectedTask && selectedTask.id === id) {
        setSelectedTask({ ...selectedTask, ...data });
      }
      showToast('Task updated successfully.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update task', 'error');
    }
  };

  const resetAssignForm = () => {
    setTaskTitle('');
    setTaskDesc('');
    setAssigneeId('');
    setDeadline('');
    setPriority('medium');
    setPoints(10);
  };

  // Metrics
  const totalTasks = tasks.length;
  const pendingTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const totalPoints = tasks.reduce((sum, t) => sum + (t.points || 0), 0);
  const earnedPoints = completedTasks.reduce((sum, t) => sum + (t.points || 0), 0);

  // Filtered List
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Status filter
      if (statusFilter === 'pending' && t.status === 'completed') return false;
      if (statusFilter === 'completed' && t.status !== 'completed') return false;

      // Priority filter
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchAssignee = t.assigneeName?.toLowerCase().includes(q);
        const matchAssigner = t.assignedByName?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchAssignee && !matchAssigner) return false;
      }

      return true;
    });
  }, [tasks, statusFilter, priorityFilter, searchQuery]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Tasks Management</h1>
          <p className="page-header-sub">
            {isCoreMember(profile)
              ? 'Assign, govern, and review member contributions & task milestones'
              : 'Complete your assigned objectives to earn points and advance the club'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div
            className="flex border"
            style={{
              borderColor: 'var(--dash-border)',
              borderRadius: '6px',
              overflow: 'hidden',
              background: 'var(--dash-card)',
            }}
          >
            <button
              onClick={() => setViewMode('grid')}
              className="p-2 transition-colors"
              title="Grid View"
              style={{
                background: viewMode === 'grid' ? 'var(--dash-accent-soft)' : 'transparent',
                color: viewMode === 'grid' ? 'var(--dash-accent)' : 'var(--dash-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className="p-2 transition-colors"
              title="List View"
              style={{
                background: viewMode === 'list' ? 'var(--dash-accent-soft)' : 'transparent',
                color: viewMode === 'list' ? 'var(--dash-accent)' : 'var(--dash-muted)',
                border: 'none',
                cursor: 'pointer',
                borderLeft: '1px solid var(--dash-border)',
              }}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {isCoreMember(profile) && (
            <button onClick={() => setIsAssigning(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              <span>Assign Task</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Stats Metric Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="stat-card-accent-bar" style={{ background: 'var(--dash-accent)' }} />
          <div className="flex items-start justify-between mt-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                Total Tasks
              </p>
              <p className="text-3xl font-black mt-1 tabular-nums" style={{ color: 'var(--dash-text)' }}>
                {totalTasks}
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--dash-muted)' }}>
                All assigned records
              </p>
            </div>
            <div
              className="w-9 h-9 flex items-center justify-center shrink-0"
              style={{ background: 'var(--dash-accent-soft)', borderRadius: '6px' }}
            >
              <Layers className="w-4 h-4" style={{ color: 'var(--dash-accent)' }} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-accent-bar" style={{ background: '#3b82f6' }} />
          <div className="flex items-start justify-between mt-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                In Progress
              </p>
              <p className="text-3xl font-black mt-1 tabular-nums" style={{ color: '#3b82f6' }}>
                {pendingTasks.length}
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--dash-muted)' }}>
                Awaiting delivery
              </p>
            </div>
            <div
              className="w-9 h-9 flex items-center justify-center shrink-0"
              style={{ background: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px' }}
            >
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-accent-bar" style={{ background: '#10b981' }} />
          <div className="flex items-start justify-between mt-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                Completed
              </p>
              <p className="text-3xl font-black mt-1 tabular-nums" style={{ color: '#10b981' }}>
                {completedTasks.length}
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--dash-muted)' }}>
                Approved & verified
              </p>
            </div>
            <div
              className="w-9 h-9 flex items-center justify-center shrink-0"
              style={{ background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px' }}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-accent-bar" style={{ background: '#f59e0b' }} />
          <div className="flex items-start justify-between mt-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                Points Pool
              </p>
              <p className="text-3xl font-black mt-1 tabular-nums" style={{ color: '#f59e0b' }}>
                {isCoreMember(profile) ? totalPoints : earnedPoints}
                <span className="text-xs font-semibold ml-1" style={{ color: 'var(--dash-muted)' }}>
                  {isCoreMember(profile) ? 'pts' : `/ ${totalPoints} pts`}
                </span>
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--dash-muted)' }}>
                {isCoreMember(profile) ? 'Allocated score total' : 'Your earned score'}
              </p>
            </div>
            <div
              className="w-9 h-9 flex items-center justify-center shrink-0"
              style={{ background: 'rgba(245, 158, 11, 0.1)', borderRadius: '6px' }}
            >
              <Award className="w-4 h-4 text-amber-500" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs & Filter Bar ── */}
      <div
        className="dash-card !p-3 flex flex-col md:flex-row md:items-center justify-between gap-3"
        style={{ borderRadius: '6px' }}
      >
        {/* Status Tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
              statusFilter === 'pending'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={{
              background: statusFilter === 'pending' ? 'var(--dash-accent)' : 'transparent',
              color: statusFilter === 'pending' ? '#ffffff' : 'var(--dash-muted)',
              borderRadius: '4px',
            }}
          >
            Pending ({pendingTasks.length})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
              statusFilter === 'completed'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={{
              background: statusFilter === 'completed' ? 'var(--dash-accent)' : 'transparent',
              color: statusFilter === 'completed' ? '#ffffff' : 'var(--dash-muted)',
              borderRadius: '4px',
            }}
          >
            Completed ({completedTasks.length})
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={{
              background: statusFilter === 'all' ? 'var(--dash-accent)' : 'transparent',
              color: statusFilter === 'all' ? '#ffffff' : 'var(--dash-muted)',
              borderRadius: '4px',
            }}
          >
            All Tasks ({totalTasks})
          </button>
        </div>

        {/* Search & Priority Filter */}
        <div className="flex items-center gap-2 flex-1 md:max-w-md md:justify-end">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--dash-muted)' }} />
            <input
              type="text"
              placeholder="Search tasks, members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="dash-input !pl-8 !py-1.5 !text-xs !w-full"
              style={{ borderRadius: '4px' }}
            />
          </div>

          <div className="w-32 shrink-0">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="dash-input !py-1.5 !px-2.5 !text-xs !w-full"
              style={{ borderRadius: '4px' }}
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Tasks View (Grid or List) ── */}
      {viewMode === 'grid' ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredTasks.map((task) => {
            const pTheme = PRIORITY_THEMES[task.priority] || PRIORITY_THEMES.medium;
            const isCompleted = task.status === 'completed';

            return (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className="dash-card cursor-pointer flex flex-col justify-between group transition-all duration-150"
                style={{
                  borderRadius: '6px',
                  borderColor: 'var(--dash-card-border)',
                }}
              >
                <div>
                  {/* Card Header Tag Row */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5"
                        style={{
                          background: pTheme.bg,
                          color: pTheme.text,
                          border: `1px solid ${pTheme.border}`,
                          borderRadius: '4px',
                        }}
                      >
                        {pTheme.label}
                      </span>

                      {isCompleted && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 flex items-center gap-1"
                          style={{
                            background: 'rgba(16, 185, 129, 0.08)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            borderRadius: '4px',
                          }}
                        >
                          <CheckCircle2 className="w-2.5 h-2.5" /> Done
                        </span>
                      )}
                    </div>

                    <span
                      className="text-[11px] font-extrabold px-2 py-0.5"
                      style={{
                        background: 'rgba(245, 158, 11, 0.08)',
                        color: '#f59e0b',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        borderRadius: '4px',
                      }}
                    >
                      +{task.points} pts
                    </span>
                  </div>

                  {/* Task Title & Description */}
                  <h3
                    className="font-bold text-sm leading-snug line-clamp-1 group-hover:text-blue-500 transition-colors"
                    style={{ color: 'var(--dash-text)' }}
                  >
                    {task.title}
                  </h3>
                  <p
                    className="text-xs line-clamp-2 leading-relaxed mt-1.5"
                    style={{ color: 'var(--dash-muted)' }}
                  >
                    {task.description || 'No additional description provided.'}
                  </p>
                </div>

                {/* Card Footer */}
                <div
                  className="flex items-center justify-between pt-3 mt-4 border-t text-xs"
                  style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-muted)' }}
                >
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--dash-accent)' }} />
                    <span className="font-medium">Due {task.deadline || 'No date'}</span>
                  </div>

                  {isCoreMember(profile) ? (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 truncate max-w-[130px]"
                      style={{
                        background: 'var(--dash-hover)',
                        color: 'var(--dash-text)',
                        borderRadius: '3px',
                        border: '1px solid var(--dash-border)',
                      }}
                    >
                      @{task.assigneeName || 'Unassigned'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium" style={{ color: 'var(--dash-muted)' }}>
                      By {task.assignedByName || 'Core'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {filteredTasks.length === 0 && (
            <div
              className="col-span-full py-16 text-center dash-card border-dashed flex flex-col items-center justify-center"
              style={{ borderRadius: '6px' }}
            >
              <FileText className="w-8 h-8 mb-2 opacity-30" style={{ color: 'var(--dash-text)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>
                No tasks match your criteria
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
                Try adjusting your search query or status filter.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* List View */
        <div
          className="dash-card !p-0 overflow-hidden"
          style={{ borderRadius: '6px', borderColor: 'var(--dash-card-border)' }}
        >
          <div className="overflow-x-auto">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Priority</th>
                  <th>Assignee / Assigner</th>
                  <th>Deadline</th>
                  <th>Points</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => {
                  const pTheme = PRIORITY_THEMES[task.priority] || PRIORITY_THEMES.medium;
                  const isCompleted = task.status === 'completed';

                  return (
                    <tr
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="cursor-pointer hover:bg-white/5 transition-colors"
                      style={{ borderBottom: '1px solid var(--dash-border)' }}
                    >
                      <td className="font-semibold text-xs py-3" style={{ color: 'var(--dash-text)' }}>
                        <div className="max-w-xs truncate">{task.title}</div>
                        <div className="text-[10px] font-normal truncate opacity-60 mt-0.5" style={{ color: 'var(--dash-muted)' }}>
                          {task.description}
                        </div>
                      </td>
                      <td>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5"
                          style={{
                            background: pTheme.bg,
                            color: pTheme.text,
                            border: `1px solid ${pTheme.border}`,
                            borderRadius: '4px',
                          }}
                        >
                          {pTheme.label}
                        </span>
                      </td>
                      <td className="text-xs" style={{ color: 'var(--dash-text)' }}>
                        {isCoreMember(profile) ? task.assigneeName : `Assigned by ${task.assignedByName}`}
                      </td>
                      <td className="text-xs font-mono" style={{ color: 'var(--dash-muted)' }}>
                        {task.deadline || '—'}
                      </td>
                      <td className="font-bold text-xs" style={{ color: '#f59e0b' }}>
                        +{task.points} pts
                      </td>
                      <td>
                        {isCompleted ? (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 inline-flex items-center gap-1"
                            style={{
                              background: 'rgba(16, 185, 129, 0.08)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.2)',
                              borderRadius: '4px',
                            }}
                          >
                            <CheckCircle2 className="w-2.5 h-2.5" /> Done
                          </span>
                        ) : (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5"
                            style={{
                              background: 'rgba(59, 130, 246, 0.08)',
                              color: '#3b82f6',
                              border: '1px solid rgba(59, 130, 246, 0.2)',
                              borderRadius: '4px',
                            }}
                          >
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <ChevronRight className="w-4 h-4 ml-auto opacity-40" />
                      </td>
                    </tr>
                  );
                })}

                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10" style={{ color: 'var(--dash-muted)' }}>
                      No tasks found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Assign Task Drawer ── */}
      {isAssigning && (
        <RightPanel open={isAssigning} onClose={() => setIsAssigning(false)} title="Assign New Task" width="460px">
          <form onSubmit={handleAssignTask} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                Task Title *
              </label>
              <input
                className="dash-input"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g. Design Hackathon Poster & Assets"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                Detailed Instructions / Requirements *
              </label>
              <textarea
                className="dash-input min-h-[90px] resize-none"
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="Specify deliverables, formats, and milestones..."
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                Assign To Member *
              </label>
              <select
                className="dash-input"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                required
              >
                <option value="">Select an approved member...</option>
                {allUsers.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName} ({u.role?.toUpperCase()}) — {u.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                  Deadline Date *
                </label>
                <input
                  className="dash-input font-mono text-xs"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                  Award Points *
                </label>
                <input
                  className="dash-input font-mono text-xs"
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                  required
                  min={1}
                  max={500}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                Priority Level
              </label>
              <select
                className="dash-input"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="pt-4 border-t" style={{ borderColor: 'var(--dash-border)' }}>
              <button
                type="submit"
                disabled={submittingAssign}
                className="btn-primary w-full !py-2.5 !text-xs font-bold"
              >
                {submittingAssign ? 'Assigning...' : 'Confirm & Dispatch Task'}
              </button>
            </div>
          </form>
        </RightPanel>
      )}

      {/* ── Task Details & Proof Review Drawer ── */}
      {selectedTask && (
        <RightPanel
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          title="Task Overview"
          width="460px"
        >
          <div className="space-y-5">
            {/* Header info */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[10px] font-bold px-2 py-0.5"
                  style={{
                    background: PRIORITY_THEMES[selectedTask.priority]?.bg || 'transparent',
                    color: PRIORITY_THEMES[selectedTask.priority]?.text || 'var(--dash-text)',
                    border: `1px solid ${PRIORITY_THEMES[selectedTask.priority]?.border || 'var(--dash-border)'}`,
                    borderRadius: '4px',
                  }}
                >
                  {selectedTask.priority.toUpperCase()} PRIORITY
                </span>
                <span
                  className="text-[11px] font-extrabold px-2 py-0.5"
                  style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    color: '#f59e0b',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    borderRadius: '4px',
                  }}
                >
                  +{selectedTask.points} pts reward
                </span>
              </div>
              <h2 className="text-base font-bold leading-snug" style={{ color: 'var(--dash-text)' }}>
                {selectedTask.title}
              </h2>
              <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
                Assigned by <strong style={{ color: 'var(--dash-text)' }}>{selectedTask.assignedByName}</strong>
                {selectedTask.assigneeName && (
                  <span> to <strong style={{ color: 'var(--dash-text)' }}>{selectedTask.assigneeName}</strong></span>
                )}
              </p>
            </div>

            {/* Description */}
            <div
              className="p-3.5 border"
              style={{
                borderColor: 'var(--dash-border)',
                background: 'var(--dash-hover)',
                borderRadius: '6px',
              }}
            >
              <h4 className="font-bold text-xs mb-1" style={{ color: 'var(--dash-text)' }}>
                Requirements & Description
              </h4>
              <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--dash-muted)' }}>
                {selectedTask.description || 'No description entered.'}
              </p>
            </div>

            {/* Meta Grid */}
            <div
              className="grid grid-cols-2 gap-3 p-3 border"
              style={{
                borderColor: 'var(--dash-border)',
                background: 'var(--dash-card)',
                borderRadius: '6px',
              }}
            >
              <div>
                <span className="block text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                  Due Deadline
                </span>
                <strong className="text-xs font-mono" style={{ color: 'var(--dash-text)' }}>
                  {selectedTask.deadline || 'None'}
                </strong>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                  Execution State
                </span>
                <strong
                  className="text-xs capitalize"
                  style={{
                    color: selectedTask.status === 'completed' ? '#10b981' : '#3b82f6',
                  }}
                >
                  {selectedTask.status.replace('_', ' ')}
                </strong>
              </div>
            </div>

            {/* Completion / Proof files section */}
            {selectedTask.status === 'completed' && (
              <div className="pt-2 space-y-2">
                <h4 className="font-bold text-xs" style={{ color: 'var(--dash-text)' }}>
                  Completion Artifact
                </h4>
                {selectedTask.proofDataUrl ? (
                  <button
                    onClick={() => handleDownloadProof(selectedTask)}
                    className="flex items-center gap-2.5 p-3 border w-full text-left transition-all hover:bg-white/5"
                    style={{
                      borderColor: 'var(--dash-border)',
                      background: 'var(--dash-card)',
                      borderRadius: '6px',
                      color: 'var(--dash-text)',
                    }}
                  >
                    <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{selectedTask.proofFileName || 'Proof Document'}</p>
                      <p className="text-[10px]" style={{ color: 'var(--dash-muted)' }}>
                        Click to view or download proof
                      </p>
                    </div>
                    <Download className="w-4 h-4 opacity-60 shrink-0" />
                  </button>
                ) : (
                  <p className="text-xs italic" style={{ color: 'var(--dash-muted)' }}>
                    Marked complete without physical proof attachment.
                  </p>
                )}
              </div>
            )}

            {/* Member View: Upload Proof Form */}
            {selectedTask.status !== 'completed' && selectedTask.assigneeId === profile?.uid && (
              <form
                onSubmit={handleCompleteTask}
                className="pt-4 border-t space-y-3.5"
                style={{ borderColor: 'var(--dash-border)' }}
              >
                <div>
                  <h4 className="font-bold text-xs" style={{ color: 'var(--dash-text)' }}>
                    Submit Completion Proof
                  </h4>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--dash-muted)' }}>
                    Attach your work (PDF, image, doc) to claim your +{selectedTask.points} points.
                  </p>
                </div>

                {proofError && (
                  <div
                    className="p-2.5 text-xs text-red-400 border border-red-500/20"
                    style={{ background: 'rgba(239, 68, 68, 0.08)', borderRadius: '4px' }}
                  >
                    {proofError}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                    Proof Document / Screenshot
                  </label>
                  <input
                    type="file"
                    className="dash-input !py-1.5 !px-2.5 !text-xs"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setProofFile(file);
                    }}
                    required
                  />
                  <span className="text-[10px] mt-1 block" style={{ color: 'var(--dash-muted)' }}>
                    Accepted formats: PDF, PNG, JPG, ZIP (Max 1MB)
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submittingProof}
                  className="btn-primary w-full !py-2.5 !text-xs font-bold"
                >
                  {submittingProof ? 'Uploading & Verifying...' : `Submit Proof & Claim +${selectedTask.points} Pts`}
                </button>
              </form>
            )}

            {/* Core Member actions: Change Priority, deadline, or delete */}
            {isCoreMember(profile) && (
              <div
                className="pt-4 border-t space-y-3.5"
                style={{ borderColor: 'var(--dash-border)' }}
              >
                <h4 className="font-bold text-xs" style={{ color: 'var(--dash-text)' }}>
                  Core Governance
                </h4>

                {selectedTask.status !== 'completed' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                        Update Deadline
                      </label>
                      <input
                        type="date"
                        className="dash-input !py-1.5 !px-2 !text-xs font-mono"
                        value={selectedTask.deadline}
                        onChange={(e) => updateTaskField(selectedTask.id, { deadline: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                        Update Priority
                      </label>
                      <select
                        className="dash-input !py-1.5 !px-2 !text-xs"
                        value={selectedTask.priority}
                        onChange={(e) => updateTaskField(selectedTask.id, { priority: e.target.value as TaskPriority })}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => handleUnassignTask(selectedTask.id)}
                  className="btn-outline w-full !py-2 !text-xs hover:!bg-red-500/10 hover:!border-red-500 hover:!text-red-400 transition-colors"
                  style={{
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    color: '#ef4444',
                    borderRadius: '4px',
                  }}
                >
                  Unassign & Delete Task
                </button>
              </div>
            )}
          </div>
        </RightPanel>
      )}
    </div>
  );
}
