import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAllUsers, approveUser, rejectUser, removeUser, updateUserProfile } from '../../services/authService';
import { getPositions, createPosition, assignPosition } from '../../services/positionService';
import { logActivity } from '../../services/activityService';
import type { UserProfile, PositionRecord } from '../../types';
import { getRoleBadge } from '../../utils/permissions';
import { Clock, Mail, Phone, Users, Check, X } from 'lucide-react';
import VerifiedBadge from '../../components/ui/VerifiedBadge';
import { CardSkeleton, TableSkeleton, DataStateWrapper } from '../../components/ui/skeleton';

export default function UserApprovalsPage() {
  const { profile: approver } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [positions, setPositions] = useState<PositionRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Local state for approval forms indexed by user ID
  const [approvalRoles, setApprovalRoles] = useState<Record<string, 'member' | 'core'>>({});
  const [approvalPositions, setApprovalPositions] = useState<Record<string, string>>({});
  const [newPositionTitles, setNewPositionTitles] = useState<Record<string, string>>({});
  const [financeAccess, setFinanceAccess] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    setLoadingData(true);
    setError('');
    try {
      const [allUsers, allPositions] = await Promise.all([
        getAllUsers(true),
        getPositions(true),
      ]);
      setUsers(allUsers);
      setPositions(allPositions);
    } catch (err) {
      console.error('User approvals load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoadingData(false);
    }
  };

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (uid: string, userDisplayName: string) => {
    if (!approver) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const selectedRole = approvalRoles[uid] || 'member';
      const hasFinance = financeAccess[uid] || false;
      let posId = approvalPositions[uid] || '';
      const newPosTitle = newPositionTitles[uid] || '';

      // 1. Handle on-the-fly position creation if selected
      if (posId === 'new') {
        if (!newPosTitle.trim()) {
          throw new Error('Please specify a title for the new position.');
        }
        // Create position
        posId = await createPosition(newPosTitle.trim(), 'Created during member approval');
        await logActivity(
          approver.uid,
          approver.displayName,
          approver.email,
          'create_position',
          `Created new position "${newPosTitle}" on-the-fly during user approval`
        );
      }

      // 2. Approve user (sets status, base role, base permissions)
      await approveUser(uid, selectedRole, approver.uid);

      // 3. Update finance access
      if (hasFinance) {
        await updateUserProfile(uid, { hasFinanceAccess: true });
      }

      // 4. Assign position if selected
      let finalPosTitle = '';
      if (posId) {
        await assignPosition(posId, uid);
        const posRecord = positions.find((p) => p.id === posId) || { title: newPosTitle };
        finalPosTitle = posRecord.title;
      }

      // 5. Log action
      await logActivity(
        approver.uid,
        approver.displayName,
        approver.email,
        'approve_user',
        `Approved ${userDisplayName} as ${selectedRole === 'core' ? 'Core' : 'Member'}${
          finalPosTitle ? ` with position "${finalPosTitle}"` : ''
        }${hasFinance ? ' (with finance access)' : ''}`
      );

      setSuccess(`Successfully approved ${userDisplayName}!`);
      
      // Reset form states
      setApprovalRoles((prev) => { const c = { ...prev }; delete c[uid]; return c; });
      setApprovalPositions((prev) => { const c = { ...prev }; delete c[uid]; return c; });
      setNewPositionTitles((prev) => { const c = { ...prev }; delete c[uid]; return c; });
      setFinanceAccess((prev) => { const c = { ...prev }; delete c[uid]; return c; });

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (uid: string, userDisplayName: string) => {
    if (!approver || !window.confirm(`Reject the registration request from ${userDisplayName}?`)) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await rejectUser(uid);
      await logActivity(
        approver.uid,
        approver.displayName,
        approver.email,
        'reject_user',
        `Rejected registration request from ${userDisplayName}`
      );
      setSuccess(`Rejected application from ${userDisplayName}.`);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (uid: string, userDisplayName: string) => {
    if (!approver || !window.confirm(`Remove ${userDisplayName} from the club? This will revoke dashboard access.`)) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await removeUser(uid);
      await logActivity(
        approver.uid,
        approver.displayName,
        approver.email,
        'remove_user',
        `Removed user ${userDisplayName} from the club`
      );
      setSuccess(`Removed ${userDisplayName} from active members list.`);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Removal failed');
    } finally {
      setLoading(false);
    }
  };

  const pendingRequests = users.filter((u) => u.status === 'pending' && u.role !== 'superadmin');
  const approvedUsers = users.filter((u) => u.status === 'approved' && u.role !== 'superadmin');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>User Approvals & Audits</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>
          Approve new member sign-ups, customize their privileges, and assign roles & positions on-the-fly.
        </p>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-500/10 text-red-500 text-sm mb-4 border border-red-500/20">{error}</div>}
      {success && <div className="p-3 rounded-xl bg-green-500/10 text-green-500 text-sm mb-4 border border-green-500/20">{success}</div>}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left Column: Pending Sign-up Requests */}
        <div className="space-y-4">
          <h2 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
            <Clock className="w-4 h-4 text-amber-500" /> Pending Sign-up Requests ({pendingRequests.length})
          </h2>

          <DataStateWrapper
            loading={loadingData}
            isEmpty={pendingRequests.length === 0}
            emptyTitle="No pending registration requests"
            emptyDescription="There are currently no sign-up requests awaiting approval."
            skeleton={<CardSkeleton count={3} />}
          >
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {pendingRequests.map((u) => {
                const currentRole = approvalRoles[u.uid] || 'member';
                const currentPos = approvalPositions[u.uid] || '';
                const newTitle = newPositionTitles[u.uid] || '';
                const hasFinance = financeAccess[u.uid] || false;

                return (
                  <div
                    key={u.uid}
                    className="dash-card p-5 border flex flex-col justify-between gap-4"
                    style={{ borderColor: 'var(--dash-border)' }}
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt="" className="w-10 h-10 rounded-full object-cover border" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-sm text-slate-700">
                            {u.firstName?.[0] || u.displayName?.[0]}
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-sm flex items-center" style={{ color: 'var(--dash-text)' }}>
                            <span>{u.displayName}</span>
                            <VerifiedBadge user={u} />
                          </h3>
                          <span className="text-[10px]" style={{ color: 'var(--dash-muted)' }}>Batch: {u.batchYear || 'N/A'}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] mt-3" style={{ color: 'var(--dash-muted)' }}>
                        <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {u.email}</span>
                        {u.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {u.phone}</span>}
                      </div>
                      {u.description && (
                        <p className="text-[11px] mt-2 italic leading-relaxed" style={{ color: 'var(--dash-muted)' }}>
                          &quot;{u.description}&quot;
                        </p>
                      )}

                      {/* Inline Approvals Configuration Panel */}
                      <div className="mt-4 p-4 rounded-xl space-y-4 border bg-black/10" style={{ borderColor: 'var(--dash-border)' }}>
                        <p className="text-xs font-semibold" style={{ color: 'var(--dash-text)' }}>Privileges & Position</p>
                        
                        <div className="grid grid-cols-2 gap-3">
                          {/* Role Select */}
                          <div>
                            <label className="block text-[10px] mb-1 uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>Role</label>
                            <select
                              className="input-field !py-1.5 !px-2 !text-xs"
                              value={currentRole}
                              onChange={(e) => setApprovalRoles({ ...approvalRoles, [u.uid]: e.target.value as 'member' | 'core' })}
                            >
                              <option value="member">Member</option>
                              <option value="core">Core Team</option>
                            </select>
                          </div>

                          {/* Position Select */}
                          <div>
                            <label className="block text-[10px] mb-1 uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>Position</label>
                            <select
                              className="input-field !py-1.5 !px-2 !text-xs"
                              value={currentPos}
                              onChange={(e) => setApprovalPositions({ ...approvalPositions, [u.uid]: e.target.value })}
                            >
                              <option value="">No Position</option>
                              {positions.map((p) => (
                                <option key={p.id} value={p.id}>{p.title}</option>
                              ))}
                              <option value="new">+ Create New Position</option>
                            </select>
                          </div>
                        </div>

                        {/* On-The-Fly Position Creator */}
                        {currentPos === 'new' && (
                          <div className="pt-2">
                            <label className="block text-[10px] mb-1 uppercase tracking-wider text-amber-500 font-bold">New Position Title</label>
                            <input
                              type="text"
                              className="input-field !py-1.5 !px-2 !text-xs"
                              placeholder="e.g. Lead Designer"
                              value={newTitle}
                              onChange={(e) => setNewPositionTitles({ ...newPositionTitles, [u.uid]: e.target.value })}
                            />
                          </div>
                        )}

                        {/* Finance Permission Toggle */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                          <div>
                            <span className="block text-xs font-medium" style={{ color: 'var(--dash-text)' }}>Finance Tab Access</span>
                            <span className="block text-[10px]" style={{ color: 'var(--dash-muted)' }}>Allow access to Manage Financials</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={hasFinance}
                            onChange={(e) => setFinanceAccess({ ...financeAccess, [u.uid]: e.target.checked })}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => handleApprove(u.uid, u.displayName)}
                        disabled={loading}
                        className="btn-primary !py-2 !px-3 !text-xs flex-1 flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve Registration
                      </button>
                      <button
                        onClick={() => handleReject(u.uid, u.displayName)}
                        disabled={loading}
                        className="btn-outline border-red-500 text-red-500 hover:bg-red-500/10 !py-2 !px-3 !text-xs flex items-center justify-center gap-1.5 shrink-0"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </DataStateWrapper>
        </div>

        {/* Right Column: Approved Members Directory */}
        <div className="space-y-4">
          <h2 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
            <Users className="w-4 h-4 text-blue-500" /> Active Association Members ({approvedUsers.length})
          </h2>

          <DataStateWrapper
            loading={loadingData}
            isEmpty={approvedUsers.length === 0}
            emptyTitle="No active members"
            emptyDescription="No active members registered yet."
            skeleton={<TableSkeleton rows={5} cols={2} hasSearch={false} />}
          >
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {approvedUsers.map((u) => (
                <div
                  key={u.uid}
                  className="dash-card p-4 border flex items-center justify-between gap-4"
                  style={{ borderColor: 'var(--dash-border)' }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {u.photoURL ? (
                      <img src={u.photoURL} alt="" className="w-10 h-10 rounded-full object-cover shrink-0 border" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-sm text-slate-700 shrink-0">
                        {u.firstName?.[0] || u.displayName?.[0]}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-semibold text-xs truncate" style={{ color: 'var(--dash-text)' }}>{u.displayName}</h3>
                      <p className="text-[10px] truncate" style={{ color: 'var(--dash-muted)' }}>{u.email}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[9px] capsule-tag !py-0.5">{getRoleBadge(u)}</span>
                        {u.hasFinanceAccess && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">Finance</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemove(u.uid, u.displayName)}
                    disabled={loading}
                    className="btn-outline border-red-500 text-red-500 hover:bg-red-500/10 !py-1.5 !px-3 !text-[11px] shrink-0"
                  >
                    Revoke Access
                  </button>
                </div>
              ))}
            </div>
          </DataStateWrapper>
        </div>
      </div>
    </div>
  );
}
