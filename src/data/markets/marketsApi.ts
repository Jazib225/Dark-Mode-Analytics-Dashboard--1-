/**
 * Optimized Markets API Client
 * 
 * This client fetches market data from our backend endpoints, NOT directly
 * from Polymarket APIs. The backend handles:
 * - API routing (Gamma for metadata, CLOB for prices)
 * - Caching with stale-while-revalidate
 * - Request deduplication
 * - Rate limiting protection
 * 
 * Performance optimizations:
 * - Client-side caching layer
 * - Request deduplication
 * - Parallel fetching
 * - Performance instrumentation
 */

const isDev = import.meta.env.DEV;

// =============================================================================
// API Configuration
// =============================================================================
function getApiBase(): string {
    if (isDev) {
        return "http://localhost:3001/api";
    }
    return "/api";
}

const API_BASE = getApiBase();
// Note: Legacy proxy removed - now using unified backend API

// =============================================================================
// Performance Instrumentation
// =============================================================================
const DEBUG_PERF = import.meta.env.DEV;

interface PerfMark {
    start: number;
    end?: number;
    duration?: number;
}

const perfMarks = new Map<string, PerfMark>();

function perfStart(label: string): void {
    if (DEBUG_PERF) {
        perfMarks.set(label, { start: performance.now() });
    }
}

function perfEnd(label: string): number {
    if (DEBUG_PERF) {
        const mark = perfMarks.get(label);
        if (mark) {
            mark.end = performance.now();
            mark.duration = mark.end - mark.start;
            console.log(`⏱️ ${label}: ${mark.duration.toFixed(2)}ms`);
            return mark.duration;
        }
    }
    return 0;
}

// =============================================================================
// Types - Slim DTOs matching backend
// =============================================================================
export interface MarketSummary {
    id: string;
    slug: string;
    question: string;
    image: string | null;
    outcomes: string[];
    outcomePrices: number[];
    probability: number;
    volume24hr: number;
    volume7d: number;
    volume1mo: number;
    liquidity: number;
    status: 'active' | 'closed' | 'resolved';
    category: string | null;
    eventTitle: string | null;
    endDate: string | null;
    createdAt: string;
    lastUpdated: number;
    // Computed fields
    title: string;
    yesPrice: number;
    noPrice: number;
}

export interface MarketDetail extends MarketSummary {
    description: string;
    conditionId: string;
    clobTokenIds: string[];
}

export interface OrderBook {
    marketId: string;
    tokenId: string;
    bids: Array<{ price: number; size: number }>;
    asks: Array<{ price: number; size: number }>;
    bestBid: number;
    bestAsk: number;
    mid: number;
    spread: number;
    lastUpdated: number;
}

// =============================================================================
// Request Deduplication
// =============================================================================
const inflightRequests = new Map<string, Promise<any>>();

async function dedupedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
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
// Client-side Cache - Stale-While-Revalidate pattern
// =============================================================================
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    staleAt: number;
    expiresAt: number;
}

const marketCache = new Map<string, CacheEntry<any>>();

const CACHE_FRESH_MS = 10_000;   // 10s fresh
const CACHE_MAX_MS = 300_000;    // 5m hard expiry

function getCached<T>(key: string): { data: T; isStale: boolean; isExpired: boolean } | null {
    const entry = marketCache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const isStale = now > entry.staleAt;
    const isExpired = now > entry.expiresAt;

    if (isExpired) {
        marketCache.delete(key);
        return null;
    }

    return { data: entry.data, isStale, isExpired };
}

function setCache<T>(key: string, data: T): void {
    const now = Date.now();
    marketCache.set(key, {
        data,
        timestamp: now,
        staleAt: now + CACHE_FRESH_MS,
        expiresAt: now + CACHE_MAX_MS,
    });
}

// Cache stats for debugging
export function getCacheStats() {
    return {
        size: marketCache.size,
        entries: Array.from(marketCache.keys()),
    };
}

// =============================================================================
// Fast Fetch with Timeout
// =============================================================================
async function fastFetch(url: string, timeoutMs = 8000): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { signal: controller.signal });
        return response;
    } finally {
        clearTimeout(timeout);
    }
}

// =============================================================================
// API Response Transformation
// =============================================================================
function transformApiMarket(raw: any): MarketSummary {
    return {
        ...raw,
        // Computed fields for backwards compatibility
        title: raw.question || 'Unknown Market',
        yesPrice: raw.outcomePrices?.[0] || 0.5,
        noPrice: raw.outcomePrices?.[1] || 0.5,
    };
}

// =============================================================================
// Main API Functions
// =============================================================================

/**
 * Fetch trending markets (sorted by volume)
 */
export async function fetchTrendingMarkets(
    limit: number = 50,
    offset: number = 0
): Promise<{ markets: MarketSummary[]; fromCache: boolean; fetchTime: number }> {
    const cacheKey = `trending:${limit}:${offset}`;
    perfStart(cacheKey);

    // Check cache
    const cached = getCached<MarketSummary[]>(cacheKey);
    if (cached && !cached.isStale) {
        perfEnd(cacheKey);
        return { markets: cached.data, fromCache: true, fetchTime: 0 };
    }

    // Fetch with deduplication
    const fetchPromise = dedupedFetch(cacheKey, async () => {
        const start = performance.now();
        const url = `${API_BASE}/markets?type=trending&limit=${limit}&offset=${offset}`;

        const response = await fastFetch(url);
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();
        const fetchTime = performance.now() - start;

        const markets = (result.data || []).map(transformApiMarket);
        return { markets, fetchTime };
    });

    // Return stale cache while refreshing
    if (cached?.isStale) {
        fetchPromise.then(result => {
            setCache(cacheKey, result.markets);
        }).catch(console.error);

        perfEnd(cacheKey);
        return { markets: cached.data, fromCache: true, fetchTime: 0 };
    }

    const result = await fetchPromise;
    setCache(cacheKey, result.markets);
    perfEnd(cacheKey);

    return { ...result, fromCache: false };
}

/**
 * Fetch new markets (sorted by creation date)
 */
export async function fetchNewMarkets(
    limit: number = 30,
    offset: number = 0
): Promise<{ markets: MarketSummary[]; fromCache: boolean; fetchTime: number }> {
    const cacheKey = `new:${limit}:${offset}`;
    perfStart(cacheKey);

    const cached = getCached<MarketSummary[]>(cacheKey);
    if (cached && !cached.isStale) {
        perfEnd(cacheKey);
        return { markets: cached.data, fromCache: true, fetchTime: 0 };
    }

    const fetchPromise = dedupedFetch(cacheKey, async () => {
        const start = performance.now();
        const url = `${API_BASE}/markets?type=new&limit=${limit}&offset=${offset}`;

        const response = await fastFetch(url);
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();
        const fetchTime = performance.now() - start;

        const markets = (result.data || []).map(transformApiMarket);
        return { markets, fetchTime };
    });

    if (cached?.isStale) {
        fetchPromise.then(result => setCache(cacheKey, result.markets)).catch(console.error);
        perfEnd(cacheKey);
        return { markets: cached.data, fromCache: true, fetchTime: 0 };
    }

    const result = await fetchPromise;
    setCache(cacheKey, result.markets);
    perfEnd(cacheKey);

    return { ...result, fromCache: false };
}

/**
 * Fetch nearly resolved markets (sorted by end date)
 */
export async function fetchNearlyResolvedMarkets(
    limit: number = 30,
    offset: number = 0,
    hoursAhead: number = 72
): Promise<{ markets: MarketSummary[]; fromCache: boolean; fetchTime: number }> {
    const cacheKey = `resolving:${limit}:${offset}:${hoursAhead}`;
    perfStart(cacheKey);

    const cached = getCached<MarketSummary[]>(cacheKey);
    if (cached && !cached.isStale) {
        perfEnd(cacheKey);
        return { markets: cached.data, fromCache: true, fetchTime: 0 };
    }

    const fetchPromise = dedupedFetch(cacheKey, async () => {
        const start = performance.now();
        const url = `${API_BASE}/markets?type=nearly-resolved&limit=${limit}&offset=${offset}&hoursAhead=${hoursAhead}`;

        const response = await fastFetch(url);
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();
        const fetchTime = performance.now() - start;

        const markets = (result.data || []).map(transformApiMarket);
        return { markets, fetchTime };
    });

    if (cached?.isStale) {
        fetchPromise.then(result => setCache(cacheKey, result.markets)).catch(console.error);
        perfEnd(cacheKey);
        return { markets: cached.data, fromCache: true, fetchTime: 0 };
    }

    const result = await fetchPromise;
    setCache(cacheKey, result.markets);
    perfEnd(cacheKey);

    return { ...result, fromCache: false };
}

/**
 * Fetch market detail by ID
 */
export async function fetchMarketDetail(
    marketId: string
): Promise<{ market: MarketDetail | null; fromCache: boolean; fetchTime: number }> {
    if (!marketId) {
        return { market: null, fromCache: false, fetchTime: 0 };
    }

    const cacheKey = `detail:${marketId}`;
    perfStart(cacheKey);

    const cached = getCached<MarketDetail>(cacheKey);
    if (cached && !cached.isStale) {
        perfEnd(cacheKey);
        return { market: cached.data, fromCache: true, fetchTime: 0 };
    }

    const fetchPromise = dedupedFetch(cacheKey, async () => {
        const start = performance.now();
        const url = `${API_BASE}/markets/${marketId}`;

        const response = await fastFetch(url);
        if (!response.ok) {
            throw new Error(`Market not found: ${response.status}`);
        }

        const result = await response.json();
        const fetchTime = performance.now() - start;

        const market = result.data ? transformApiMarket(result.data) as MarketDetail : null;
        return { market, fetchTime };
    });

    if (cached?.isStale) {
        fetchPromise.then(result => {
            if (result.market) setCache(cacheKey, result.market);
        }).catch(console.error);
        perfEnd(cacheKey);
        return { market: cached.data, fromCache: true, fetchTime: 0 };
    }

    const result = await fetchPromise;
    if (result.market) setCache(cacheKey, result.market);
    perfEnd(cacheKey);

    return { ...result, fromCache: false };
}

/**
 * Fetch orderbook for a market
 */
export async function fetchOrderBook(
    marketId: string,
    tokenId: string
): Promise<{ orderbook: OrderBook | null; fromCache: boolean; fetchTime: number }> {
    if (!tokenId) {
        return { orderbook: null, fromCache: false, fetchTime: 0 };
    }

    const cacheKey = `orderbook:${tokenId}`;
    perfStart(cacheKey);

    // Shorter cache for orderbook (5s)
    const cached = getCached<OrderBook>(cacheKey);
    if (cached && !cached.isStale) {
        perfEnd(cacheKey);
        return { orderbook: cached.data, fromCache: true, fetchTime: 0 };
    }

    const fetchPromise = dedupedFetch(cacheKey, async () => {
        const start = performance.now();
        const url = `${API_BASE}/markets/${marketId}/orderbook?tokenId=${tokenId}`;

        const response = await fastFetch(url, 5000); // Shorter timeout for orderbook
        if (!response.ok) {
            console.warn(`Orderbook error: ${response.status}`);
            return { orderbook: null, fetchTime: performance.now() - start };
        }

        const result = await response.json();
        const fetchTime = performance.now() - start;

        return { orderbook: result.data || null, fetchTime };
    });

    if (cached?.isStale) {
        fetchPromise.then(result => {
            if (result.orderbook) setCache(cacheKey, result.orderbook);
        }).catch(console.error);
        perfEnd(cacheKey);
        return { orderbook: cached.data, fromCache: true, fetchTime: 0 };
    }

    const result = await fetchPromise;
    if (result.orderbook) {
        setCache(cacheKey, result.orderbook);
    }
    perfEnd(cacheKey);

    return { ...result, fromCache: false };
}

// =============================================================================
// Legacy Compatibility Functions
// These maintain backwards compatibility with existing code
// =============================================================================

/**
 * Fetch markets summary - maintains backwards compatibility
 */
export async function fetchMarketsSummary(options: {
    limit?: number;
    offset?: number;
    category?: string;
    sortBy?: 'volume' | 'newest' | 'endingSoon';
}): Promise<{ markets: MarketSummary[]; fromCache: boolean; fetchTime: number }> {
    const { limit = 50, offset = 0, sortBy = 'volume' } = options;

    switch (sortBy) {
        case 'newest':
            return fetchNewMarkets(limit, offset);
        case 'endingSoon':
            return fetchNearlyResolvedMarkets(limit, offset);
        default:
            return fetchTrendingMarkets(limit, offset);
    }
}

/**
 * Get trending markets from a list (memoized selector)
 */
let lastTrendingInput: MarketSummary[] | null = null;
let lastTrendingResult: MarketSummary[] | null = null;

export function getTrendingMarkets(markets: MarketSummary[], limit = 30): MarketSummary[] {
    if (markets === lastTrendingInput && lastTrendingResult) {
        return lastTrendingResult;
    }

    lastTrendingInput = markets;
    lastTrendingResult = [...markets]
        .sort((a, b) => b.volume24hr - a.volume24hr)
        .slice(0, limit);

    return lastTrendingResult;
}

/**
 * Get new markets from a list (memoized selector)
 */
let lastNewInput: MarketSummary[] | null = null;
let lastNewResult: MarketSummary[] | null = null;

export function getNewMarkets(markets: MarketSummary[], limit = 30): MarketSummary[] {
    if (markets === lastNewInput && lastNewResult) {
        return lastNewResult;
    }

    lastNewInput = markets;
    lastNewResult = [...markets]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);

    return lastNewResult;
}

/**
 * Get resolving soon markets from a list (memoized selector)
 */
let lastResolvingInput: MarketSummary[] | null = null;
let lastResolvingResult: MarketSummary[] | null = null;

export function getResolvingSoonMarkets(markets: MarketSummary[], hoursAhead = 168, limit = 30): MarketSummary[] {
    if (markets === lastResolvingInput && lastResolvingResult) {
        return lastResolvingResult;
    }

    const now = Date.now();
    const cutoff = now + hoursAhead * 60 * 60 * 1000;

    const filtered = markets.filter(m => {
        if (!m.endDate) return false;
        const endTime = new Date(m.endDate).getTime();
        if (isNaN(endTime)) return false;
        return endTime > now && endTime < cutoff;
    });

    lastResolvingInput = markets;
    lastResolvingResult = filtered
        .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime())
        .slice(0, limit);

    // Fallback if no markets within window
    if (lastResolvingResult.length === 0) {
        lastResolvingResult = markets
            .filter(m => m.endDate && !isNaN(new Date(m.endDate).getTime()))
            .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime())
            .slice(0, limit);
    }

    return lastResolvingResult;
}

// =============================================================================
// Prefetching
// =============================================================================

export function prefetchMarkets(): void {
    // Prefetch all three column types in parallel
    Promise.all([
        fetchTrendingMarkets(100, 0),
        fetchNewMarkets(50, 0),
        fetchNearlyResolvedMarkets(50, 0),
    ]).catch(console.error);
}

export function prefetchMarketDetail(marketId: string): void {
    fetchMarketDetail(marketId).catch(() => { });
}

// =============================================================================
// Batch Fetch for Multiple Markets
// =============================================================================

export async function fetchMarketsBatch(ids: string[]): Promise<Map<string, MarketSummary>> {
    const results = new Map<string, MarketSummary>();
    if (ids.length === 0) return results;

    // Check cache first
    const uncachedIds: string[] = [];
    for (const id of ids) {
        const cached = getCached<MarketSummary>(`detail:${id}`);
        if (cached && !cached.isStale) {
            results.set(id, cached.data);
        } else {
            uncachedIds.push(id);
        }
    }

    if (uncachedIds.length === 0) {
        return results;
    }

    // Fetch uncached markets in parallel (max 5 concurrent)
    const batchSize = 5;
    for (let i = 0; i < uncachedIds.length; i += batchSize) {
        const batch = uncachedIds.slice(i, i + batchSize);
        const promises = batch.map(async (id) => {
            try {
                const { market } = await fetchMarketDetail(id);
                if (market) {
                    results.set(id, market);
                }
            } catch (e) {
                console.warn(`Failed to fetch market ${id}:`, e);
            }
        });
        await Promise.all(promises);
    }

    return results;
}
