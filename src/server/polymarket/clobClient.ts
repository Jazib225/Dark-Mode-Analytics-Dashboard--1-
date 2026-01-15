/**
 * CLOB API Client - Prices & Orderbooks ONLY
 * 
 * This client handles:
 * - Orderbooks
 * - Best bid/ask/mid prices
 * - Order placement/cancel (if in scope)
 * 
 * DO NOT use this client for:
 * - Market metadata (use gammaClient)
 * - Market discovery (use gammaClient)
 * - User positions (use dataClient)
 */

import {
    OrderBookDTO,
    transformToOrderBook,
} from './dtos';
import {
    orderBookCache,
    orderBookKey,
    getWithRevalidation,
    dedupedFetch,
    fetchWithTimeout,
} from './cache';

const CLOB_API_BASE = 'https://clob.polymarket.com';
const DEFAULT_TIMEOUT = 5000; // Shorter timeout for price data
const NO_RETRY = 0; // Don't retry price requests - they're time-sensitive

// =============================================================================
// Orderbook Endpoints
// =============================================================================

/**
 * Get orderbook for a token
 */
export async function getOrderBook(
    marketId: string,
    tokenId: string
): Promise<{ orderbook: OrderBookDTO | null; fromCache: boolean; duration: number }> {
    if (!tokenId) {
        return { orderbook: null, fromCache: false, duration: 0 };
    }

    const cacheKey = orderBookKey(tokenId);

    const result = await getWithRevalidation(
        cacheKey,
        orderBookCache,
        () => dedupedFetch(cacheKey, async () => {
            const url = `${CLOB_API_BASE}/book?token_id=${tokenId}`;

            const response = await fetchWithTimeout(url, { timeout: DEFAULT_TIMEOUT });

            if (!response.ok) {
                console.warn(`CLOB API error for ${tokenId}: ${response.status}`);
                // Return empty orderbook rather than throwing
                return transformToOrderBook({ bids: [], asks: [] }, marketId, tokenId);
            }

            const data = await response.json();
            return transformToOrderBook(data, marketId, tokenId);
        })
    );

    return {
        orderbook: result.data,
        fromCache: result.fromCache,
        duration: result.duration,
    };
}

/**
 * Get current price for a token (best bid/ask/mid)
 */
export async function getPrice(
    tokenId: string
): Promise<{ bid: number; ask: number; mid: number } | null> {
    if (!tokenId) return null;

    try {
        const result = await getOrderBook('', tokenId);
        if (!result.orderbook) return null;

        return {
            bid: result.orderbook.bestBid,
            ask: result.orderbook.bestAsk,
            mid: result.orderbook.mid,
        };
    } catch (error) {
        console.error(`Failed to get price for ${tokenId}:`, error);
        return null;
    }
}

/**
 * Get prices for multiple tokens in parallel
 */
export async function getBatchPrices(
    tokenIds: string[]
): Promise<Map<string, { bid: number; ask: number; mid: number }>> {
    const results = new Map<string, { bid: number; ask: number; mid: number }>();

    if (!tokenIds.length) return results;

    // Fetch in parallel with concurrency limit
    const BATCH_SIZE = 5;

    for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
        const batch = tokenIds.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (tokenId) => {
            const price = await getPrice(tokenId);
            if (price) {
                results.set(tokenId, price);
            }
        });
        await Promise.all(promises);
    }

    return results;
}

/**
 * Get live orderbook snapshot (no caching)
 * Use for real-time trading UI
 */
export async function getLiveOrderBook(
    marketId: string,
    tokenId: string
): Promise<OrderBookDTO | null> {
    if (!tokenId) return null;

    try {
        const url = `${CLOB_API_BASE}/book?token_id=${tokenId}`;
        const response = await fetchWithTimeout(url, { timeout: DEFAULT_TIMEOUT });

        if (!response.ok) {
            console.warn(`CLOB API error for ${tokenId}: ${response.status}`);
            return null;
        }

        const data = await response.json();
        return transformToOrderBook(data, marketId, tokenId);
    } catch (error) {
        console.error(`Failed to get live orderbook for ${tokenId}:`, error);
        return null;
    }
}
