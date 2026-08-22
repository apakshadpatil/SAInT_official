import { trackDBOperation, getCurrentPageRoute } from './dbTrackingService';
import type { DBOperationType } from '../types';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  timestamp: number;
}

// In-memory cache storage
const memoryCache = new Map<string, CacheEntry<any>>();

// In-flight active promises to prevent duplicate simultaneous queries
const inFlightRequests = new Map<string, Promise<any>>();

// Default TTL is 60 seconds unless overridden
const DEFAULT_TTL_MS = 60 * 1000;

/**
 * Executes an asynchronous data fetching function with caching, in-flight deduplication, and telemetry tracking.
 */
export async function cachedFetch<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options: {
    ttlMs?: number;
    resource: string;
    action?: string;
    operation?: DBOperationType;
    forceRefresh?: boolean;
    page?: string;
  }
): Promise<T> {
  const {
    ttlMs = DEFAULT_TTL_MS,
    resource,
    action = `fetch_${resource}`,
    operation = 'fetch',
    forceRefresh = false,
    page = getCurrentPageRoute(),
  } = options;

  const now = Date.now();

  // 1. Check in-memory cache if not forced refresh
  if (!forceRefresh && memoryCache.has(cacheKey)) {
    const entry = memoryCache.get(cacheKey)!;
    if (now < entry.expiresAt) {
      // Served from cache: record saved reads
      const docCount = Array.isArray(entry.data) ? entry.data.length : 1;
      trackDBOperation({
        operation: 'read',
        action: `${action}_cached`,
        resource,
        documentCount: docCount,
        cached: true,
        durationMs: 0,
        status: 'success',
        page,
      });
      return entry.data;
    } else {
      // Expired
      memoryCache.delete(cacheKey);
    }
  }

  // 2. In-flight request deduplication: if identical query is currently executing, reuse promise
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!;
  }

  // 3. Execute new network fetch
  const startTime = performance.now();
  const fetchPromise = (async () => {
    try {
      const data = await fetcher();
      const durationMs = Math.round(performance.now() - startTime);
      const docCount = Array.isArray(data) ? data.length : 1;

      // Store in cache
      memoryCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + ttlMs,
        timestamp: Date.now(),
      });

      // Track telemetry
      trackDBOperation({
        operation,
        action,
        resource,
        documentCount: docCount,
        cached: false,
        durationMs,
        status: 'success',
        page,
      });

      return data;
    } catch (error: any) {
      const durationMs = Math.round(performance.now() - startTime);
      trackDBOperation({
        operation,
        action,
        resource,
        documentCount: 0,
        cached: false,
        durationMs,
        status: 'failed',
        errorMessage: error?.message || String(error),
        page,
      });
      throw error;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Manually update a specific cache entry (e.g., after a local update)
 */
export function setCachedData<T>(cacheKey: string, data: T, ttlMs = DEFAULT_TTL_MS) {
  memoryCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + ttlMs,
    timestamp: Date.now(),
  });
}

/**
 * Invalidate cache keys matching a prefix or regex pattern
 */
export function invalidateCache(patternOrPrefix: string | RegExp) {
  const isRegex = patternOrPrefix instanceof RegExp;
  for (const key of memoryCache.keys()) {
    if (isRegex ? patternOrPrefix.test(key) : key.startsWith(patternOrPrefix)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Clears the entire in-memory cache
 */
export function invalidateAllCache() {
  memoryCache.clear();
  inFlightRequests.clear();
}
