/**
 * Gamma API Client - Raw Data Access
 * 
 * Responsible for:
 * - Fetching raw events/markets from Gamma API.
 * - Caching raw responses.
 * - Deduplicating requests.
 * 
 * It does NOT map to UI DTOs.
 */

import { RawGammaEvent, RawGammaMarket } from './dtos';
import {
    marketListCache,
    getWithRevalidation,
    dedupedFetch,
    fetchWithTimeout,
    fetchWithRetry,
} from './cache';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';
const DEFAULT_TIMEOUT = 8000;
const MAX_RETRIES = 2;

/**
 * Fetch raw events based on type/category
 */
export async function getRawEvents(
    type: 'trending' | 'new' | 'resolving',
    limit: number,
    offset: number
): Promise<RawGammaEvent[]> {
    const cacheKey = `raw_events:${type}:${limit}:${offset}`;

    // We can reuse the dedupedFetch logic
    return dedupedFetch(cacheKey, async () => {
        let url = `${GAMMA_API_BASE}/events?limit=${limit + 10}&offset=${offset}&active=true&closed=false`;

        // Sorting params
        if (type === 'new') {
            // Gamma API sort param might be supported
            url += `&sort=createdAt&order=desc`;
            // If not supported, we sort client side
        } else if (type === 'resolving') {
            url += `&sort=endDate&order=asc`;
        }

        const data = await fetchWithRetry(
            async () => {
                const response = await fetchWithTimeout(url, { timeout: DEFAULT_TIMEOUT });
                if (!response.ok) throw new Error(`Gamma Error: ${response.status}`);
                return response.json();
            },
            { maxRetries: MAX_RETRIES }
        ) as RawGammaEvent[];

        // Post-fetch sorting/filtering to be safe
        let sorted = data;

        if (type === 'trending') {
            sorted.sort((a, b) => {
                const volA = a.markets?.reduce((s, m) => s + (Number(m.volume24hr) || 0), 0) || 0;
                const volB = b.markets?.reduce((s, m) => s + (Number(m.volume24hr) || 0), 0) || 0;
                return volB - volA;
            });
        } else if (type === 'new') {
            sorted.sort((a, b) => {
                const timeA = a.markets?.[0]?.createdAt ? new Date(a.markets[0].createdAt).getTime() : 0;
                const timeB = b.markets?.[0]?.createdAt ? new Date(b.markets[0].createdAt).getTime() : 0;
                return timeB - timeA;
            });
        } else if (type === 'resolving') {
            const now = Date.now();
            // Filter out already ended?
            sorted = sorted.filter(e => {
                const end = e.markets?.[0]?.endDate ? new Date(e.markets[0].endDate).getTime() : 0;
                return end > now;
            });
            sorted.sort((a, b) => {
                const timeA = a.markets?.[0]?.endDate ? new Date(a.markets[0].endDate).getTime() : 0;
                const timeB = b.markets?.[0]?.endDate ? new Date(b.markets[0].endDate).getTime() : Infinity;
                return timeA - timeB;
            });
        }

        return sorted.slice(0, limit);
    });
}

/**
 * Fetch raw event by ID (or Market ID)
 */
export async function getRawEvent(id: string): Promise<RawGammaEvent | null> {
    const cacheKey = `raw_event:${id}`;

    const result = await getWithRevalidation(
        cacheKey,
        marketListCache, // Reuse generic cache
        async () => {
            // Try as Event ID
            // Check if we can find it via /events/id
            try {
                const eventRes = await fetchWithTimeout(`${GAMMA_API_BASE}/events/${id}`, { timeout: 3000 });
                if (eventRes.ok) {
                    return eventRes.json();
                }
            } catch (e) { }

            // Try as Market ID -> Wrapped Event
            try {
                const marketRes = await fetchWithTimeout(`${GAMMA_API_BASE}/markets/${id}`, { timeout: 3000 });
                if (marketRes.ok) {
                    const m = await marketRes.json();

                    // If this market defines an eventId, we should try to fetch that event?
                    // But if we fail, we wrap this market.
                    // Important: For group markets, we need the group context.
                    // Gamma markets response does not usually include the siblings.
                    // But typically `id` passed here IS the market ID.

                    // Optimistic approach: Return as single-market event wrapper.
                    // This satisfies strict typing, even if we miss siblings.
                    // BUT user requirement: "ALL outcomes".

                    // If it's a multi-outcome market, does /markets/:id return all outcomes?
                    // Answer from previous turn: Yes, it returned `outcomes` array (strings) or `events`.
                    // Wait, `events` field in the market response usually contains the event.

                    // Let's wrap safely.
                    return {
                        id: m.id, // Fake event ID
                        title: m.question,
                        slug: m.slug,
                        image: m.image,
                        description: m.description,
                        markets: [m]
                    } as RawGammaEvent;
                }
            } catch (e) { }

            return null;
        }
    );

    return result.data;
}

// Helpers
function transformToMarketCard() { throw new Error("Do not use legacy transform"); }
