import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAllUsers, updateUserPermissions, updateUserRole } from '../../services/authService';
import type { UserProfile, SidebarPermissions, UserRole } from '../../types';
import { getRoleBadge } from '../../utils/permissions';
import { ShieldAlert, Save, Search, ShieldCheck } from 'lucide-react';
import Toggle from '../../components/ui/Toggle';
import VerifiedBadge from '../../components/ui/VerifiedBadge';
import { useToast } from '../../contexts/ToastContext';

export default function AccessControlPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [search, setSearch] = useState('');
  
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  // Local state for editing permissions
  const [editedPerms, setEditedPerms] = useState<SidebarPermissions | null>(null);
  const [hasFinanceAccess, setHasFinanceAccess] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Exclude<UserRole, 'pending'> | null>(null);

  const fetchUsers = async () => {
    try {
      const all = await getAllUsers();
      setUsers(all.filter((u) => u.status === 'approved' && u.uid !== profile?.uid));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [profile?.uid]);

  const selectUserForEdit = (user: UserProfile) => {
    setSelectedUser(user);
    setEditedPerms({ ...user.permissions });
    setHasFinanceAccess(user.hasFinanceAccess || false);
    setSelectedRole(user.role === 'pending' ? 'member' : user.role);
  };

  const handleTogglePerm = (key: keyof SidebarPermissions, checked: boolean) => {
    if (!editedPerms) return;
    setEditedPerms({
      ...editedPerms,
      [key]: checked,
    });
  };

  const filteredUsers = users.filter((u) => {
    const term = search.toLowerCase();
    if (!term) return true;
    return (
      u.displayName?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      getRoleBadge(u).toLowerCase().includes(term)
    );
  });

  const handleSavePermissions = async () => {
    if (!selectedUser || !editedPerms) return;
    setLoading(true);
    try {
      await updateUserPermissions(selectedUser.uid, editedPerms, { hasFinanceAccess });
      showToast('Permissions updated successfully!', 'success');
      await fetchUsers(); // Refresh grid
      
      // Update selected user
      setSelectedUser({
        ...selectedUser,
        permissions: editedPerms,
        hasFinanceAccess,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update permissions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRole = async () => {
    if (!selectedUser || !selectedRole) return;
    setLoading(true);
    try {
      await updateUserRole(selectedUser.uid, selectedRole);
      showToast('User role updated successfully!', 'success');
      await fetchUsers();
      setSelectedUser({
        ...selectedUser,
        role: selectedRole,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update role', 'error');
    } finally {
      setLoading(false);
    }
  };

  const permissionGroups = [
    {
      title: 'Core Pages',
      items: [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'events', label: 'Events' },
        { key: 'calendar', label: 'Calendar' },
        { key: 'agenda', label: 'Agenda & Meetings' },
        { key: 'tasks', label: 'Tasks' },
        { key: 'explore', label: 'Explore' },
        { key: 'qrScanner', label: 'QR Scanner' },
      ],
    },
    {
      title: 'Operations',
      items: [
        { key: 'analytics', label: 'Analytics' },
        { key: 'teams', label: 'Teams' },
        { key: 'files', label: 'Files' },
        { key: 'documentation', label: 'Documentation' },
        { key: 'manageApplications', label: 'Manage Applications' },
        { key: 'interviewPanels', label: 'Interview Panels' },
        { key: 'gdPanels', label: 'GD Panels' },
      ],
    },
    {
      title: 'Admin & Finance',
      items: [
        { key: 'finance', label: 'Finance' },
        { key: 'financialAnalytics', label: 'Financial Analytics' },
        { key: 'controlCentre', label: 'Control Centre' },
        { key: 'positions', label: 'Positions' },
        { key: 'userApprovals', label: 'User Approvals' },
        { key: 'accessControl', label: 'Access Control' },
        { key: 'monitorActivity', label: 'Monitor Activity' },
        { key: 'homeImages', label: 'Landing Images' },
        { key: 'profile', label: 'Profile' },
      ],
    },
  ] as const;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--dash-border)', background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(15,23,42,0.05))' }}>
        <div className="flex items-start gap-3">
          <div className="rounded-xl p-2" style={{ background: 'rgba(59,130,246,0.15)' }}>
            <ShieldCheck className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>Access Control Command Center</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>Grant or revoke every dashboard page and capability with full precision.</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column: User directory grid */}
        <div className="lg:col-span-1">
          <div className="dash-card p-6 h-full flex flex-col justify-between" style={{ background: 'var(--dash-card)', border: '1px solid var(--dash-card-border)', backdropFilter: 'blur(24px)' }}>
            <div>
              <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--dash-text)' }}>Approved Members</h3>
              <div className="relative mb-3">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  className="input-field !pl-10 !py-2.5"
                  placeholder="Search by name, email, role"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {filteredUsers.map((u) => (
                  <div
                    key={u.uid}
                    onClick={() => selectUserForEdit(u)}
                    className={`p-3 border rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all hover:bg-slate-500/5 ${
                      selectedUser?.uid === u.uid ? 'border-blue-500 bg-blue-500/5' : ''
                    }`}
                    style={{ borderColor: selectedUser?.uid === u.uid ? 'var(--dash-accent)' : 'var(--dash-border)' }}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-xs truncate flex items-center" style={{ color: 'var(--dash-text)' }}>
                        <span className="truncate">{u.displayName}</span>
                        <VerifiedBadge user={u} />
                      </p>
                      <p className="text-[10px] truncate" style={{ color: 'var(--dash-muted)' }}>{u.email}</p>
                      <span className="text-[9px] capsule-tag !py-0.5 mt-1">{getRoleBadge(u)}</span>
                    </div>
                  </div>
                ))}

                {filteredUsers.length === 0 && (
                  <p className="text-xs text-center py-12" style={{ color: 'var(--dash-muted)' }}>No members found matching your search.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Permissions editor */}
        <div className="lg:col-span-2">
          <div className="dash-card p-6 min-h-[450px]" style={{ background: 'var(--dash-card)', border: '1px solid var(--dash-card-border)', backdropFilter: 'blur(24px)' }}>
            <h3 className="font-bold text-sm mb-6" style={{ color: 'var(--dash-text)' }}>Permissions Manager</h3>

            {!selectedUser || !editedPerms ? (
              <div className="text-center py-20 text-slate-400">
                <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>Select a member from the directory grid to manage their permissions</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-base flex items-center" style={{ color: 'var(--dash-text)' }}>
                    <span>{selectedUser.displayName}</span>
                    <VerifiedBadge user={selectedUser} />
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedUser.email} · {getRoleBadge(selectedUser)}</p>
                </div>



                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4 py-4 border-y" style={{ borderColor: 'var(--dash-border)' }}>
                  <div className="xl:col-span-1 space-y-4">
                    <div>
                      <h5 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-3">Role Assignment</h5>
                      <select
                        value={selectedRole ?? ''}
                        onChange={(e) => setSelectedRole(e.target.value as Exclude<UserRole, 'pending'>)}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                        style={{
                          background: 'var(--dash-input-bg)',
                          border: '1px solid var(--dash-input-border)',
                          color: 'var(--dash-text)',
                        }}
                      >
                        <option value="member">Club Member</option>
                        <option value="core">Core Member</option>
                        <option value="superadmin">Super Admin</option>
                      </select>
                    </div>

                    <button
                      onClick={handleSaveRole}
                      disabled={loading || !selectedRole || selectedRole === selectedUser.role}
                      className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all"
                      style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}
                    >
                      {loading ? 'Saving role...' : 'Save Role'}
                    </button>
                  </div>

                  {permissionGroups.map((group) => (
                    <div key={group.title} className="space-y-3">
                      <h5 className="font-bold text-xs text-slate-400 uppercase tracking-wider">{group.title}</h5>
                      {group.items.map((item) => (
                        <Toggle
                          key={item.key}
                          checked={editedPerms[item.key as keyof SidebarPermissions]}
                          onChange={(val) => handleTogglePerm(item.key as keyof SidebarPermissions, val)}
                          label={item.label}
                        />
                      ))}
                    </div>
                  ))}

                  <div className="md:col-span-2 xl:col-span-1 pt-2 border-t md:border-t-0 xl:border-t-0" style={{ borderColor: 'var(--dash-border)' }}>
                    <h5 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-3">Finance Access</h5>
                    <Toggle
                      checked={hasFinanceAccess}
                      onChange={setHasFinanceAccess}
                      label="Finance Operations"
                      description="Enables financial ledger entry, billing audits, and analytics"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSavePermissions}
                  disabled={loading}
                  className="btn-primary w-full !py-3 flex items-center justify-center gap-2"
                  style={{ boxShadow: 'none' }}
                >
                  <Save className="w-4 h-4" /> {loading ? 'Saving adjustments...' : 'Save Privileges'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
