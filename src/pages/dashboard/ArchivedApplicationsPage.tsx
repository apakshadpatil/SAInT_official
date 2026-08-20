import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { deleteApplication, subscribeApplications, unarchiveApplication } from '../../services/applicationService';
import { logActivity } from '../../services/activityService';
import type { ClubApplication } from '../../types';
import RightPanel from '../../components/ui/RightPanel';
import { ArchiveRestore, Eye, Search, Trash2, Archive, X } from 'lucide-react';

export default function ArchivedApplicationsPage() {
  const { profile } = useAuth();
  const [applications, setApplications] = useState<ClubApplication[]>([]);
  const [query, setQuery] = useState('');
  const [selectedApp, setSelectedApp] = useState<ClubApplication | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');

  useEffect(() => subscribeApplications(setApplications), []);

  const archivedApps = applications.filter((app) => app.archivedAt).filter((app) => {
    const search = query.trim().toLowerCase();
    return !search || `${app.firstName} ${app.lastName} ${app.email} ${app.rbtNumber} ${app.department}`.toLowerCase().includes(search);
  });
  const selectedArchivedApps = applications.filter((app) => app.archivedAt && selectedIds.has(app.id));
  const allVisibleSelected = archivedApps.length > 0 && archivedApps.every((app) => selectedIds.has(app.id));

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleVisibleSelection = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) archivedApps.forEach((app) => next.delete(app.id));
      else archivedApps.forEach((app) => next.add(app.id));
      return next;
    });
  };

  const restore = async (app: ClubApplication) => {
    if (!profile) return;
    try {
      await unarchiveApplication(app.id);
      await logActivity(profile.uid, profile.displayName, profile.email, 'unarchive_application', `Restored application from ${app.firstName} ${app.lastName}`);
      setSelectedApp(null);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(app.id);
        return next;
      });
      setMessage('Application restored to the active application queue.');
    } catch (error) {
      console.error(error);
      setMessage('Could not restore the application.');
    }
  };

  const remove = async (app: ClubApplication) => {
    if (!profile || !window.confirm(`Permanently delete ${app.firstName} ${app.lastName}'s archived application? This cannot be undone.`)) return;
    try {
      await deleteApplication(app.id);
      await logActivity(profile.uid, profile.displayName, profile.email, 'delete_application', `Permanently deleted archived application from ${app.firstName} ${app.lastName}`);
      setSelectedApp(null);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(app.id);
        return next;
      });
      setMessage('Archived application permanently deleted.');
    } catch (error) {
      console.error(error);
      setMessage('Could not delete the application.');
    }
  };

  const restoreSelected = async () => {
    if (!profile || selectedArchivedApps.length === 0) return;
    if (!window.confirm(`Restore ${selectedArchivedApps.length} selected application${selectedArchivedApps.length === 1 ? '' : 's'} to the interview queue?`)) return;
    try {
      await Promise.all(selectedArchivedApps.map((app) => unarchiveApplication(app.id)));
      await logActivity(profile.uid, profile.displayName, profile.email, 'bulk_unarchive_applications', `Restored ${selectedArchivedApps.length} archived applications to the interview queue`);
      setSelectedIds(new Set());
      setMessage(`${selectedArchivedApps.length} application${selectedArchivedApps.length === 1 ? '' : 's'} restored.`);
    } catch (error) {
      console.error(error);
      setMessage('Some applications could not be restored. Please try again.');
    }
  };

  const deleteSelected = async () => {
    if (!profile || selectedArchivedApps.length === 0) return;
    if (!window.confirm(`Permanently delete ${selectedArchivedApps.length} selected archived application${selectedArchivedApps.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    try {
      await Promise.all(selectedArchivedApps.map((app) => deleteApplication(app.id)));
      await logActivity(profile.uid, profile.displayName, profile.email, 'bulk_delete_applications', `Permanently deleted ${selectedArchivedApps.length} archived applications`);
      setSelectedIds(new Set());
      setMessage(`${selectedArchivedApps.length} application${selectedArchivedApps.length === 1 ? '' : 's'} permanently deleted.`);
    } catch (error) {
      console.error(error);
      setMessage('Some applications could not be deleted. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}><Archive className="w-6 h-6 text-amber-400" /> Archived Applications</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>Restore applications to the interview queue or permanently remove them.</p>
        </div>
        <span className="dash-badge !py-1.5">{archivedApps.length} archived</span>
      </div>

      {message && <div className="p-3 rounded-xl bg-blue-500/10 text-blue-300 text-sm border border-blue-500/20">{message}</div>}

      <div className="dash-card p-4">
        <label className="relative block max-w-lg">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--dash-muted)' }} />
          <input className="input-field !pl-9 !text-xs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search archived applications..." />
        </label>
      </div>

      {selectedArchivedApps.length > 0 && (
        <div className="dash-card !p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-emerald-400/20">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--dash-text)' }}>
            <span className="dash-badge !py-1">{selectedArchivedApps.length}</span>
            archived application{selectedArchivedApps.length === 1 ? '' : 's'} selected
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={restoreSelected} className="btn-outline !py-2 !px-3 !text-xs border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10"><ArchiveRestore className="w-3.5 h-3.5" /> Restore selected</button>
            <button onClick={deleteSelected} className="btn-outline !py-2 !px-3 !text-xs border-red-500/50 text-red-300 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /> Delete selected</button>
            <button onClick={() => setSelectedIds(new Set())} className="btn-ghost !p-2" title="Clear selection" aria-label="Clear selection"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <div className="dash-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dash-table min-w-[720px]">
            <thead><tr><th className="w-10"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleSelection} className="w-4 h-4 accent-blue-500 cursor-pointer" aria-label={allVisibleSelected ? 'Clear visible archived application selection' : 'Select all visible archived applications'} /></th><th>Applicant</th><th>Department</th><th>Interview status</th><th>Archived on</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {archivedApps.map((app) => (
                <tr key={app.id}>
                  <td><input type="checkbox" checked={selectedIds.has(app.id)} onChange={() => toggleSelection(app.id)} className="w-4 h-4 accent-blue-500 cursor-pointer" aria-label={`Select ${app.firstName} ${app.lastName}`} /></td>
                  <td><p className="font-semibold">{app.firstName} {app.lastName}</p><p className="text-[10px]" style={{ color: 'var(--dash-muted)' }}>{app.email} · {app.rbtNumber}</p></td>
                  <td>{app.department}</td>
                  <td><span className="dash-badge">{app.status.replace('_', ' ')}</span></td>
                  <td>{app.archivedAt ? new Date(app.archivedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td><div className="flex justify-end gap-2"><button onClick={() => setSelectedApp(app)} className="btn-ghost !py-1.5 !px-2 text-blue-300" title="View application"><Eye className="w-4 h-4" /></button><button onClick={() => restore(app)} className="btn-ghost !py-1.5 !px-2 text-emerald-300" title="Unarchive application"><ArchiveRestore className="w-4 h-4" /></button></div></td>
                </tr>
              ))}
              {archivedApps.length === 0 && <tr><td colSpan={6} className="py-14 text-center" style={{ color: 'var(--dash-muted)' }}>No archived applications match this search.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <RightPanel open={!!selectedApp} onClose={() => setSelectedApp(null)} title="Archived Application" width="560px">
        {selectedApp && <div className="space-y-5 text-sm">
          <div><h2 className="text-xl font-bold" style={{ color: 'var(--dash-text)' }}>{selectedApp.firstName} {selectedApp.lastName}</h2><p style={{ color: 'var(--dash-muted)' }}>{selectedApp.email} · {selectedApp.phone}</p></div>
          <div className="grid grid-cols-2 gap-4 text-xs"><div><p style={{ color: 'var(--dash-muted)' }}>RBT Number</p><p className="font-semibold">{selectedApp.rbtNumber}</p></div><div><p style={{ color: 'var(--dash-muted)' }}>Department</p><p className="font-semibold">{selectedApp.department}</p></div><div><p style={{ color: 'var(--dash-muted)' }}>Interview status</p><p className="font-semibold capitalize">{selectedApp.status.replace('_', ' ')}</p></div><div><p style={{ color: 'var(--dash-muted)' }}>Archived on</p><p className="font-semibold">{selectedApp.archivedAt ? new Date(selectedApp.archivedAt).toLocaleString('en-IN') : '—'}</p></div></div>
          <div><p className="text-xs font-semibold mb-2" style={{ color: 'var(--dash-muted)' }}>Interested sections</p><div className="flex flex-wrap gap-2">{selectedApp.sections.map((section) => <span className="dash-badge" key={section}>{section.replace('_', ' ')}</span>)}</div></div>
          <div><p className="text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>Application statement</p><p className="rounded-xl p-3 leading-relaxed bg-black/20">{selectedApp.reason || 'No statement provided.'}</p></div>
          <div className="pt-4 border-t flex flex-wrap gap-2" style={{ borderColor: 'var(--dash-border)' }}><button onClick={() => restore(selectedApp)} className="btn-primary !py-2 !text-xs"><ArchiveRestore className="w-4 h-4" /> Unarchive Application</button><button onClick={() => remove(selectedApp)} className="btn-outline !py-2 !text-xs border-red-500/60 text-red-300 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /> Delete Permanently</button></div>
        </div>}
      </RightPanel>
    </div>
  );
}
