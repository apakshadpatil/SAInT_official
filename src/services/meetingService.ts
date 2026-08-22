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
import type { MeetingRecord, AgendaItem } from '../types';

function now() {
  return new Date().toISOString();
}

export async function createMeeting(data: {
  title: string;
  date: string;
  time: string;
  link: string;
  agenda: AgendaItem[];
  createdBy: string;
  createdByName: string;
}) {
  const meeting: Omit<MeetingRecord, 'id'> = {
    ...data,
    isPast: false,
    createdAt: now(),
    updatedAt: now(),
  };
  const ref = await addDoc(collection(db, 'meetings'), meeting);
  invalidateCache('meetings:');
  trackDBOperation({ operation: 'write', action: 'create_meeting', resource: 'meetings', documentCount: 1 });
  return ref.id;
}

export async function updateMeeting(id: string, data: Partial<MeetingRecord>) {
  await updateDoc(doc(db, 'meetings', id), { ...data, updatedAt: now() });
  invalidateCache('meetings:');
  trackDBOperation({ operation: 'update', action: 'update_meeting', resource: 'meetings', documentCount: 1 });
}

export async function deleteMeeting(id: string) {
  await deleteDoc(doc(db, 'meetings', id));
  invalidateCache('meetings:');
  trackDBOperation({ operation: 'delete', action: 'delete_meeting', resource: 'meetings', documentCount: 1 });
}

export async function getMeetings(forceRefresh = false): Promise<MeetingRecord[]> {
  return cachedFetch<MeetingRecord[]>(
    'meetings:all',
    async () => {
      const snap = await getDocs(query(collection(db, 'meetings'), orderBy('date', 'desc')));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MeetingRecord));
    },
    {
      ttlMs: 45 * 1000,
      resource: 'meetings',
      action: 'get_meetings',
      forceRefresh,
    }
  );
}

export function subscribeMeetings(callback: (meetings: MeetingRecord[]) => void) {
  trackDBOperation({ operation: 'listener', action: 'subscribe_meetings', resource: 'meetings' });
  return onSnapshot(query(collection(db, 'meetings'), orderBy('date', 'desc')), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MeetingRecord));
    setCachedData('meetings:all', items);
    callback(items);
  });
}

export function getUpcomingMeetings(meetings: MeetingRecord[]) {
  const today = new Date().toISOString().split('T')[0];
  return meetings.filter((m) => m.date >= today && !m.isPast);
}

export function getPastMeetings(meetings: MeetingRecord[]) {
  const today = new Date().toISOString().split('T')[0];
  return meetings.filter((m) => m.date < today || m.isPast);
}

export async function reorderAgenda(meetingId: string, agenda: AgendaItem[]) {
  await updateMeeting(meetingId, { agenda: agenda.map((item, i) => ({ ...item, order: i })) });
}

