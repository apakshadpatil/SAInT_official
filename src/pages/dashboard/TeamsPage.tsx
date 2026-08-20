import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeTeams, createTeam, deleteTeam, addMemberToTeam, removeMemberFromTeam } from '../../services/teamService';
import { getAllUsers } from '../../services/authService';
import type { TeamRecord, UserProfile } from '../../types';
import { Plus, Users, Calendar } from 'lucide-react';
import RightPanel from '../../components/ui/RightPanel';

export default function TeamsPage() {
  const { profile } = useAuth();
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamRecord | null>(null);

  // Form State (New Team)
  const [isCreating, setIsCreating] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');

  // Add Member State
  const [targetMemberId, setTargetMemberId] = useState('');

  useEffect(() => {
    const unsub = subscribeTeams(setTeams);
    getAllUsers().then((res) => {
      setAllUsers(res.filter((u) => u.status === 'approved'));
    }).catch(console.error);
    return unsub;
  }, []);

  // Update selected team properties dynamically on state changes
  useEffect(() => {
    if (selectedTeam) {
      const active = teams.find((t) => t.id === selectedTeam.id);
      if (active) {
        setSelectedTeam(active);
      }
    }
  }, [teams]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !teamName) return;

    try {
      await createTeam({
        name: teamName,
        description: teamDesc,
        createdBy: profile.uid,
        createdByName: profile.displayName,
      });
      setIsCreating(false);
      setTeamName('');
      setTeamDesc('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!window.confirm('Delete this team? All member profile tags will be automatically cleared.')) return;
    try {
      await deleteTeam(id);
      setSelectedTeam(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !targetMemberId) return;

    try {
      await addMemberToTeam(selectedTeam.id, targetMemberId);
      setTargetMemberId('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add member');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedTeam) return;
    if (!window.confirm('Remove this member from the team?')) return;
    try {
      await removeMemberFromTeam(selectedTeam.id, memberId);
    } catch (err) {
      console.error(err);
    }
  };

  // Filter users who are not currently in the selected team
  const eligibleMembers = allUsers.filter(
    (u) => selectedTeam && !selectedTeam.memberIds?.includes(u.uid)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>Teams Board</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>Organize association departments, task forces, and sub-committees</p>
        </div>

        <button onClick={() => setIsCreating(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Create Team
        </button>
      </div>

      {/* Teams Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => (
          <div
            key={team.id}
            onClick={() => setSelectedTeam(team)}
            className="dash-card cursor-pointer hover:shadow-lg hover:border-blue-500/20 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <span className="text-[10px] capsule-tag !py-0.5">{team.memberIds?.length || 0} Members</span>
              </div>

              <h3 className="font-bold text-sm leading-snug line-clamp-1 mb-2" style={{ color: 'var(--dash-text)' }}>{team.name}</h3>
              <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--dash-muted)' }}>{team.description}</p>
            </div>

            <div className="flex items-center justify-between pt-4 mt-6 border-t" style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-muted)' }}>
              <div className="flex items-center gap-1.5 text-[9px]">
                <Calendar className="w-3.5 h-3.5" />
                <span>Created: {new Date(team.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              </div>

              <span className="text-[9px] truncate max-w-[120px]">Led: {team.createdByName}</span>
            </div>
          </div>
        ))}

        {teams.length === 0 && (
          <div className="col-span-full py-16 text-center dash-card border-dashed">
            <p style={{ color: 'var(--dash-muted)' }}>No teams registered.</p>
          </div>
        )}
      </div>

      {/* Create Team Drawer */}
      {isCreating && (
        <RightPanel open={isCreating} onClose={() => setIsCreating(false)} title="Create Team Department" width="440px">
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-600 dark:text-slate-400">Team / Department Name *</label>
              <input className="input-field" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Media & Photography" required />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-600 dark:text-slate-400">Description *</label>
              <textarea className="input-field min-h-[80px]" value={teamDesc} onChange={(e) => setTeamDesc(e.target.value)} placeholder="Objectives of this department..." required />
            </div>

            <button type="submit" className="btn-primary w-full !py-3">Create Team</button>
          </form>
        </RightPanel>
      )}

      {/* Team detail and member assignment panel */}
      {selectedTeam && (
        <RightPanel open={!!selectedTeam} onClose={() => setSelectedTeam(null)} title="Team Board Settings" width="485px">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--dash-text)' }}>{selectedTeam.name}</h2>
              <p className="text-xs text-slate-400 mt-1">Created by: {selectedTeam.createdByName} on {new Date(selectedTeam.createdAt).toLocaleDateString('en-IN')}</p>
            </div>

            <div className="space-y-1.5">
              <h4 className="font-bold text-xs" style={{ color: 'var(--dash-text)' }}>Department Objective</h4>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--dash-muted)' }}>{selectedTeam.description}</p>
            </div>

            {/* Add Member form */}
            <form onSubmit={handleAddMember} className="p-4 border rounded-xl space-y-3 bg-slate-500/5" style={{ borderColor: 'var(--dash-border)' }}>
              <h4 className="font-bold text-xs text-slate-600 dark:text-slate-400">Add Team Member</h4>
              <div className="flex gap-2">
                <select className="input-field !py-2 !px-3 !text-xs flex-1" value={targetMemberId} onChange={(e) => setTargetMemberId(e.target.value)} required>
                  <option value="">Select member...</option>
                  {eligibleMembers.map((u) => (
                    <option key={u.uid} value={u.uid}>{u.displayName} ({u.email})</option>
                  ))}
                </select>
                <button type="submit" className="btn-primary shrink-0 !py-2 !px-4 !text-xs">Add</button>
              </div>
            </form>

            {/* Current Members list */}
            <div className="space-y-3 pt-6 border-t" style={{ borderColor: 'var(--dash-border)' }}>
              <h4 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>Current Members ({selectedTeam.memberIds?.length || 0})</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {selectedTeam.memberIds?.map((uid) => {
                  const u = allUsers.find((user) => user.uid === uid);
                  return (
                    <div key={uid} className="p-2 border rounded-xl flex items-center justify-between gap-3 bg-slate-500/5 text-xs" style={{ borderColor: 'var(--dash-border)' }}>
                      <span className="font-semibold truncate" style={{ color: 'var(--dash-text)' }}>{u?.displayName || uid}</span>
                      <button
                        onClick={() => handleRemoveMember(uid)}
                        className="text-red-500 hover:text-red-700 shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
                {(!selectedTeam.memberIds || selectedTeam.memberIds.length === 0) && (
                  <p className="text-xs text-center py-2" style={{ color: 'var(--dash-muted)' }}>No active members assigned.</p>
                )}
              </div>
            </div>

            {/* Past Members history */}
            {selectedTeam.pastMemberIds && selectedTeam.pastMemberIds.length > 0 && (
              <div className="space-y-3 pt-6 border-t" style={{ borderColor: 'var(--dash-border)' }}>
                <h4 className="font-bold text-xs" style={{ color: 'var(--dash-text)' }}>Past Members Registry</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto pr-1 opacity-70">
                  {selectedTeam.pastMemberIds.map((uid) => {
                    const u = allUsers.find((user) => user.uid === uid);
                    return (
                      <div key={uid} className="p-2 border rounded-xl flex items-center justify-between text-xs" style={{ borderColor: 'var(--dash-border)' }}>
                        <span style={{ color: 'var(--dash-text)' }}>{u?.displayName || uid}</span>
                        <span className="text-[9px] uppercase" style={{ color: 'var(--dash-muted)' }}>Retired</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={() => handleDeleteTeam(selectedTeam.id)}
              className="w-full btn-outline border-red-500 text-red-500 hover:bg-red-500/10 !py-2.5 !text-xs mt-4"
            >
              Delete Team Department
            </button>
          </div>
        </RightPanel>
      )}
    </div>
  );
}
