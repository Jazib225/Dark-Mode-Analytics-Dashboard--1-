/**
 * Direct Polymarket API client - calls APIs directly from frontend
 * No backend needed!
 * 
 * In development, uses backend proxy to avoid CORS issues
 * In production, uses a CORS proxy service
 */

const isDev = import.meta.env.DEV;

// Use backend proxy in dev for testing, CORS proxy in production
const CORS_PROXY = "https://api.allorigins.win/raw?url=";
const BACKEND_PROXY = isDev ? "http://localhost:3001/api/proxy" : "/api/proxy";

const GAMMA_API = isDev ? `${BACKEND_PROXY}/gamma` : "https://gamma-api.polymarket.com";
const CLOB_API = isDev ? `${BACKEND_PROXY}/clob` : "https://clob.polymarket.com";
const DATA_API = isDev ? `${BACKEND_PROXY}/data` : "https://data-api.polymarket.com";

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
    // Use CLOB API which has more recent market data
    const response = await fetchWithTimeout(
      `${CLOB_API}/markets`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    // Handle both array and paginated responses
    let markets: any[] = [];
    if (Array.isArray(data)) {
      markets = data;
    } else if (data?.markets && Array.isArray(data.markets)) {
      markets = data.markets;
    } else if (data?.data && Array.isArray(data.data)) {
      markets = data.data;
    }
    
    // Filter for active markets (accepting_orders = true or active = true, not closed)
    const active = markets
      .filter((m: any) => {
        // Keep markets that are either:
        // 1. Accepting orders, OR
        // 2. Active and not closed
        return (m.accepting_orders === true) || (m.active === true && m.closed !== true);
      })
      .map((m: any) => ({
        ...m,
        // Use question as title if not available
        title: m.question || m.title,
        // Use a dummy lastPriceUsd if not available for probability display
        lastPriceUsd: m.lastPriceUsd || 0.5,
        // Set dummy volume fields if not in response
        volumeUsd: m.volumeUsd || 0,
        volume24hr: m.volume24hr || 0,
        volume7d: m.volume7d || 0,
        volume1mo: m.volume1mo || 0,
      }))
      .slice(0, 50);
    
    return active;
  } catch (error) {
    console.error("Failed to fetch trending markets:", error);
    return [];
  }
}

export async function getActiveMarkets(limit = 100) {
  try {
    const response = await fetchWithTimeout(
      `${GAMMA_API}/markets?limit=${limit}`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    const allMarkets = Array.isArray(data) ? data : (data?.data || data?.markets || []);
    
    // Filter for active markets and sort by volume (highest first)
    const activeMarkets = allMarkets
      .filter((m: any) => !m.closed && m.volumeUsd && parseFloat(m.volumeUsd) > 0)
      .sort(
        (a: any, b: any) =>
          (parseFloat(b.volumeUsd) || 0) - (parseFloat(a.volumeUsd) || 0)
      )
      .slice(0, limit);
    
    return activeMarkets;
  } catch (error) {
    console.error("Failed to fetch active markets:", error);
    return [];
  }
}

export async function getMarketById(id: string) {
  try {
    const response = await fetchWithTimeout(`${GAMMA_API}/markets/${id}`);
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
      `${GAMMA_API}/markets?limit=${limit}`
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
      `${GAMMA_API}/markets/${id}/stats`
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
    const response = await fetchWithTimeout(`${GAMMA_API}/markets/categories`);
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
      `${CLOB_API}/orderbooks/${assetId}`
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
    const response = await fetchWithTimeout(`${CLOB_API}/prices/${assetId}`);
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
      `${DATA_API}/portfolios/${address}`
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
      `${DATA_API}/portfolios/${address}/positions`
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
      `${DATA_API}/portfolios/${address}/activity?limit=${limit}&offset=${offset}`
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
      `${DATA_API}/activity?limit=${limit}&offset=${offset}`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : (data?.data || data?.trades || []);
  } catch (error) {
    console.error("Failed to fetch recent trades:", error);
    return [];
  }
}
