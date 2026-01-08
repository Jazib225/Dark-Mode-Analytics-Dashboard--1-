/**
 * Direct Polymarket API client - calls APIs directly from frontend
 * No backend needed!
 * 
 * In development, uses local backend proxy to avoid CORS issues
 * In production, uses Vercel serverless API route as proxy
 * 
 * OPTIMIZED: Uses global market cache for instant search across ALL markets
 */

const isDev = import.meta.env.DEV;

// =============================================================================
// GLOBAL MARKET CACHE - Enables instant search across ALL Polymarket markets
// =============================================================================
interface CachedMarket {
  id: string;
  title: string;
  slug: string;
  description: string;
  groupItemTitle: string;
  probability: number;
  volumeUsd: number;
  volume24hr: number;
  liquidity: number;
  image: string | null;
  eventTitle: string;
  conditionId: string;
  clobTokenIds: string;
  outcomes: string;
  outcomePrices: string;
  endDate: string;
  createdAt: string;
  closed: boolean;
  active: boolean;
  // Search optimization: pre-computed lowercase fields
  _titleLower: string;
  _slugLower: string;
  _groupTitleLower: string;
  _descLower: string;
}

interface MarketCache {
  markets: CachedMarket[];
  lastUpdated: number;
  isLoading: boolean;
  loadPromise: Promise<void> | null;
}

// Global singleton cache
const globalMarketCache: MarketCache = {
  markets: [],
  lastUpdated: 0,
  isLoading: false,
  loadPromise: null,
};

// Cache duration: 5 minutes (markets don't change that frequently)
const CACHE_DURATION_MS = 5 * 60 * 1000;

// =============================================================================
// UTILITY FUNCTIONS (must be defined before cache functions that use them)
// =============================================================================

// Helper to build URLs that work in both dev and prod
function buildApiUrl(path: string, service: string): string {
  if (isDev) {
    // Local dev: use Express server proxy (path-based)
    return `http://localhost:3001/api/proxy/${service}${path}`;
  } else {
    // Production: use Vercel API route (query-based)
    const params = new URLSearchParams();
    params.append('service', service);
    params.append('path', path);
    return `/api/proxy?${params.toString()}`;
  }
}

// Helper to add additional query params to the URL
function addQueryParams(baseUrl: string, additionalParams: Record<string, string>): string {
  const url = new URL(baseUrl, window.location.origin);
  for (const [key, value] of Object.entries(additionalParams)) {
    url.searchParams.append(key, value);
  }
  return url.toString().replace(url.origin, '');
}

// Convenience functions for each API
const gammaUrl = (path: string, params?: Record<string, string>) => {
  const baseUrl = buildApiUrl(path, "gamma");
  return params ? addQueryParams(baseUrl, params) : baseUrl;
};
const clobUrl = (path: string, params?: Record<string, string>) => {
  const baseUrl = buildApiUrl(path, "clob");
  return params ? addQueryParams(baseUrl, params) : baseUrl;
};
const dataUrl = (path: string, params?: Record<string, string>) => {
  const baseUrl = buildApiUrl(path, "data");
  return params ? addQueryParams(baseUrl, params) : baseUrl;
};

async function fetchWithTimeout(
  url: string,
  timeout = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// =============================================================================
// CACHE FUNCTIONS
// =============================================================================

/**
 * Check if cache is valid
 */
function isCacheValid(): boolean {
  return globalMarketCache.markets.length > 0 && 
         (Date.now() - globalMarketCache.lastUpdated) < CACHE_DURATION_MS;
}

/**
 * Initialize the global market cache - fetches ALL markets using pagination
 * Call this on app startup for instant search
 */
export async function initializeMarketCache(): Promise<void> {
  // If already loading, wait for existing load
  if (globalMarketCache.loadPromise) {
    return globalMarketCache.loadPromise;
  }
  
  // If cache is still valid, skip reload
  if (isCacheValid()) {
    console.log(`Market cache valid with ${globalMarketCache.markets.length} markets`);
    return;
  }
  
  globalMarketCache.isLoading = true;
  console.log("🚀 Initializing global market cache...");
  
  globalMarketCache.loadPromise = (async () => {
    try {
      const allMarkets: any[] = [];
      const seenIds = new Set<string>();
      
      // Fetch ALL markets using pagination from events endpoint
      let offset = 0;
      const pageSize = 500;
      let hasMore = true;
      
      console.log("📊 Fetching all markets from events endpoint...");
      while (hasMore) {
        try {
          const response = await fetchWithTimeout(
            gammaUrl("/events", { 
              limit: String(pageSize), 
              offset: String(offset),
              closed: "false" 
            }),
            15000
          );
          
          if (!response.ok) {
            console.log(`Events fetch failed at offset ${offset}, stopping pagination`);
            hasMore = false;
            break;
          }
          
          const events = await response.json();
          
          if (!Array.isArray(events) || events.length === 0) {
            hasMore = false;
            break;
          }
          
          let marketsInPage = 0;
          events.forEach((event: any) => {
            if (Array.isArray(event.markets)) {
              event.markets.forEach((m: any) => {
                const id = m.id || m.conditionId;
                if (id && !seenIds.has(id)) {
                  seenIds.add(id);
                  allMarkets.push({ ...m, eventTitle: event.title, eventSlug: event.slug });
                  marketsInPage++;
                }
              });
            }
          });
          
          console.log(`  Page ${offset / pageSize + 1}: ${events.length} events, ${marketsInPage} new markets`);
          
          // If we got fewer events than requested, we're done
          if (events.length < pageSize) {
            hasMore = false;
          } else {
            offset += pageSize;
          }
          
          // Safety limit to prevent infinite loops
          if (offset > 10000) {
            console.log("  Reached safety limit, stopping pagination");
            hasMore = false;
          }
        } catch (e) {
          console.log(`  Pagination error at offset ${offset}:`, e);
          hasMore = false;
        }
      }
      
      // Also fetch from /markets endpoint to catch standalone markets
      console.log("📊 Fetching standalone markets...");
      offset = 0;
      hasMore = true;
      
      while (hasMore) {
        try {
          const response = await fetchWithTimeout(
            gammaUrl("/markets", { 
              limit: String(pageSize), 
              offset: String(offset),
              closed: "false" 
            }),
            15000
          );
          
          if (!response.ok) {
            hasMore = false;
            break;
          }
          
          const data = await response.json();
          const markets = Array.isArray(data) ? data : (data?.data || data?.markets || []);
          
          if (markets.length === 0) {
            hasMore = false;
            break;
          }
          
          let newCount = 0;
          markets.forEach((m: any) => {
            const id = m.id || m.conditionId;
            if (id && !seenIds.has(id)) {
              seenIds.add(id);
              allMarkets.push(m);
              newCount++;
            }
          });
          
          if (newCount > 0) {
            console.log(`  Markets page ${offset / pageSize + 1}: ${newCount} new markets`);
          }
          
          if (markets.length < pageSize) {
            hasMore = false;
          } else {
            offset += pageSize;
          }
          
          if (offset > 5000) {
            hasMore = false;
          }
        } catch (e) {
          hasMore = false;
        }
      }
      
      // Transform and cache markets
      console.log(`🔄 Processing ${allMarkets.length} markets for cache...`);
      globalMarketCache.markets = allMarkets
        .filter((m: any) => m.question || m.title)
        .map((m: any): CachedMarket => {
          const title = m.question || m.title || "";
          const slug = m.slug || "";
          const groupTitle = m.groupItemTitle || "";
          const desc = m.description || "";
          
          return {
            id: m.id || m.conditionId || Math.random().toString(),
            title,
            slug,
            description: desc,
            groupItemTitle: groupTitle,
            probability: extractProbabilityFromMarket(m),
            volumeUsd: parseFloat(String(m.volumeNum || m.volume || 0)),
            volume24hr: parseFloat(String(m.volume24hr || 0)),
            liquidity: parseFloat(String(m.liquidityNum || m.liquidity || 0)),
            image: m.image || null,
            eventTitle: m.eventTitle || "",
            conditionId: m.conditionId || "",
            clobTokenIds: m.clobTokenIds || "",
            outcomes: m.outcomes || "",
            outcomePrices: m.outcomePrices || "",
            endDate: m.endDate || "",
            createdAt: m.createdAt || "",
            closed: m.closed === true,
            active: m.active !== false,
            // Pre-compute lowercase for faster search
            _titleLower: title.toLowerCase(),
            _slugLower: slug.toLowerCase(),
            _groupTitleLower: groupTitle.toLowerCase(),
            _descLower: desc.toLowerCase().slice(0, 500), // Limit description for memory
          };
        });
      
      globalMarketCache.lastUpdated = Date.now();
      console.log(`✅ Market cache initialized with ${globalMarketCache.markets.length} markets`);
      
    } catch (error) {
      console.error("❌ Failed to initialize market cache:", error);
    } finally {
      globalMarketCache.isLoading = false;
      globalMarketCache.loadPromise = null;
    }
  })();
  
  return globalMarketCache.loadPromise;
}

/**
 * Helper to extract probability from market data
 */
function extractProbabilityFromMarket(market: any): number {
  if (market.outcomePrices) {
    try {
      const prices = typeof market.outcomePrices === 'string' 
        ? JSON.parse(market.outcomePrices) 
        : market.outcomePrices;
      if (Array.isArray(prices) && prices.length > 0) {
        const parsed = parseFloat(String(prices[0]));
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          return parsed * 100;
        }
      }
    } catch (e) {}
  }
  if (market.bestBid) {
    const bid = parseFloat(String(market.bestBid));
    if (!isNaN(bid) && bid > 0 && bid < 1) return bid * 100;
  }
  if (market.lastTradePrice) {
    const last = parseFloat(String(market.lastTradePrice));
    if (!isNaN(last) && last > 0 && last < 1) return last * 100;
  }
  return 50;
}

/**
 * INSTANT SEARCH - Uses the preloaded cache for immediate results
 * Fuzzy matching with scoring for best relevance
 */
export function instantSearch(query: string, limit = 50): CachedMarket[] {
  if (!query.trim()) return [];
  
  const lowerQuery = query.toLowerCase().trim();
  const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 1);
  
  // If cache not ready, return empty (search will fall back to API)
  if (globalMarketCache.markets.length === 0) {
    return [];
  }
  
  const scored = globalMarketCache.markets
    .filter(m => !m.closed)
    .map(m => {
      let score = 0;
      
      // Exact phrase match - highest priority
      if (m._titleLower.includes(lowerQuery)) {
        score += 100;
        if (m._titleLower.startsWith(lowerQuery)) score += 20;
      }
      
      // Group title match (e.g., "Kevin Stefanski" in groupItemTitle)
      if (m._groupTitleLower.includes(lowerQuery)) {
        score += 90;
      }
      
      // Slug match
      if (m._slugLower.includes(lowerQuery.replace(/\s+/g, '-'))) {
        score += 70;
      }
      
      // Word-by-word matching
      let wordMatches = 0;
      queryWords.forEach(word => {
        // Check for word stem matching (e.g., "stefan" matches "stefanski")
        const wordStem = word.length > 4 ? word.slice(0, -2) : word;
        
        if (m._titleLower.includes(word)) {
          score += 20;
          wordMatches++;
        } else if (m._titleLower.includes(wordStem)) {
          score += 15;
          wordMatches++;
        }
        
        if (m._groupTitleLower.includes(word)) {
          score += 18;
          wordMatches++;
        } else if (m._groupTitleLower.includes(wordStem)) {
          score += 12;
          wordMatches++;
        }
        
        if (m._slugLower.includes(word)) {
          score += 10;
          wordMatches++;
        }
        
        if (m._descLower.includes(word)) {
          score += 5;
        }
      });
      
      // Bonus if all words match
      if (queryWords.length > 1 && wordMatches >= queryWords.length) {
        score += 30;
      }
      
      return { market: m, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.market);
  
  return scored;
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    totalMarkets: globalMarketCache.markets.length,
    lastUpdated: globalMarketCache.lastUpdated,
    isLoading: globalMarketCache.isLoading,
    cacheAge: Date.now() - globalMarketCache.lastUpdated,
  };
}

/**
 * Markets API - Get trending and active markets
 */
export async function getTrendingMarkets(timeframe: "1h" | "24h" | "7d" | "1m" = "24h") {
  try {
    // Use Gamma API events endpoint to get all active markets with volume data
    const response = await fetchWithTimeout(
      gammaUrl("/events", { limit: "500", active: "true", closed: "false" })
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    // Events endpoint returns array of events, each containing markets
    let allMarkets: any[] = [];
    
    if (Array.isArray(data)) {
      // Extract all markets from events
      data.forEach((event: any) => {
        if (Array.isArray(event.markets)) {
          allMarkets = allMarkets.concat(event.markets);
        }
      });
    }
    
    console.log(`Fetched ${allMarkets.length} active markets from Events API`);
    
    // Determine volume field based on timeframe
    const volumeField = timeframe === "24h" ? "volume24hr" 
                      : timeframe === "7d" ? "volume1wk" 
                      : timeframe === "1m" ? "volume1mo"
                      : "volume24hr";
    
    // Filter for markets with questions, active status, and volume > 0, then sort by timeframe volume
    const activeMarkets = allMarkets
      .filter((m: any) => {
        // Only include if has question/title and is active and not closed
        const hasTitle = m.question || m.title;
        const isActive = m.active === true && m.closed !== true;
        const hasVolume = parseFloat(String(m[volumeField] || 0)) > 0;
        return hasTitle && isActive && hasVolume;
      })
      .map((m: any) => {
        // Parse outcomePrices which can be a JSON string like "[\"0.65\",\"0.35\"]"
        let yesPrice = 0.5;
        let noPrice = 0.5;
        if (m.outcomePrices) {
          try {
            const prices = typeof m.outcomePrices === 'string' 
              ? JSON.parse(m.outcomePrices) 
              : m.outcomePrices;
            if (Array.isArray(prices) && prices.length > 0) {
              const parsed = parseFloat(String(prices[0]));
              if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
                yesPrice = parsed;
                noPrice = prices.length > 1 ? parseFloat(String(prices[1])) : (1 - yesPrice);
              }
            }
          } catch (e) {
            // Fall back to other price sources
          }
        }
        // Fallback to bestBid or lastTradePrice
        if (yesPrice === 0.5) {
          if (m.bestBid) {
            const bid = parseFloat(String(m.bestBid));
            if (!isNaN(bid) && bid > 0 && bid < 1) {
              yesPrice = bid;
              noPrice = 1 - bid;
            }
          } else if (m.lastTradePrice) {
            const last = parseFloat(String(m.lastTradePrice));
            if (!isNaN(last) && last > 0 && last < 1) {
              yesPrice = last;
              noPrice = 1 - last;
            }
          }
        }
        
        return {
          ...m,
          id: m.id || m.conditionId || Math.random().toString(),
          title: m.question || m.title || "Unknown Market",
          // Use parsed price for probability
          lastPriceUsd: yesPrice,
          // Pre-calculated cents for exact display (not rounded)
          yesPriceCents: yesPrice * 100,
          noPriceCents: noPrice * 100,
          // Use real volume data from API
          volumeUsd: parseFloat(String(m[volumeField] || 0)),
          volume24hr: parseFloat(String(m.volume24hr || 0)),
          volume7d: parseFloat(String(m.volume1wk || 0)),
          volume1mo: parseFloat(String(m.volume1mo || 0)),
          // Include image from API
          image: m.image || null,
        };
      })
      .sort((a: any, b: any) => (b.volumeUsd || 0) - (a.volumeUsd || 0))
      .slice(0, 50);
    
    console.log(`Filtered to ${activeMarkets.length} active markets with volume in ${timeframe} timeframe`);
    
    return activeMarkets.length > 0 ? activeMarkets : [];
  } catch (error) {
    console.error("Failed to fetch trending markets:", error);
    return [];
  }
}

export async function getActiveMarkets(limit = 100) {
  try {
    // Use Gamma API with active=true&closed=false to get live markets
    const response = await fetchWithTimeout(
      gammaUrl("/markets", { limit: limit.toString(), active: "true", closed: "false" })
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    let markets: any[] = Array.isArray(data) ? data : (data?.data || data?.markets || []);
    
    // Filter and map markets
    const activeMarkets = markets
      .filter((m: any) => m.question && m.question.length > 5)
      .map((m: any) => ({
        ...m,
        id: m.id || m.questionID || m.conditionId || Math.random().toString(),
        title: m.question || "Unknown Market",
        lastPriceUsd: m.bestBid ? parseFloat(String(m.bestBid)) : (m.lastTradePrice ? parseFloat(String(m.lastTradePrice)) : 0.5),
        volumeUsd: parseFloat(String(m.volumeNum || m.volume24hr || 0)),
        volume24hr: parseFloat(String(m.volume24hr || 0)),
        volume7d: parseFloat(String(m.volume1wk || 0)),
        volume1mo: parseFloat(String(m.volume1mo || 0)),
      }))
      .sort((a: any, b: any) => (b.volumeUsd || 0) - (a.volumeUsd || 0))
      .slice(0, limit);
    
    return activeMarkets;
  } catch (error) {
    console.error("Failed to fetch active markets:", error);
    return [];
  }
}

export async function getMarketById(id: string) {
  try {
    const response = await fetchWithTimeout(gammaUrl(`/markets/${id}`));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data || {};
  } catch (error) {
    console.error("Failed to fetch market:", error);
    return {};
  }
}

/**
 * Get ALL active markets for comprehensive search
 * Uses the global cache if available for instant results
 * Including new markets, niche markets, and low liquidity markets
 */
export async function getAllActiveMarkets() {
  // First try to use the cache for instant results
  if (globalMarketCache.markets.length > 0) {
    console.log(`Using cached markets: ${globalMarketCache.markets.length} markets available`);
    return globalMarketCache.markets
      .filter(m => !m.closed)
      .map(m => ({
        id: m.id,
        title: m.title,
        name: m.title,
        slug: m.slug,
        conditionId: m.conditionId,
        clobTokenIds: m.clobTokenIds,
        probability: m.probability,
        volume: formatVolumeHelper(m.volumeUsd),
        volumeUsd: m.volumeUsd,
        volume24hr: m.volume24hr,
        eventTitle: m.eventTitle,
        description: m.description,
        endDate: m.endDate,
        createdAt: m.createdAt,
        liquidity: m.liquidity,
        outcomes: m.outcomes,
        outcomePrices: m.outcomePrices,
        image: m.image,
      }));
  }
  
  // Cache not ready, ensure it's loading then fetch directly
  initializeMarketCache();
  
  try {
    let allMarkets: any[] = [];
    const seenIds = new Set<string>();
    
    // Source 1: Fetch from events endpoint (limit increased, no active filter)
    try {
      const eventsResponse = await fetchWithTimeout(
        gammaUrl("/events", { limit: "2000", closed: "false" })
      );
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        if (Array.isArray(eventsData)) {
          eventsData.forEach((event: any) => {
            if (Array.isArray(event.markets)) {
              event.markets.forEach((m: any) => {
                const id = m.id || m.conditionId;
                if (id && !seenIds.has(id)) {
                  seenIds.add(id);
                  allMarkets.push({
                    ...m,
                    eventTitle: event.title,
                    eventSlug: event.slug,
                  });
                }
              });
            }
          });
        }
        console.log(`Events endpoint: ${allMarkets.length} markets`);
      }
    } catch (e) {
      console.log("Events fetch failed:", e);
    }
    
    // Source 2: Fetch directly from /markets endpoint (catches standalone markets)
    try {
      const marketsResponse = await fetchWithTimeout(
        gammaUrl("/markets", { limit: "1000", closed: "false" })
      );
      if (marketsResponse.ok) {
        const marketsData = await marketsResponse.json();
        const markets = Array.isArray(marketsData) ? marketsData : (marketsData?.data || marketsData?.markets || []);
        let newCount = 0;
        markets.forEach((m: any) => {
          const id = m.id || m.conditionId;
          if (id && !seenIds.has(id)) {
            seenIds.add(id);
            allMarkets.push(m);
            newCount++;
          }
        });
        console.log(`Markets endpoint added ${newCount} additional markets, total: ${allMarkets.length}`);
      }
    } catch (e) {
      console.log("Markets fetch failed:", e);
    }
    
    // Source 3: Try fetching with different sort orders to catch newer markets
    try {
      const newestResponse = await fetchWithTimeout(
        gammaUrl("/markets", { limit: "500", closed: "false", order: "createdAt" })
      );
      if (newestResponse.ok) {
        const newestData = await newestResponse.json();
        const markets = Array.isArray(newestData) ? newestData : (newestData?.data || newestData?.markets || []);
        let newCount = 0;
        markets.forEach((m: any) => {
          const id = m.id || m.conditionId;
          if (id && !seenIds.has(id)) {
            seenIds.add(id);
            allMarkets.push(m);
            newCount++;
          }
        });
        if (newCount > 0) console.log(`Newest markets endpoint added ${newCount} more, total: ${allMarkets.length}`);
      }
    } catch (e) {
      // Silent fail for optional source
    }
    
    console.log(`Total fetched: ${allMarkets.length} unique markets for comprehensive search`);
    
    // Map all markets with consistent structure
    return allMarkets
      .filter((m: any) => m.question || m.title)
      .map((m: any) => {
        // Parse outcomePrices which can be a JSON string
        let probability = 50;
        if (m.outcomePrices) {
          try {
            const prices = typeof m.outcomePrices === 'string' 
              ? JSON.parse(m.outcomePrices) 
              : m.outcomePrices;
            if (Array.isArray(prices) && prices.length > 0) {
              const parsed = parseFloat(String(prices[0]));
              if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
                probability = parsed * 100;
              }
            }
          } catch (e) {
            // Fall back to other price sources
          }
        }
        // Fallback to bestBid or lastTradePrice
        if (probability === 50) {
          if (m.bestBid) {
            const bid = parseFloat(String(m.bestBid));
            if (!isNaN(bid) && bid > 0 && bid < 1) probability = bid * 100;
          } else if (m.lastTradePrice) {
            const last = parseFloat(String(m.lastTradePrice));
            if (!isNaN(last) && last > 0 && last < 1) probability = last * 100;
          }
        }
        
        return {
          id: m.id || m.conditionId || Math.random().toString(),
          title: m.question || m.title || "Unknown Market",
          name: m.question || m.title || "Unknown Market",
          slug: m.slug,
          conditionId: m.conditionId,
          questionId: m.questionId,
          // Tokens for CLOB lookups
          clobTokenIds: m.clobTokenIds,
          tokens: m.tokens,
          // Use parsed probability
          probability: probability,
          volume: formatVolumeHelper(parseFloat(String(m.volume || m.volumeNum || 0))),
          volumeUsd: parseFloat(String(m.volume || m.volumeNum || 0)),
          volume24hr: parseFloat(String(m.volume24hr || 0)),
          // Event context
          eventTitle: m.eventTitle,
          eventSlug: m.eventSlug,
          // Additional metadata
          description: m.description,
          endDate: m.endDate,
          createdAt: m.createdAt,
          liquidity: m.liquidity,
          outcomes: m.outcomes,
          outcomePrices: m.outcomePrices,
          // Market image
          image: m.image || null,
        };
      });
  } catch (error) {
    console.error("Failed to fetch all active markets:", error);
    return [];
  }
}

// Helper for formatting volume
function formatVolumeHelper(volume: number): string {
  if (volume >= 1000000) {
    return `$${(volume / 1000000).toFixed(2)}M`;
  } else if (volume >= 1000) {
    return `$${(volume / 1000).toFixed(2)}K`;
  }
  return `$${volume.toFixed(2)}`;
}

/**
 * Get detailed market data including CLOB prices
 * Uses multiple data sources to ensure accurate pricing
 */
export async function getMarketDetails(marketId: string) {
  try {
    console.log(`Fetching market details for: ${marketId}`);
    
    // First get basic market info from Gamma
    const marketResponse = await fetchWithTimeout(gammaUrl(`/markets/${marketId}`));
    let marketData: any = null;
    
    if (marketResponse.ok) {
      marketData = await marketResponse.json();
      console.log("Gamma market data:", marketData);
    } else {
      console.log(`Gamma market fetch failed with status: ${marketResponse.status}`);
    }
    
    // If direct market lookup failed, try finding it via events
    if (!marketData || Object.keys(marketData).length === 0) {
      console.log("Trying to find market via events endpoint...");
      const eventsResponse = await fetchWithTimeout(
        gammaUrl("/events", { limit: "500", active: "true", closed: "false" })
      );
      
      if (eventsResponse.ok) {
        const events = await eventsResponse.json();
        if (Array.isArray(events)) {
          for (const event of events) {
            if (Array.isArray(event.markets)) {
              const foundMarket = event.markets.find((m: any) => m.id === marketId);
              if (foundMarket) {
                marketData = foundMarket;
                console.log("Found market in events:", marketData);
                break;
              }
            }
          }
        }
      }
    }
    
    // If still no data, return sensible defaults
    if (!marketData) {
      console.log("No market data found, using defaults");
      return {
        id: marketId,
        title: "Unknown Market",
        name: "Unknown Market",
        description: "",
        yesPrice: 0.5,
        noPrice: 0.5,
        probability: 50,
        spread: 0,
        volume: "$0",
        volumeUsd: 0,
        volume24hr: "$0",
        volume24hrNum: 0,
        liquidity: "$0",
        liquidityNum: 0,
        outcomes: ["Yes", "No"],
        outcomePrices: [0.5, 0.5],
        clobTokenIds: [],
        tokens: [],
        uniqueTraders: 0,
        tradesCount: 0,
      };
    }
    
    // Extract prices from market data
    // Polymarket provides outcomePrices as a JSON string like "[\"0.65\",\"0.35\"]"
    let yesPrice = 0.5;
    let noPrice = 0.5;
    let spread = 0;
    let priceSource = "default";
    
    // Priority 1: Use outcomePrices from Gamma (MOST RELIABLE - actual Polymarket prices)
    // outcomePrices can be a string that needs JSON parsing OR an array
    if (marketData.outcomePrices) {
      let prices: any[] = [];
      
      // Try to parse if it's a string
      if (typeof marketData.outcomePrices === 'string') {
        try {
          prices = JSON.parse(marketData.outcomePrices);
          console.log("Parsed outcomePrices from string:", prices);
        } catch (e) {
          console.log("Failed to parse outcomePrices string:", marketData.outcomePrices);
        }
      } else if (Array.isArray(marketData.outcomePrices)) {
        prices = marketData.outcomePrices;
        console.log("outcomePrices is already array:", prices);
      }
      
      if (prices.length >= 2) {
        const yesParsed = parseFloat(String(prices[0]));
        const noParsed = parseFloat(String(prices[1]));
        if (!isNaN(yesParsed) && !isNaN(noParsed) && yesParsed >= 0 && yesParsed <= 1) {
          yesPrice = yesParsed;
          noPrice = noParsed;
          priceSource = "outcomePrices";
          console.log(`Using outcomePrices: YES=${yesPrice}, NO=${noPrice}`);
        }
      }
    }
    // Priority 2: Use bestBid and bestAsk for midpoint price
    if (priceSource === "default" && marketData.bestBid !== undefined && marketData.bestBid !== null && marketData.bestAsk !== undefined && marketData.bestAsk !== null) {
      const bidParsed = parseFloat(String(marketData.bestBid));
      const askParsed = parseFloat(String(marketData.bestAsk));
      if (!isNaN(bidParsed) && !isNaN(askParsed) && bidParsed > 0 && askParsed < 1) {
        yesPrice = (bidParsed + askParsed) / 2;
        noPrice = 1 - yesPrice;
        spread = askParsed - bidParsed;
        priceSource = "bestBid/Ask";
        console.log(`Using bestBid/bestAsk midpoint: YES=${yesPrice}, NO=${noPrice}`);
      }
    }
    // Priority 3: Try lastTradePrice
    if (priceSource === "default" && marketData.lastTradePrice !== undefined && marketData.lastTradePrice !== null) {
      const lastParsed = parseFloat(String(marketData.lastTradePrice));
      if (!isNaN(lastParsed) && lastParsed > 0 && lastParsed < 1) {
        yesPrice = lastParsed;
        noPrice = 1 - lastParsed;
        priceSource = "lastTradePrice";
        console.log(`Using lastTradePrice: YES=${yesPrice}, NO=${noPrice}`);
      }
    }
    // Priority 4: Try bestBid alone
    if (priceSource === "default" && marketData.bestBid !== undefined && marketData.bestBid !== null) {
      const bidParsed = parseFloat(String(marketData.bestBid));
      if (!isNaN(bidParsed) && bidParsed > 0 && bidParsed < 1) {
        yesPrice = bidParsed;
        noPrice = 1 - bidParsed;
        priceSource = "bestBid";
        console.log(`Using bestBid: YES=${yesPrice}, NO=${noPrice}`);
      }
    }
    
    // CLOB API - Only use as LAST RESORT fallback if we still have default prices
    // clobTokenIds might be a JSON string or array
    let clobTokenIds: string[] = [];
    if (marketData.clobTokenIds) {
      if (typeof marketData.clobTokenIds === 'string') {
        try {
          clobTokenIds = JSON.parse(marketData.clobTokenIds);
        } catch (e) {
          console.log("Failed to parse clobTokenIds string");
        }
      } else if (Array.isArray(marketData.clobTokenIds)) {
        clobTokenIds = marketData.clobTokenIds;
      }
    }
    
    // Only fetch CLOB if we don't have valid prices yet (priceSource is still default)
    if (priceSource === "default" && clobTokenIds.length > 0) {
      try {
        const yesTokenId = clobTokenIds[0];
        console.log(`Fetching CLOB book for token: ${yesTokenId}`);
        const orderBookResponse = await fetchWithTimeout(clobUrl(`/book`, { token_id: yesTokenId }));
        
        if (orderBookResponse.ok) {
          const clobData = await orderBookResponse.json();
          console.log("CLOB data (fallback):", clobData);
          
          if (clobData && clobData.bids && clobData.asks && clobData.bids.length > 0 && clobData.asks.length > 0) {
            const bestBid = parseFloat(String(clobData.bids[0]?.price || 0));
            const bestAsk = parseFloat(String(clobData.asks[0]?.price || 1));
            
            // Only use CLOB if prices are reasonable (not at extremes)
            if (!isNaN(bestBid) && !isNaN(bestAsk) && bestBid > 0.01 && bestAsk < 0.99) {
              // Use midpoint of bid-ask as yes price
              yesPrice = (bestBid + bestAsk) / 2;
              noPrice = 1 - yesPrice;
              spread = bestAsk - bestBid;
              priceSource = "CLOB";
              console.log(`Using CLOB midpoint: YES=${yesPrice}, NO=${noPrice}, Spread=${spread}`);
            }
          }
        }
      } catch (clobError) {
        console.log("CLOB fetch failed, using Gamma prices:", clobError);
      }
    }
    
    console.log(`Final prices for ${marketId}: YES=${yesPrice}, NO=${noPrice}, source=${priceSource}`);
    
    // Ensure prices are valid numbers between 0 and 1
    if (isNaN(yesPrice) || yesPrice <= 0 || yesPrice >= 1) {
      yesPrice = 0.5;
    }
    if (isNaN(noPrice) || noPrice <= 0 || noPrice >= 1) {
      noPrice = 1 - yesPrice;
    }
    
    // Parse volume and liquidity safely
    const volumeNum = parseFloat(String(marketData.volume || marketData.volumeNum || 0)) || 0;
    const volume24hrNum = parseFloat(String(marketData.volume24hr || 0)) || 0;
    const liquidityNum = parseFloat(String(marketData.liquidity || 0)) || 0;
    
    const result = {
      id: marketData.id || marketId,
      title: marketData.question || marketData.title || "Unknown Market",
      name: marketData.question || marketData.title || "Unknown Market",
      description: marketData.description || "",
      slug: marketData.slug,
      conditionId: marketData.conditionId,
      
      // Pricing - ensure valid numbers
      yesPrice: yesPrice,
      noPrice: noPrice,
      probability: yesPrice * 100,
      spread: spread,
      
      // Volume and liquidity
      volume: formatVolumeHelper(volumeNum),
      volumeUsd: volumeNum,
      volume24hr: formatVolumeHelper(volume24hrNum),
      volume24hrNum: volume24hrNum,
      liquidity: formatVolumeHelper(liquidityNum),
      liquidityNum: liquidityNum,
      
      // Market info
      outcomes: marketData.outcomes || ["Yes", "No"],
      outcomePrices: [yesPrice, noPrice],
      endDate: marketData.endDate,
      createdAt: marketData.createdAt,
      
      // Token IDs for trading
      clobTokenIds: clobTokenIds,
      tokens: marketData.tokens || [],
      
      // Additional stats
      uniqueTraders: parseInt(String(marketData.uniqueTraders || 0)) || 0,
      tradesCount: parseInt(String(marketData.tradesCount || 0)) || 0,
      
      // Market image
      image: marketData.image || null,
    };
    
    console.log("Final market details:", result);
    return result;
  } catch (error) {
    console.error("Failed to fetch market details:", error);
    return null;
  }
}

/**
 * Get market price history for charts
 */
export async function getMarketPriceHistory(marketId: string, interval: string = "1d") {
  try {
    // Try to get price history from data API
    const response = await fetchWithTimeout(
      dataUrl(`/markets/${marketId}/prices`, { interval })
    );
    
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        return data.map((point: any) => ({
          time: new Date(point.timestamp || point.t).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          timestamp: point.timestamp || point.t,
          probability: (parseFloat(String(point.price || point.p || 0.5)) * 100),
        }));
      }
    }
    
    // Fallback: generate mock data based on current price
    return [];
  } catch (error) {
    console.error("Failed to fetch price history:", error);
    return [];
  }
}

/**
 * Get recent trades for a specific market
 */
export async function getMarketTrades(marketId: string, limit = 20) {
  try {
    const response = await fetchWithTimeout(
      dataUrl(`/markets/${marketId}/trades`, { limit: limit.toString() })
    );
    
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        return data.map((trade: any) => ({
          id: trade.id || Math.random().toString(),
          timestamp: new Date(trade.timestamp || trade.createdAt).toLocaleString(),
          wallet: trade.maker ? `${trade.maker.slice(0, 6)}...${trade.maker.slice(-4)}` : "0x0000...0000",
          side: trade.side === "BUY" || trade.outcome === "Yes" ? "YES" : "NO",
          size: `$${parseFloat(String(trade.size || trade.amount || 0)).toFixed(0)}`,
          price: parseFloat(String(trade.price || 0.5)),
        }));
      }
    }
    
    return [];
  } catch (error) {
    console.error("Failed to fetch market trades:", error);
    return [];
  }
}

export async function searchMarkets(query: string, limit = 100) {
  try {
    // PRIORITY 1: Use instant cache for immediate results
    const cachedResults = instantSearch(query, limit);
    if (cachedResults.length > 0) {
      console.log(`⚡ Instant search returned ${cachedResults.length} results for "${query}"`);
      return cachedResults.map(m => ({
        id: m.id,
        title: m.title,
        name: m.title,
        slug: m.slug,
        conditionId: m.conditionId,
        probability: m.probability,
        lastPriceUsd: m.probability / 100,
        volumeUsd: m.volumeUsd,
        volume24hr: m.volume24hr,
        volume: formatVolumeHelper(m.volumeUsd),
        image: m.image,
        liquidity: m.liquidity,
        description: m.description,
        groupItemTitle: m.groupItemTitle,
        eventTitle: m.eventTitle,
      }));
    }
    
    // Cache not ready - ensure it's loading
    initializeMarketCache();
    
    // Fallback to API search while cache loads
    const encodedQuery = encodeURIComponent(query.trim());
    let allResults: any[] = [];
    const lowerQuery = query.toLowerCase().trim();
    const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 1);
    
    // Strategy 1: Use the dedicated Gamma search endpoint (includes ALL markets)
    try {
      const searchResponse = await fetchWithTimeout(
        gammaUrl("/markets/search", { q: encodedQuery, limit: "200" })
      );
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const searchResults = Array.isArray(searchData) ? searchData : (searchData?.markets || searchData?.data || []);
        console.log(`Gamma search API returned ${searchResults.length} results for "${query}"`);
        allResults = allResults.concat(searchResults);
      }
    } catch (e) {
      console.log("Gamma search endpoint failed, trying fallback...");
    }
    
    // Strategy 2: Also search in /markets endpoint with increased limit
    try {
      const marketsResponse = await fetchWithTimeout(
        gammaUrl("/markets", { limit: "1000", closed: "false" })
      );
      if (marketsResponse.ok) {
        const marketsData = await marketsResponse.json();
        const markets = Array.isArray(marketsData) ? marketsData : (marketsData?.data || marketsData?.markets || []);
        // Filter markets locally to match query - more flexible matching
        const matchedMarkets = markets.filter((m: any) => {
          const title = (m.question || m.title || "").toLowerCase();
          const description = (m.description || "").toLowerCase();
          const slug = (m.slug || "").toLowerCase();
          const groupTitle = (m.groupItemTitle || "").toLowerCase();
          
          // Check for full phrase match
          if (title.includes(lowerQuery) || description.includes(lowerQuery) || slug.includes(lowerQuery)) {
            return true;
          }
          
          // Check if any query word matches (flexible matching for names)
          return queryWords.some(word => 
            title.includes(word) || 
            description.includes(word) || 
            groupTitle.includes(word) ||
            slug.includes(word)
          );
        });
        console.log(`Markets endpoint matched ${matchedMarkets.length} markets for "${query}"`);
        allResults = allResults.concat(matchedMarkets);
      }
    } catch (e) {
      console.log("Markets fallback search failed");
    }
    
    // Strategy 3: Search through ALL events (includes markets not in other endpoints)
    try {
      // Fetch events WITHOUT the active filter to get newer markets too
      const eventsResponse = await fetchWithTimeout(
        gammaUrl("/events", { limit: "2000", closed: "false" })
      );
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        if (Array.isArray(eventsData)) {
          eventsData.forEach((event: any) => {
            // Check if event title matches
            const eventTitle = (event.title || "").toLowerCase();
            const eventDescription = (event.description || "").toLowerCase();
            const eventSlug = (event.slug || "").toLowerCase();
            
            // Check for event-level match
            const eventMatchesFull = eventTitle.includes(lowerQuery) || eventSlug.includes(lowerQuery);
            const eventMatchesWord = queryWords.some(word => 
              eventTitle.includes(word) || 
              eventSlug.includes(word) ||
              eventDescription.includes(word)
            );
            
            if (Array.isArray(event.markets)) {
              event.markets.forEach((m: any) => {
                const marketTitle = (m.question || m.title || "").toLowerCase();
                const marketDescription = (m.description || "").toLowerCase();
                const marketSlug = (m.slug || "").toLowerCase();
                const groupTitle = (m.groupItemTitle || "").toLowerCase();
                
                // Check for market-level match
                const marketMatches = 
                  marketTitle.includes(lowerQuery) || 
                  marketDescription.includes(lowerQuery) ||
                  marketSlug.includes(lowerQuery) ||
                  queryWords.some(word => 
                    marketTitle.includes(word) || 
                    groupTitle.includes(word) ||
                    marketSlug.includes(word)
                  );
                
                if (eventMatchesFull || eventMatchesWord || marketMatches) {
                  allResults.push({ ...m, eventTitle: event.title });
                }
              });
            }
          });
        }
        console.log(`Events search found additional matches, total now: ${allResults.length}`);
      }
    } catch (e) {
      console.log("Events search failed");
    }
    
    // Deduplicate results by ID
    const seenIds = new Set<string>();
    const uniqueResults = allResults.filter((m: any) => {
      const id = m.id || m.conditionId;
      if (!id || seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });
    
    // Score and sort results by relevance
    const scoredResults = uniqueResults
      .filter((m: any) => {
        const title = (m.question || m.title || "").toLowerCase();
        return title && m.closed !== true;
      })
      .map((m: any) => {
        const title = (m.question || m.title || "").toLowerCase();
        const groupTitle = (m.groupItemTitle || "").toLowerCase();
        const slug = (m.slug || "").toLowerCase();
        let score = 0;
        
        // Exact phrase match gets highest score
        if (title.includes(lowerQuery)) {
          score += 100;
        }
        
        // Match in group title (e.g., "Kevin Stefanski" in groupItemTitle)
        if (groupTitle.includes(lowerQuery)) {
          score += 80;
        }
        
        // Score based on word matches
        queryWords.forEach(word => {
          if (title.includes(word)) {
            score += 15;
            if (title.startsWith(word)) score += 5;
          }
          if (groupTitle.includes(word)) {
            score += 12;
          }
          if (slug.includes(word)) {
            score += 8;
          }
        });
        
        // All query words match is a strong signal
        const allWordsMatch = queryWords.every(word => 
          title.includes(word) || groupTitle.includes(word) || slug.includes(word)
        );
        if (allWordsMatch && queryWords.length > 1) {
          score += 30;
        }
        
        // Small bonus for volume (but don't deprioritize low-volume markets too much)
        const volume = parseFloat(String(m.volumeNum || m.volume24hr || m.volume || 0));
        if (volume > 1000000) score += 2;
        else if (volume > 100000) score += 1;
        
        return { ...m, _searchScore: score };
      })
      .filter((m: any) => m._searchScore > 0)
      .sort((a: any, b: any) => b._searchScore - a._searchScore)
      .slice(0, limit)
      .map((m: any) => ({
        ...m,
        id: m.id || m.conditionId || Math.random().toString(),
        title: m.question || m.title || "Unknown Market",
        name: m.question || m.title || "Unknown Market",
        probability: extractProbability(m),
        lastPriceUsd: extractProbability(m) / 100,
        volumeUsd: parseFloat(String(m.volumeNum || m.volume24hr || m.volume || 0)),
        volume24hr: parseFloat(String(m.volume24hr || 0)),
        volume: formatVolumeHelper(parseFloat(String(m.volumeNum || m.volume24hr || m.volume || 0))),
        image: m.image || null,
        liquidity: m.liquidity,
      }));
    
    console.log(`Search for "${query}" found ${scoredResults.length} unique results`);
    return scoredResults;
  } catch (error) {
    console.error("Failed to search markets:", error);
    return [];
  }
}

// Helper to extract probability from various market data formats
function extractProbability(market: any): number {
  if (market.outcomePrices) {
    try {
      const prices = typeof market.outcomePrices === 'string' 
        ? JSON.parse(market.outcomePrices) 
        : market.outcomePrices;
      if (Array.isArray(prices) && prices.length > 0) {
        const parsed = parseFloat(String(prices[0]));
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          return parsed * 100;
        }
      }
    } catch (e) {}
  }
  if (market.bestBid) {
    const bid = parseFloat(String(market.bestBid));
    if (!isNaN(bid) && bid > 0 && bid < 1) return bid * 100;
  }
  if (market.lastTradePrice) {
    const last = parseFloat(String(market.lastTradePrice));
    if (!isNaN(last) && last > 0 && last < 1) return last * 100;
  }
  return 50;
}

export async function getMarketStats(id: string) {
  try {
    const response = await fetchWithTimeout(
      gammaUrl(`/markets/${id}/stats`)
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch market stats:", error);
    return {};
  }
}

export async function getCategories() {
  try {
    const response = await fetchWithTimeout(gammaUrl("/markets/categories"));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : (data?.data || data?.categories || []);
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return [];
  }
}

/**
 * Trading API - Order books and pricing
 */
export async function getOrderBook(assetId: string) {
  try {
    const response = await fetchWithTimeout(
      clobUrl(`/orderbooks/${assetId}`)
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch order book:", error);
    return {};
  }
}

export async function getPriceQuote(assetId: string) {
  try {
    const response = await fetchWithTimeout(clobUrl(`/prices/${assetId}`));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch price quote:", error);
    return {};
  }
}

/**
 * Data API - Portfolio and history (requires wallet address)
 */
export async function getPortfolio(address: string) {
  try {
    const response = await fetchWithTimeout(
      dataUrl(`/portfolios/${address}`)
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch portfolio:", error);
    return {};
  }
}

export async function getPositions(address: string) {
  try {
    const response = await fetchWithTimeout(
      dataUrl(`/portfolios/${address}/positions`)
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : (data?.data || data?.positions || []);
  } catch (error) {
    console.error("Failed to fetch positions:", error);
    return [];
  }
}

export async function getActivity(
  address: string,
  limit = 50,
  offset = 0
) {
  try {
    const response = await fetchWithTimeout(
      dataUrl(`/portfolios/${address}/activity`, { limit: limit.toString(), offset: offset.toString() })
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : (data?.data || data?.activity || []);
  } catch (error) {
    console.error("Failed to fetch activity:", error);
    return [];
  }
}

export async function getRecentTrades(limit = 50, offset = 0) {
  try {
    const response = await fetchWithTimeout(
      dataUrl("/activity", { limit: limit.toString(), offset: offset.toString() })
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : (data?.data || data?.trades || []);
  } catch (error) {
    console.error("Failed to fetch recent trades:", error);
    return [];
  }
}

/**
 * Get event details with all its markets (for multi-outcome markets like Fed decisions)
 * This returns the parent event with all child markets and their prices
 */
export async function getEventWithMarkets(marketId: string) {
  try {
    console.log(`Fetching event for market: ${marketId}`);
    
    // First, find the event that contains this market
    const eventsResponse = await fetchWithTimeout(
      gammaUrl("/events", { limit: "500", active: "true", closed: "false" })
    );
    
    if (!eventsResponse.ok) throw new Error(`HTTP ${eventsResponse.status}`);
    const events = await eventsResponse.json();
    
    let parentEvent: any = null;
    let targetMarket: any = null;
    
    if (Array.isArray(events)) {
      for (const event of events) {
        if (Array.isArray(event.markets)) {
          const found = event.markets.find((m: any) => m.id === marketId);
          if (found) {
            parentEvent = event;
            targetMarket = found;
            break;
          }
        }
      }
    }
    
    if (!parentEvent) {
      console.log("Market not found in any event");
      return null;
    }
    
    console.log(`Found event: ${parentEvent.title} with ${parentEvent.markets?.length} markets`);
    
    // Get prices for all markets in this event
    const marketsWithPrices = await Promise.all(
      (parentEvent.markets || []).map(async (market: any) => {
        let yesPrice = 0.5;
        let noPrice = 0.5;
        let priceSource = "default";
        
        // Debug: log raw market data
        console.log(`Market ${market.id} raw data:`, {
          outcomePrices: market.outcomePrices,
          bestBid: market.bestBid,
          bestAsk: market.bestAsk,
          lastTradePrice: market.lastTradePrice,
        });
        
        // Parse outcomePrices (JSON string or array) - PRIMARY SOURCE
        if (market.outcomePrices) {
          try {
            const prices = typeof market.outcomePrices === 'string'
              ? JSON.parse(market.outcomePrices)
              : market.outcomePrices;
            console.log(`Market ${market.id} parsed outcomePrices:`, prices);
            if (Array.isArray(prices) && prices.length >= 1) {
              const parsed = parseFloat(String(prices[0]));
              if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
                yesPrice = parsed;
                noPrice = prices.length > 1 ? parseFloat(String(prices[1])) : (1 - yesPrice);
                priceSource = "outcomePrices";
              }
            }
          } catch (e) {
            console.log("Failed to parse outcomePrices for", market.id, e);
          }
        }
        
        // Fallback to bestBid/bestAsk if outcomePrices didn't work
        if (priceSource === "default" && market.bestBid !== undefined) {
          const bid = parseFloat(String(market.bestBid));
          if (!isNaN(bid) && bid > 0 && bid < 1) {
            yesPrice = bid;
            noPrice = 1 - bid;
            priceSource = "bestBid";
          }
        }
        
        // Fallback to lastTradePrice
        if (priceSource === "default" && market.lastTradePrice !== undefined) {
          const last = parseFloat(String(market.lastTradePrice));
          if (!isNaN(last) && last > 0 && last < 1) {
            yesPrice = last;
            noPrice = 1 - last;
            priceSource = "lastTradePrice";
          }
        }
        
        // Parse clobTokenIds for reference (but DON'T override outcomePrices)
        let clobTokenIds: string[] = [];
        if (market.clobTokenIds) {
          try {
            clobTokenIds = typeof market.clobTokenIds === 'string'
              ? JSON.parse(market.clobTokenIds)
              : market.clobTokenIds;
          } catch (e) {}
        }
        
        // Only try CLOB API as a LAST RESORT fallback when we have no price data
        // outcomePrices from Gamma API is the most accurate source
        if (priceSource === "default" && clobTokenIds.length > 0) {
          try {
            const orderBookResponse = await fetchWithTimeout(
              clobUrl("/book", { token_id: clobTokenIds[0] }),
              5000 // 5 second timeout
            );
            
            if (orderBookResponse.ok) {
              const clobData = await orderBookResponse.json();
              console.log(`Market ${market.id} CLOB data (fallback):`, clobData);
              if (clobData?.bids?.length > 0 && clobData?.asks?.length > 0) {
                const bestBid = parseFloat(String(clobData.bids[0]?.price || 0));
                const bestAsk = parseFloat(String(clobData.asks[0]?.price || 1));
                // Only use CLOB if it gives us reasonable prices (not 0/1 or empty)
                if (!isNaN(bestBid) && !isNaN(bestAsk) && bestBid > 0.01 && bestAsk < 0.99) {
                  yesPrice = (bestBid + bestAsk) / 2;
                  noPrice = 1 - yesPrice;
                  priceSource = "CLOB";
                }
              }
            }
          } catch (e) {
            console.log(`CLOB fetch failed for market ${market.id}:`, e);
          }
        }
        
        const volumeNum = parseFloat(String(market.volume || market.volumeNum || 0)) || 0;
        
        console.log(`Market ${market.id} final prices: YES=${yesPrice}, NO=${noPrice}, source=${priceSource}`);
        
        // Return with EXACT decimal precision (not rounded)
        return {
          id: market.id,
          question: market.question || market.title,
          outcome: market.outcome || market.groupItemTitle || market.question,
          yesPrice,
          noPrice,
          // Keep full precision for display (e.g., 0.4¢, 99.6¢)
          yesPriceCents: yesPrice * 100,
          noPriceCents: noPrice * 100,
          volume: formatVolumeHelper(volumeNum),
          volumeNum,
          clobTokenIds,
          priceSource,
        };
      })
    );
    
    return {
      id: parentEvent.id,
      title: parentEvent.title,
      slug: parentEvent.slug,
      description: parentEvent.description,
      isMultiOutcome: parentEvent.markets?.length > 1,
      markets: marketsWithPrices,
      // The specific market that was requested
      targetMarket: marketsWithPrices.find((m: any) => m.id === marketId),
    };
  } catch (error) {
    console.error("Failed to fetch event with markets:", error);
    return null;
  }
}

/**
 * Get live CLOB prices for a specific market token
 * Returns bid/ask/mid prices and spread
 */
export async function getClobPrices(tokenId: string) {
  try {
    const response = await fetchWithTimeout(
      clobUrl("/book", { token_id: tokenId }),
      5000
    );
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    if (!data || !data.bids || !data.asks) {
      return null;
    }
    
    const bestBid = data.bids[0] ? parseFloat(String(data.bids[0].price)) : 0;
    const bestAsk = data.asks[0] ? parseFloat(String(data.asks[0].price)) : 1;
    const midPrice = (bestBid + bestAsk) / 2;
    const spread = bestAsk - bestBid;
    
    // Calculate total liquidity at best prices
    const bidLiquidity = data.bids.slice(0, 5).reduce((sum: number, b: any) => 
      sum + parseFloat(String(b.size || 0)), 0);
    const askLiquidity = data.asks.slice(0, 5).reduce((sum: number, a: any) => 
      sum + parseFloat(String(a.size || 0)), 0);
    
    return {
      bestBid,
      bestAsk,
      midPrice,
      spread,
      bidLiquidity,
      askLiquidity,
      // Convert to cents for display (like Polymarket does)
      yesPriceCents: Math.round(midPrice * 100),
      noPriceCents: Math.round((1 - midPrice) * 100),
    };
  } catch (error) {
    console.error("Failed to fetch CLOB prices:", error);
    return null;
  }
}

