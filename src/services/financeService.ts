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
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { FinanceTransaction } from '../types';

function now() {
  return new Date().toISOString();
}

export async function addTransaction(data: Omit<FinanceTransaction, 'id' | 'createdAt'>) {
  const ref = await addDoc(collection(db, 'transactions'), {
    ...data,
    createdAt: now(),
  });
  return ref.id;
}

export async function updateTransaction(id: string, data: Partial<FinanceTransaction>) {
  await updateDoc(doc(db, 'transactions', id), data);
}

export async function deleteTransaction(id: string) {
  await deleteDoc(doc(db, 'transactions', id));
}

export async function getTransactions(): Promise<FinanceTransaction[]> {
  const snap = await getDocs(query(collection(db, 'transactions'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinanceTransaction));
}

export async function getEventTransactions(eventId: string): Promise<FinanceTransaction[]> {
  const snap = await getDocs(
    query(collection(db, 'transactions'), where('eventId', '==', eventId), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinanceTransaction));
}

export function subscribeTransactions(callback: (txns: FinanceTransaction[]) => void) {
  return onSnapshot(query(collection(db, 'transactions'), orderBy('createdAt', 'desc')), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinanceTransaction)));
  });
}

export function computeFinancialAnalytics(transactions: FinanceTransaction[]) {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  const expenses = transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0);
  const income = transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const sponsorships = transactions
    .filter((t) => t.isSponsorship)
    .reduce((sum, t) => sum + t.amount, 0);

  const byEvent: Record<string, number> = {};
  transactions.forEach((t) => {
    if (t.eventId) {
      byEvent[t.eventId] = (byEvent[t.eventId] || 0) + t.amount;
    }
  });

  return { total, expenses, income, sponsorships, byEvent, count: transactions.length };
}

export async function setEventBudget(eventId: string, budget: number) {
  await updateDoc(doc(db, 'events', eventId), { budget });
}
