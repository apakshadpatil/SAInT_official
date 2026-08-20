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
  return ref.id;
}

export async function updateTask(id: string, data: Partial<TaskRecord>) {
  await updateDoc(doc(db, 'tasks', id), { ...data, updatedAt: now() });
}

export async function deleteTask(id: string) {
  await deleteDoc(doc(db, 'tasks', id));
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
}

export async function getTasksForUser(userId: string): Promise<TaskRecord[]> {
  const snap = await getDocs(
    query(collection(db, 'tasks'), where('assigneeId', '==', userId), orderBy('deadline', 'asc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TaskRecord));
}

export async function getAllTasks(): Promise<TaskRecord[]> {
  const snap = await getDocs(query(collection(db, 'tasks'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TaskRecord));
}

export function subscribeUserTasks(userId: string, callback: (tasks: TaskRecord[]) => void) {
  return onSnapshot(
    query(collection(db, 'tasks'), where('assigneeId', '==', userId), orderBy('deadline', 'asc')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TaskRecord)))
  );
}

export function subscribeAllTasks(callback: (tasks: TaskRecord[]) => void) {
  return onSnapshot(query(collection(db, 'tasks'), orderBy('createdAt', 'desc')), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TaskRecord)));
  });
}
