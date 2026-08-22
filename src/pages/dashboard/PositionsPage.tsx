import { useEffect, useState } from 'react';
import {
  subscribePositions,
  createPosition,
  updatePosition,
  deletePosition,
  assignPosition,
  removeFromPosition,
} from '../../services/positionService';
import { getAllUsers } from '../../services/authService';
import type { PositionRecord, UserProfile } from '../../types';
import { Shield, Trash2, ArrowUp, ArrowDown, UserMinus, Plus, UserPlus } from 'lucide-react';
import RightPanel from '../../components/ui/RightPanel';
import { TableSkeleton, DataStateWrapper } from '../../components/ui/skeleton';

export default function PositionsPage() {
  const [positions, setPositions] = useState<PositionRecord[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  
  // Form State (New Position)
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  
  // Assign User State
  const [selectedPositionId, setSelectedPositionId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const unsub = subscribePositions((pos) => {
      setPositions(pos);
      setDataLoading(false);
    });
    getAllUsers().then((users) => {
      setAllUsers(users.filter((u) => u.status === 'approved'));
    }).catch(console.error);
    return unsub;
  }, []);

  const handleCreatePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await createPosition(title, desc);
      setTitle('');
      setDesc('');
      setIsCreating(false);
      setSuccess('Position title created successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create position');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePosition = async (id: string) => {
    if (!window.confirm('Delete this position title? All users holding this title will be unassigned.')) return;
    try {
      await deletePosition(id);
      setSuccess('Position title deleted.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPositionId || !targetUserId) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await assignPosition(selectedPositionId, targetUserId);
      setTargetUserId('');
      setIsAssigning(false);
      setSuccess('Position assigned successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign position');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (posId: string, userId: string) => {
    if (!window.confirm('Remove this member from the position?')) return;
    try {
      await removeFromPosition(posId, userId);
      setSuccess('Member unassigned.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    const newPositions = [...positions];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newPositions.length) return;

    // Swap order
    const temp = newPositions[index].order;
    newPositions[index].order = newPositions[targetIdx].order;
    newPositions[targetIdx].order = temp;

    try {
      await updatePosition(newPositions[index].id, { order: newPositions[index].order });
      await updatePosition(newPositions[targetIdx].id, { order: newPositions[targetIdx].order });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>Positions & Hierarchy</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>Define officer positions, coordinate structure, and allocate user titles</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setIsCreating(true)} className="btn-primary !py-2.5 !px-4 !text-xs">
            <Plus className="w-4 h-4" /> Create New Position
          </button>
          <button onClick={() => setIsAssigning(true)} className="btn-outline !py-2.5 !px-4 !text-xs">
            <UserPlus className="w-4 h-4" /> Assign Title to User
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-500/10 text-red-500 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-xl bg-green-500/10 text-green-600 text-sm">{success}</div>}

      <div className="grid gap-6">
        <div>
          <div className="dash-card p-6 h-full flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-sm mb-6" style={{ color: 'var(--dash-text)' }}>Positions Hierarchy</h3>
              <DataStateWrapper
                loading={dataLoading}
                isEmpty={positions.length === 0}
                emptyTitle="No positions defined"
                emptyDescription="Create position titles to assign to association members."
                skeleton={<TableSkeleton rows={4} cols={2} hasSearch={false} />}
              >
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {positions
                    .sort((a, b) => a.order - b.order)
                    .map((pos, idx) => (
                      <div
                        key={pos.id}
                        className="p-4 border rounded-xl flex flex-col gap-3 bg-slate-500/5 text-xs"
                        style={{ borderColor: 'var(--dash-border)' }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                              <Shield className="w-4 h-4 text-blue-500" />
                            </div>
                            <div>
                              <span className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>{pos.title}</span>
                              {pos.description && <p className="text-[10px] mt-0.5" style={{ color: 'var(--dash-muted)' }}>{pos.description}</p>}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={() => handleReorder(idx, 'up')} disabled={idx === 0} className="p-1.5 rounded bg-slate-200/50 hover:bg-slate-200 dark:bg-slate-800 disabled:opacity-40">
                              <ArrowUp className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                            </button>
                            <button onClick={() => handleReorder(idx, 'down')} disabled={idx === positions.length - 1} className="p-1.5 rounded bg-slate-200/50 hover:bg-slate-200 dark:bg-slate-800 disabled:opacity-40">
                              <ArrowDown className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                            </button>
                            <button onClick={() => handleDeletePosition(pos.id)} className="p-1.5 rounded text-red-500 hover:bg-red-500/10">
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          </div>
                        </div>

                        {/* Holders of this position */}
                        <div className="pt-2 border-t" style={{ borderColor: 'var(--dash-border)' }}>
                          <span className="text-[10px] font-semibold text-slate-400 block mb-2">Assigned Holders:</span>
                          <div className="flex flex-wrap gap-2">
                            {pos.holderIds?.map((uid) => {
                              const u = allUsers.find((user) => user.uid === uid);
                              return (
                                <div key={uid} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px]" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)', color: 'var(--dash-text)' }}>
                                  <span>{u?.displayName || uid}</span>
                                  <button type="button" onClick={() => handleRemoveUser(pos.id, uid)} className="text-red-500 hover:text-red-700 shrink-0">
                                    <UserMinus className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                            {(!pos.holderIds || pos.holderIds.length === 0) && (
                              <span className="text-[10px] italic text-slate-400">Unassigned</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </DataStateWrapper>
            </div>
          </div>
        </div>
      </div>

      <RightPanel open={isCreating} onClose={() => setIsCreating(false)} title="Create a New Position" width="480px">
        <form onSubmit={handleCreatePosition} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Position Title *</label>
            <input className="input-field" placeholder="e.g. Treasurer" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Role Description</label>
            <textarea className="input-field min-h-[100px]" placeholder="Responsibilities, authority, and reporting scope..." value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary w-full !py-3" disabled={loading}>{loading ? 'Creating...' : 'Create Position Title'}</button>
        </form>
      </RightPanel>

      <RightPanel open={isAssigning} onClose={() => setIsAssigning(false)} title="Assign Title to a User" width="480px">
        <form onSubmit={handleAssignUser} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Position Title *</label>
            <select className="input-field" value={selectedPositionId} onChange={(e) => setSelectedPositionId(e.target.value)} required>
              <option value="">Select title...</option>
              {positions.map((pos) => <option key={pos.id} value={pos.id}>{pos.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Target Member *</label>
            <select className="input-field" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} required>
              <option value="">Select member...</option>
              {allUsers.map((u) => <option key={u.uid} value={u.uid}>{u.displayName} ({u.email})</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary w-full !py-3" disabled={loading}>{loading ? 'Assigning...' : 'Assign Position'}</button>
        </form>
      </RightPanel>
    </div>
  );
}
