import {
  addDoc,
  collection,
  doc,
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
import type { PositionRecord, UserProfile } from '../types';
import { getAllUsers, getUserProfile, updateUserProfile } from './authService';

function now() {
  return new Date().toISOString();
}

export async function createPosition(title: string, description: string) {
  const positions = await getPositions();
  const position: Omit<PositionRecord, 'id'> = {
    title,
    description,
    holderIds: [],
    order: positions.length,
    createdAt: now(),
  };
  const ref = await addDoc(collection(db, 'positions'), position);
  invalidateCache('positions:');
  trackDBOperation({ operation: 'write', action: 'create_position', resource: 'positions', documentCount: 1 });
  return ref.id;
}

export async function updatePosition(id: string, data: Partial<PositionRecord>) {
  await updateDoc(doc(db, 'positions', id), data);
  invalidateCache('positions:');
  trackDBOperation({ operation: 'update', action: 'update_position', resource: 'positions', documentCount: 1 });
}

export async function deletePosition(id: string) {
  const positions = await getPositions();
  const pos = positions.find((p) => p.id === id);
  if (pos) {
    for (const holderId of pos.holderIds) {
      await updateUserProfile(holderId, { positionId: undefined, positionTitle: undefined });
    }
  }
  await deleteDoc(doc(db, 'positions', id));
  invalidateCache('positions:');
  trackDBOperation({ operation: 'delete', action: 'delete_position', resource: 'positions', documentCount: 1 });
}

export async function getPositions(forceRefresh = false): Promise<PositionRecord[]> {
  return cachedFetch<PositionRecord[]>(
    'positions:all',
    async () => {
      const snap = await getDocs(query(collection(db, 'positions'), orderBy('order', 'asc')));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PositionRecord));
    },
    {
      ttlMs: 120 * 1000,
      resource: 'positions',
      action: 'get_positions',
      forceRefresh,
    }
  );
}

export function subscribePositions(callback: (positions: PositionRecord[]) => void) {
  trackDBOperation({ operation: 'listener', action: 'subscribe_positions', resource: 'positions' });
  return onSnapshot(query(collection(db, 'positions'), orderBy('order', 'asc')), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PositionRecord));
    setCachedData('positions:all', items);
    callback(items);
  });
}

export async function assignPosition(positionId: string, userId: string) {
  const positions = await getPositions();
  const position = positions.find((p) => p.id === positionId);
  if (!position) throw new Error('Position not found');

  for (const p of positions) {
    if (p.holderIds.includes(userId)) {
      await updateDoc(doc(db, 'positions', p.id), {
        holderIds: p.holderIds.filter((id) => id !== userId),
      });
    }
  }

  const holderIds = position.holderIds.includes(userId)
    ? position.holderIds
    : [...position.holderIds, userId];

  await updateDoc(doc(db, 'positions', positionId), { holderIds });
  await updateUserProfile(userId, { positionId, positionTitle: position.title });
  invalidateCache('positions:');
  trackDBOperation({ operation: 'update', action: 'assign_position', resource: 'positions', documentCount: 1 });
}

export async function removeFromPosition(positionId: string, userId: string) {
  const positions = await getPositions();
  const position = positions.find((p) => p.id === positionId);
  if (!position) return;

  await updateDoc(doc(db, 'positions', positionId), {
    holderIds: position.holderIds.filter((id) => id !== userId),
  });
  await updateUserProfile(userId, { positionId: undefined, positionTitle: undefined });
  invalidateCache('positions:');
  trackDBOperation({ operation: 'update', action: 'remove_from_position', resource: 'positions', documentCount: 1 });
}

export async function getPositionHolders(forceRefresh = false): Promise<{ position: PositionRecord; users: UserProfile[] }[]> {
  return cachedFetch(
    'positions:holders',
    async () => {
      const [positions, allUsers] = await Promise.all([
        getPositions(forceRefresh),
        getAllUsers(forceRefresh),
      ]);
      const userMap = new Map<string, UserProfile>(allUsers.map((u) => [u.uid, u]));
      return positions.map((position) => ({
        position,
        users: position.holderIds.map((id) => userMap.get(id)).filter((u): u is UserProfile => Boolean(u)),
      }));
    },
    {
      ttlMs: 90 * 1000,
      resource: 'positions',
      action: 'get_position_holders',
      forceRefresh,
    }
  );
}

