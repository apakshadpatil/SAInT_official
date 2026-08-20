import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeApplications, updateApplicationStatus, archiveApplication, deleteApplication } from '../../services/applicationService';
import { logActivity } from '../../services/activityService';
import type { ClubApplication } from '../../types';
import RightPanel from '../../components/ui/RightPanel';
import {
  Download,
  Search,
  Eye,
  Filter,
  CheckCircle,
  Clock,
  Briefcase,
  User,
  Archive,
  Trash2,
  X,
} from 'lucide-react';

// Helper to derive academic year
function getAcademicYear(createdAtStr: string): string {
  if (!createdAtStr) return 'Unknown';
  const date = new Date(createdAtStr);
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 is January, 5 is June
  if (month >= 5) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

export default function ManageApplicationsPage() {
  const { profile } = useAuth();
  const [applications, setApplications] = useState<ClubApplication[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [selectedApp, setSelectedApp] = useState<ClubApplication | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');

  useEffect(() => {
    const unsub = subscribeApplications(setApplications);
    return () => unsub();
  }, []);

  // Compute unique academic years from data to populate filter
  const activeApplications = applications.filter((app) => !app.archivedAt);
  const academicYears = Array.from(
    new Set(activeApplications.map((app) => getAcademicYear(app.createdAt)))
  ).sort((a, b) => b.localeCompare(a));

  // Filter application list
  const filteredApps = activeApplications.filter((app) => {
    const appYear = getAcademicYear(app.createdAt);
    const matchesYear = yearFilter === 'all' || appYear === yearFilter;
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    
    const query = search.toLowerCase();
    const fullName = `${app.firstName} ${app.lastName}`.toLowerCase();
    const matchesSearch =
      fullName.includes(query) ||
      app.email.toLowerCase().includes(query) ||
      app.rbtNumber.toLowerCase().includes(query) ||
      app.department.toLowerCase().includes(query);

    return matchesYear && matchesStatus && matchesSearch;
  });

  const selectedApps = activeApplications.filter((app) => selectedIds.has(app.id));
  const allVisibleSelected = filteredApps.length > 0 && filteredApps.every((app) => selectedIds.has(app.id));

  const toggleApplicationSelection = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleVisibleSelection = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        filteredApps.forEach((app) => next.delete(app.id));
      } else {
        filteredApps.forEach((app) => next.add(app.id));
      }
      return next;
    });
  };

  // Export functions
  const handleExportCSV = async () => {
    if (!profile) return;
    try {
      const headers = ['RBT Number', 'First Name', 'Last Name', 'Email', 'Phone', 'Department', 'Academic Year', 'Interested Sections', 'Status', 'Applied At', 'Allocated Panel'];
      const rows = filteredApps.map((app) => [
        app.rbtNumber,
        app.firstName,
        app.lastName,
        app.email,
        app.phone,
        app.department,
        getAcademicYear(app.createdAt),
        app.sections.join('; '),
        app.status,
        app.createdAt,
        app.panelName || 'None',
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `saint_applications_${yearFilter}_${statusFilter}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await logActivity(
        profile.uid,
        profile.displayName,
        profile.email,
        'export_applications_csv',
        `Exported ${filteredApps.length} applications to CSV (Year: ${yearFilter}, Status: ${statusFilter})`
      );
    } catch (err) {
      console.error(err);
      setMessage('Failed to export CSV');
    }
  };

  const handleExportJSON = async () => {
    if (!profile) return;
    try {
      const dataStr = JSON.stringify(filteredApps, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

      const link = document.createElement('a');
      link.setAttribute('href', dataUri);
      link.setAttribute('download', `saint_applications_${yearFilter}_${statusFilter}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await logActivity(
        profile.uid,
        profile.displayName,
        profile.email,
        'export_applications_json',
        `Exported ${filteredApps.length} applications to JSON (Year: ${yearFilter}, Status: ${statusFilter})`
      );
    } catch (err) {
      console.error(err);
      setMessage('Failed to export JSON');
    }
  };

  const handleStatusChange = async (id: string, newStatus: ClubApplication['status']) => {
    if (!profile) return;
    try {
      await updateApplicationStatus(id, newStatus);
      const targetApp = applications.find((a) => a.id === id);
      const name = targetApp ? `${targetApp.firstName} ${targetApp.lastName}` : 'Applicant';
      
      // Sync local dialog view state
      if (selectedApp && selectedApp.id === id) {
        setSelectedApp({ ...selectedApp, status: newStatus });
      }

      await logActivity(
        profile.uid,
        profile.displayName,
        profile.email,
        'update_application_status',
        `Updated application status of ${name} to "${newStatus}"`
      );
      setMessage(`Updated application status to ${newStatus}`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Failed to update status');
    }
  };

  const handleArchive = async (app: ClubApplication) => {
    if (!profile || !window.confirm(`Archive the application from ${app.firstName} ${app.lastName}? It can be restored later.`)) return;
    try {
      await archiveApplication(app.id, profile.uid);
      await logActivity(profile.uid, profile.displayName, profile.email, 'archive_application', `Archived application from ${app.firstName} ${app.lastName}`);
      setSelectedApp(null);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(app.id);
        return next;
      });
      setMessage('Application archived. You can restore it from Archived Applications.');
    } catch (err) {
      console.error(err);
      setMessage('Could not archive application');
    }
  };

  const handleDelete = async (app: ClubApplication) => {
    if (!profile || !window.confirm(`Permanently delete the application from ${app.firstName} ${app.lastName}? This cannot be undone.`)) return;
    try {
      await deleteApplication(app.id);
      await logActivity(profile.uid, profile.displayName, profile.email, 'delete_application', `Permanently deleted application from ${app.firstName} ${app.lastName}`);
      setSelectedApp(null);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(app.id);
        return next;
      });
      setMessage('Application permanently deleted.');
    } catch (err) {
      console.error(err);
      setMessage('Could not delete application');
    }
  };

  const handleBulkArchive = async () => {
    if (!profile || selectedApps.length === 0) return;
    if (!window.confirm(`Archive ${selectedApps.length} selected application${selectedApps.length === 1 ? '' : 's'}? They can be restored later.`)) return;
    try {
      await Promise.all(selectedApps.map((app) => archiveApplication(app.id, profile.uid)));
      await logActivity(profile.uid, profile.displayName, profile.email, 'bulk_archive_applications', `Archived ${selectedApps.length} applications from the management queue`);
      setSelectedIds(new Set());
      setMessage(`${selectedApps.length} application${selectedApps.length === 1 ? '' : 's'} archived.`);
    } catch (err) {
      console.error(err);
      setMessage('Some applications could not be archived. Please try again.');
    }
  };

  const handleBulkDelete = async () => {
    if (!profile || selectedApps.length === 0) return;
    if (!window.confirm(`Permanently delete ${selectedApps.length} selected application${selectedApps.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    try {
      await Promise.all(selectedApps.map((app) => deleteApplication(app.id)));
      await logActivity(profile.uid, profile.displayName, profile.email, 'bulk_delete_applications', `Permanently deleted ${selectedApps.length} applications from the management queue`);
      setSelectedIds(new Set());
      setMessage(`${selectedApps.length} application${selectedApps.length === 1 ? '' : 's'} permanently deleted.`);
    } catch (err) {
      console.error(err);
      setMessage('Some applications could not be deleted. Please try again.');
    }
  };

  const getStatusBadge = (status: ClubApplication['status']) => {
    switch (status) {
      case 'submitted':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'reviewed':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'interview_scheduled':
        return 'bg-green-500/10 text-green-400 border border-green-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>Manage Club Applications</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>
            Review apply forms, filter by academic cycle, assign interview status, and export applicant data.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            disabled={filteredApps.length === 0}
            className="btn-outline !py-2 !px-3.5 !text-xs flex items-center gap-1.5 hover:bg-slate-700/30"
          >
            <Download className="w-3.5 h-3.5" /> CSV Export
          </button>
          <button
            onClick={handleExportJSON}
            disabled={filteredApps.length === 0}
            className="btn-outline !py-2 !px-3.5 !text-xs flex items-center gap-1.5 hover:bg-slate-700/30"
          >
            <Download className="w-3.5 h-3.5" /> JSON Export
          </button>
        </div>
      </div>

      {message && <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 text-sm border border-blue-500/20">{message}</div>}

      {/* Filters Control Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl border bg-black/10" style={{ borderColor: 'var(--dash-border)' }}>
        {/* Search */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, RBT, or dept..."
            className="input-field !pl-9 !text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Academic Year Filter */}
        <div className="relative flex items-center">
          <Filter className="w-4 h-4 absolute left-3 text-slate-400" />
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="input-field !pl-9 !text-xs"
          >
            <option value="all">All Academic Cycles</option>
            {academicYears.map((yr) => (
              <option key={yr} value={yr}>Academic Year {yr}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="relative flex items-center">
          <Clock className="w-4 h-4 absolute left-3 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field !pl-9 !text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="reviewed">Reviewed</option>
            <option value="interview_scheduled">Interview Scheduled</option>
          </select>
        </div>
      </div>

      {selectedApps.length > 0 && (
        <div className="dash-card !p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-amber-400/20">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--dash-text)' }}>
            <span className="dash-badge !py-1">{selectedApps.length}</span>
            application{selectedApps.length === 1 ? '' : 's'} selected
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleBulkArchive} className="btn-outline !py-2 !px-3 !text-xs border-amber-500/50 text-amber-300 hover:bg-amber-500/10">
              <Archive className="w-3.5 h-3.5" /> Archive selected
            </button>
            <button onClick={handleBulkDelete} className="btn-outline !py-2 !px-3 !text-xs border-red-500/50 text-red-300 hover:bg-red-500/10">
              <Trash2 className="w-3.5 h-3.5" /> Delete selected
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="btn-ghost !p-2" title="Clear selection" aria-label="Clear selection">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Applications Data Table */}
      <div className="dash-card border overflow-hidden" style={{ borderColor: 'var(--dash-border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b text-[10px] uppercase font-bold tracking-wider" style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-muted)' }}>
                <th className="py-3 px-3 w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleVisibleSelection}
                    className="w-4 h-4 accent-blue-500 cursor-pointer"
                    aria-label={allVisibleSelected ? 'Clear visible application selection' : 'Select all visible applications'}
                  />
                </th>
                <th className="py-3 px-4">Applicant</th>
                <th className="py-3 px-4">RBT Number</th>
                <th className="py-3 px-4">Academic Cycle</th>
                <th className="py-3 px-4">Applied Sections</th>
                <th className="py-3 px-4">Allocated Panel</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y">
              {filteredApps.map((app) => (
                <tr key={app.id} className="hover:bg-black/5" style={{ color: 'var(--dash-text)' }}>
                  <td className="py-3 px-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(app.id)}
                      onChange={() => toggleApplicationSelection(app.id)}
                      className="w-4 h-4 accent-blue-500 cursor-pointer"
                      aria-label={`Select ${app.firstName} ${app.lastName}`}
                    />
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="font-semibold">{app.firstName} {app.lastName}</span>
                    <p className="text-[10px]" style={{ color: 'var(--dash-muted)' }}>{app.email}</p>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold" style={{ color: 'var(--dash-text)' }}>{app.rbtNumber}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{getAcademicYear(app.createdAt)}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {app.sections.map((s) => (
                        <span key={s} className="text-[9px] capsule-tag !py-0.5">{s.replace('_', ' ').toUpperCase()}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {app.panelName ? (
                      <span className="text-[10px] text-blue-400 font-semibold flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5" /> {app.panelName}
                      </span>
                    ) : (
                      <span className="text-[10px] italic" style={{ color: 'var(--dash-muted)' }}>Unallocated</span>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${getStatusBadge(app.status)}`}>
                      {app.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      <button
                        onClick={() => setSelectedApp(app)}
                        className="btn-ghost !p-2 text-blue-300"
                        title={`Inspect ${app.firstName} ${app.lastName}'s application`}
                        aria-label={`Inspect ${app.firstName} ${app.lastName}'s application`}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleArchive(app)}
                        className="btn-ghost !p-2 text-amber-300 hover:!text-amber-200"
                        title={`Archive ${app.firstName} ${app.lastName}'s application`}
                        aria-label={`Archive ${app.firstName} ${app.lastName}'s application`}
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(app)}
                        className="btn-ghost !p-2 text-red-300 hover:!text-red-200"
                        title={`Delete ${app.firstName} ${app.lastName}'s application`}
                        aria-label={`Delete ${app.firstName} ${app.lastName}'s application`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredApps.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 italic">
                    No matching applications found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Side Drawer Modal */}
      {selectedApp && (
        <RightPanel open={!!selectedApp} onClose={() => setSelectedApp(null)} title="Application Details" width="620px">
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--dash-border)' }}>
              <h3 className="font-bold text-sm flex items-center gap-1.5" style={{ color: 'var(--dash-text)' }}>
                <User className="w-4 h-4 text-blue-400" /> Application Details
              </h3>
              <button
                onClick={() => setSelectedApp(null)}
                className="text-slate-400 hover:text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 text-xs" style={{ color: 'var(--dash-text)' }}>
              {/* Profile Block */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="block text-[10px] uppercase font-bold" style={{ color: 'var(--dash-muted)' }}>Name</span>
                  <p className="font-semibold text-sm">{selectedApp.firstName} {selectedApp.lastName}</p>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] uppercase font-bold" style={{ color: 'var(--dash-muted)' }}>RBT Number</span>
                  <p className="font-mono font-bold">{selectedApp.rbtNumber}</p>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] uppercase font-bold" style={{ color: 'var(--dash-muted)' }}>Email</span>
                  <p>{selectedApp.email}</p>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] uppercase font-bold" style={{ color: 'var(--dash-muted)' }}>Phone</span>
                  <p>{selectedApp.phone}</p>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] uppercase font-bold" style={{ color: 'var(--dash-muted)' }}>Department</span>
                  <p>{selectedApp.department}</p>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] uppercase font-bold" style={{ color: 'var(--dash-muted)' }}>Academic Cycle</span>
                  <p>{getAcademicYear(selectedApp.createdAt)}</p>
                </div>
              </div>

              {/* Status & Panel Block */}
              <div className="p-3.5 rounded-xl border bg-black/20 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--dash-border)' }}>
                <div>
                  <span className="block text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--dash-muted)' }}>Interview Panel</span>
                  {selectedApp.panelName ? (
                    <span className="text-blue-400 font-semibold flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5" /> {selectedApp.panelName}
                    </span>
                  ) : (
                    <span className="text-[10px] italic" style={{ color: 'var(--dash-muted)' }}>No panel assigned yet</span>
                  )}
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--dash-muted)' }}>Status State</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${getStatusBadge(selectedApp.status)}`}>
                    {selectedApp.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Applied Sections Skills */}
              <div className="space-y-2">
                <span className="block text-[10px] uppercase font-bold" style={{ color: 'var(--dash-muted)' }}>Interested Sections & Skills</span>
                <div className="space-y-2">
                  {selectedApp.sections.map((sec) => (
                    <div key={sec} className="bg-black/10 border p-3 rounded-xl" style={{ borderColor: 'var(--dash-border)' }}>
                      <span className="capsule-tag">{sec.replace('_', ' ').toUpperCase()}</span>
                      <p className="mt-1.5 italic text-slate-300">
                        &quot;{selectedApp.sectionSkills[sec] || 'No skill description provided.'}&quot;
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Motivation */}
              <div>
                <span className="block text-[10px] uppercase font-bold" style={{ color: 'var(--dash-muted)' }}>Why do you want to join SAInT?</span>
                <div className="bg-black/20 p-3 rounded-xl border mt-1 leading-relaxed text-slate-300" style={{ borderColor: 'var(--dash-border)' }}>
                  {selectedApp.reason || 'No statement provided.'}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t pt-4 flex flex-wrap gap-2 justify-end" style={{ borderColor: 'var(--dash-border)' }}>
                <button
                  type="button"
                  onClick={() => handleStatusChange(selectedApp.id, 'reviewed')}
                  disabled={selectedApp.status === 'reviewed'}
                  className={`btn-outline !py-2 !px-3.5 !text-xs flex items-center gap-1 ${
                    selectedApp.status === 'reviewed' ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5 text-blue-400" /> Mark Reviewed
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(selectedApp.id, 'interview_scheduled')}
                  disabled={selectedApp.status === 'interview_scheduled'}
                  className={`btn-primary !py-2 !px-3.5 !text-xs flex items-center gap-1 ${
                    selectedApp.status === 'interview_scheduled' ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5 text-green-400" /> Schedule Interview
                </button>
                <button
                  type="button"
                  onClick={() => handleArchive(selectedApp)}
                  className="btn-outline !py-2 !px-3.5 !text-xs flex items-center gap-1 border-amber-500/50 text-amber-300 hover:bg-amber-500/10"
                >
                  <Archive className="w-3.5 h-3.5" /> Archive
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(selectedApp)}
                  className="btn-outline !py-2 !px-3.5 !text-xs flex items-center gap-1 border-red-500/50 text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          </div>
        </RightPanel>
      )}
    </div>
  );
}
