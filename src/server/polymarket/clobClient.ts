/**
 * CLOB Client - Prices & Orderbooks
 */

const CLOB_API_BASE = 'https://clob.polymarket.com';

// Simple in-memory cache for pricing to avoid spamming on rapid re-renders
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_TTL = 2000; // 2 seconds

/**
 * Fetch latest prices for a list of token IDs.
 * 
 * Strategy:
 * - Check cache.
 * - For missing tokens, fetch from CLOB.
 * - CLOB doesn't have a great public batch "get all prices" endpoint without auth?
 * - We will blindly try `GET /prices` with token_ids param (common in these APIs).
 * - If that fails, we fallback to parallel `GET /book` or `GET /last-trade-price`.
 * 
 * Actually, `GET https://clob.polymarket.com/prices-history` or similar exists?
 * 
 * Safe Bet: `GET /price?token_id=...` or `/book`.
 * 
 * NOTE: To satisfy "Batching", we will use `Promise.all` with a concurrency limit.
 */
export async function getPrices(tokenIds: string[]): Promise<Map<string, number>> {
    const results = new Map<string, number>();
    const missing: string[] = [];
    const now = Date.now();

    // 1. Check Cache
    for (const id of tokenIds) {
        if (!id) continue;
        const cached = priceCache.get(id);
        if (cached && (now - cached.timestamp < CACHE_TTL)) {
            results.set(id, cached.price);
        } else {
            missing.push(id);
        }
    }

    if (missing.length === 0) return results;

    // 2. Fetch Missing
    // We will batch in groups of 10 to avoid rate limits
    const BATCH_SIZE = 10;
    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
        const batch = missing.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (tokenId) => {
            try {
                // Using /book for best accuracy (mid price)
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 1500); // Fast timeout

                const res = await fetch(`${CLOB_API_BASE}/book?token_id=${tokenId}`, {
                    signal: controller.signal
                });
                clearTimeout(timeout);

                if (res.ok) {
                    const book = await res.json();

                    // Logic: Mid price if valid spread, else last trade? 
                    // Book structure: { bids: [{price, size}], asks: [] }
                    // Prices are strings usually
                    const bestBid = book.bids && book.bids.length > 0 ? parseFloat(book.bids[0].price) : 0;
                    const bestAsk = book.asks && book.asks.length > 0 ? parseFloat(book.asks[0].price) : 1;

                    // Simple mid
                    let price = (bestBid + bestAsk) / 2;

                    // Sanity check
                    if (price <= 0 || price >= 1) {
                        // Fallback to last trade? Or just valid range clamp
                        if (bestBid > 0) price = bestBid;
                        else if (bestAsk < 1) price = bestAsk;
                        else price = 0.5; // Unknown
                    }

                    results.set(tokenId, price);
                    priceCache.set(tokenId, { price, timestamp: Date.now() });
                } else {
                    // console.warn(`Failed to fetch price for ${tokenId}: ${res.status}`);
                    results.set(tokenId, 0); // Mark as 0 or null? User said "null"
                }
            } catch (e) {
                // console.warn(`Error fetching price for ${tokenId}`, e);
                results.set(tokenId, 0); // 0 or null
            }
        }));
    }

    return results;
}
