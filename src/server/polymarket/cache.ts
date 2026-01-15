/**
 * Server-side Cache for Polymarket Data
 * 
 * Implements stale-while-revalidate pattern with:
 * - LRU eviction
 * - Request deduplication
 * - Configurable TTLs per data type
 * - Timing instrumentation
 */

// =============================================================================
// Cache Entry Type
// =============================================================================
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    staleAt: number;
    expiresAt: number;
}

// =============================================================================
// LRU Cache Implementation
// =============================================================================
interface CacheOptions {
    maxSize?: number;
    freshTTL?: number;    // Time until stale (serve immediately, revalidate in background)
    staleTTL?: number;    // Time until expired (serve stale data while revalidating)
    maxTTL?: number;      // Hard expiry (must refetch)
}

export class LRUCache<T> {
    private cache: Map<string, CacheEntry<T>> = new Map();
    private maxSize: number;
    private freshTTL: number;
    private staleTTL: number;
    private maxTTL: number;

    constructor(options: CacheOptions = {}) {
        this.maxSize = options.maxSize || 100;
        this.freshTTL = options.freshTTL || 15000;   // 15s fresh
        this.staleTTL = options.staleTTL || 60000;   // 60s stale
        this.maxTTL = options.maxTTL || 300000;      // 5min max
    }

    get(key: string): { data: T; isStale: boolean; isExpired: boolean } | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const now = Date.now();
        const isStale = now > entry.staleAt;
        const isExpired = now > entry.expiresAt;

        // Entry has completely expired
        if (isExpired) {
            this.cache.delete(key);
            return null;
        }

        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);

        return {
            data: entry.data,
            isStale,
            isExpired: false,
        };
    }

    set(key: string, data: T): void {
        const now = Date.now();

        // Evict oldest entries if at capacity
        while (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            data,
            timestamp: now,
            staleAt: now + this.freshTTL,
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

    stats(): { size: number; maxSize: number; keys: string[] } {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            keys: Array.from(this.cache.keys()),
        };
    }
}

// =============================================================================
// Cache Instances with Appropriate TTLs
// =============================================================================

// Market list cache (Trending, New, Resolving)
// Fresh: 15s, Stale: 60s, Max: 5min
export const marketListCache = new LRUCache<any>({
    maxSize: 50,
    freshTTL: 15000,
    staleTTL: 60000,
    maxTTL: 300000,
});

// Market detail cache
// Fresh: 30s, Stale: 120s, Max: 10min
export const marketDetailCache = new LRUCache<any>({
    maxSize: 500,
    freshTTL: 30000,
    staleTTL: 120000,
    maxTTL: 600000,
});

// Orderbook cache (very short TTL - prices change fast)
// Fresh: 3s, Stale: 10s, Max: 30s
export const orderBookCache = new LRUCache<any>({
    maxSize: 200,
    freshTTL: 3000,
    staleTTL: 10000,
    maxTTL: 30000,
});

// User positions cache
// Fresh: 10s, Stale: 30s, Max: 2min
export const userPositionsCache = new LRUCache<any>({
    maxSize: 100,
    freshTTL: 10000,
    staleTTL: 30000,
    maxTTL: 120000,
});

// =============================================================================
// Request Deduplication
// =============================================================================
const inflightRequests = new Map<string, Promise<any>>();

export async function dedupedFetch<T>(
    key: string,
    fetcher: () => Promise<T>
): Promise<T> {
    const existing = inflightRequests.get(key);
    if (existing) {
        console.log(`🔄 Deduped request: ${key}`);
        return existing;
    }

    const promise = fetcher().finally(() => {
        inflightRequests.delete(key);
    });

    inflightRequests.set(key, promise);
    return promise;
}

// =============================================================================
// Stale-While-Revalidate Helper
// =============================================================================
const revalidationQueue = new Map<string, Promise<any>>();

export async function getWithRevalidation<T>(
    key: string,
    cache: LRUCache<T>,
    fetcher: () => Promise<T>
): Promise<{ data: T; fromCache: boolean; duration: number }> {
    const startTime = Date.now();
    const cached = cache.get(key);

    if (cached) {
        // If stale, trigger background revalidation
        if (cached.isStale && !revalidationQueue.has(key)) {
            const revalidationPromise = (async () => {
                try {
                    const freshData = await fetcher();
                    cache.set(key, freshData);
                    console.log(`✅ Background revalidation complete: ${key}`);
                    return freshData;
                } catch (error) {
                    console.error(`❌ Background revalidation failed: ${key}`, error);
                } finally {
                    revalidationQueue.delete(key);
                }
            })();
            revalidationQueue.set(key, revalidationPromise);
        }

        const duration = Date.now() - startTime;
        logTiming(key, duration, true);
        return { data: cached.data, fromCache: true, duration };
    }

    // Cache miss - fetch fresh data
    const data = await fetcher();
    cache.set(key, data);

    const duration = Date.now() - startTime;
    logTiming(key, duration, false);
    return { data, fromCache: false, duration };
}

// =============================================================================
// Cache Key Generators
// =============================================================================
export function marketListKey(type: 'trending' | 'new' | 'resolving', limit: number, offset: number): string {
    return `markets:list:${type}:${limit}:${offset}`;
}

export function marketDetailKey(marketId: string): string {
    return `markets:detail:${marketId}`;
}

export function orderBookKey(tokenId: string): string {
    return `orderbook:${tokenId}`;
}

export function userPositionsKey(address: string): string {
    return `user:positions:${address}`;
}

// =============================================================================
// Timing Instrumentation
// =============================================================================
interface TimingLog {
    operation: string;
    duration: number;
    cacheHit: boolean;
    timestamp: number;
}

const timingLogs: TimingLog[] = [];
const MAX_TIMING_LOGS = 500;

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

    // Log slow operations (>500ms)
    if (duration > 500) {
        console.warn(`⚠️ Slow operation: ${operation} took ${duration}ms (cache: ${cacheHit})`);
    } else if (process.env.NODE_ENV === 'development') {
        console.log(`⏱️ ${operation}: ${duration}ms (cache: ${cacheHit})`);
    }
}

export function getTimingStats(): {
    avgDuration: number;
    cacheHitRate: number;
    slowOperations: number;
    p95Duration: number;
    recentLogs: TimingLog[];
} {
    if (timingLogs.length === 0) {
        return { avgDuration: 0, cacheHitRate: 0, slowOperations: 0, p95Duration: 0, recentLogs: [] };
    }

    const durations = timingLogs.map(l => l.duration).sort((a, b) => a - b);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const cacheHits = timingLogs.filter(log => log.cacheHit).length;
    const slowOps = timingLogs.filter(log => log.duration > 500).length;
    const p95Index = Math.floor(durations.length * 0.95);

    return {
        avgDuration: Math.round(totalDuration / timingLogs.length),
        cacheHitRate: Math.round((cacheHits / timingLogs.length) * 100),
        slowOperations: slowOps,
        p95Duration: durations[p95Index] || 0,
        recentLogs: timingLogs.slice(-20),
    };
}

// =============================================================================
// Fetch with Timeout Helper
// =============================================================================
export async function fetchWithTimeout(
    url: string,
    options: {
        timeout?: number;
        headers?: Record<string, string>;
    } = {}
): Promise<Response> {
    const { timeout = 8000, headers = {} } = options;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Polymarket-Dashboard/2.0',
                'Accept': 'application/json',
                ...headers,
            },
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// =============================================================================
// Retry with Backoff Helper
// =============================================================================
export async function fetchWithRetry<T>(
    fetcher: () => Promise<T>,
    options: {
        maxRetries?: number;
        initialDelay?: number;
        onRetry?: (attempt: number, error: any) => void;
    } = {}
): Promise<T> {
    const { maxRetries = 2, initialDelay = 500, onRetry } = options;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fetcher();
        } catch (error) {
            lastError = error;

            if (attempt < maxRetries) {
                const delay = initialDelay * Math.pow(2, attempt);
                onRetry?.(attempt + 1, error);
                console.log(`🔄 Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}
