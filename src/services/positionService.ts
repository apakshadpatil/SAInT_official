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
import type { PositionRecord } from '../types';
import { getUserProfile, updateUserProfile } from './authService';

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
  return ref.id;
}

export async function updatePosition(id: string, data: Partial<PositionRecord>) {
  await updateDoc(doc(db, 'positions', id), data);
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
}

export async function getPositions(): Promise<PositionRecord[]> {
  const snap = await getDocs(query(collection(db, 'positions'), orderBy('order', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PositionRecord));
}

export function subscribePositions(callback: (positions: PositionRecord[]) => void) {
  return onSnapshot(query(collection(db, 'positions'), orderBy('order', 'asc')), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PositionRecord)));
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
}

export async function removeFromPosition(positionId: string, userId: string) {
  const positions = await getPositions();
  const position = positions.find((p) => p.id === positionId);
  if (!position) return;

  await updateDoc(doc(db, 'positions', positionId), {
    holderIds: position.holderIds.filter((id) => id !== userId),
  });
  await updateUserProfile(userId, { positionId: undefined, positionTitle: undefined });
}

export async function getPositionHolders(): Promise<{ position: PositionRecord; users: Awaited<ReturnType<typeof getUserProfile>>[] }[]> {
  const positions = await getPositions();
  const result = [];
  for (const position of positions) {
    const users = await Promise.all(position.holderIds.map((id) => getUserProfile(id)));
    result.push({ position, users: users.filter(Boolean) });
  }
  return result;
}
