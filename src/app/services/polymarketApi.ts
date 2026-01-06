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

export async function searchMarkets(query: string, limit = 50) {
  try {
    const response = await fetchWithTimeout(
      gammaUrl("/markets", { limit: limit.toString() })
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    const allMarkets = Array.isArray(data) ? data : (data?.data || data?.markets || []);
    const lowerQuery = query.toLowerCase();
    
    return allMarkets.filter((m: any) => 
      m.title?.toLowerCase().includes(lowerQuery) || 
      m.question?.toLowerCase().includes(lowerQuery) ||
      m.name?.toLowerCase().includes(lowerQuery)
    );
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
