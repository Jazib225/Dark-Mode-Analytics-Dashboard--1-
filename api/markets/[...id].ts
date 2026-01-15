import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/markets/[id] - Get market detail by ID
 * GET /api/markets/[id]/orderbook - Get orderbook for market
 * 
 * Query params for orderbook:
 * - tokenId: string (required)
 */

const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';

// =============================================================================
// Types
// =============================================================================
interface MarketDetailDTO {
    id: string;
    slug: string;
    question: string;
    description: string;
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
    conditionId: string;
    clobTokenIds: string[];
    lastUpdated: number;
}

interface OrderBookDTO {
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
// In-memory cache
// =============================================================================
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    staleAt: number;
}

const detailCache = new Map<string, CacheEntry<MarketDetailDTO>>();
const orderBookCache = new Map<string, CacheEntry<OrderBookDTO>>();

const DETAIL_FRESH_MS = 30000;  // 30s
const ORDERBOOK_FRESH_MS = 5000; // 5s

// =============================================================================
// Transform Functions
// =============================================================================
function transformToMarketDetail(raw: any): MarketDetailDTO {
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

    // Parse clobTokenIds
    let clobTokenIds: string[] = [];
    if (raw.clobTokenIds) {
        try {
            clobTokenIds = typeof raw.clobTokenIds === 'string'
                ? JSON.parse(raw.clobTokenIds)
                : (Array.isArray(raw.clobTokenIds) ? raw.clobTokenIds : []);
        } catch (e) { /* use empty */ }
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
        description: raw.description || '',
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
        eventTitle: null,
        endDate: raw.endDate || null,
        createdAt: raw.createdAt || new Date().toISOString(),
        conditionId: raw.conditionId || raw.id || '',
        clobTokenIds,
        lastUpdated: Date.now(),
    };
}

function transformToOrderBook(raw: any, marketId: string, tokenId: string): OrderBookDTO {
    // Parse and sort bids (highest price first)
    const bids = (raw.bids || [])
        .map((b: any) => ({
            price: parseFloat(String(b.price || 0)),
            size: parseFloat(String(b.size || 0)),
        }))
        .filter((b: any) => b.price > 0 && b.size > 0)
        .sort((a: any, b: any) => b.price - a.price)
        .slice(0, 10);

    // Parse and sort asks (lowest price first)
    const asks = (raw.asks || [])
        .map((a: any) => ({
            price: parseFloat(String(a.price || 0)),
            size: parseFloat(String(a.size || 0)),
        }))
        .filter((a: any) => a.price > 0 && a.size > 0)
        .sort((a: any, b: any) => a.price - b.price)
        .slice(0, 10);

    const bestBid = bids.length > 0 ? bids[0].price : 0;
    const bestAsk = asks.length > 0 ? asks[0].price : 1;
    const mid = (bestBid + bestAsk) / 2;
    const spread = bestAsk - bestBid;

    return {
        marketId,
        tokenId,
        bids,
        asks,
        bestBid,
        bestAsk,
        mid,
        spread,
        lastUpdated: Date.now(),
    };
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
        // Get path: /api/markets/[id] or /api/markets/[id]/orderbook
        const pathSegments = req.query.id as string[];

        if (!pathSegments || pathSegments.length === 0) {
            return res.status(400).json({ success: false, error: 'Market ID required' });
        }

        const marketId = pathSegments[0];
        const isOrderbook = pathSegments.length > 1 && pathSegments[1] === 'orderbook';

        if (isOrderbook) {
            // Handle orderbook request
            const tokenId = req.query.tokenId as string;

            if (!tokenId) {
                return res.status(400).json({ success: false, error: 'tokenId query param required' });
            }

            const cacheKey = `orderbook:${tokenId}`;
            const now = Date.now();
            const cached = orderBookCache.get(cacheKey);

            if (cached && now < cached.staleAt) {
                const duration = Date.now() - startTime;
                res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=15');
                return res.json({
                    success: true,
                    data: cached.data,
                    meta: { duration, cached: true },
                });
            }

            // Fetch from CLOB API
            console.log(`[Market API] Fetching orderbook for token ${tokenId}...`);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${CLOB_API}/book?token_id=${tokenId}`, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Polymarket-Dashboard/2.0',
                    'Accept': 'application/json',
                },
            });

            clearTimeout(timeout);

            if (!response.ok) {
                // Return empty orderbook on error
                const emptyOrderbook = transformToOrderBook({ bids: [], asks: [] }, marketId, tokenId);
                return res.json({
                    success: true,
                    data: emptyOrderbook,
                    meta: { duration: Date.now() - startTime, cached: false, error: `CLOB error: ${response.status}` },
                });
            }

            const data = await response.json();
            const orderbook = transformToOrderBook(data, marketId, tokenId);

            // Update cache
            orderBookCache.set(cacheKey, {
                data: orderbook,
                timestamp: now,
                staleAt: now + ORDERBOOK_FRESH_MS,
            });

            const duration = Date.now() - startTime;
            console.log(`[Market API] Orderbook fetched in ${duration}ms`);

            res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=15');
            return res.json({
                success: true,
                data: orderbook,
                meta: { duration, cached: false },
            });

        } else if (pathSegments.length > 1 && pathSegments[1] === 'outcomes') {
            // =================================================================
            // HANDLE OUTCOMES REQUEST
            // =================================================================
            const cacheKey = `outcomes:${marketId}`;
            const now = Date.now();
            const cached = detailCache.get(cacheKey) as any; // Reusing detailCache for simplicity

            if (cached && now < cached.staleAt) {
                const duration = Date.now() - startTime;
                res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
                return res.json({
                    success: true,
                    data: cached.data,
                    meta: { duration, cached: true },
                });
            }

            // 1. Fetch market first to get event info
            console.log(`[Market API] Fetching outcomes for market ${marketId}...`);
            const marketRes = await fetch(`${GAMMA_API}/markets/${marketId}`);
            if (!marketRes.ok) {
                return res.status(404).json({ success: false, error: 'Market not found' });
            }
            const marketData = await marketRes.json();

            // 2. Fetch all markets for this event (to get all outcomes)
            // If it's a group market (multi-outcome), we need the event's other markets via event ID or slug
            // Or if it's a single market, just return its outcomes

            let allOutcomes: any[] = [];
            let isMultiOutcome = false;
            let eventTitle = null;
            let eventSlug = null;
            let targetIndex = undefined;

            // Strategy: Try to find the event
            // Use eventId if available, otherwise search by slug or just use the market itself
            const eventId = marketData.events?.[0]?.id || marketData.conditionId; // Fallback

            if (eventId) {
                const eventsRes = await fetch(`${GAMMA_API}/events/${eventId}`);
                if (eventsRes.ok) {
                    const eventData = await eventsRes.json();
                    if (eventData && Array.isArray(eventData.markets)) {
                        allOutcomes = eventData.markets;
                        isMultiOutcome = eventData.markets.length > 1;
                        eventTitle = eventData.title;
                        eventSlug = eventData.slug;
                    }
                }
            }

            // Fallback: Use the market's own outcomes if event fetch failed or returned nothing
            if (allOutcomes.length === 0) {
                // Determine if this itself is a multi-outcome market container?
                // Usually Gamma returns individual markets. 
                // If we can't find the event, we just return this market as a single outcome (or Yes/No)
                allOutcomes = [marketData];
            }

            // 3. Map to OutcomeListItem format
            const outcomesFormatted = allOutcomes.map((m: any, index: number) => {
                // Parse image - check various places
                const image = m.image || m.groupItemImage || m.token?.image || null;

                // Parse outcome prices
                let yesPrice = 0.5;
                if (m.outcomePrices) {
                    try {
                        const prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
                        if (Array.isArray(prices)) yesPrice = parseFloat(prices[0]) || 0.5;
                    } catch (e) { }
                } else if (m.bestBid) {
                    yesPrice = parseFloat(m.bestBid);
                }

                const isTarget = m.id === marketId;
                if (isTarget) targetIndex = index;

                return {
                    id: m.id,
                    name: m.groupItemTitle || m.question || m.title || "Unknown",
                    question: m.question || m.title,
                    outcome: m.groupItemTitle || m.outcome || "Yes",
                    index: index,
                    probability: yesPrice * 100,
                    volume: `$${parseFloat(m.volume || 0).toFixed(2)}`,
                    volumeNum: parseFloat(m.volume || 0),
                    isTarget,
                    image: image
                };
            });

            // Sort by probability or volume if it's a large list
            if (outcomesFormatted.length > 2) {
                outcomesFormatted.sort((a: any, b: any) => b.probability - a.probability);
            }

            const result = {
                isMultiOutcome,
                eventTitle,
                eventSlug,
                outcomes: outcomesFormatted,
                targetIndex
            };

            // Update cache (borrowing detailCache)
            detailCache.set(cacheKey, {
                data: result as any,
                timestamp: now,
                staleAt: now + 30000 // 30s TTL
            });

            res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
            return res.json({
                success: true,
                data: result,
                meta: { duration: Date.now() - startTime, cached: false }
            });

        } else {
            // Handle market detail request
            const cacheKey = `detail:${marketId}`;
            const now = Date.now();
            const cached = detailCache.get(cacheKey);

            if (cached && now < cached.staleAt) {
                const duration = Date.now() - startTime;
                res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
                return res.json({
                    success: true,
                    data: cached.data,
                    meta: { duration, cached: true },
                });
            }

            // Fetch from Gamma API
            console.log(`[Market API] Fetching detail for market ${marketId}...`);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(`${GAMMA_API}/markets/${marketId}`, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Polymarket-Dashboard/2.0',
                    'Accept': 'application/json',
                },
            });

            clearTimeout(timeout);

            if (!response.ok) {
                return res.status(404).json({ success: false, error: `Market not found: ${response.status}` });
            }

            const data = await response.json();
            const market = transformToMarketDetail(data);

            // Update cache
            detailCache.set(cacheKey, {
                data: market,
                timestamp: now,
                staleAt: now + DETAIL_FRESH_MS,
            });

            const duration = Date.now() - startTime;
            console.log(`[Market API] Detail fetched in ${duration}ms`);

            res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
            return res.json({
                success: true,
                data: market,
                meta: { duration, cached: false },
            });
        }

    } catch (error) {
        console.error('[Market API] Error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch market data',
        });
    }
}
