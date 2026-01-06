/**
 * Direct Polymarket API client - calls APIs directly from frontend
 * No backend needed!
 */

const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";
const DATA_API = "https://data-api.polymarket.com";

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
export async function getTrendingMarkets(timeframe: "1h" | "24h" | "7d" = "24h") {
  try {
    const response = await fetchWithTimeout(
      `${GAMMA_API}/markets/trending?timeframe=${timeframe}`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch trending markets:", error);
    throw error;
  }
}

export async function getActiveMarkets(limit = 100) {
  try {
    const response = await fetchWithTimeout(
      `${GAMMA_API}/markets?limit=${limit}&active=true&closed=false`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const markets = await response.json();
    
    // Sort by volume (highest first)
    return markets.sort(
      (a: any, b: any) =>
        (parseFloat(b.volumeUsd) || 0) - (parseFloat(a.volumeUsd) || 0)
    );
  } catch (error) {
    console.error("Failed to fetch active markets:", error);
    throw error;
  }
}

export async function getMarketById(id: string) {
  try {
    const response = await fetchWithTimeout(`${GAMMA_API}/markets/${id}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch market:", error);
    throw error;
  }
}

export async function searchMarkets(query: string, limit = 50) {
  try {
    const response = await fetchWithTimeout(
      `${GAMMA_API}/markets/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to search markets:", error);
    throw error;
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
    throw error;
  }
}

export async function getCategories() {
  try {
    const response = await fetchWithTimeout(`${GAMMA_API}/markets/categories`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    throw error;
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
    throw error;
  }
}

export async function getPriceQuote(assetId: string) {
  try {
    const response = await fetchWithTimeout(`${CLOB_API}/prices/${assetId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch price quote:", error);
    throw error;
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
    throw error;
  }
}

export async function getPositions(address: string) {
  try {
    const response = await fetchWithTimeout(
      `${DATA_API}/portfolios/${address}/positions`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch positions:", error);
    throw error;
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
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch activity:", error);
    throw error;
  }
}

export async function getRecentTrades(limit = 50, offset = 0) {
  try {
    const response = await fetchWithTimeout(
      `${DATA_API}/activity?limit=${limit}&offset=${offset}`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch recent trades:", error);
    throw error;
  }
}
