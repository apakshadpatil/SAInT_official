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
  where,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { cachedFetch, invalidateCache, setCachedData } from './dbCache';
import { trackDBOperation } from './dbTrackingService';
import type { GDRubric, StudentRubricEvaluation, RubricScoreItem } from '../types';

function now() {
  return new Date().toISOString();
}

let rubricsSeeded = false;

const DEFAULT_RUBRICS: Omit<GDRubric, 'id' | 'createdAt'>[] = [
  {
    title: 'Communication & Expression',
    description: 'Clarity of thought, articulation, fluency, and vocal tone.',
    maxMarks: 10,
    category: 'gd',
  },
  {
    title: 'Content & Problem Solving',
    description: 'Relevance of points, domain knowledge, logical reasoning, and depth of arguments.',
    maxMarks: 10,
    category: 'gd',
  },
  {
    title: 'Leadership & Group Dynamics',
    description: 'Initiative, listening skills, involving quiet members, and avoiding aggressiveness.',
    maxMarks: 10,
    category: 'gd',
  },
  {
    title: 'Confidence & Body Language',
    description: 'Posture, eye contact, composure under pressure, and active listening.',
    maxMarks: 10,
    category: 'gd',
  },
];

export async function seedDefaultRubrics() {
  if (rubricsSeeded) return;
  rubricsSeeded = true;
  try {
    const snap = await getDocs(collection(db, 'assessmentRubrics'));
    if (snap.empty) {
      const batch = writeBatch(db);
      for (const r of DEFAULT_RUBRICS) {
        const ref = doc(collection(db, 'assessmentRubrics'));
        batch.set(ref, {
          ...r,
          createdAt: now(),
        });
      }
      await batch.commit();
      invalidateCache('assessmentRubrics:');
    }
  } catch (err) {
    console.warn('[Seeding] Rubrics seeding error', err);
  }
}

export async function createRubric(title: string, description: string, maxMarks: number, category: 'gd' | 'interview' | 'general' = 'gd') {
  const rubric: Omit<GDRubric, 'id'> = {
    title,
    description,
    maxMarks: Number(maxMarks) || 10,
    category,
    createdAt: now(),
  };
  const ref = await addDoc(collection(db, 'assessmentRubrics'), rubric);
  invalidateCache('assessmentRubrics:');
  trackDBOperation({ operation: 'write', action: 'create_rubric', resource: 'assessmentRubrics', documentCount: 1 });
  return ref.id;
}

export async function updateRubric(id: string, data: Partial<GDRubric>) {
  await updateDoc(doc(db, 'assessmentRubrics', id), data);
  invalidateCache('assessmentRubrics:');
  trackDBOperation({ operation: 'update', action: 'update_rubric', resource: 'assessmentRubrics', documentCount: 1 });
}

export async function deleteRubric(id: string) {
  await deleteDoc(doc(db, 'assessmentRubrics', id));
  invalidateCache('assessmentRubrics:');
  trackDBOperation({ operation: 'delete', action: 'delete_rubric', resource: 'assessmentRubrics', documentCount: 1 });
}

export async function getRubrics(forceRefresh = false): Promise<GDRubric[]> {
  await seedDefaultRubrics();
  return cachedFetch<GDRubric[]>(
    'assessmentRubrics:all',
    async () => {
      const snap = await getDocs(query(collection(db, 'assessmentRubrics'), orderBy('createdAt', 'asc')));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GDRubric));
    },
    {
      ttlMs: 120 * 1000,
      resource: 'assessmentRubrics',
      action: 'get_rubrics',
      forceRefresh,
    }
  );
}

export function subscribeRubrics(callback: (rubrics: GDRubric[]) => void) {
  seedDefaultRubrics().catch(() => {});
  trackDBOperation({ operation: 'listener', action: 'subscribe_rubrics', resource: 'assessmentRubrics' });
  return onSnapshot(query(collection(db, 'assessmentRubrics'), orderBy('createdAt', 'asc')), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as GDRubric));
    setCachedData('assessmentRubrics:all', items);
    callback(items);
  });
}

// Rubric Evaluations
export async function submitRubricEvaluation(
  applicationId: string,
  evaluatorId: string,
  evaluatorName: string,
  rubricScores: Record<string, number>,
  rubricsList: GDRubric[],
  comment?: string,
  panelId?: string,
  gdPanelId?: string
) {
  // Calculate total score and max possible total score
  let totalScore = 0;
  let maxTotalScore = 0;
  const scoresList: RubricScoreItem[] = [];

  rubricsList.forEach((r) => {
    const score = Number(rubricScores[r.id]) || 0;
    totalScore += score;
    maxTotalScore += r.maxMarks;
    scoresList.push({
      rubricId: r.id,
      rubricTitle: r.title,
      score,
      maxMarks: r.maxMarks,
    });
  });

  const percentage = maxTotalScore > 0 ? Math.round((totalScore / maxTotalScore) * 100) : 0;

  // Custom doc id per application & evaluator to allow multiple evaluators per candidate
  const evalDocId = `${applicationId}_${evaluatorId}`;
  const evalRef = doc(db, 'studentRubricEvaluations', evalDocId);

  const evalData: Omit<StudentRubricEvaluation, 'id'> = {
    applicationId,
    ...(panelId && { panelId }),
    ...(gdPanelId && { gdPanelId }),
    evaluatorId,
    evaluatorName,
    rubricScores,
    scoresList,
    comment: comment?.trim() || '',
    totalScore,
    maxTotalScore,
    percentage,
    updatedAt: now(),
  };

  await setDoc(evalRef, evalData, { merge: true });

  // Optionally update aggregate score on application document
  const appRef = doc(db, 'applications', applicationId);
  await updateDoc(appRef, {
    gdScore: totalScore,
    gdMaxScore: maxTotalScore,
    gdStatus: 'evaluated',
  }).catch(() => {});
}

export function subscribeStudentRubricEvaluations(
  applicationId: string,
  callback: (evaluations: StudentRubricEvaluation[]) => void
) {
  return onSnapshot(
    query(collection(db, 'studentRubricEvaluations'), where('applicationId', '==', applicationId)),
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentRubricEvaluation)));
    }
  );
}

export function subscribeAllRubricEvaluations(
  callback: (evaluationsMap: Record<string, StudentRubricEvaluation[]>) => void
) {
  return onSnapshot(collection(db, 'studentRubricEvaluations'), (snap) => {
    const map: Record<string, StudentRubricEvaluation[]> = {};
    snap.docs.forEach((d) => {
      const item = { id: d.id, ...d.data() } as StudentRubricEvaluation;
      if (!map[item.applicationId]) {
        map[item.applicationId] = [];
      }
      map[item.applicationId].push(item);
    });
    callback(map);
  });
}
