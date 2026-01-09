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

/**
 * Prefetch market detail on hover/viewport entry
 * Non-blocking, doesn't return anything
 */
export function prefetchMarketDetail(marketId: string): void {
  if (prefetchedMarkets.has(marketId)) return;
  
  prefetchedMarkets.add(marketId);
  
  // Fire and forget
  fetchMarketDetail(marketId).catch(() => {
    // Remove from prefetched set so it can be retried
    prefetchedMarkets.delete(marketId);
  });
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
