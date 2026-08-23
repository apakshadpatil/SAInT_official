import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import type { DBTelemetryRecord, DayWiseDBStats, UserDBAnalyticsSummary, SystemStatsOverview, DBOperationType, UserRole } from '../types';

const MAX_MEMORY_TRACES = 1000;
const STORAGE_KEY_RECENT_TRACES = 'saint_db_recent_traces';
const STORAGE_KEY_DAILY_AGGREGATES = 'saint_db_daily_aggregates';
const STORAGE_KEY_USER_AGGREGATES = 'saint_db_user_aggregates';

// In-memory ring buffer of recent telemetry events
let memoryTraces: DBTelemetryRecord[] = [];
// Aggregated daily records keyed by 'YYYY-MM-DD'
let dailyAggregates: Record<string, DayWiseDBStats> = {};
// Aggregated user records keyed by userId
let userAggregates: Record<string, UserDBAnalyticsSummary> = {};

let initialized = false;
let isSyncingToFirestore = false;
let lastSyncTimestamp = 0;

// Load persisted local data on startup
function initTelemetry() {
  if (initialized || typeof window === 'undefined') return;
  try {
    const rawTraces = localStorage.getItem(STORAGE_KEY_RECENT_TRACES);
    if (rawTraces) memoryTraces = JSON.parse(rawTraces);

    const rawDaily = localStorage.getItem(STORAGE_KEY_DAILY_AGGREGATES);
    if (rawDaily) dailyAggregates = JSON.parse(rawDaily);

    const rawUser = localStorage.getItem(STORAGE_KEY_USER_AGGREGATES);
    if (rawUser) userAggregates = JSON.parse(rawUser);
  } catch (err) {
    console.warn('[Telemetry] Failed to load local cache', err);
  }
  initialized = true;
}

function saveToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY_RECENT_TRACES, JSON.stringify(memoryTraces.slice(0, 100)));
    localStorage.setItem(STORAGE_KEY_DAILY_AGGREGATES, JSON.stringify(dailyAggregates));
    localStorage.setItem(STORAGE_KEY_USER_AGGREGATES, JSON.stringify(userAggregates));
  } catch {
    // LocalStorage quota safety
  }
}

/**
 * Get the current active page route for telemetry tracking
 */
export function getCurrentPageRoute(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname || '/';
}

/**
 * Main telemetry tracking function.
 * Called on every database interaction (read, write, update, delete, fetch, listener).
 */
export function trackDBOperation(options: {
  operation: DBOperationType;
  action: string;
  resource: string;
  documentCount?: number;
  cached?: boolean;
  durationMs?: number;
  status?: 'success' | 'failed';
  errorMessage?: string;
  page?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userRole?: UserRole | 'anonymous';
}) {
  initTelemetry();

  const now = new Date();
  const timestamp = now.toISOString();
  const dateKey = timestamp.split('T')[0];
  const hourKey = `${now.getHours().toString().padStart(2, '0')}:00`;

  const currentUser = auth.currentUser;
  const userId = options.userId || currentUser?.uid || 'anonymous';
  const userEmail = options.userEmail || currentUser?.email || 'guest@saint.org';
  const userName = options.userName || currentUser?.displayName || (userId === 'anonymous' ? 'Anonymous Visitor' : 'Active User');
  const userRole = options.userRole || 'member';
  const page = options.page || getCurrentPageRoute();
  const documentCount = options.documentCount ?? 1;
  const cached = Boolean(options.cached);
  const durationMs = options.durationMs ?? 0;
  const status = options.status || 'success';

  const record: DBTelemetryRecord = {
    id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId,
    userName,
    userEmail,
    userRole,
    operation: options.operation,
    action: options.action,
    resource: options.resource,
    page,
    documentCount,
    cached,
    timestamp,
    durationMs,
    status,
    errorMessage: options.errorMessage,
  };

  // Add to ring buffer
  memoryTraces.unshift(record);
  if (memoryTraces.length > MAX_MEMORY_TRACES) {
    memoryTraces.pop();
  }

  // Update Daily Aggregates
  if (!dailyAggregates[dateKey]) {
    dailyAggregates[dateKey] = {
      date: dateKey,
      totalCalls: 0,
      totalReads: 0,
      totalWrites: 0,
      fetchOperations: 0,
      cachedReads: 0,
      activeUserIds: [],
      activeUsersCount: 0,
      resources: {},
      pages: {},
      hourlyDistribution: {},
    };
  }

  const dayStat = dailyAggregates[dateKey];
  dayStat.totalCalls += 1;
  if (options.operation === 'read' || options.operation === 'fetch') {
    if (cached) {
      dayStat.cachedReads += documentCount;
    } else {
      dayStat.totalReads += documentCount;
      dayStat.fetchOperations += 1;
    }
  } else if (['write', 'update', 'delete'].includes(options.operation)) {
    dayStat.totalWrites += documentCount;
  }

  if (userId && !dayStat.activeUserIds.includes(userId)) {
    dayStat.activeUserIds.push(userId);
    dayStat.activeUsersCount = dayStat.activeUserIds.length;
  }

  dayStat.resources[options.resource] = (dayStat.resources[options.resource] || 0) + 1;
  dayStat.pages[page] = (dayStat.pages[page] || 0) + 1;
  dayStat.hourlyDistribution[hourKey] = (dayStat.hourlyDistribution[hourKey] || 0) + 1;

  // Update User Aggregates
  if (!userAggregates[userId]) {
    userAggregates[userId] = {
      userId,
      userName,
      userEmail,
      userRole,
      totalCalls: 0,
      totalReads: 0,
      totalWrites: 0,
      totalFetches: 0,
      cachedReads: 0,
      firstActivity: timestamp,
      lastActivity: timestamp,
      topPages: [],
      topResources: [],
      dayWiseBreakdown: [],
    };
  }

  const userStat = userAggregates[userId];
  userStat.userName = userName;
  userStat.userEmail = userEmail;
  userStat.userRole = userRole;
  userStat.lastActivity = timestamp;
  userStat.totalCalls += 1;

  if (options.operation === 'read' || options.operation === 'fetch') {
    if (cached) {
      userStat.cachedReads += documentCount;
    } else {
      userStat.totalReads += documentCount;
      userStat.totalFetches += 1;
    }
  } else if (['write', 'update', 'delete'].includes(options.operation)) {
    userStat.totalWrites += documentCount;
  }

  // Update user's day-wise breakdown
  let userDay = userStat.dayWiseBreakdown.find((d) => d.date === dateKey);
  if (!userDay) {
    userDay = {
      date: dateKey,
      calls: 0,
      reads: 0,
      writes: 0,
      fetches: 0,
      pages: [],
    };
    userStat.dayWiseBreakdown.unshift(userDay);
  }
  userDay.calls += 1;
  if (options.operation === 'read' || options.operation === 'fetch') {
    if (!cached) {
      userDay.reads += documentCount;
      userDay.fetches += 1;
    }
  } else if (['write', 'update', 'delete'].includes(options.operation)) {
    userDay.writes += documentCount;
  }
  if (!userDay.pages.includes(page)) {
    userDay.pages.push(page);
  }

  saveToLocalStorage();

  // Throttled background sync to Firestore (at most once every 5 minutes)
  schedulePeriodicSync();
}

function schedulePeriodicSync() {
  const now = Date.now();
  if (now - lastSyncTimestamp < 300000 || isSyncingToFirestore) return;

  lastSyncTimestamp = now;
  setTimeout(() => {
    void flushAggregatesToFirestore();
  }, 5000);
}

/**
 * Periodically stores aggregated statistics into Firestore.
 * Uses merge: true on single daily rollup documents, creating at most 1 write every 5 minutes.
 */
export async function flushAggregatesToFirestore() {
  if (!auth.currentUser || isSyncingToFirestore || typeof window === 'undefined') return;
  isSyncingToFirestore = true;
  try {
    const today = new Date().toISOString().split('T')[0];
    const currentDayStat = dailyAggregates[today];
    if (currentDayStat) {
      // Direct doc set without triggering tracking interceptor
      const ref = doc(db, 'system_analytics_daily', today);
      await setDoc(ref, {
        ...currentDayStat,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }
  } catch (err) {
    console.warn('[Telemetry] Daily sync skipped', err);
  } finally {
    isSyncingToFirestore = false;
  }
}

/**
 * Computes high-level System Stats overview for the Superadmin Dashboard.
 */
export async function getSystemStatsOverview(dateRange?: { startDate?: string; endDate?: string }): Promise<SystemStatsOverview> {
  initTelemetry();

  // Try to load any remote daily stats from Firestore for history
  try {
    const today = new Date().toISOString().split('T')[0];
    const snap = await getDoc(doc(db, 'system_analytics_daily', today));
    if (snap.exists()) {
      const data = snap.data() as DayWiseDBStats;
      dailyAggregates[today] = {
        ...data,
        ...dailyAggregates[today],
        totalCalls: Math.max(data.totalCalls || 0, dailyAggregates[today]?.totalCalls || 0),
        totalReads: Math.max(data.totalReads || 0, dailyAggregates[today]?.totalReads || 0),
      };
    }
  } catch {
    // local fallback
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
  const currentMonthStr = todayStr.slice(0, 7);

  let filteredDays = Object.values(dailyAggregates).sort((a, b) => b.date.localeCompare(a.date));

  if (dateRange?.startDate && dateRange?.endDate) {
    filteredDays = filteredDays.filter((d) => d.date >= dateRange.startDate! && d.date <= dateRange.endDate!);
  }

  const totalCalls = filteredDays.reduce((sum, d) => sum + (d.totalCalls || 0), 0);
  const totalReads = filteredDays.reduce((sum, d) => sum + (d.totalReads || 0), 0);
  const totalWrites = filteredDays.reduce((sum, d) => sum + (d.totalWrites || 0), 0);
  const totalFetches = filteredDays.reduce((sum, d) => sum + (d.fetchOperations || 0), 0);
  const cachedReads = filteredDays.reduce((sum, d) => sum + (d.cachedReads || 0), 0);

  const totalAttemptedReads = totalReads + cachedReads;
  const cacheSavingsRate = totalAttemptedReads > 0 ? Math.round((cachedReads / totalAttemptedReads) * 100) : 0;

  const allActiveUsers = new Set<string>();
  filteredDays.forEach((d) => (d.activeUserIds || []).forEach((u) => allActiveUsers.add(u)));
  const activeUsersCount = allActiveUsers.size || Object.keys(userAggregates).length || 1;

  const avgCallsPerUser = activeUsersCount > 0 ? Math.round(totalCalls / activeUsersCount) : 0;

  const todayStat = dailyAggregates[todayStr];
  const yesterdayStat = dailyAggregates[yesterdayStr];

  const todayCalls = todayStat?.totalCalls || 0;
  const todayReads = todayStat?.totalReads || 0;
  const yesterdayCalls = yesterdayStat?.totalCalls || 0;

  const thisMonthCalls = Object.entries(dailyAggregates)
    .filter(([k]) => k.startsWith(currentMonthStr))
    .reduce((sum, [, d]) => sum + (d.totalCalls || 0), 0);

  // Aggregate resource counts
  const resourceTotals: Record<string, number> = {};
  filteredDays.forEach((d) => {
    Object.entries(d.resources || {}).forEach(([res, cnt]) => {
      resourceTotals[res] = (resourceTotals[res] || 0) + cnt;
    });
  });

  const topResources = Object.entries(resourceTotals)
    .map(([resource, count]) => ({ resource, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Aggregate page counts
  const pageTotals: Record<string, number> = {};
  filteredDays.forEach((d) => {
    Object.entries(d.pages || {}).forEach(([p, cnt]) => {
      pageTotals[p] = (pageTotals[p] || 0) + cnt;
    });
  });

  const topPages = Object.entries(pageTotals)
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top users
  const topUsers = Object.values(userAggregates)
    .sort((a, b) => b.totalCalls - a.totalCalls);

  return {
    totalCalls,
    totalReads,
    totalWrites,
    totalFetches,
    cachedReads,
    cacheSavingsRate,
    activeUsersCount,
    avgCallsPerUser,
    todayCalls,
    todayReads,
    yesterdayCalls,
    thisMonthCalls,
    topResources,
    topPages,
    topUsers,
    dayWiseStats: filteredDays,
    recentTraces: memoryTraces.slice(0, 100),
  };
}

/**
 * Returns raw recent query traces for the live query inspector.
 */
export function getRecentDBTraces(): DBTelemetryRecord[] {
  initTelemetry();
  return [...memoryTraces];
}

/**
 * Clear or reset analytics data (Superadmin action if needed).
 */
export function clearLocalAnalytics() {
  memoryTraces = [];
  dailyAggregates = {};
  userAggregates = {};
  localStorage.removeItem(STORAGE_KEY_RECENT_TRACES);
  localStorage.removeItem(STORAGE_KEY_DAILY_AGGREGATES);
  localStorage.removeItem(STORAGE_KEY_USER_AGGREGATES);
}
