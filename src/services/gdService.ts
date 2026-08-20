import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { GDPanel, ClubApplication, StudentRubricEvaluation } from '../types';
import { getPanels } from './interviewService';

function now() {
  return new Date().toISOString();
}

// GD Panels CRUD
export async function createGDPanel(
  name: string,
  venue?: string,
  timeSlot?: string,
  interviewerIds: string[] = [],
  interviewerNames: string[] = []
) {
  const panel: Omit<GDPanel, 'id'> = {
    name,
    venue: venue || '',
    timeSlot: timeSlot || '',
    interviewerIds,
    interviewerNames,
    createdAt: now(),
  };
  const ref = await addDoc(collection(db, 'gdPanels'), panel);
  return ref.id;
}

export async function updateGDPanel(id: string, data: Partial<GDPanel>) {
  await updateDoc(doc(db, 'gdPanels', id), data);
}

export async function deleteGDPanel(id: string) {
  await deleteDoc(doc(db, 'gdPanels', id));
}

export async function getGDPanels(): Promise<GDPanel[]> {
  const snap = await getDocs(query(collection(db, 'gdPanels'), orderBy('createdAt', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GDPanel));
}

export function subscribeGDPanels(callback: (panels: GDPanel[]) => void) {
  return onSnapshot(query(collection(db, 'gdPanels'), orderBy('createdAt', 'asc')), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GDPanel)));
  });
}

// Auto Allocate applications to GD panels evenly or with max per panel capacity limit
export async function allocateApplicationsToGDPanels(
  maxPerPanel?: number
): Promise<{ allocatedCount: number; details: string[] }> {
  // Fetch active applications
  const appSnap = await getDocs(collection(db, 'applications'));
  const applications = appSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as ClubApplication))
    .filter((a) => !a.archivedAt);

  // Fetch all GD panels
  const gdPanels = await getGDPanels();
  if (gdPanels.length === 0) {
    throw new Error('No GD Panels available. Please create at least one GD Panel first.');
  }

  let allocatedCount = 0;
  const details: string[] = [];
  const batch = writeBatch(db);

  if (maxPerPanel && maxPerPanel > 0) {
    // Fill each panel up to maxPerPanel first
    const panelCounts: Record<string, number> = {};
    gdPanels.forEach((p) => (panelCounts[p.id] = 0));

    let panelIndex = 0;
    const remainingApps: ClubApplication[] = [];

    applications.forEach((app) => {
      // Find next panel that hasn't reached maxPerPanel
      while (panelIndex < gdPanels.length && panelCounts[gdPanels[panelIndex].id] >= maxPerPanel) {
        panelIndex++;
      }

      if (panelIndex < gdPanels.length) {
        const targetPanel = gdPanels[panelIndex];
        panelCounts[targetPanel.id]++;
        if (app.gdPanelId !== targetPanel.id || app.gdPanelName !== targetPanel.name) {
          const appRef = doc(db, 'applications', app.id);
          batch.update(appRef, {
            gdPanelId: targetPanel.id,
            gdPanelName: targetPanel.name,
            gdStatus: app.gdStatus || 'pending',
          });
          allocatedCount++;
          details.push(`Allocated ${app.firstName} ${app.lastName} to ${targetPanel.name}`);
        }
      } else {
        // Exceeded capacity across all panels -> collect as remaining to distribute evenly
        remainingApps.push(app);
      }
    });

    // Distribute remaining applications evenly across all panels
    if (remainingApps.length > 0) {
      remainingApps.forEach((app, idx) => {
        const targetPanel = gdPanels[idx % gdPanels.length];
        if (app.gdPanelId !== targetPanel.id || app.gdPanelName !== targetPanel.name) {
          const appRef = doc(db, 'applications', app.id);
          batch.update(appRef, {
            gdPanelId: targetPanel.id,
            gdPanelName: targetPanel.name,
            gdStatus: app.gdStatus || 'pending',
          });
          allocatedCount++;
          details.push(`Allocated remaining candidate ${app.firstName} ${app.lastName} to ${targetPanel.name}`);
        }
      });
    }
  } else {
    // Round-robin distribution (equal distribution)
    applications.forEach((app, index) => {
      const targetPanel = gdPanels[index % gdPanels.length];
      if (app.gdPanelId !== targetPanel.id || app.gdPanelName !== targetPanel.name) {
        const appRef = doc(db, 'applications', app.id);
        batch.update(appRef, {
          gdPanelId: targetPanel.id,
          gdPanelName: targetPanel.name,
          gdStatus: app.gdStatus || 'pending',
        });
        allocatedCount++;
        details.push(`Allocated ${app.firstName} ${app.lastName} to ${targetPanel.name}`);
      }
    });
  }

  if (allocatedCount > 0) {
    await batch.commit();
  }

  return { allocatedCount, details };
}

// Auto Allocate selected GD students to interview panels
export async function allocateSelectedStudentsToInterviewPanels(
  specificAppIds?: string[]
): Promise<{ allocatedCount: number; details: string[] }> {
  const appSnap = await getDocs(collection(db, 'applications'));
  let applications = appSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as ClubApplication))
    .filter((a) => !a.archivedAt);

  if (specificAppIds && specificAppIds.length > 0) {
    applications = applications.filter((app) => specificAppIds.includes(app.id));
  } else {
    // Default: candidates marked as gdStatus === 'selected'
    applications = applications.filter((app) => app.gdStatus === 'selected');
  }

  if (applications.length === 0) {
    throw new Error('No candidates marked as selected for interview allocation.');
  }

  const interviewPanels = await getPanels();
  if (!interviewPanels || interviewPanels.length === 0) {
    throw new Error('No Interview Panels found! Please go to the "Interview Panels" section and create at least one interview panel before auto-allocating candidates.');
  }

  let allocatedCount = 0;
  const details: string[] = [];
  const batch = writeBatch(db);

  for (const app of applications) {
    const matchingPanels = interviewPanels.filter((panel) =>
      panel.sections.some((sec) => app.sections.includes(sec))
    );

    const targetPanels = matchingPanels.length > 0 ? matchingPanels : [interviewPanels[0]];
    const panelIds = targetPanels.map((p) => p.id);
    const panelNames = targetPanels.map((p) => p.name);
    const primaryPanel = targetPanels[0];
    const targetPanelName = panelNames.join(', ');

    const appRef = doc(db, 'applications', app.id);
    batch.update(appRef, {
      panelId: primaryPanel.id,
      panelIds,
      panelName: targetPanelName,
      panelNames,
      status: 'interview_scheduled',
    });

    allocatedCount++;
    details.push(
      `Allocated ${app.firstName} ${app.lastName} (${app.sections.join(', ')}) to Interview Panel: ${targetPanelName}`
    );
  }

  if (allocatedCount > 0) {
    await batch.commit();
  }

  return { allocatedCount, details };
}

// Export GD Panels & Assigned Applications to CSV
export function exportGDPanelsToCSV(
  panels: GDPanel[],
  applications: ClubApplication[],
  evaluationsMap: Record<string, StudentRubricEvaluation[]> = {}
) {
  const headers = [
    'GD Panel Name',
    'Venue',
    'Time Slot',
    'Panellists',
    'Candidate Name',
    'RBT Number',
    'Email',
    'Phone',
    'Department',
    'Requested Sections',
    'GD Status',
    'Evaluation Total Score',
    'Evaluation Max Score',
    'Percentage',
  ];

  const rows: string[][] = [];

  panels.forEach((panel) => {
    const assignedApps = applications.filter((app) => app.gdPanelId === panel.id);

    if (assignedApps.length === 0) {
      rows.push([
        panel.name,
        panel.venue || '-',
        panel.timeSlot || '-',
        panel.interviewerNames.join('; ') || 'Unassigned',
        'No Candidates Assigned',
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
      ]);
    } else {
      assignedApps.forEach((app) => {
        const evals = evaluationsMap[app.id] || [];
        const avgScore =
          evals.length > 0
            ? Math.round((evals.reduce((sum, e) => sum + e.totalScore, 0) / evals.length) * 10) / 10
            : app.gdScore || 0;
        const maxScore = evals[0]?.maxTotalScore || app.gdMaxScore || 0;
        const pct = maxScore > 0 ? `${Math.round((avgScore / maxScore) * 100)}%` : 'N/A';

        rows.push([
          panel.name,
          panel.venue || '-',
          panel.timeSlot || '-',
          panel.interviewerNames.join('; ') || 'Unassigned',
          `${app.firstName} ${app.lastName}`,
          app.rbtNumber || '-',
          app.email || '-',
          app.phone || '-',
          app.department || '-',
          app.sections.join('; ') || '-',
          app.gdStatus || 'pending',
          avgScore.toString(),
          maxScore.toString(),
          pct,
        ]);
      });
    }
  });

  // Also include unassigned candidates if any
  const unassignedApps = applications.filter((a) => !a.gdPanelId && !a.archivedAt);
  if (unassignedApps.length > 0) {
    unassignedApps.forEach((app) => {
      rows.push([
        'Unassigned',
        '-',
        '-',
        '-',
        `${app.firstName} ${app.lastName}`,
        app.rbtNumber || '-',
        app.email || '-',
        app.phone || '-',
        app.department || '-',
        app.sections.join('; ') || '-',
        app.gdStatus || 'pending',
        '0',
        '0',
        '0%',
      ]);
    });
  }

  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join(
      '\n'
    );

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `GD_Panels_Allocations_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
