/**
 * Direct Polymarket API client - calls APIs directly from frontend
 * No backend needed!
 * 
 * In development, uses local backend proxy to avoid CORS issues
 * In production, uses Vercel serverless API route as proxy
 */

const isDev = import.meta.env.DEV;

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
      .map((m: any) => ({
        ...m,
        id: m.id || m.conditionId || Math.random().toString(),
        title: m.question || m.title || "Unknown Market",
        // Use bestBid for probability, default to 0.5
        lastPriceUsd: m.bestBid ? parseFloat(String(m.bestBid)) : (m.lastTradePrice ? parseFloat(String(m.lastTradePrice)) : 0.5),
        // Use real volume data from API
        volumeUsd: parseFloat(String(m[volumeField] || 0)),
        volume24hr: parseFloat(String(m.volume24hr || 0)),
        volume7d: parseFloat(String(m.volume1wk || 0)),
        volume1mo: parseFloat(String(m.volume1mo || 0)),
      }))
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
 * Fetches all markets without filtering by volume
 */
export async function getAllActiveMarkets() {
  try {
    // Fetch all events to get comprehensive market list
    const response = await fetchWithTimeout(
      gammaUrl("/events", { limit: "1000", active: "true", closed: "false" })
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    // Extract all markets from events
    let allMarkets: any[] = [];
    if (Array.isArray(data)) {
      data.forEach((event: any) => {
        if (Array.isArray(event.markets)) {
          // Add event info to each market for context
          const marketsWithEvent = event.markets.map((m: any) => ({
            ...m,
            eventTitle: event.title,
            eventSlug: event.slug,
          }));
          allMarkets = allMarkets.concat(marketsWithEvent);
        }
      });
    }
    
    console.log(`Fetched ${allMarkets.length} total active markets for search`);
    
    // Map all markets with consistent structure
    return allMarkets
      .filter((m: any) => m.question || m.title)
      .map((m: any) => ({
        id: m.id || m.conditionId || Math.random().toString(),
        title: m.question || m.title || "Unknown Market",
        name: m.question || m.title || "Unknown Market",
        slug: m.slug,
        conditionId: m.conditionId,
        questionId: m.questionId,
        // Tokens for CLOB lookups
        clobTokenIds: m.clobTokenIds,
        tokens: m.tokens,
        // Use outcomePrices if available, otherwise bestBid/lastTradePrice
        probability: m.outcomePrices 
          ? parseFloat(String(m.outcomePrices[0] || 0.5)) * 100
          : m.bestBid 
            ? parseFloat(String(m.bestBid)) * 100 
            : (m.lastTradePrice ? parseFloat(String(m.lastTradePrice)) * 100 : 50),
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
      }));
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
 */
export async function getMarketDetails(marketId: string) {
  try {
    // First get basic market info from Gamma
    const marketResponse = await fetchWithTimeout(gammaUrl(`/markets/${marketId}`));
    let marketData: any = {};
    
    if (marketResponse.ok) {
      marketData = await marketResponse.json();
    }
    
    // Try to get CLOB prices if we have token IDs
    let clobPrices: any = null;
    if (marketData.clobTokenIds && marketData.clobTokenIds.length > 0) {
      try {
        // Try to get order book for the YES token (first token)
        const yesTokenId = marketData.clobTokenIds[0];
        const orderBookResponse = await fetchWithTimeout(clobUrl(`/book`, { token_id: yesTokenId }));
        if (orderBookResponse.ok) {
          clobPrices = await orderBookResponse.json();
        }
      } catch (e) {
        console.log("Could not fetch CLOB prices:", e);
      }
    }
    
    // Calculate prices from various sources
    let yesPrice = 0.5;
    let noPrice = 0.5;
    let spread = 0;
    
    // Try CLOB order book first
    if (clobPrices && clobPrices.bids && clobPrices.asks) {
      const bestBid = clobPrices.bids[0]?.price || 0;
      const bestAsk = clobPrices.asks[0]?.price || 1;
      yesPrice = (bestBid + bestAsk) / 2;
      noPrice = 1 - yesPrice;
      spread = Math.abs(bestAsk - bestBid);
    }
    // Fall back to outcomePrices from market data
    else if (marketData.outcomePrices && marketData.outcomePrices.length >= 2) {
      yesPrice = parseFloat(String(marketData.outcomePrices[0]));
      noPrice = parseFloat(String(marketData.outcomePrices[1]));
    }
    // Fall back to bestBid
    else if (marketData.bestBid) {
      yesPrice = parseFloat(String(marketData.bestBid));
      noPrice = 1 - yesPrice;
    }
    
    return {
      id: marketData.id || marketId,
      title: marketData.question || marketData.title || "Unknown Market",
      name: marketData.question || marketData.title || "Unknown Market",
      description: marketData.description || "",
      slug: marketData.slug,
      conditionId: marketData.conditionId,
      
      // Pricing
      yesPrice: yesPrice,
      noPrice: noPrice,
      probability: yesPrice * 100,
      spread: spread,
      
      // Volume and liquidity
      volume: formatVolumeHelper(parseFloat(String(marketData.volume || marketData.volumeNum || 0))),
      volumeUsd: parseFloat(String(marketData.volume || marketData.volumeNum || 0)),
      volume24hr: formatVolumeHelper(parseFloat(String(marketData.volume24hr || 0))),
      volume24hrNum: parseFloat(String(marketData.volume24hr || 0)),
      liquidity: formatVolumeHelper(parseFloat(String(marketData.liquidity || 0))),
      liquidityNum: parseFloat(String(marketData.liquidity || 0)),
      
      // Market info
      outcomes: marketData.outcomes || ["Yes", "No"],
      outcomePrices: marketData.outcomePrices || [yesPrice, noPrice],
      endDate: marketData.endDate,
      createdAt: marketData.createdAt,
      
      // Token IDs for trading
      clobTokenIds: marketData.clobTokenIds || [],
      tokens: marketData.tokens || [],
      
      // CLOB order book data
      orderBook: clobPrices,
      
      // Additional stats
      uniqueTraders: marketData.uniqueTraders || 0,
      tradesCount: marketData.tradesCount || 0,
    };
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

export async function searchMarkets(query: string, limit = 50) {
  try {
    // Fetch all active events to get comprehensive market list for searching
    const response = await fetchWithTimeout(
      gammaUrl("/events", { limit: "500", active: "true", closed: "false" })
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    // Extract all markets from events
    let allMarkets: any[] = [];
    if (Array.isArray(data)) {
      data.forEach((event: any) => {
        if (Array.isArray(event.markets)) {
          allMarkets = allMarkets.concat(event.markets);
        }
      });
    }
    
    const lowerQuery = query.toLowerCase().trim();
    const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 0);
    
    // Score markets based on relevance
    const scoredMarkets = allMarkets
      .filter((m: any) => {
        const title = (m.question || m.title || "").toLowerCase();
        // Must have title and be active
        return title && m.active !== false && m.closed !== true;
      })
      .map((m: any) => {
        const title = (m.question || m.title || "").toLowerCase();
        let score = 0;
        
        // Exact phrase match gets highest score
        if (title.includes(lowerQuery)) {
          score += 100;
        }
        
        // Score based on word matches
        queryWords.forEach(word => {
          if (title.includes(word)) {
            score += 10;
            // Bonus for word at start
            if (title.startsWith(word)) {
              score += 5;
            }
          }
        });
        
        // Bonus for volume (popular markets)
        const volume = parseFloat(String(m.volumeNum || m.volume24hr || 0));
        if (volume > 1000000) score += 3;
        else if (volume > 100000) score += 2;
        else if (volume > 10000) score += 1;
        
        return { ...m, _searchScore: score };
      })
      .filter((m: any) => m._searchScore > 0)
      .sort((a: any, b: any) => b._searchScore - a._searchScore)
      .slice(0, limit)
      .map((m: any) => ({
        ...m,
        id: m.id || m.conditionId || Math.random().toString(),
        title: m.question || m.title || "Unknown Market",
        lastPriceUsd: m.bestBid ? parseFloat(String(m.bestBid)) : (m.lastTradePrice ? parseFloat(String(m.lastTradePrice)) : 0.5),
        volumeUsd: parseFloat(String(m.volumeNum || m.volume24hr || 0)),
        volume24hr: parseFloat(String(m.volume24hr || 0)),
        volume7d: parseFloat(String(m.volume1wk || 0)),
        volume1mo: parseFloat(String(m.volume1mo || 0)),
      }));
    
    console.log(`Search for "${query}" found ${scoredMarkets.length} results`);
    return scoredMarkets;
  } catch (error) {
    console.error("Failed to search markets:", error);
    return [];
  }
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
