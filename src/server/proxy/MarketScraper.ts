/**
 * MarketScraper - High-performance market data scraper with proxy rotation
 * 
 * This module provides optimized batch fetching for Polymarket data:
 * - Concurrent requests through different proxies
 * - Intelligent rate limiting with backoff
 * - Progress tracking and resumable scraping
 * - Memory-efficient streaming for large datasets
 */

import { proxyManager, ProxyConfig } from './ProxyManager';
import { proxyFetch, proxyFetchBatch, proxyFetchAllPages } from './proxyFetch';

// Types
export interface MarketData {
    id: string;
    title: string;
    slug: string;
    description: string;
    conditionId: string;
    image: string | null;
    outcomes: string[];
    outcomePrices: number[];
    volume: number;
    volume24hr: number;
    liquidity: number;
    endDate: string | null;
    createdAt: string;
    closed: boolean;
    active: boolean;
    eventTitle?: string;
    eventSlug?: string;
}

export interface ScrapeProgress {
    phase: 'events' | 'markets' | 'details' | 'complete';
    currentPage: number;
    totalPages: number;
    marketsFound: number;
    marketsFetched: number;
    errors: number;
    startTime: number;
    estimatedTimeRemaining: number;
}

export interface ScrapeOptions {
    maxConcurrent?: number;
    includeDetails?: boolean;
    includePriceHistory?: boolean;
    onProgress?: (progress: ScrapeProgress) => void;
    onMarket?: (market: MarketData) => void;
    onError?: (error: Error, context: string) => void;
    activeOnly?: boolean;
    maxMarkets?: number;
}

// Constants
const GAMMA_API = 'https://gamma-api.polymarket.com';
const DATA_API = 'https://data-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';

/**
 * Parse market data from API response
 */
function parseMarket(raw: any, eventTitle?: string, eventSlug?: string): MarketData {
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

    // Parse outcomes
    let outcomes: string[] = ['Yes', 'No'];
    if (raw.outcomes) {
        try {
            outcomes = typeof raw.outcomes === 'string'
                ? JSON.parse(raw.outcomes)
                : (Array.isArray(raw.outcomes) ? raw.outcomes : outcomes);
        } catch (e) { /* use defaults */ }
    }

    return {
        id: raw.id || raw.conditionId || '',
        title: raw.question || raw.title || 'Unknown Market',
        slug: raw.slug || '',
        description: raw.description || '',
        conditionId: raw.conditionId || raw.id || '',
        image: raw.image || null,
        outcomes,
        outcomePrices,
        volume: parseFloat(String(raw.volume || raw.volumeNum || 0)) || 0,
        volume24hr: parseFloat(String(raw.volume24hr || 0)) || 0,
        liquidity: parseFloat(String(raw.liquidity || raw.liquidityNum || 0)) || 0,
        endDate: raw.endDate || null,
        createdAt: raw.createdAt || new Date().toISOString(),
        closed: raw.closed === true,
        active: raw.active !== false,
        eventTitle,
        eventSlug,
    };
}

/**
 * Fetch all markets from the events endpoint
 * This is the fastest way to get all markets because events contain embedded market data
 */
export async function fetchAllMarketsFromEvents(options: ScrapeOptions = {}): Promise<MarketData[]> {
    const {
        onProgress,
        onMarket,
        onError,
        activeOnly = true,
        maxMarkets,
    } = options;

    const markets: MarketData[] = [];
    const seenIds = new Set<string>();
    const startTime = Date.now();

    console.log('🚀 Starting market scrape from events endpoint...');

    try {
        // Fetch all events with pagination
        let offset = 0;
        const pageSize = 500;
        let hasMore = true;
        let pageNum = 0;

        while (hasMore) {
            const url = `${GAMMA_API}/events?limit=${pageSize}&offset=${offset}${activeOnly ? '&closed=false' : ''}`;

            try {
                const result = await proxyFetch<any[]>(url, {
                    timeout: 20000,
                    retries: 3,
                });

                const events = result.data;

                if (!Array.isArray(events) || events.length === 0) {
                    hasMore = false;
                    break;
                }

                // Extract markets from events
                let newMarketsCount = 0;
                for (const event of events) {
                    if (Array.isArray(event.markets)) {
                        for (const rawMarket of event.markets) {
                            const id = rawMarket.id || rawMarket.conditionId;
                            if (id && !seenIds.has(id)) {
                                seenIds.add(id);
                                const market = parseMarket(rawMarket, event.title, event.slug);
                                markets.push(market);
                                onMarket?.(market);
                                newMarketsCount++;

                                // Check max markets limit
                                if (maxMarkets && markets.length >= maxMarkets) {
                                    hasMore = false;
                                    break;
                                }
                            }
                        }
                    }
                    if (maxMarkets && markets.length >= maxMarkets) break;
                }

                console.log(`📊 Page ${pageNum + 1}: ${events.length} events, ${newMarketsCount} new markets (total: ${markets.length})`);

                // Update progress
                onProgress?.({
                    phase: 'events',
                    currentPage: pageNum + 1,
                    totalPages: -1, // Unknown
                    marketsFound: markets.length,
                    marketsFetched: markets.length,
                    errors: 0,
                    startTime,
                    estimatedTimeRemaining: -1,
                });

                // Check if we got fewer than requested (end of data)
                if (events.length < pageSize) {
                    hasMore = false;
                } else {
                    offset += pageSize;
                    pageNum++;
                }

                // Respect rate limits even with proxies
                await new Promise(resolve => setTimeout(resolve, 50));

            } catch (pageError) {
                console.error(`Error fetching page ${pageNum + 1}:`, pageError);
                onError?.(pageError instanceof Error ? pageError : new Error(String(pageError)), `Page ${pageNum + 1}`);

                // Continue to next page
                offset += pageSize;
                pageNum++;

                // Stop if too many errors
                if (pageNum > 200) {
                    hasMore = false;
                }
            }
        }

    } catch (error) {
        console.error('Failed to fetch markets from events:', error);
        onError?.(error instanceof Error ? error : new Error(String(error)), 'events');
    }

    // Also fetch from /markets endpoint to catch standalone markets
    console.log('📊 Fetching standalone markets...');

    try {
        let offset = 0;
        const pageSize = 500;
        let hasMore = true;

        while (hasMore && (!maxMarkets || markets.length < maxMarkets)) {
            const url = `${GAMMA_API}/markets?limit=${pageSize}&offset=${offset}${activeOnly ? '&closed=false&active=true' : ''}`;

            try {
                const result = await proxyFetch<any>(url, {
                    timeout: 20000,
                    retries: 2,
                });

                const data = result.data;
                const marketList = Array.isArray(data) ? data : (data?.data || data?.markets || []);

                if (marketList.length === 0) {
                    hasMore = false;
                    break;
                }

                let newCount = 0;
                for (const rawMarket of marketList) {
                    const id = rawMarket.id || rawMarket.conditionId;
                    if (id && !seenIds.has(id)) {
                        seenIds.add(id);
                        const market = parseMarket(rawMarket);
                        markets.push(market);
                        onMarket?.(market);
                        newCount++;

                        if (maxMarkets && markets.length >= maxMarkets) {
                            hasMore = false;
                            break;
                        }
                    }
                }

                if (newCount > 0) {
                    console.log(`   Markets page: ${newCount} new (total: ${markets.length})`);
                }

                if (marketList.length < pageSize) {
                    hasMore = false;
                } else {
                    offset += pageSize;
                }

                await new Promise(resolve => setTimeout(resolve, 50));

            } catch (e) {
                hasMore = false;
            }
        }
    } catch (error) {
        console.error('Failed to fetch standalone markets:', error);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Scrape complete: ${markets.length} markets in ${(duration / 1000).toFixed(1)}s`);

    onProgress?.({
        phase: 'complete',
        currentPage: -1,
        totalPages: -1,
        marketsFound: markets.length,
        marketsFetched: markets.length,
        errors: 0,
        startTime,
        estimatedTimeRemaining: 0,
    });

    return markets;
}

/**
 * Fetch detailed data for specific markets concurrently
 * Use this to enrich market data with order books, price history, etc.
 */
export async function fetchMarketDetails(
    marketIds: string[],
    options: {
        maxConcurrent?: number;
        includePriceHistory?: boolean;
        includeOrderBook?: boolean;
        onProgress?: (completed: number, total: number) => void;
    } = {}
): Promise<Map<string, any>> {
    const {
        maxConcurrent = 5,
        includePriceHistory = false,
        includeOrderBook = false,
        onProgress,
    } = options;

    const results = new Map<string, any>();
    let completed = 0;

    // Build URLs for batch fetch
    const urls = marketIds.map(id => `${GAMMA_API}/markets/${id}`);

    console.log(`📊 Fetching details for ${marketIds.length} markets...`);

    const fetchResults = await proxyFetchBatch(urls, {
        maxConcurrent,
        timeout: 15000,
        retries: 2,
        onProgress: (done, total, url, success) => {
            completed = done;
            onProgress?.(done, total);
            if (!success) {
                console.warn(`   Failed: ${url}`);
            }
        },
    });

    // Process results
    for (let i = 0; i < marketIds.length; i++) {
        const url = urls[i];
        const marketId = marketIds[i];
        const result = fetchResults.get(url);

        if (result && !(result instanceof Error)) {
            results.set(marketId, result.data);
        }
    }

    console.log(`✅ Fetched details for ${results.size}/${marketIds.length} markets`);

    return results;
}

/**
 * Stream markets as they're fetched (memory efficient for large datasets)
 */
export async function* streamAllMarkets(options: ScrapeOptions = {}): AsyncGenerator<MarketData> {
    const {
        activeOnly = true,
        maxMarkets,
    } = options;

    const seenIds = new Set<string>();
    let marketCount = 0;

    // Stream from events endpoint
    let offset = 0;
    const pageSize = 500;
    let hasMore = true;

    while (hasMore) {
        const url = `${GAMMA_API}/events?limit=${pageSize}&offset=${offset}${activeOnly ? '&closed=false' : ''}`;

        try {
            const result = await proxyFetch<any[]>(url, {
                timeout: 20000,
                retries: 3,
            });

            const events = result.data;

            if (!Array.isArray(events) || events.length === 0) {
                hasMore = false;
                break;
            }

            for (const event of events) {
                if (Array.isArray(event.markets)) {
                    for (const rawMarket of event.markets) {
                        const id = rawMarket.id || rawMarket.conditionId;
                        if (id && !seenIds.has(id)) {
                            seenIds.add(id);
                            marketCount++;
                            yield parseMarket(rawMarket, event.title, event.slug);

                            if (maxMarkets && marketCount >= maxMarkets) {
                                return;
                            }
                        }
                    }
                }
            }

            if (events.length < pageSize) {
                hasMore = false;
            } else {
                offset += pageSize;
            }

            await new Promise(resolve => setTimeout(resolve, 50));

        } catch (e) {
            console.error(`Stream error at offset ${offset}:`, e);
            offset += pageSize;
            if (offset > 50000) hasMore = false;
        }
    }
}

/**
 * Quick benchmark to test proxy performance
 */
export async function benchmarkProxies(iterations = 10): Promise<{
    avgLatency: number;
    successRate: number;
    proxyStats: any;
}> {
    const testUrl = `${GAMMA_API}/markets?limit=1`;
    let totalLatency = 0;
    let successes = 0;

    console.log(`🔬 Benchmarking proxies with ${iterations} requests...`);

    for (let i = 0; i < iterations; i++) {
        try {
            const result = await proxyFetch(testUrl, {
                timeout: 10000,
                retries: 0, // No retries for benchmark
            });
            totalLatency += result.latencyMs;
            successes++;
            console.log(`   Request ${i + 1}: ${result.latencyMs}ms via ${result.proxy?.host || 'direct'}`);
        } catch (e) {
            console.log(`   Request ${i + 1}: FAILED`);
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    const stats = proxyManager.getStats();

    return {
        avgLatency: successes > 0 ? totalLatency / successes : 0,
        successRate: (successes / iterations) * 100,
        proxyStats: stats,
    };
}

export default {
    fetchAllMarketsFromEvents,
    fetchMarketDetails,
    streamAllMarkets,
    benchmarkProxies,
};
