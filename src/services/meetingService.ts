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
  return ref.id;
}

export async function updateMeeting(id: string, data: Partial<MeetingRecord>) {
  await updateDoc(doc(db, 'meetings', id), { ...data, updatedAt: now() });
}

export async function deleteMeeting(id: string) {
  await deleteDoc(doc(db, 'meetings', id));
}

export async function getMeetings(): Promise<MeetingRecord[]> {
  const snap = await getDocs(query(collection(db, 'meetings'), orderBy('date', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MeetingRecord));
}

export function subscribeMeetings(callback: (meetings: MeetingRecord[]) => void) {
  return onSnapshot(query(collection(db, 'meetings'), orderBy('date', 'desc')), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MeetingRecord)));
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
