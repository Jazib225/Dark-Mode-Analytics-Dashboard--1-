/**
 * Gamma API Client - Market Discovery & Metadata ONLY
 * 
 * This client handles:
 * - Market lists (trending, new, nearly resolved)
 * - Market metadata (question, outcomes, status, close time)
 * - Events and categories
 * - Market search/filtering
 * 
 * DO NOT use this client for:
 * - Orderbooks (use clobClient)
 * - Prices (use clobClient)
 * - User positions (use dataClient)
 */

import {
    MarketCardDTO,
    MarketDetailDTO,
    RawGammaEvent,
    RawGammaMarket,
    transformToMarketCard,
    transformToMarketDetail,
} from './dtos';
import {
    marketListCache,
    marketDetailCache,
    marketListKey,
    marketDetailKey,
    getWithRevalidation,
    dedupedFetch,
    fetchWithTimeout,
    fetchWithRetry,
} from './cache';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';
const DEFAULT_TIMEOUT = 8000;
const MAX_RETRIES = 2;

// =============================================================================
// Market List Endpoints
// =============================================================================

/**
 * Get trending markets sorted by volume
 */
export async function getTrendingMarkets(
    limit: number = 50,
    offset: number = 0
): Promise<{ markets: MarketCardDTO[]; fromCache: boolean; duration: number }> {
    const cacheKey = marketListKey('trending', limit, offset);

    const result = await getWithRevalidation(
        cacheKey,
        marketListCache,
        () => dedupedFetch(cacheKey, async () => {
            const url = `${GAMMA_API_BASE}/events?limit=500&active=true&closed=false`;

            const data = await fetchWithRetry(
                async () => {
                    const response = await fetchWithTimeout(url, { timeout: DEFAULT_TIMEOUT });
                    if (!response.ok) {
                        throw new Error(`Gamma API error: ${response.status}`);
                    }
                    return response.json();
                },
                { maxRetries: MAX_RETRIES }
            );

            // Extract markets from events
            const markets = extractMarketsFromEvents(data as RawGammaEvent[]);

            // Sort by 24hr volume descending
            markets.sort((a, b) => b.volume24hr - a.volume24hr);

            // Apply pagination
            return markets.slice(offset, offset + limit);
        })
    );

    return {
        markets: result.data,
        fromCache: result.fromCache,
        duration: result.duration,
    };
}

/**
 * Get new markets sorted by creation date
 */
export async function getNewMarkets(
    limit: number = 30,
    offset: number = 0
): Promise<{ markets: MarketCardDTO[]; fromCache: boolean; duration: number }> {
    const cacheKey = marketListKey('new', limit, offset);

    const result = await getWithRevalidation(
        cacheKey,
        marketListCache,
        () => dedupedFetch(cacheKey, async () => {
            const url = `${GAMMA_API_BASE}/events?limit=500&active=true&closed=false`;

            const data = await fetchWithRetry(
                async () => {
                    const response = await fetchWithTimeout(url, { timeout: DEFAULT_TIMEOUT });
                    if (!response.ok) {
                        throw new Error(`Gamma API error: ${response.status}`);
                    }
                    return response.json();
                },
                { maxRetries: MAX_RETRIES }
            );

            // Extract markets from events
            const markets = extractMarketsFromEvents(data as RawGammaEvent[]);

            // Sort by createdAt descending (newest first)
            markets.sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            // Apply pagination
            return markets.slice(offset, offset + limit);
        })
    );

    return {
        markets: result.data,
        fromCache: result.fromCache,
        duration: result.duration,
    };
}

/**
 * Get markets resolving soon sorted by end date
 */
export async function getNearlyResolvedMarkets(
    limit: number = 30,
    offset: number = 0,
    hoursAhead: number = 72
): Promise<{ markets: MarketCardDTO[]; fromCache: boolean; duration: number }> {
    const cacheKey = marketListKey('resolving', limit, offset);

    const result = await getWithRevalidation(
        cacheKey,
        marketListCache,
        () => dedupedFetch(cacheKey, async () => {
            const url = `${GAMMA_API_BASE}/events?limit=500&active=true&closed=false`;

            const data = await fetchWithRetry(
                async () => {
                    const response = await fetchWithTimeout(url, { timeout: DEFAULT_TIMEOUT });
                    if (!response.ok) {
                        throw new Error(`Gamma API error: ${response.status}`);
                    }
                    return response.json();
                },
                { maxRetries: MAX_RETRIES }
            );

            // Extract markets from events
            const allMarkets = extractMarketsFromEvents(data as RawGammaEvent[]);

            // Filter to markets ending within the time window
            const now = Date.now();
            const cutoff = now + hoursAhead * 60 * 60 * 1000;

            let markets = allMarkets.filter(m => {
                if (!m.endDate) return false;
                const endTime = new Date(m.endDate).getTime();
                if (isNaN(endTime)) return false;
                return endTime > now && endTime < cutoff;
            });

            // Sort by endDate ascending (soonest first)
            markets.sort((a, b) =>
                new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime()
            );

            // Fallback: if no markets within window, show all markets with endDate
            if (markets.length === 0) {
                console.log('⚠️ No markets within time range, showing all markets with endDate');
                markets = allMarkets
                    .filter(m => m.endDate && !isNaN(new Date(m.endDate).getTime()))
                    .sort((a, b) =>
                        new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime()
                    );
            }

            // Apply pagination
            return markets.slice(offset, offset + limit);
        })
    );

    return {
        markets: result.data,
        fromCache: result.fromCache,
        duration: result.duration,
    };
}

// =============================================================================
// Single Market Endpoints
// =============================================================================

/**
 * Get market detail by ID
 */
export async function getMarketById(
    marketId: string
): Promise<{ market: MarketDetailDTO | null; fromCache: boolean; duration: number }> {
    if (!marketId) {
        return { market: null, fromCache: false, duration: 0 };
    }

    const cacheKey = marketDetailKey(marketId);

    const result = await getWithRevalidation(
        cacheKey,
        marketDetailCache,
        () => dedupedFetch(cacheKey, async () => {
            const url = `${GAMMA_API_BASE}/markets/${marketId}`;

            const data = await fetchWithRetry(
                async () => {
                    const response = await fetchWithTimeout(url, { timeout: DEFAULT_TIMEOUT });
                    if (!response.ok) {
                        throw new Error(`Market not found: ${response.status}`);
                    }
                    return response.json();
                },
                { maxRetries: MAX_RETRIES }
            );

            return transformToMarketDetail(data as RawGammaMarket);
        })
    );

    return {
        market: result.data,
        fromCache: result.fromCache,
        duration: result.duration,
    };
}

/**
 * Search markets by query
 */
export async function searchMarkets(
    query: string,
    limit: number = 20
): Promise<{ markets: MarketCardDTO[]; fromCache: boolean; duration: number }> {
    if (!query || query.length < 2) {
        return { markets: [], fromCache: false, duration: 0 };
    }

    const cacheKey = `search:${query.toLowerCase()}:${limit}`;

    const result = await getWithRevalidation(
        cacheKey,
        marketListCache,
        () => dedupedFetch(cacheKey, async () => {
            // Gamma API doesn't have a dedicated search endpoint
            // Fetch all markets and filter client-side
            const url = `${GAMMA_API_BASE}/events?limit=500&active=true&closed=false`;

            const data = await fetchWithRetry(
                async () => {
                    const response = await fetchWithTimeout(url, { timeout: DEFAULT_TIMEOUT });
                    if (!response.ok) {
                        throw new Error(`Gamma API error: ${response.status}`);
                    }
                    return response.json();
                },
                { maxRetries: MAX_RETRIES }
            );

            // Extract markets from events
            const allMarkets = extractMarketsFromEvents(data as RawGammaEvent[]);

            // Search filter
            const queryLower = query.toLowerCase();
            const filtered = allMarkets.filter(m =>
                m.question.toLowerCase().includes(queryLower) ||
                (m.category && m.category.toLowerCase().includes(queryLower)) ||
                (m.eventTitle && m.eventTitle.toLowerCase().includes(queryLower))
            );

            // Sort by relevance (question match first, then by volume)
            filtered.sort((a, b) => {
                const aQuestionMatch = a.question.toLowerCase().includes(queryLower) ? 1 : 0;
                const bQuestionMatch = b.question.toLowerCase().includes(queryLower) ? 1 : 0;
                if (aQuestionMatch !== bQuestionMatch) return bQuestionMatch - aQuestionMatch;
                return b.volume24hr - a.volume24hr;
            });

            return filtered.slice(0, limit);
        })
    );

    return {
        markets: result.data,
        fromCache: result.fromCache,
        duration: result.duration,
    };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract markets from events array
 */
function extractMarketsFromEvents(events: RawGammaEvent[]): MarketCardDTO[] {
    if (!Array.isArray(events)) return [];

    const markets: MarketCardDTO[] = [];

    for (const event of events) {
        if (!Array.isArray(event.markets)) continue;

        for (const market of event.markets) {
            // Skip inactive or closed markets
            if (market.active === false || market.closed) continue;
            // Skip markets without a question
            if (!market.question && !market.title) continue;

            markets.push(transformToMarketCard(market, event.title));
        }
    }

    return markets;
}

/**
 * Get all markets (for search/cache warming)
 */
export async function getAllMarkets(): Promise<MarketCardDTO[]> {
    const result = await getTrendingMarkets(1000, 0);
    return result.markets;
}
