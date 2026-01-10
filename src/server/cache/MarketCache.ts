/**
 * Server-side LRU Cache for Market Data
 * Implements stale-while-revalidate pattern for instant responses
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  staleAt: number;
  expiresAt: number;
}

interface CacheOptions {
  maxSize?: number;
  defaultTTL?: number; // Time until stale (serve immediately, revalidate in background)
  maxTTL?: number;     // Time until expired (must refetch)
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private defaultTTL: number;
  private maxTTL: number;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 100;
    this.defaultTTL = options.defaultTTL || 30000; // 30s until stale
    this.maxTTL = options.maxTTL || 300000; // 5min until expired
  }

  get(key: string): { data: T; isStale: boolean } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();

    // Entry has completely expired
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return {
      data: entry.data,
      isStale: now > entry.staleAt,
    };
  }

  set(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const staleTTL = ttl || this.defaultTTL;

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      staleAt: now + staleTTL,
      expiresAt: now + this.maxTTL,
    });
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// =============================================================================
// Market-specific caches with appropriate TTLs
// =============================================================================

// Market list cache (longer TTL - 2min stale, 10min max)
export const marketListCache = new LRUCache<any>({
  maxSize: 50,
  defaultTTL: 120000,  // 2 minutes until stale
  maxTTL: 600000,      // 10 minutes until expired
});

// Market metadata cache (longer TTL - 3min stale, 15min max)
export const marketMetadataCache = new LRUCache<any>({
  maxSize: 500,
  defaultTTL: 180000,  // 3 minutes until stale
  maxTTL: 900000,      // 15 minutes until expired
});

// Event cache (longer TTL - 2min stale, 10min max)
export const eventCache = new LRUCache<any>({
  maxSize: 100,
  defaultTTL: 120000,  // 2 minutes until stale
  maxTTL: 600000,      // 10 minutes until expired
});

// Order book cache (very short TTL - 5s stale, 15s max)
export const orderBookCache = new LRUCache<any>({
  maxSize: 200,
  defaultTTL: 5000,   // 5 seconds until stale
  maxTTL: 15000,      // 15 seconds until expired
});

// =============================================================================
// Cache key generators
// =============================================================================

export function generateMarketListKey(params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return `markets:list:${sortedParams}`;
}

export function generateMarketDetailKey(marketId: string): string {
  return `markets:detail:${marketId}`;
}

export function generateEventKey(params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return `events:${sortedParams}`;
}

export function generateOrderBookKey(tokenId: string): string {
  return `orderbook:${tokenId}`;
}

// =============================================================================
// Timing instrumentation
// =============================================================================

interface TimingLog {
  operation: string;
  duration: number;
  cacheHit: boolean;
  timestamp: number;
}

const timingLogs: TimingLog[] = [];
const MAX_TIMING_LOGS = 1000;

export function logTiming(operation: string, duration: number, cacheHit: boolean): void {
  const log: TimingLog = {
    operation,
    duration,
    cacheHit,
    timestamp: Date.now(),
  };

  timingLogs.push(log);

  // Keep only recent logs
  if (timingLogs.length > MAX_TIMING_LOGS) {
    timingLogs.shift();
  }

  // Log slow operations (> 500ms)
  if (duration > 500) {
    console.warn(`⚠️ Slow operation: ${operation} took ${duration}ms (cache: ${cacheHit})`);
  } else {
    console.log(`⏱️ ${operation}: ${duration}ms (cache: ${cacheHit})`);
  }
}

export function getTimingStats(): {
  avgDuration: number;
  cacheHitRate: number;
  slowOperations: number;
  recentLogs: TimingLog[];
} {
  if (timingLogs.length === 0) {
    return { avgDuration: 0, cacheHitRate: 0, slowOperations: 0, recentLogs: [] };
  }

  const totalDuration = timingLogs.reduce((sum, log) => sum + log.duration, 0);
  const cacheHits = timingLogs.filter(log => log.cacheHit).length;
  const slowOps = timingLogs.filter(log => log.duration > 500).length;

  return {
    avgDuration: totalDuration / timingLogs.length,
    cacheHitRate: (cacheHits / timingLogs.length) * 100,
    slowOperations: slowOps,
    recentLogs: timingLogs.slice(-20),
  };
}

// =============================================================================
// Background revalidation
// =============================================================================

const revalidationQueue: Map<string, Promise<any>> = new Map();

export async function getWithRevalidation<T>(
  key: string,
  cache: LRUCache<T>,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const startTime = Date.now();
  const cached = cache.get(key);

  if (cached) {
    // If stale, trigger background revalidation
    if (cached.isStale && !revalidationQueue.has(key)) {
      const revalidationPromise = (async () => {
        try {
          const freshData = await fetcher();
          cache.set(key, freshData, ttl);
          return freshData;
        } finally {
          revalidationQueue.delete(key);
        }
      })();
      revalidationQueue.set(key, revalidationPromise);
    }

    logTiming(`cache:${key.split(':')[0]}`, Date.now() - startTime, true);
    return cached.data;
  }

  // Cache miss - fetch fresh data
  const data = await fetcher();
  cache.set(key, data, ttl);

  logTiming(`fetch:${key.split(':')[0]}`, Date.now() - startTime, false);
  return data;
}
