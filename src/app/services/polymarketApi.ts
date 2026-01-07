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
      .map((m: any) => {
        // Parse outcomePrices which can be a JSON string like "[\"0.65\",\"0.35\"]"
        let yesPrice = 0.5;
        if (m.outcomePrices) {
          try {
            const prices = typeof m.outcomePrices === 'string' 
              ? JSON.parse(m.outcomePrices) 
              : m.outcomePrices;
            if (Array.isArray(prices) && prices.length > 0) {
              const parsed = parseFloat(String(prices[0]));
              if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
                yesPrice = parsed;
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
            if (!isNaN(bid) && bid > 0 && bid < 1) yesPrice = bid;
          } else if (m.lastTradePrice) {
            const last = parseFloat(String(m.lastTradePrice));
            if (!isNaN(last) && last > 0 && last < 1) yesPrice = last;
          }
        }
        
        return {
          ...m,
          id: m.id || m.conditionId || Math.random().toString(),
          title: m.question || m.title || "Unknown Market",
          // Use parsed price for probability
          lastPriceUsd: yesPrice,
          // Use real volume data from API
          volumeUsd: parseFloat(String(m[volumeField] || 0)),
          volume24hr: parseFloat(String(m.volume24hr || 0)),
          volume7d: parseFloat(String(m.volume1wk || 0)),
          volume1mo: parseFloat(String(m.volume1mo || 0)),
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

