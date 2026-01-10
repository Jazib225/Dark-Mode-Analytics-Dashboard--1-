/**
 * Optimized Market Data Client
 * - Request deduplication (no duplicate concurrent fetches)
 * - Client-side caching with stale-while-revalidate
 * - Prefetching on hover/viewport entry
 * - Parallel data loading
 */

const isDev = import.meta.env.DEV;

// =============================================================================
// API Configuration
// =============================================================================

function getApiBase(): string {
  return isDev ? "http://localhost:3001" : "";
}

// =============================================================================
// Request Deduplication
// =============================================================================

const inflightRequests = new Map<string, Promise<any>>();

async function dedupedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  // If there's already a request in flight for this key, return it
  const existing = inflightRequests.get(key);
  if (existing) {
    return existing;
  }

  // Create new request and store it
  const promise = fetcher().finally(() => {
    inflightRequests.delete(key);
  });

  inflightRequests.set(key, promise);
  return promise;
}

// =============================================================================
// Client-side Cache
// =============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  staleAt: number;
}

const clientCache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string, _maxAge: number): { data: T; isStale: boolean } | null {
  const entry = clientCache.get(key);
  if (!entry) return null;

  const now = Date.now();
  const isStale = now > entry.staleAt;

  // Return cached data even if stale (SWR pattern)
  return { data: entry.data, isStale };
}

function setCache<T>(key: string, data: T, ttl: number): void {
  clientCache.set(key, {
    data,
    timestamp: Date.now(),
    staleAt: Date.now() + ttl,
  });
}

// =============================================================================
// Types
// =============================================================================

export interface MarketCardDTO {
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
  lastUpdated: number;
}

export interface MarketDetailDTO extends MarketCardDTO {
  description: string;
  endDate: string | null;
  createdAt: string;
  conditionId: string;
  clobTokenIds: string[];
}

export interface OrderBookDTO {
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  spread: number;
  lastUpdated: number;
}

// =============================================================================
// API Functions with Caching & Deduplication
// =============================================================================

const MARKET_LIST_TTL = 15000;  // 15s
const MARKET_DETAIL_TTL = 60000; // 60s
const ORDERBOOK_TTL = 5000;     // 5s

/**
 * Fetch market list with caching and deduplication
 */
export async function fetchMarketList(
  timeframe: "24h" | "7d" | "1m" = "24h",
  limit = 50,
  offset = 0
): Promise<{ markets: MarketCardDTO[]; fromCache: boolean }> {
  const cacheKey = `markets:list:${timeframe}:${limit}:${offset}`;

  // Check cache first
  const cached = getCached<MarketCardDTO[]>(cacheKey, MARKET_LIST_TTL);

  if (cached && !cached.isStale) {
    return { markets: cached.data, fromCache: true };
  }

  // Fetch (deduplicated)
  const fetchPromise = dedupedFetch(cacheKey, async () => {
    const response = await fetch(
      `${getApiBase()}/api/v2/markets?timeframe=${timeframe}&limit=${limit}&offset=${offset}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch markets: ${response.status}`);
    }

    const result = await response.json();
    return result.data || [];
  });

  // If we have stale data, return it immediately and refresh in background
  if (cached?.isStale) {
    fetchPromise.then(freshData => {
      setCache(cacheKey, freshData, MARKET_LIST_TTL);
    }).catch(console.error);

    return { markets: cached.data, fromCache: true };
  }

  // No cache - wait for fetch
  const markets = await fetchPromise;
  setCache(cacheKey, markets, MARKET_LIST_TTL);

  return { markets, fromCache: false };
}

/**
 * Fetch market detail with caching and deduplication
 */
export async function fetchMarketDetail(
  marketId: string
): Promise<{ market: MarketDetailDTO | null; fromCache: boolean }> {
  const cacheKey = `markets:detail:${marketId}`;

  // Check cache first
  const cached = getCached<MarketDetailDTO>(cacheKey, MARKET_DETAIL_TTL);

  if (cached && !cached.isStale) {
    return { market: cached.data, fromCache: true };
  }

  // Fetch (deduplicated)
  const fetchPromise = dedupedFetch(cacheKey, async () => {
    const response = await fetch(`${getApiBase()}/api/v2/markets/${marketId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch market: ${response.status}`);
    }

    const result = await response.json();
    return result.data || null;
  });

  // If we have stale data, return it immediately and refresh in background
  if (cached?.isStale) {
    fetchPromise.then(freshData => {
      setCache(cacheKey, freshData, MARKET_DETAIL_TTL);
    }).catch(console.error);

    return { market: cached.data, fromCache: true };
  }

  // No cache - wait for fetch
  const market = await fetchPromise;
  if (market) {
    setCache(cacheKey, market, MARKET_DETAIL_TTL);
  }

  return { market, fromCache: false };
}

/**
 * Fetch orderbook with short caching
 */
export async function fetchOrderBook(
  marketId: string,
  tokenId: string
): Promise<{ orderbook: OrderBookDTO | null; fromCache: boolean }> {
  const cacheKey = `orderbook:${tokenId}`;

  // Check cache first
  const cached = getCached<OrderBookDTO>(cacheKey, ORDERBOOK_TTL);

  if (cached && !cached.isStale) {
    return { orderbook: cached.data, fromCache: true };
  }

  // Fetch (deduplicated)
  const fetchPromise = dedupedFetch(cacheKey, async () => {
    const response = await fetch(
      `${getApiBase()}/api/v2/markets/${marketId}/orderbook?tokenId=${tokenId}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch orderbook: ${response.status}`);
    }

    const result = await response.json();
    return result.data || null;
  });

  // If we have stale data, return it immediately
  if (cached?.isStale) {
    fetchPromise.then(freshData => {
      setCache(cacheKey, freshData, ORDERBOOK_TTL);
    }).catch(console.error);

    return { orderbook: cached.data, fromCache: true };
  }

  // No cache - wait for fetch
  const orderbook = await fetchPromise;
  if (orderbook) {
    setCache(cacheKey, orderbook, ORDERBOOK_TTL);
  }

  return { orderbook, fromCache: false };
}

// =============================================================================
// Prefetching
// =============================================================================

const prefetchedMarkets = new Set<string>();
const fullPrefetchedMarkets = new Set<string>();

// Import polymarketApi functions for full prefetch
import {
  getMarketDetails,
  getMarketPriceHistory,
  getMarketTrades,
  getOrderBook as getOrderBookApi,
  getEventWithMarkets,
  getMarketTradersCount,
  getMarketTopHolders,
  getMarketTopTraders,
  getCachedMarketDetail
} from './polymarketApi';

/**
 * Prefetch market detail on hover/viewport entry
 * Non-blocking, doesn't return anything
 */
export function prefetchMarketDetail(marketId: string): void {
  if (prefetchedMarkets.has(marketId)) return;

  prefetchedMarkets.add(marketId);

  // Fire and forget - this prefetches EVERYTHING needed for the detail page
  prefetchFullMarketData(marketId).catch(() => {
    // Remove from prefetched set so it can be retried
    prefetchedMarkets.delete(marketId);
  });
}

/**
 * Full prefetch - loads ALL data needed for MarketDetail page
 * Called on hover to make click feel instant
 */
export async function prefetchFullMarketData(marketId: string): Promise<void> {
  // Skip if already fully prefetched
  if (fullPrefetchedMarkets.has(marketId)) return;

  console.log(`[Prefetch] Starting full prefetch for ${marketId}`);

  try {
    // First, get market details (this also caches internally)
    const details = await getMarketDetails(marketId);

    if (!details) {
      console.log(`[Prefetch] No details found for ${marketId}`);
      return;
    }

    // Get token ID and condition ID for additional fetches
    const tokenId = details.clobTokenIds?.[0] ||
      (typeof details.clobTokenIds === 'string' ? JSON.parse(details.clobTokenIds)[0] : null);
    const conditionId = details.conditionId || marketId;

    // Fire ALL other requests in parallel - don't await individually
    const promises = [
      getMarketPriceHistory(marketId, "1d"),
      getMarketTrades(marketId, 10),
      getEventWithMarkets(marketId),
      getMarketTradersCount(conditionId),
      getMarketTopHolders(conditionId, 20),
      getMarketTopTraders(conditionId, 20),
    ];

    // Add order book if we have token ID
    if (tokenId) {
      promises.push(getOrderBookApi(tokenId));
    }

    // Wait for all to complete
    await Promise.all(promises);

    fullPrefetchedMarkets.add(marketId);
    console.log(`[Prefetch] Completed full prefetch for ${marketId}`);
  } catch (error) {
    console.log(`[Prefetch] Error prefetching ${marketId}:`, error);
  }
}

/**
 * Check if a market has been fully prefetched
 */
export function isMarketFullyPrefetched(marketId: string): boolean {
  return fullPrefetchedMarkets.has(marketId) || getCachedMarketDetail(marketId) !== null;
}

/**
 * Prefetch multiple markets (e.g., for visible cards)
 */
export function prefetchVisibleMarkets(marketIds: string[]): void {
  marketIds.forEach(id => prefetchMarketDetail(id));
}

/**
 * Prefetch market list for other timeframes
 */
export function prefetchOtherTimeframes(currentTimeframe: string): void {
  const timeframes = ["24h", "7d", "1m"] as const;

  timeframes
    .filter(t => t !== currentTimeframe)
    .forEach(timeframe => {
      const cacheKey = `markets:list:${timeframe}:50:0`;
      if (!getCached(cacheKey, MARKET_LIST_TTL)) {
        // Silent prefetch
        fetchMarketList(timeframe, 50, 0).catch(console.error);
      }
    });
}

// =============================================================================
// Parallel Loading Utility
// =============================================================================

/**
 * Load market detail with parallel orderbook fetch
 * Returns metadata immediately, orderbook loads progressively
 */
export async function loadMarketWithOrderbook(
  marketId: string,
  onOrderbookLoaded?: (orderbook: OrderBookDTO) => void
): Promise<MarketDetailDTO | null> {
  // Fetch metadata first (usually cached or fast)
  const { market } = await fetchMarketDetail(marketId);

  if (!market) return null;

  // Start orderbook fetch in parallel (non-blocking)
  if (market.clobTokenIds && market.clobTokenIds.length > 0) {
    fetchOrderBook(marketId, market.clobTokenIds[0])
      .then(({ orderbook }) => {
        if (orderbook && onOrderbookLoaded) {
          onOrderbookLoaded(orderbook);
        }
      })
      .catch(console.error);
  }

  return market;
}

// =============================================================================
// LAZY LOADING - Outcomes for Multi-Outcome Markets
// =============================================================================

export interface OutcomeListItem {
  id: string;
  name: string;
  index: number;
  probability: number;
  isTarget?: boolean;
}

export interface OutcomesList {
  isMultiOutcome: boolean;
  eventTitle: string | null;
  eventSlug?: string;
  outcomes: OutcomeListItem[];
  targetIndex?: number;
}

export interface OutcomeDetail {
  id: string;
  name: string;
  question: string;
  description: string;
  yesPrice: number;
  noPrice: number;
  yesPriceCents: number;
  noPriceCents: number;
  priceSource: 'gamma' | 'clob';
  volume: string;
  volumeNum: number;
  clobTokenIds: string[];
  conditionId: string;
}

const OUTCOMES_LIST_TTL = 60000;  // 60s - outcomes don't change often
const OUTCOME_DETAIL_TTL = 30000; // 30s - prices change more frequently

/**
 * Fetch LIGHTWEIGHT list of outcomes for a market
 * Does NOT load CLOB prices - super fast!
 * Use this to render the outcomes list, then lazy-load details on click
 */
export async function fetchOutcomesList(
  marketId: string
): Promise<{ outcomes: OutcomesList | null; fromCache: boolean }> {
  const cacheKey = `outcomes:list:${marketId}`;

  // Check cache first
  const cached = getCached<OutcomesList>(cacheKey, OUTCOMES_LIST_TTL);

  if (cached && !cached.isStale) {
    return { outcomes: cached.data, fromCache: true };
  }

  // Fetch (deduplicated)
  const fetchPromise = dedupedFetch(cacheKey, async () => {
    const response = await fetch(`${getApiBase()}/api/v2/markets/${marketId}/outcomes`);

    if (!response.ok) {
      throw new Error(`Failed to fetch outcomes: ${response.status}`);
    }

    const result = await response.json();
    return result.data || null;
  });

  // If we have stale data, return it immediately
  if (cached?.isStale) {
    fetchPromise.then(freshData => {
      if (freshData) setCache(cacheKey, freshData, OUTCOMES_LIST_TTL);
    }).catch(console.error);

    return { outcomes: cached.data, fromCache: true };
  }

  // No cache - wait for fetch
  const outcomes = await fetchPromise;
  if (outcomes) {
    setCache(cacheKey, outcomes, OUTCOMES_LIST_TTL);
  }

  return { outcomes, fromCache: false };
}

/**
 * Fetch FULL details for a SINGLE outcome (including CLOB prices)
 * Call this ONLY when user clicks on an outcome
 * This is the lazy-load function for individual outcomes
 */
export async function fetchOutcomeDetail(
  outcomeId: string
): Promise<{ detail: OutcomeDetail | null; fromCache: boolean }> {
  const cacheKey = `outcome:detail:${outcomeId}`;

  // Check cache first
  const cached = getCached<OutcomeDetail>(cacheKey, OUTCOME_DETAIL_TTL);

  if (cached && !cached.isStale) {
    return { detail: cached.data, fromCache: true };
  }

  // Fetch (deduplicated)
  const fetchPromise = dedupedFetch(cacheKey, async () => {
    const response = await fetch(`${getApiBase()}/api/v2/markets/${outcomeId}/outcome-detail`);

    if (!response.ok) {
      throw new Error(`Failed to fetch outcome detail: ${response.status}`);
    }

    const result = await response.json();
    return result.data || null;
  });

  // If we have stale data, return it immediately
  if (cached?.isStale) {
    fetchPromise.then(freshData => {
      if (freshData) setCache(cacheKey, freshData, OUTCOME_DETAIL_TTL);
    }).catch(console.error);

    return { detail: cached.data, fromCache: true };
  }

  // No cache - wait for fetch
  const detail = await fetchPromise;
  if (detail) {
    setCache(cacheKey, detail, OUTCOME_DETAIL_TTL);
  }

  return { detail, fromCache: false };
}

/**
 * Prefetch outcome detail on hover (non-blocking)
 */
export function prefetchOutcomeDetail(outcomeId: string): void {
  const cacheKey = `outcome:detail:${outcomeId}`;
  const cached = getCached<OutcomeDetail>(cacheKey, OUTCOME_DETAIL_TTL);

  // Skip if already cached and not stale
  if (cached && !cached.isStale) return;

  // Fire and forget
  fetchOutcomeDetail(outcomeId).catch(() => { });
}

// =============================================================================
// Cache Stats (for debugging)
// =============================================================================

export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: clientCache.size,
    keys: Array.from(clientCache.keys()),
  };
}

export function clearCache(): void {
  clientCache.clear();
  prefetchedMarkets.clear();
}
