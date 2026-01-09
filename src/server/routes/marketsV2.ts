import { Router, Request, Response } from "express";
import {
  marketListCache,
  marketMetadataCache,
  eventCache,
  orderBookCache,
  generateMarketListKey,
  generateMarketDetailKey,
  generateEventKey,
  generateOrderBookKey,
  getWithRevalidation,
  logTiming,
  getTimingStats,
} from "../cache/MarketCache";

const router = Router();

// =============================================================================
// API Base URLs
// =============================================================================
const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";

// =============================================================================
// Slim DTO types for optimized payloads
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
  lastUpdated: number;
  // Do NOT include orderbook here - keep payload lean
}

interface MarketDetailDTO extends MarketCardDTO {
  description: string;
  endDate: string | null;
  createdAt: string;
  conditionId: string;
  clobTokenIds: string[];
  // Orderbook fetched separately
}

// =============================================================================
// Helper: Fetch with timeout
// =============================================================================
async function fetchWithTimeout(url: string, timeout = 10000): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const fetchResponse = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Polymarket-Dashboard/2.0" },
    });
    clearTimeout(timeoutId);
    return fetchResponse;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// =============================================================================
// Helper: Transform raw market to slim DTO
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
  
  // Fallback price from bestBid/lastTradePrice
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

  return {
    id: raw.id || raw.conditionId || '',
    slug: raw.slug || '',
    question: raw.question || raw.title || 'Unknown Market',
    image: raw.image || null,
    outcomes,
    outcomePrices,
    probability: outcomePrices[0] * 100,
    volume24hr: parseFloat(String(raw.volume24hr || 0)) || 0,
    volume7d: parseFloat(String(raw.volume1wk || raw.volume7d || 0)) || 0,
    volume1mo: parseFloat(String(raw.volume1mo || 0)) || 0,
    liquidity: parseFloat(String(raw.liquidity || raw.liquidityNum || 0)) || 0,
    status: raw.closed ? 'closed' : (raw.active === false ? 'resolved' : 'active'),
    category: raw.tag || raw.category || null,
    eventTitle: eventTitle || raw.eventTitle || null,
    lastUpdated: Date.now(),
  };
}

function transformToMarketDetail(raw: any, eventTitle?: string): MarketDetailDTO {
  const card = transformToMarketCard(raw, eventTitle);
  
  // Parse clobTokenIds
  let clobTokenIds: string[] = [];
  if (raw.clobTokenIds) {
    try {
      clobTokenIds = typeof raw.clobTokenIds === 'string'
        ? JSON.parse(raw.clobTokenIds)
        : (Array.isArray(raw.clobTokenIds) ? raw.clobTokenIds : []);
    } catch (e) { /* use empty array */ }
  }

  return {
    ...card,
    description: raw.description || '',
    endDate: raw.endDate || null,
    createdAt: raw.createdAt || new Date().toISOString(),
    conditionId: raw.conditionId || raw.id || '',
    clobTokenIds,
  };
}

// =============================================================================
// GET /api/v2/markets - Optimized market list endpoint
// Returns slim MarketCardDTO array with caching
// =============================================================================
router.get("/", async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { 
      timeframe = "24h",
      limit = "50",
      offset = "0",
    } = req.query;
    
    const cacheKey = generateMarketListKey({ timeframe, limit, offset });
    
    const markets = await getWithRevalidation(
      cacheKey,
      marketListCache,
      async () => {
        // Fetch from Gamma API events endpoint (includes markets with volume data)
        const apiResponse = await fetchWithTimeout(
          `${GAMMA_API}/events?limit=500&active=true&closed=false`
        );
        
        if (!apiResponse.ok) {
          throw new Error(`Gamma API error: ${apiResponse.status}`);
        }
        
        const events = await apiResponse.json();
        
        // Extract all markets from events
        const allMarkets: MarketCardDTO[] = [];
        
        if (Array.isArray(events)) {
          for (const event of events) {
            if (Array.isArray(event.markets)) {
              for (const market of event.markets) {
                if (market.question && market.active !== false && !market.closed) {
                  allMarkets.push(transformToMarketCard(market, event.title));
                }
              }
            }
          }
        }
        
        // Sort by volume based on timeframe
        const volumeField = timeframe === "7d" ? "volume7d" 
          : timeframe === "1m" ? "volume1mo" 
          : "volume24hr";
        
        allMarkets.sort((a, b) => (b[volumeField as keyof MarketCardDTO] as number) - (a[volumeField as keyof MarketCardDTO] as number));
        
        // Apply pagination
        const start = parseInt(String(offset), 10);
        const end = start + parseInt(String(limit), 10);
        
        return allMarkets.slice(start, end);
      },
      15000 // 15s TTL for list
    );
    
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      data: markets,
      meta: {
        count: markets.length,
        timeframe,
        duration,
        cached: duration < 50, // Likely cached if < 50ms
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch markets";
    console.error("Markets aggregator error:", error);
    res.status(500).json({ success: false, error: message });
  }
});

// =============================================================================
// GET /api/v2/markets/:id - Optimized market detail endpoint
// Returns MarketDetailDTO with caching (no orderbook)
// =============================================================================
router.get("/:id", async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ success: false, error: "Market ID is required" });
    }
    
    const cacheKey = generateMarketDetailKey(id);
    
    const market = await getWithRevalidation(
      cacheKey,
      marketMetadataCache,
      async () => {
        const apiResponse = await fetchWithTimeout(`${GAMMA_API}/markets/${id}`);
        
        if (!apiResponse.ok) {
          throw new Error(`Market not found: ${apiResponse.status}`);
        }
        
        const raw = await apiResponse.json();
        return transformToMarketDetail(raw);
      },
      60000 // 60s TTL for detail
    );
    
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      data: market,
      meta: { duration, cached: duration < 50 },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch market";
    res.status(404).json({ success: false, error: message });
  }
});

// =============================================================================
// GET /api/v2/markets/:id/orderbook - Orderbook endpoint (CLOB API)
// Separate endpoint for progressive loading
// =============================================================================
router.get("/:id/orderbook", async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    const { tokenId } = req.query;
    
    if (!tokenId) {
      return res.status(400).json({ success: false, error: "tokenId query param required" });
    }
    
    const cacheKey = generateOrderBookKey(String(tokenId));
    
    const orderbook = await getWithRevalidation(
      cacheKey,
      orderBookCache,
      async () => {
        const apiResponse = await fetchWithTimeout(
          `${CLOB_API}/book?token_id=${tokenId}`,
          5000 // 5s timeout for orderbook
        );
        
        if (!apiResponse.ok) {
          throw new Error(`CLOB API error: ${apiResponse.status}`);
        }
        
        const data = await apiResponse.json();
        
        // Return slim orderbook
        return {
          bids: (data.bids || []).slice(0, 10).map((b: any) => ({
            price: parseFloat(String(b.price || 0)),
            size: parseFloat(String(b.size || 0)),
          })),
          asks: (data.asks || []).slice(0, 10).map((a: any) => ({
            price: parseFloat(String(a.price || 0)),
            size: parseFloat(String(a.size || 0)),
          })),
          spread: data.bids?.[0] && data.asks?.[0] 
            ? parseFloat(data.asks[0].price) - parseFloat(data.bids[0].price)
            : 0,
          lastUpdated: Date.now(),
        };
      },
      5000 // 5s TTL for orderbook
    );
    
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      data: orderbook,
      meta: { duration, cached: duration < 20 },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch orderbook";
    res.status(500).json({ success: false, error: message });
  }
});

// =============================================================================
// GET /api/v2/events - Events endpoint with caching
// =============================================================================
router.get("/events", async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { limit = "50", offset = "0" } = req.query;
    
    const cacheKey = generateEventKey({ limit, offset });
    
    const events = await getWithRevalidation(
      cacheKey,
      eventCache,
      async () => {
        const apiResponse = await fetchWithTimeout(
          `${GAMMA_API}/events?limit=${limit}&offset=${offset}&active=true&closed=false`
        );
        
        if (!apiResponse.ok) {
          throw new Error(`Gamma API error: ${apiResponse.status}`);
        }
        
        const data = await apiResponse.json();
        
        // Transform to slim format
        if (Array.isArray(data)) {
          return data.map((event: any) => ({
            id: event.id,
            title: event.title,
            slug: event.slug,
            image: event.image || null,
            marketCount: event.markets?.length || 0,
            totalVolume: event.markets?.reduce((sum: number, m: any) => 
              sum + (parseFloat(String(m.volume24hr || 0)) || 0), 0) || 0,
          }));
        }
        
        return [];
      },
      30000 // 30s TTL for events
    );
    
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      data: events,
      meta: { count: events.length, duration, cached: duration < 50 },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch events";
    res.status(500).json({ success: false, error: message });
  }
});

// =============================================================================
// GET /api/v2/cache/stats - Cache statistics endpoint
// =============================================================================
router.get("/cache/stats", (req: Request, res: Response) => {
  const stats = getTimingStats();
  
  res.json({
    success: true,
    data: {
      timing: stats,
      caches: {
        marketList: marketListCache.stats(),
        marketMetadata: marketMetadataCache.stats(),
        events: eventCache.stats(),
        orderBook: orderBookCache.stats(),
      },
    },
  });
});

export default router;
