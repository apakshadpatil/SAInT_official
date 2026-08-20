import {
  addDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ActivityLog } from '../types';

export async function logActivity(
  userId: string,
  userName: string,
  userEmail: string,
  action: string,
  details: string
) {
  try {
    const activity: Omit<ActivityLog, 'id'> = {
      userId,
      userName,
      userEmail,
      action,
      details,
      timestamp: new Date().toISOString(),
    };
    await addDoc(collection(db, 'activityLogs'), activity);
  } catch (error) {
    console.error('Failed to write activity log:', error);
  }
}

export function subscribeActivity(callback: (logs: ActivityLog[]) => void, limitCount = 200) {
  const q = query(
    collection(db, 'activityLogs'),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog)));
  });
}
