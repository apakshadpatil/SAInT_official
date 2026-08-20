import { useEffect, useState } from 'react';
import { onSnapshot, collection } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { getAllUsers, followUser, unfollowUser } from '../../services/authService';
import type { UserProfile } from '../../types';
import { getRoleBadge } from '../../utils/permissions';
import { Search, UserPlus, UserMinus, Award, BookOpen, Layers, Users } from 'lucide-react';
import RightPanel from '../../components/ui/RightPanel';
import VerifiedBadge from '../../components/ui/VerifiedBadge';

export default function ExplorePage() {
  const { profile, refreshProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const fetchUsers = async () => {
    try {
      const all = await getAllUsers();
      // Filter out pending and superadmins if desired, or just show approved users
      setUsers(all.filter((u) => u.status === 'approved' && u.uid !== profile?.uid));
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  useEffect(() => {
    fetchUsers();

    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const liveUsers = snap.docs.map((doc) => doc.data() as UserProfile);
      setUsers(liveUsers.filter((u) => u.status === 'approved' && u.uid !== profile?.uid));
    });

    return () => unsub();
  }, [profile]);

  const handleFollow = async (e: React.MouseEvent, targetUid: string, isFollowing: boolean) => {
    e.stopPropagation(); // Avoid opening drawer
    if (!profile) return;
    setLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(profile.uid, targetUid);
      } else {
        await followUser(profile.uid, targetUid);
      }
      await refreshProfile();
      await fetchUsers();
      // Update selected user reference if open
      if (selectedUser?.uid === targetUid) {
        const updated = users.find((u) => u.uid === targetUid);
        if (updated) {
          const isNowFollowing = !isFollowing;
          setSelectedUser({
            ...updated,
            followers: isNowFollowing
              ? [...(updated.followers || []), profile.uid]
              : (updated.followers || []).filter((id) => id !== profile.uid),
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users
    .filter((u) => {
      const term = search.toLowerCase();
      const nameMatch = u.displayName?.toLowerCase().includes(term);
      const emailMatch = u.email?.toLowerCase().includes(term);
      const positionMatch = getRoleBadge(u).toLowerCase().includes(term);
      const teamMatch = u.teamNames?.some((t) => t.toLowerCase().includes(term));
      return nameMatch || emailMatch || positionMatch || teamMatch;
    })
    .sort((a, b) => Number(b.isOnline || false) - Number(a.isOnline || false));

  return (
    <div className="space-y-6">
      <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--dash-text)' }}>Members</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>Search and browse the member directory</p>
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="input-field !pl-10 !py-2.5"
                placeholder="Search by name, team, role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredUsers.map((u) => {
              const isFollowing = profile?.following?.includes(u.uid) || false;
              const roleTitle = getRoleBadge(u);

              return (
                <div
                  key={u.uid}
                  onClick={() => setSelectedUser(u)}
                  className="dash-card cursor-pointer hover:border-blue-500/40 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="flex items-start gap-4 mb-4">
                    {u.photoURL ? (
                      <img src={u.photoURL} alt="" className="w-14 h-14 rounded-full object-cover shrink-0 border border-blue-400/20" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-600 font-bold text-lg shrink-0">
                        {u.firstName?.[0] || u.displayName?.[0] || '?'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold truncate text-sm flex items-center" style={{ color: 'var(--dash-text)' }}>
                          <span className="truncate">{u.displayName}</span>
                          <VerifiedBadge user={u} />
                        </h3>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${u.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {u.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <div className="mt-0.5">
                        {u.role === 'superadmin' ? (
                          <span className="capsule-tag superadmin-tag inline-flex justify-center text-center">
                            {roleTitle}
                          </span>
                        ) : (
                          <p className="text-xs truncate font-medium" style={{ color: 'var(--dash-muted)' }}>{roleTitle}</p>
                        )}
                      </div>
                      <span className="text-[10px] opacity-75 mt-1 block" style={{ color: 'var(--dash-muted)' }}>Batch: {u.batchYear || 'N/A'}</span>
                    </div>
                  </div>

                  {u.teamNames && u.teamNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {u.teamNames.slice(0, 2).map((t) => (
                        <span key={t} className="capsule-tag !text-[10px] !py-0.5">{t}</span>
                      ))}
                      {u.teamNames.length > 2 && (
                        <span className="capsule-tag !text-[10px] !py-0.5 font-normal">+{u.teamNames.length - 2} more</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 mt-auto border-t" style={{ borderColor: 'var(--dash-border)' }}>
                    <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--dash-muted)' }}>
                      <Award className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="font-bold" style={{ color: 'var(--dash-text)' }}>{u.taskScore || 0}</span> pts
                    </div>

                    <button
                      onClick={(e) => handleFollow(e, u.uid, isFollowing)}
                      disabled={loading}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isFollowing ? 'bg-slate-200/60 text-slate-700 hover:bg-slate-200' : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                      style={{
                        backgroundColor: isFollowing ? 'var(--dash-border)' : undefined,
                        color: isFollowing ? 'var(--dash-text)' : undefined,
                      }}
                    >
                      {isFollowing ? (
                        <>
                          <UserMinus className="w-3.5 h-3.5" /> Unfollow
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" /> Follow
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredUsers.length === 0 && (
              <div className="col-span-full py-12 text-center dash-card">
                <p style={{ color: 'var(--dash-muted)' }}>No members found matching your search</p>
              </div>
            )}
          </div>
        </div>

      {/* Profile detail sidebar panel */}
      {selectedUser && (
        <RightPanel
          open={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          title="Member Details"
        >
          <div className="flex flex-col items-center text-center space-y-4">
            {selectedUser.photoURL ? (
              <img src={selectedUser.photoURL} alt="" className="w-24 h-24 rounded-full object-cover border-4 border-blue-500/20" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-600 font-bold text-3xl">
                {selectedUser.firstName?.[0] || selectedUser.displayName?.[0]}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold flex items-center justify-center" style={{ color: 'var(--dash-text)' }}>
                <span>{selectedUser.displayName}</span>
                <VerifiedBadge user={selectedUser} />
              </h2>
              <p className="text-xs font-semibold mt-1" style={{ color: 'var(--dash-muted)' }}>{getRoleBadge(selectedUser)}</p>
            </div>

            <button
              onClick={(e) => {
                const isFollowing = profile?.following?.includes(selectedUser.uid) || false;
                handleFollow(e, selectedUser.uid, isFollowing);
              }}
              disabled={loading}
              className={`w-full py-2 rounded-xl text-sm font-semibold transition-all ${
                profile?.following?.includes(selectedUser.uid)
                  ? 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              style={{
                borderColor: profile?.following?.includes(selectedUser.uid) ? 'var(--dash-border)' : undefined,
                color: profile?.following?.includes(selectedUser.uid) ? 'var(--dash-text)' : undefined,
              }}
            >
              {profile?.following?.includes(selectedUser.uid) ? 'Unfollow Member' : 'Follow Member'}
            </button>

            <div className="w-full text-left space-y-4 pt-6 border-t" style={{ borderColor: 'var(--dash-border)' }}>
              <div className="flex items-center justify-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${selectedUser.isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                <span className="text-sm font-medium" style={{ color: selectedUser.isOnline ? '#10b981' : 'var(--dash-muted)' }}>
                  {selectedUser.isOnline ? 'Online now' : 'Offline'}
                </span>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--dash-muted)' }}>Bio</span>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--dash-text)' }}>
                  {selectedUser.description || 'No description provided by this user.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border rounded-xl" style={{ borderColor: 'var(--dash-border)' }}>
                  <span className="text-[10px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--dash-muted)' }}>Followers</span>
                  <span className="text-lg font-bold" style={{ color: 'var(--dash-text)' }}>{selectedUser.followers?.length || 0}</span>
                </div>
                <div className="p-3 border rounded-xl" style={{ borderColor: 'var(--dash-border)' }}>
                  <span className="text-[10px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--dash-muted)' }}>Following</span>
                  <span className="text-lg font-bold" style={{ color: 'var(--dash-text)' }}>{selectedUser.following?.length || 0}</span>
                </div>
              </div>

              <div className="p-3 border rounded-xl" style={{ borderColor: 'var(--dash-border)' }}>
                <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--dash-text)' }}>
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>Positions</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedUser.positionTitle ? (
                    <span className="capsule-tag">{selectedUser.positionTitle}</span>
                  ) : (
                    <span className="text-sm" style={{ color: 'var(--dash-muted)' }}>No position assigned</span>
                  )}
                  {selectedUser.role && selectedUser.role !== 'member' && (
                    <span className="capsule-tag">{selectedUser.role}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border rounded-xl" style={{ borderColor: 'var(--dash-border)' }}>
                  <span className="text-[10px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--dash-muted)' }}>Task Score</span>
                  <span className="text-lg font-bold" style={{ color: 'var(--dash-text)' }}>{selectedUser.taskScore || 0} pts</span>
                </div>
                <div className="p-3 border rounded-xl" style={{ borderColor: 'var(--dash-border)' }}>
                  <span className="text-[10px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--dash-muted)' }}>Tasks Completed</span>
                  <span className="text-lg font-bold" style={{ color: 'var(--dash-text)' }}>{selectedUser.completedTaskCount || 0}</span>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
                  <BookOpen className="w-4 h-4 text-slate-400" />
                  <span>Batch Year: <strong className="font-semibold">{selectedUser.batchYear || 'N/A'}</strong></span>
                </div>
                {selectedUser.teamNames && selectedUser.teamNames.length > 0 && (
                  <div className="flex items-start gap-2 pt-1">
                    <Layers className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span style={{ color: 'var(--dash-text)' }}>Teams:</span>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {selectedUser.teamNames.map((team) => (
                          <span key={team} className="capsule-tag">{team}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </RightPanel>
      )}
    </div>
  );
}
