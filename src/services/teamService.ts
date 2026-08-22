import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { cachedFetch, invalidateCache, setCachedData } from './dbCache';
import { trackDBOperation } from './dbTrackingService';
import type { TeamRecord } from '../types';
import { getUserProfile, updateUserProfile } from './authService';

function now() {
  return new Date().toISOString();
}

export async function createTeam(data: {
  name: string;
  description: string;
  createdBy: string;
  createdByName: string;
}) {
  const team: Omit<TeamRecord, 'id'> = {
    ...data,
    memberIds: [],
    pastMemberIds: [],
    createdAt: now(),
  };
  const ref = await addDoc(collection(db, 'teams'), team);
  invalidateCache('teams:');
  trackDBOperation({ operation: 'write', action: 'create_team', resource: 'teams', documentCount: 1 });
  return ref.id;
}

export async function deleteTeam(id: string) {
  const team = await getTeam(id);
  if (!team) return;
  for (const memberId of team.memberIds) {
    await removeMemberFromTeamTags(memberId, team.name, team.id);
  }
  await deleteDoc(doc(db, 'teams', id));
  invalidateCache('teams:');
  trackDBOperation({ operation: 'delete', action: 'delete_team', resource: 'teams', documentCount: 1 });
}

export async function getTeam(id: string, forceRefresh = false): Promise<TeamRecord | null> {
  return cachedFetch<TeamRecord | null>(
    `team:${id}`,
    async () => {
      const snap = await getDoc(doc(db, 'teams', id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as TeamRecord;
    },
    {
      ttlMs: 60 * 1000,
      resource: 'teams',
      action: 'get_team',
      forceRefresh,
    }
  );
}

export async function getTeams(forceRefresh = false): Promise<TeamRecord[]> {
  return cachedFetch<TeamRecord[]>(
    'teams:all',
    async () => {
      const snap = await getDocs(query(collection(db, 'teams'), orderBy('createdAt', 'desc')));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TeamRecord));
    },
    {
      ttlMs: 60 * 1000,
      resource: 'teams',
      action: 'get_teams',
      forceRefresh,
    }
  );
}

export function subscribeTeams(callback: (teams: TeamRecord[]) => void) {
  trackDBOperation({ operation: 'listener', action: 'subscribe_teams', resource: 'teams' });
  return onSnapshot(query(collection(db, 'teams'), orderBy('createdAt', 'desc')), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TeamRecord));
    setCachedData('teams:all', items);
    callback(items);
  });
}

async function removeMemberFromTeamTags(memberId: string, teamName: string, teamId: string) {
  const profile = await getUserProfile(memberId);
  if (!profile) return;
  await updateUserProfile(memberId, {
    teamIds: profile.teamIds.filter((id) => id !== teamId),
    teamNames: profile.teamNames.filter((name) => name !== teamName),
  });
}

export async function addMemberToTeam(teamId: string, memberId: string) {
  const team = await getTeam(teamId);
  const profile = await getUserProfile(memberId);
  if (!team || !profile) throw new Error('Team or user not found');

  const memberIds = team.memberIds.includes(memberId)
    ? team.memberIds
    : [...team.memberIds, memberId];

  await updateDoc(doc(db, 'teams', teamId), { memberIds });

  const teamIds = profile.teamIds.includes(teamId)
    ? profile.teamIds
    : [...profile.teamIds, teamId];
  const teamNames = profile.teamNames.includes(team.name)
    ? profile.teamNames
    : [...profile.teamNames, team.name];

  await updateUserProfile(memberId, { teamIds, teamNames });
  invalidateCache('teams:');
  trackDBOperation({ operation: 'update', action: 'add_member_to_team', resource: 'teams', documentCount: 1 });
}

export async function removeMemberFromTeam(teamId: string, memberId: string) {
  const team = await getTeam(teamId);
  if (!team) throw new Error('Team not found');

  await updateDoc(doc(db, 'teams', teamId), {
    memberIds: team.memberIds.filter((id) => id !== memberId),
    pastMemberIds: team.pastMemberIds.includes(memberId)
      ? team.pastMemberIds
      : [...team.pastMemberIds, memberId],
  });

  await removeMemberFromTeamTags(memberId, team.name, teamId);
  invalidateCache('teams:');
  trackDBOperation({ operation: 'update', action: 'remove_member_from_team', resource: 'teams', documentCount: 1 });
}

