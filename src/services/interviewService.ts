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
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { cachedFetch, invalidateCache, setCachedData } from './dbCache';
import { trackDBOperation } from './dbTrackingService';
import type { InterviewSection, InterviewPanel, ClubApplication } from '../types';

function now() {
  return new Date().toISOString();
}

let sectionsSeeded = false;

// Default sections to seed if none exist
const DEFAULT_SECTIONS = [
  { value: 'social_media', label: 'Social Media' },
  { value: 'management', label: 'Management' },
  { value: 'media', label: 'Media' },
  { value: 'decoration', label: 'Decoration' },
  { value: 'documentation', label: 'Documentation' },
];

export async function seedDefaultSections() {
  if (sectionsSeeded) return;
  sectionsSeeded = true;
  try {
    const snap = await getDocs(collection(db, 'interviewSections'));
    if (snap.empty) {
      const batch = writeBatch(db);
      for (const sec of DEFAULT_SECTIONS) {
        const ref = doc(collection(db, 'interviewSections'));
        batch.set(ref, {
          value: sec.value,
          label: sec.label,
          createdAt: now(),
        });
      }
      await batch.commit();
      invalidateCache('interviewSections:');
    }
  } catch (err) {
    console.warn('[Seeding] Sections seeding error', err);
  }
}

// Global Interview Sections CRUD
export async function createSection(label: string) {
  const value = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
  const sections = await getSections();
  if (sections.some((s) => s.value === value)) {
    throw new Error('Section already exists');
  }

  const section: Omit<InterviewSection, 'id'> = {
    value,
    label,
    createdAt: now(),
  };
  const ref = await addDoc(collection(db, 'interviewSections'), section);
  invalidateCache('interviewSections:');
  trackDBOperation({ operation: 'write', action: 'create_section', resource: 'interviewSections', documentCount: 1 });
  return ref.id;
}

export async function deleteSection(id: string) {
  await deleteDoc(doc(db, 'interviewSections', id));
  invalidateCache('interviewSections:');
  trackDBOperation({ operation: 'delete', action: 'delete_section', resource: 'interviewSections', documentCount: 1 });
}

export async function getSections(forceRefresh = false): Promise<InterviewSection[]> {
  await seedDefaultSections();
  return cachedFetch<InterviewSection[]>(
    'interviewSections:all',
    async () => {
      const snap = await getDocs(query(collection(db, 'interviewSections'), orderBy('createdAt', 'asc')));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as InterviewSection));
    },
    {
      ttlMs: 120 * 1000,
      resource: 'interviewSections',
      action: 'get_sections',
      forceRefresh,
    }
  );
}

export function subscribeSections(callback: (sections: InterviewSection[]) => void) {
  seedDefaultSections().catch(() => {});
  trackDBOperation({ operation: 'listener', action: 'subscribe_sections', resource: 'interviewSections' });
  return onSnapshot(query(collection(db, 'interviewSections'), orderBy('createdAt', 'asc')), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InterviewSection));
    setCachedData('interviewSections:all', items);
    callback(items);
  });
}

// Panels CRUD
export async function createPanel(name: string, sections: string[]) {
  const panel: Omit<InterviewPanel, 'id'> = {
    name,
    sections,
    interviewerIds: [],
    interviewerNames: [],
    createdAt: now(),
  };
  const ref = await addDoc(collection(db, 'interviewPanels'), panel);
  invalidateCache('interviewPanels:');
  trackDBOperation({ operation: 'write', action: 'create_panel', resource: 'interviewPanels', documentCount: 1 });
  return ref.id;
}

export async function updatePanel(id: string, data: Partial<InterviewPanel>) {
  await updateDoc(doc(db, 'interviewPanels', id), data);
  invalidateCache('interviewPanels:');
  trackDBOperation({ operation: 'update', action: 'update_panel', resource: 'interviewPanels', documentCount: 1 });
}

export async function deletePanel(id: string) {
  await deleteDoc(doc(db, 'interviewPanels', id));
  invalidateCache('interviewPanels:');
  trackDBOperation({ operation: 'delete', action: 'delete_panel', resource: 'interviewPanels', documentCount: 1 });
}

export async function getPanels(forceRefresh = false): Promise<InterviewPanel[]> {
  return cachedFetch<InterviewPanel[]>(
    'interviewPanels:all',
    async () => {
      const snap = await getDocs(query(collection(db, 'interviewPanels'), orderBy('createdAt', 'asc')));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as InterviewPanel));
    },
    {
      ttlMs: 60 * 1000,
      resource: 'interviewPanels',
      action: 'get_panels',
      forceRefresh,
    }
  );
}

export function subscribePanels(callback: (panels: InterviewPanel[]) => void) {
  trackDBOperation({ operation: 'listener', action: 'subscribe_panels', resource: 'interviewPanels' });
  return onSnapshot(query(collection(db, 'interviewPanels'), orderBy('createdAt', 'asc')), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InterviewPanel));
    setCachedData('interviewPanels:all', items);
    callback(items);
  });
}

// Allocate applications to panels
export async function allocateApplications(): Promise<{ allocatedCount: number; details: string[] }> {
  // Fetch all applications
  const appSnap = await getDocs(collection(db, 'applications'));
  const applications = appSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ClubApplication));

  // Fetch all panels
  const panels = await getPanels();

  let allocatedCount = 0;
  const details: string[] = [];

  for (const app of applications) {
    const matchingPanels = panels.filter((panel) =>
      panel.sections.some((sec) => app.sections.includes(sec))
    );

    if (matchingPanels.length > 0) {
      const panelIds = matchingPanels.map((panel) => panel.id);
      const panelNames = matchingPanels.map((panel) => panel.name);
      const primaryPanel = matchingPanels[0];
      const targetPanelName = panelNames.join(', ');

      if (
        app.panelId !== primaryPanel.id ||
        app.panelIds?.join(',') !== panelIds.join(',') ||
        app.panelName !== targetPanelName ||
        app.panelNames?.join(',') !== panelNames.join(',')
      ) {
        await updateDoc(doc(db, 'applications', app.id), {
          panelId: primaryPanel.id,
          panelIds,
          panelName: targetPanelName,
          panelNames,
        });
        allocatedCount++;
        details.push(`Allocated ${app.firstName} ${app.lastName} (${app.sections.join(', ')}) to ${targetPanelName}`);
      }
    }
  }

  return { allocatedCount, details };
}
