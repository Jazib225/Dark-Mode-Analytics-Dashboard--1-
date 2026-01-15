import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/markets/trending - Trending markets sorted by volume
 * GET /api/markets/new - New markets sorted by creation date
 * GET /api/markets/nearly-resolved - Markets resolving soon
 * 
 * Query params:
 * - limit: number (default 50)
 * - offset: number (default 0)
 * - hoursAhead: number (for nearly-resolved, default 72)
 */

const GAMMA_API = 'https://gamma-api.polymarket.com';

// =============================================================================
// Types
// =============================================================================
interface MarketCardDTO {
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
}

// =============================================================================
// In-memory cache for Vercel serverless (per-instance)
// =============================================================================
interface CacheEntry {
    data: MarketCardDTO[];
    timestamp: number;
    staleAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_FRESH_MS = 15000;  // 15s fresh
const CACHE_STALE_MS = 60000;  // 60s stale-while-revalidate

// =============================================================================
// Transform Functions
// =============================================================================
function transformToMarketCard(raw: any, eventTitle?: string): MarketCardDTO {
    // Parse outcome prices
    let outcomePrices: number[] = [0.5, 0.5];
    if (raw.outcomePrices) {
        try {
            const prices = typeof raw.outcomePrices === 'string'
                ? JSON.parse(raw.outcomePrices)
                : raw.outcomePrices;
            if (Array.isArray(prices)) {
                outcomePrices = prices.map((p: any) => parseFloat(String(p)) || 0.5);
            }
        } catch (e) { /* use defaults */ }
    }

    // Fallback price from bestBid
    if (outcomePrices[0] === 0.5 && raw.bestBid) {
        const bid = parseFloat(String(raw.bestBid));
        if (!isNaN(bid) && bid > 0 && bid < 1) {
            outcomePrices = [bid, 1 - bid];
        }
    }

    // Parse outcomes
    let outcomes: string[] = ['Yes', 'No'];
    if (raw.outcomes) {
        try {
            outcomes = typeof raw.outcomes === 'string'
                ? JSON.parse(raw.outcomes)
                : (Array.isArray(raw.outcomes) ? raw.outcomes : ['Yes', 'No']);
        } catch (e) { /* use defaults */ }
    }

    // Determine status
    let status: 'active' | 'closed' | 'resolved' = 'active';
    if (raw.closed) {
        status = 'closed';
    } else if (raw.active === false) {
        status = 'resolved';
    }

    return {
        id: raw.id || raw.conditionId || '',
        slug: raw.slug || '',
        question: raw.question || raw.title || 'Unknown Market',
        image: raw.image || null,
        outcomes,
        outcomePrices,
        probability: Math.round(outcomePrices[0] * 1000) / 10,
        volume24hr: parseFloat(String(raw.volume24hr || 0)) || 0,
        volume7d: parseFloat(String(raw.volume1wk || raw.volume7d || 0)) || 0,
        volume1mo: parseFloat(String(raw.volume1mo || 0)) || 0,
        liquidity: parseFloat(String(raw.liquidity || raw.liquidityNum || 0)) || 0,
        status,
        category: raw.tag || raw.category || raw.groupItemTitle || null,
        eventTitle: eventTitle || null,
        endDate: raw.endDate || null,
        createdAt: raw.createdAt || new Date().toISOString(),
        lastUpdated: Date.now(),
    };
}

function extractMarketsFromEvents(events: any[]): MarketCardDTO[] {
    if (!Array.isArray(events)) return [];

    const markets: MarketCardDTO[] = [];

    for (const event of events) {
        if (!Array.isArray(event.markets)) continue;

        for (const market of event.markets) {
            if (market.active === false || market.closed) continue;
            if (!market.question && !market.title) continue;

            markets.push(transformToMarketCard(market, event.title));
        }
    }

    return markets;
}

// =============================================================================
// Handler
// =============================================================================
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const startTime = Date.now();

    try {
        // Get path segments: /api/markets/trending -> ['trending']
        const pathSegments = req.query.type as string | string[] | undefined;
        const type = Array.isArray(pathSegments) ? pathSegments[0] : (pathSegments || 'trending');

        const limit = parseInt(String(req.query.limit || '50'), 10);
        const offset = parseInt(String(req.query.offset || '0'), 10);
        const hoursAhead = parseInt(String(req.query.hoursAhead || '72'), 10);

        const cacheKey = `${type}:${limit}:${offset}${type === 'nearly-resolved' ? `:${hoursAhead}` : ''}`;

        // Check cache
        const cached = cache.get(cacheKey);
        const now = Date.now();

        if (cached && now < cached.staleAt) {
            // Fresh cache hit
            const duration = Date.now() - startTime;

            // Set cache headers
            res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');

            return res.json({
                success: true,
                data: cached.data,
                meta: {
                    count: cached.data.length,
                    type,
                    duration,
                    cached: true,
                },
            });
        }

        // Fetch from Gamma API
        const url = `${GAMMA_API}/events?limit=500&active=true&closed=false`;

        console.log(`[Markets API] Fetching ${type} markets from Gamma...`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Polymarket-Dashboard/2.0',
                'Accept': 'application/json',
            },
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`Gamma API error: ${response.status}`);
        }

        const events = await response.json();
        let markets = extractMarketsFromEvents(events);

        // Sort and filter based on type
        switch (type) {
            case 'trending':
                markets.sort((a, b) => b.volume24hr - a.volume24hr);
                break;

            case 'new':
                markets.sort((a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                break;

            case 'nearly-resolved':
                const cutoff = now + hoursAhead * 60 * 60 * 1000;
                markets = markets.filter(m => {
                    if (!m.endDate) return false;
                    const endTime = new Date(m.endDate).getTime();
                    if (isNaN(endTime)) return false;
                    return endTime > now && endTime < cutoff;
                });
                markets.sort((a, b) =>
                    new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime()
                );

                // Fallback if no markets in window
                if (markets.length === 0) {
                    const allWithEndDate = extractMarketsFromEvents(events)
                        .filter(m => m.endDate && !isNaN(new Date(m.endDate).getTime()) && new Date(m.endDate).getTime() > now)
                        .sort((a, b) =>
                            new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime()
                        );
                    markets = allWithEndDate;
                }
                break;

            default:
                markets.sort((a, b) => b.volume24hr - a.volume24hr);
        }

        // Apply pagination
        const paginatedMarkets = markets.slice(offset, offset + limit);

        // Update cache
        cache.set(cacheKey, {
            data: paginatedMarkets,
            timestamp: now,
            staleAt: now + CACHE_FRESH_MS,
        });

        const duration = Date.now() - startTime;

        console.log(`[Markets API] ${type}: ${paginatedMarkets.length} markets in ${duration}ms`);

        // Set cache headers
        res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');

        return res.json({
            success: true,
            data: paginatedMarkets,
            meta: {
                count: paginatedMarkets.length,
                totalAvailable: markets.length,
                type,
                duration,
                cached: false,
            },
        });

    } catch (error) {
        console.error('[Markets API] Error:', error);

        // Try to return stale cache on error
        const pathSegments = req.query.type as string | string[] | undefined;
        const type = Array.isArray(pathSegments) ? pathSegments[0] : (pathSegments || 'trending');
        const limit = parseInt(String(req.query.limit || '50'), 10);
        const offset = parseInt(String(req.query.offset || '0'), 10);
        const cacheKey = `${type}:${limit}:${offset}`;

        const staleCache = cache.get(cacheKey);
        if (staleCache) {
            console.log('[Markets API] Returning stale cache due to error');
            return res.json({
                success: true,
                data: staleCache.data,
                meta: {
                    count: staleCache.data.length,
                    type,
                    duration: Date.now() - startTime,
                    cached: true,
                    stale: true,
                },
            });
        }

        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch markets',
        });
    }
}
