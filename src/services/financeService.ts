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
import { cachedFetch, invalidateCache, setCachedData } from './dbCache';
import { trackDBOperation } from './dbTrackingService';
import type { FinanceTransaction } from '../types';

function now() {
  return new Date().toISOString();
}

export async function addTransaction(data: Omit<FinanceTransaction, 'id' | 'createdAt'>) {
  const ref = await addDoc(collection(db, 'transactions'), {
    ...data,
    createdAt: now(),
  });
  invalidateCache('transactions:');
  trackDBOperation({ operation: 'write', action: 'add_transaction', resource: 'transactions', documentCount: 1 });
  return ref.id;
}

export async function updateTransaction(id: string, data: Partial<FinanceTransaction>) {
  await updateDoc(doc(db, 'transactions', id), data);
  invalidateCache('transactions:');
  trackDBOperation({ operation: 'update', action: 'update_transaction', resource: 'transactions', documentCount: 1 });
}

export async function deleteTransaction(id: string) {
  await deleteDoc(doc(db, 'transactions', id));
  invalidateCache('transactions:');
  trackDBOperation({ operation: 'delete', action: 'delete_transaction', resource: 'transactions', documentCount: 1 });
}

export async function getTransactions(forceRefresh = false): Promise<FinanceTransaction[]> {
  return cachedFetch<FinanceTransaction[]>(
    'transactions:all',
    async () => {
      const snap = await getDocs(query(collection(db, 'transactions'), orderBy('createdAt', 'desc')));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinanceTransaction));
    },
    {
      ttlMs: 45 * 1000,
      resource: 'transactions',
      action: 'get_transactions',
      forceRefresh,
    }
  );
}

export async function getEventTransactions(eventId: string, forceRefresh = false): Promise<FinanceTransaction[]> {
  return cachedFetch<FinanceTransaction[]>(
    `transactions:event:${eventId}`,
    async () => {
      const snap = await getDocs(
        query(collection(db, 'transactions'), where('eventId', '==', eventId), orderBy('createdAt', 'desc'))
      );
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinanceTransaction));
    },
    {
      ttlMs: 45 * 1000,
      resource: 'transactions',
      action: 'get_event_transactions',
      forceRefresh,
    }
  );
}

export function subscribeTransactions(callback: (txns: FinanceTransaction[]) => void) {
  trackDBOperation({ operation: 'listener', action: 'subscribe_transactions', resource: 'transactions' });
  return onSnapshot(query(collection(db, 'transactions'), orderBy('createdAt', 'desc')), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinanceTransaction));
    setCachedData('transactions:all', items);
    callback(items);
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
  invalidateCache('events:');
  trackDBOperation({ operation: 'update', action: 'set_event_budget', resource: 'events', documentCount: 1 });
}

