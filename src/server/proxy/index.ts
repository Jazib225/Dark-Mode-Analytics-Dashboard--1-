/**
 * Proxy module - Exports all proxy-related functionality
 */

export { ProxyManager, proxyManager, type ProxyConfig, type ProxyStats } from './ProxyManager';
export {
    proxyFetch,
    proxyFetchBatch,
    proxyFetchAllPages,
    polymarketProxyFetch,
    type ProxyFetchOptions,
    type ProxyFetchResult,
} from './proxyFetch';
export {
    fetchAllMarketsFromEvents,
    fetchMarketDetails,
    streamAllMarkets,
    benchmarkProxies,
    type MarketData,
    type ScrapeProgress,
    type ScrapeOptions,
} from './MarketScraper';
