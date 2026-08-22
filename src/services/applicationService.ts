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
import { cachedFetch, invalidateCache, setCachedData } from './dbCache';
import { trackDBOperation } from './dbTrackingService';
import type { ClubApplication, ApplySection } from '../types';

function now() {
  return new Date().toISOString();
}

export async function checkApplicationExists(email: string): Promise<boolean> {
  const q = query(collection(db, 'applications'), where('email', '==', email.toLowerCase()));
  const snap = await getDocs(q);
  trackDBOperation({ operation: 'read', action: 'check_application_exists', resource: 'applications', documentCount: snap.size });
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
  invalidateCache('applications:');
  trackDBOperation({ operation: 'write', action: 'submit_application', resource: 'applications', documentCount: 1 });
  return ref.id;
}

export async function getApplications(forceRefresh = false): Promise<ClubApplication[]> {
  return cachedFetch<ClubApplication[]>(
    'applications:all',
    async () => {
      const snap = await getDocs(query(collection(db, 'applications'), orderBy('createdAt', 'desc')));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClubApplication));
    },
    {
      ttlMs: 45 * 1000,
      resource: 'applications',
      action: 'get_applications',
      forceRefresh,
    }
  );
}

export function subscribeApplications(callback: (apps: ClubApplication[]) => void) {
  trackDBOperation({ operation: 'listener', action: 'subscribe_applications', resource: 'applications' });
  return onSnapshot(query(collection(db, 'applications'), orderBy('createdAt', 'desc')), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClubApplication));
    setCachedData('applications:all', items);
    callback(items);
  });
}

export async function updateApplicationStatus(id: string, status: ClubApplication['status']) {
  await updateDoc(doc(db, 'applications', id), { status });
  invalidateCache('applications:');
  trackDBOperation({ operation: 'update', action: 'update_application_status', resource: 'applications', documentCount: 1 });
}

export async function archiveApplication(id: string, archivedBy: string) {
  await updateDoc(doc(db, 'applications', id), { archivedAt: now(), archivedBy });
  invalidateCache('applications:');
  trackDBOperation({ operation: 'update', action: 'archive_application', resource: 'applications', documentCount: 1 });
}

export async function unarchiveApplication(id: string) {
  await updateDoc(doc(db, 'applications', id), { archivedAt: deleteField(), archivedBy: deleteField() });
  invalidateCache('applications:');
  trackDBOperation({ operation: 'update', action: 'unarchive_application', resource: 'applications', documentCount: 1 });
}

export async function deleteApplication(id: string) {
  await deleteDoc(doc(db, 'applications', id));
  invalidateCache('applications:');
  trackDBOperation({ operation: 'delete', action: 'delete_application', resource: 'applications', documentCount: 1 });
}

export async function getSiteSettings(forceRefresh = false) {
  return cachedFetch(
    'settings:site',
    async () => {
      const snap = await getDoc(doc(db, 'settings', 'site'));
      if (!snap.exists()) {
        return { applicationsOpen: true, clubDescription: '', aboutText: '', whatsappGroupLink: '', doomsdayMode: false };
      }
      return snap.data();
    },
    {
      ttlMs: 120 * 1000,
      resource: 'settings',
      action: 'get_site_settings',
      forceRefresh,
    }
  );
}

export function subscribeSiteSettings(callback: (settings: { applicationsOpen?: boolean; clubDescription?: string; aboutText?: string; whatsappGroupLink?: string; doomsdayMode?: boolean }) => void) {
  return onSnapshot(doc(db, 'settings', 'site'), (snap) => {
    if (snap.exists()) {
      const data = snap.data() as any;
      setCachedData('settings:site', data);
      try {
        localStorage.setItem('saint_doomsday_mode', String(Boolean(data?.doomsdayMode)));
      } catch {}
      callback(data);
    } else {
      callback({ applicationsOpen: true, clubDescription: '', aboutText: '', whatsappGroupLink: '', doomsdayMode: false });
    }
  });
}

export async function updateSiteSettings(data: Record<string, unknown>) {
  await setDoc(doc(db, 'settings', 'site'), data, { merge: true });
  invalidateCache('settings:');
  trackDBOperation({ operation: 'update', action: 'update_site_settings', resource: 'settings', documentCount: 1 });
}

export async function setDoomsdayMode(enabled: boolean) {
  try {
    localStorage.setItem('saint_doomsday_mode', String(enabled));
  } catch {}
  await updateSiteSettings({ doomsdayMode: enabled });
}

export async function getPublicEvents(forceRefresh = false) {
  return cachedFetch(
    'publicEvents:all',
    async () => {
      const snap = await getDocs(query(collection(db, 'publicEvents'), orderBy('date', 'asc')));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    {
      ttlMs: 60 * 1000,
      resource: 'publicEvents',
      action: 'get_public_events',
      forceRefresh,
    }
  );
}

export async function getActivities(forceRefresh = false) {
  return cachedFetch(
    'activities:all',
    async () => {
      const snap = await getDocs(query(collection(db, 'activities'), orderBy('order', 'asc')));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    {
      ttlMs: 120 * 1000,
      resource: 'activities',
      action: 'get_activities',
      forceRefresh,
    }
  );
}

export async function getSiteMembers(forceRefresh = false) {
  return cachedFetch(
    'siteMembers:all',
    async () => {
      const snap = await getDocs(query(collection(db, 'siteMembers'), orderBy('order', 'asc')));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    {
      ttlMs: 120 * 1000,
      resource: 'siteMembers',
      action: 'get_site_members',
      forceRefresh,
    }
  );
}

export async function getFacultyCoordinator(forceRefresh = false) {
  return cachedFetch(
    'settings:faculty',
    async () => {
      const snap = await getDoc(doc(db, 'settings', 'faculty'));
      return snap.exists() ? snap.data() : null;
    },
    {
      ttlMs: 180 * 1000,
      resource: 'settings',
      action: 'get_faculty_coordinator',
      forceRefresh,
    }
  );
}

export async function getHomeImagesConfig(forceRefresh = false): Promise<{ images: string[]; showHomeImages: boolean }> {
  return cachedFetch(
    'settings:homeImages',
    async () => {
      const snap = await getDoc(doc(db, 'settings', 'homeImages'));
      if (!snap.exists()) return { images: [], showHomeImages: true };
      const data = snap.data();
      return {
        images: Array.isArray(data.images) ? (data.images as string[]) : [],
        showHomeImages: data.showHomeImages !== false,
      };
    },
    {
      ttlMs: 180 * 1000,
      resource: 'settings',
      action: 'get_home_images_config',
      forceRefresh,
    }
  );
}

export async function getHomeImages(forceRefresh = false) {
  const config = await getHomeImagesConfig(forceRefresh);
  return config.images;
}

export async function updateHomeImagesConfig(images: string[], showHomeImages: boolean) {
  await setDoc(doc(db, 'settings', 'homeImages'), { images, showHomeImages }, { merge: true });
  invalidateCache('settings:');
  trackDBOperation({ operation: 'update', action: 'update_home_images_config', resource: 'settings', documentCount: 1 });
}

export async function updateHomeImages(images: string[]) {
  await updateHomeImagesConfig(images, true);
}

