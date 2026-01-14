/**
 * Optimized Markets API - Uses proxy to avoid CORS, with aggressive caching
 * 
 * Performance optimizations:
 * - Proxy-based API calls (CORS-safe)
 * - Response shaping (only fetch needed fields)
 * - Request deduplication
 * - Stale-while-revalidate caching
 * - Parallel fetching
 * - Performance instrumentation
 */

const isDev = import.meta.env.DEV;

// Use local proxy for dev, Vercel API routes for production
// The proxy at /api/proxy/gamma/* forwards requests to gamma-api.polymarket.com
function getApiBase(): string {
    if (isDev) {
        return "http://localhost:3001/api/proxy/gamma";
    }
    return "/api/proxy/gamma";
}

const GAMMA_API_BASE = getApiBase();

// =============================================================================
// PERFORMANCE INSTRUMENTATION
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
// TYPES - Minimal data for market cards
// =============================================================================
export interface MarketSummary {
    id: string;
    title: string;
    slug: string;
    category: string | null;
    yesPrice: number;
    noPrice: number;
    volume24hr: number;
    volume7d: number;
    volume1mo: number;
    liquidity: number;
    endDate: string | null;
    createdAt: string;
    status: 'active' | 'closed' | 'resolved';
    image: string | null;
    lastUpdated: number;
}

// =============================================================================
// REQUEST DEDUPLICATION
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
// CACHE - Stale-While-Revalidate pattern
// =============================================================================
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    staleAt: number;
    expiresAt: number;
}

const marketCache = new Map<string, CacheEntry<any>>();

const CACHE_FRESH_MS = 15_000;   // 15s fresh
const CACHE_STALE_MS = 60_000;   // 60s stale-but-usable
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
// FAST FETCH WITH TIMEOUT
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
// CORE API FUNCTIONS
// =============================================================================

/**
 * Fetch markets summary - optimized for list view
 * Returns only fields needed for market cards
 */
export async function fetchMarketsSummary(options: {
    limit?: number;
    offset?: number;
    category?: string;
    sortBy?: 'volume' | 'newest' | 'endingSoon';
}): Promise<{ markets: MarketSummary[]; fromCache: boolean; fetchTime: number }> {
    const { limit = 50, offset = 0, sortBy = 'volume', category } = options;

    const cacheKey = `markets:${sortBy}:${limit}:${offset}:${category || 'all'}`;
    perfStart(cacheKey);

    // Check cache
    const cached = getCached<MarketSummary[]>(cacheKey);
    if (cached && !cached.isStale) {
        perfEnd(cacheKey);
        return { markets: cached.data, fromCache: true, fetchTime: 0 };
    }

    // Build URL based on sort
    let url: string;
    const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        closed: 'false',
        active: 'true',
    });

    if (sortBy === 'newest') {
        params.set('order', 'createdAt');
        params.set('ascending', 'false');
        url = `${GAMMA_API_BASE}/markets?${params}`;
    } else if (sortBy === 'endingSoon') {
        params.set('order', 'endDate');
        params.set('ascending', 'true');
        url = `${GAMMA_API_BASE}/markets?${params}`;
    } else {
        // Default: volume (trending) - use events endpoint for richer data
        url = `${GAMMA_API_BASE}/events?${params}`;
    }

    // Fetch with deduplication
    const fetchPromise = dedupedFetch(cacheKey, async () => {
        const start = performance.now();
        const response = await fastFetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const fetchTime = performance.now() - start;

        // Transform response based on endpoint
        let markets: MarketSummary[];

        if (sortBy === 'volume') {
            // Events endpoint returns array of events with nested markets
            markets = transformEventsResponse(data);
        } else {
            // Markets endpoint returns flat array
            markets = transformMarketsResponse(Array.isArray(data) ? data : data.data || []);
        }

        // Apply category filter if needed
        if (category) {
            markets = markets.filter(m =>
                m.category?.toLowerCase().includes(category.toLowerCase())
            );
        }

        return { markets, fetchTime };
    });

    // If stale cache exists, return immediately and refresh in background
    if (cached?.isStale) {
        fetchPromise.then(result => {
            setCache(cacheKey, result.markets);
        }).catch(console.error);

        perfEnd(cacheKey);
        return { markets: cached.data, fromCache: true, fetchTime: 0 };
    }

    // Wait for fresh data
    const result = await fetchPromise;
    setCache(cacheKey, result.markets);

    perfEnd(cacheKey);
    return { ...result, fromCache: false };
}

/**
 * Batch fetch market details by IDs
 * Avoids N+1 pattern - fetches all at once
 */
export async function fetchMarketsBatch(ids: string[]): Promise<Map<string, MarketSummary>> {
    const results = new Map<string, MarketSummary>();
    if (ids.length === 0) return results;

    perfStart('batch:' + ids.length);

    // Check cache first
    const uncachedIds: string[] = [];
    for (const id of ids) {
        const cached = getCached<MarketSummary>(`market:${id}`);
        if (cached && !cached.isStale) {
            results.set(id, cached.data);
        } else {
            uncachedIds.push(id);
        }
    }

    if (uncachedIds.length === 0) {
        perfEnd('batch:' + ids.length);
        return results;
    }

    // Fetch uncached markets in parallel (max 5 concurrent)
    const batchSize = 5;
    for (let i = 0; i < uncachedIds.length; i += batchSize) {
        const batch = uncachedIds.slice(i, i + batchSize);
        const promises = batch.map(async (id) => {
            try {
                const response = await fastFetch(`${GAMMA_API_BASE}/markets/${id}`);
                if (response.ok) {
                    const data = await response.json();
                    const market = transformSingleMarket(data);
                    if (market) {
                        setCache(`market:${id}`, market);
                        results.set(id, market);
                    }
                }
            } catch (e) {
                console.warn(`Failed to fetch market ${id}:`, e);
            }
        });
        await Promise.all(promises);
    }

    perfEnd('batch:' + ids.length);
    return results;
}

// =============================================================================
// MEMOIZED SELECTORS
// =============================================================================

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

let lastResolvingInput: MarketSummary[] | null = null;
let lastResolvingResult: MarketSummary[] | null = null;

export function getResolvingSoonMarkets(markets: MarketSummary[], hoursAhead = 168, limit = 30): MarketSummary[] {
    // Reset memoization if input changed
    if (markets === lastResolvingInput && lastResolvingResult) {
        return lastResolvingResult;
    }

    const now = Date.now();
    // Use 7 days (168 hours) as default cutoff for more results
    const cutoff = now + hoursAhead * 60 * 60 * 1000;

    console.log(`🔍 Filtering ${markets.length} markets for those ending within ${hoursAhead} hours`);

    const filtered = markets.filter(m => {
        if (!m.endDate) return false;

        // Try to parse the date
        const endTime = new Date(m.endDate).getTime();
        if (isNaN(endTime)) return false;

        // Market must end after now and before cutoff
        return endTime > now && endTime < cutoff;
    });

    console.log(`📊 Found ${filtered.length} markets resolving soon`);

    lastResolvingInput = markets;
    lastResolvingResult = filtered
        .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime())
        .slice(0, limit);

    // If no markets found, return markets with any endDate (as fallback)
    if (lastResolvingResult.length === 0) {
        console.log('⚠️ No markets within time range, showing all markets with endDate');
        lastResolvingResult = markets
            .filter(m => m.endDate && !isNaN(new Date(m.endDate).getTime()))
            .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime())
            .slice(0, limit);
    }

    return lastResolvingResult;
}

// =============================================================================
// RESPONSE TRANSFORMERS
// =============================================================================

function transformEventsResponse(events: any[]): MarketSummary[] {
    if (!Array.isArray(events)) return [];

    const markets: MarketSummary[] = [];

    for (const event of events) {
        if (!Array.isArray(event.markets)) continue;

        for (const m of event.markets) {
            const market = transformSingleMarket(m, event.title);
            if (market) markets.push(market);
        }
    }

    // Sort by volume descending
    return markets.sort((a, b) => b.volume24hr - a.volume24hr);
}

function transformMarketsResponse(data: any[]): MarketSummary[] {
    return data
        .map(m => transformSingleMarket(m))
        .filter((m): m is MarketSummary => m !== null);
}

function transformSingleMarket(m: any, eventTitle?: string): MarketSummary | null {
    if (!m || (!m.question && !m.title)) return null;

    // Parse outcome prices
    let yesPrice = 0.5;
    let noPrice = 0.5;

    if (m.outcomePrices) {
        try {
            const prices = typeof m.outcomePrices === 'string'
                ? JSON.parse(m.outcomePrices)
                : m.outcomePrices;
            if (Array.isArray(prices) && prices.length > 0) {
                yesPrice = parseFloat(prices[0]) || 0.5;
                noPrice = prices.length > 1 ? parseFloat(prices[1]) : 1 - yesPrice;
            }
        } catch (e) {
            // Use defaults
        }
    }

    // Fallback to bestBid
    if (yesPrice === 0.5 && m.bestBid) {
        const bid = parseFloat(m.bestBid);
        if (bid > 0 && bid < 1) {
            yesPrice = bid;
            noPrice = 1 - bid;
        }
    }

    return {
        id: m.id || m.conditionId || '',
        title: m.question || m.title || '',
        slug: m.slug || '',
        category: m.groupItemTitle || eventTitle || m.category || null,
        yesPrice,
        noPrice,
        volume24hr: parseFloat(m.volume24hr || 0),
        volume7d: parseFloat(m.volume1wk || m.volume7d || 0),
        volume1mo: parseFloat(m.volume1mo || 0),
        liquidity: parseFloat(m.liquidity || 0),
        endDate: m.endDate || null,
        createdAt: m.createdAt || new Date().toISOString(),
        status: m.closed ? 'closed' : (m.active === false ? 'resolved' : 'active'),
        image: m.image || null,
        lastUpdated: Date.now(),
    };
}

// =============================================================================
// PREFETCHING
// =============================================================================

export function prefetchMarkets(): void {
    // Prefetch trending, new, and resolving in parallel
    Promise.all([
        fetchMarketsSummary({ sortBy: 'volume', limit: 100 }),
        fetchMarketsSummary({ sortBy: 'newest', limit: 50 }),
        fetchMarketsSummary({ sortBy: 'endingSoon', limit: 50 }),
    ]).catch(console.error);
}
