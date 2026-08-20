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
  return ref.id;
}

export async function deleteTeam(id: string) {
  const team = await getTeam(id);
  if (!team) return;
  for (const memberId of team.memberIds) {
    await removeMemberFromTeamTags(memberId, team.name, team.id);
  }
  await deleteDoc(doc(db, 'teams', id));
}

export async function getTeam(id: string): Promise<TeamRecord | null> {
  const snap = await getDoc(doc(db, 'teams', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as TeamRecord;
}

export async function getTeams(): Promise<TeamRecord[]> {
  const snap = await getDocs(query(collection(db, 'teams'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TeamRecord));
}

export function subscribeTeams(callback: (teams: TeamRecord[]) => void) {
  return onSnapshot(query(collection(db, 'teams'), orderBy('createdAt', 'desc')), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TeamRecord)));
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
}
