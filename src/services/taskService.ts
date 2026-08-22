import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { cachedFetch, invalidateCache, setCachedData } from './dbCache';
import { trackDBOperation } from './dbTrackingService';
import type { TaskRecord, TaskPriority, TaskStatus } from '../types';
import { getUserProfile, updateUserProfile } from './authService';

function now() {
  return new Date().toISOString();
}

export async function createTask(data: {
  title: string;
  description: string;
  assigneeId: string;
  assigneeName: string;
  assignedBy: string;
  assignedByName: string;
  deadline: string;
  priority: TaskPriority;
  points?: number;
}) {
  const task: Omit<TaskRecord, 'id'> = {
    ...data,
    points: data.points ?? 10,
    status: 'pending',
    createdAt: now(),
    updatedAt: now(),
  };
  const ref = await addDoc(collection(db, 'tasks'), task);
  invalidateCache('tasks:');
  trackDBOperation({ operation: 'write', action: 'create_task', resource: 'tasks', documentCount: 1 });
  return ref.id;
}

export async function updateTask(id: string, data: Partial<TaskRecord>) {
  await updateDoc(doc(db, 'tasks', id), { ...data, updatedAt: now() });
  invalidateCache('tasks:');
  trackDBOperation({ operation: 'update', action: 'update_task', resource: 'tasks', documentCount: 1 });
}

export async function deleteTask(id: string) {
  await deleteDoc(doc(db, 'tasks', id));
  invalidateCache('tasks:');
  trackDBOperation({ operation: 'delete', action: 'delete_task', resource: 'tasks', documentCount: 1 });
}

export async function completeTask(
  id: string,
  proofDataUrl?: string,
  proofFileName?: string
) {
  const snap = await getDocs(query(collection(db, 'tasks'), where('__name__', '==', id)));
  if (snap.empty) {
    const taskDoc = doc(db, 'tasks', id);
    const { getDoc } = await import('firebase/firestore');
    const d = await getDoc(taskDoc);
    if (!d.exists()) throw new Error('Task not found');
    const task = d.data() as TaskRecord;

    await updateDoc(taskDoc, {
      status: 'completed' as TaskStatus,
      completedAt: now(),
      proofDataUrl,
      proofFileName,
      updatedAt: now(),
    });

    const profile = await getUserProfile(task.assigneeId);
    if (profile) {
      await updateUserProfile(task.assigneeId, {
        taskScore: profile.taskScore + task.points,
        completedTaskCount: profile.completedTaskCount + 1,
      });
    }
    invalidateCache('tasks:');
    trackDBOperation({ operation: 'update', action: 'complete_task', resource: 'tasks', documentCount: 1 });
    return;
  }

  const task = snap.docs[0].data() as TaskRecord;
  await updateDoc(doc(db, 'tasks', id), {
    status: 'completed',
    completedAt: now(),
    proofDataUrl,
    proofFileName,
    updatedAt: now(),
  });

  const profile = await getUserProfile(task.assigneeId);
  if (profile) {
    await updateUserProfile(task.assigneeId, {
      taskScore: profile.taskScore + task.points,
      completedTaskCount: profile.completedTaskCount + 1,
    });
  }
  invalidateCache('tasks:');
  trackDBOperation({ operation: 'update', action: 'complete_task', resource: 'tasks', documentCount: 1 });
}

export async function getTasksForUser(userId: string, forceRefresh = false): Promise<TaskRecord[]> {
  return cachedFetch<TaskRecord[]>(
    `tasks:user:${userId}`,
    async () => {
      const snap = await getDocs(
        query(collection(db, 'tasks'), where('assigneeId', '==', userId), orderBy('deadline', 'asc'))
      );
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TaskRecord));
    },
    {
      ttlMs: 45 * 1000,
      resource: 'tasks',
      action: 'get_tasks_for_user',
      forceRefresh,
    }
  );
}

export async function getAllTasks(forceRefresh = false): Promise<TaskRecord[]> {
  return cachedFetch<TaskRecord[]>(
    'tasks:all',
    async () => {
      const snap = await getDocs(query(collection(db, 'tasks'), orderBy('createdAt', 'desc')));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TaskRecord));
    },
    {
      ttlMs: 45 * 1000,
      resource: 'tasks',
      action: 'get_all_tasks',
      forceRefresh,
    }
  );
}

export function subscribeUserTasks(userId: string, callback: (tasks: TaskRecord[]) => void) {
  trackDBOperation({ operation: 'listener', action: 'subscribe_user_tasks', resource: 'tasks' });
  return onSnapshot(
    query(collection(db, 'tasks'), where('assigneeId', '==', userId), orderBy('deadline', 'asc')),
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TaskRecord));
      setCachedData(`tasks:user:${userId}`, items);
      callback(items);
    }
  );
}

export function subscribeAllTasks(callback: (tasks: TaskRecord[]) => void) {
  trackDBOperation({ operation: 'listener', action: 'subscribe_all_tasks', resource: 'tasks' });
  return onSnapshot(query(collection(db, 'tasks'), orderBy('createdAt', 'desc')), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TaskRecord));
    setCachedData('tasks:all', items);
    callback(items);
  });
}
