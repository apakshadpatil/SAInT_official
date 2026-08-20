import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ClubApplication, ApplySection } from '../types';

function now() {
  return new Date().toISOString();
}

export async function checkApplicationExists(email: string): Promise<boolean> {
  const q = query(collection(db, 'applications'), where('email', '==', email.toLowerCase()));
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function submitApplication(data: {
  rbtNumber: string;
  firstName: string;
  lastName: string;
  department: string;
  sections: ApplySection[];
  sectionSkills: Record<string, string>;
  reason: string;
  phone: string;
  email: string;
}) {
  const exists = await checkApplicationExists(data.email);
  if (exists) throw new Error('An application with this email already exists. Only one response per email is allowed.');

  const application: Omit<ClubApplication, 'id'> = {
    ...data,
    email: data.email.toLowerCase(),
    sectionSkills: data.sectionSkills as ClubApplication['sectionSkills'],
    status: 'submitted',
    createdAt: now(),
  };

  const ref = await addDoc(collection(db, 'applications'), application);
  return ref.id;
}

export async function getApplications(): Promise<ClubApplication[]> {
  const snap = await getDocs(query(collection(db, 'applications'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClubApplication));
}

export function subscribeApplications(callback: (apps: ClubApplication[]) => void) {
  return onSnapshot(query(collection(db, 'applications'), orderBy('createdAt', 'desc')), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClubApplication)));
  });
}

export async function updateApplicationStatus(id: string, status: ClubApplication['status']) {
  await updateDoc(doc(db, 'applications', id), { status });
}

export async function archiveApplication(id: string, archivedBy: string) {
  await updateDoc(doc(db, 'applications', id), { archivedAt: now(), archivedBy });
}

export async function unarchiveApplication(id: string) {
  await updateDoc(doc(db, 'applications', id), { archivedAt: deleteField(), archivedBy: deleteField() });
}

export async function deleteApplication(id: string) {
  await deleteDoc(doc(db, 'applications', id));
}

export async function getSiteSettings() {
  const snap = await getDoc(doc(db, 'settings', 'site'));
  if (!snap.exists()) {
    return { applicationsOpen: true, clubDescription: '', aboutText: '', whatsappGroupLink: '' };
  }
  return snap.data();
}

export async function updateSiteSettings(data: Record<string, unknown>) {
  await setDoc(doc(db, 'settings', 'site'), data, { merge: true });
}

export async function getPublicEvents() {
  const snap = await getDocs(query(collection(db, 'publicEvents'), orderBy('date', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getActivities() {
  const snap = await getDocs(query(collection(db, 'activities'), orderBy('order', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getSiteMembers() {
  const snap = await getDocs(query(collection(db, 'siteMembers'), orderBy('order', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getFacultyCoordinator() {
  const snap = await getDoc(doc(db, 'settings', 'faculty'));
  return snap.exists() ? snap.data() : null;
}

export async function getHomeImages() {
  const snap = await getDoc(doc(db, 'settings', 'homeImages'));
  if (!snap.exists()) return [];
  const data = snap.data();
  return Array.isArray(data.images) ? data.images as string[] : [];
}

export async function updateHomeImages(images: string[]) {
  await setDoc(doc(db, 'settings', 'homeImages'), { images }, { merge: true });
}
