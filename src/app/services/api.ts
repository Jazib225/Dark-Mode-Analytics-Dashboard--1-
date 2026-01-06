/**
 * Frontend API client for calling backend endpoints
 */

// Determine API URL - use environment variable or derive from current location
const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;
  
  // If we're in production (not localhost), construct the API URL from the current hostname
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    // For Vercel deployments, the backend should be at the same domain
    return `${window.location.protocol}//${window.location.hostname}/api`;
  }
  
  // Development fallback
  return "http://localhost:3001/api";
};

const API_URL = getApiUrl();

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...((options?.headers as Record<string, string>) || {}),
      },
      ...options,
    });

    if (!response.ok) {
      console.error(`API Error (${response.status}):`, response.statusText, `URL: ${url}`);
      throw new Error(`API Error: ${response.statusText}`);
    }

    const result: ApiResponse<T> = await response.json();

    if (!result.success) {
      throw new Error(result.error || "API request failed");
    }

    if (!result.data) {
      throw new Error("No data returned from API");
    }

    return result.data;
  } catch (error) {
    console.error(`Failed to fetch from ${url}:`, error);
    throw error;
  }
}

/**
 * Markets API
 */
export const marketsApi = {
  listMarkets: (params?: {
    limit?: number;
    offset?: number;
    order?: string;
    active?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append("limit", String(params.limit));
    if (params?.offset) searchParams.append("offset", String(params.offset));
    if (params?.order) searchParams.append("order", params.order);
    if (params?.active !== undefined) searchParams.append("active", String(params.active));

    return apiCall(
      `/markets?${searchParams.toString()}`
    );
  },

  getMarket: (id: string) => apiCall(`/markets/${id}`),

  searchMarkets: (query: string, limit = 50) =>
    apiCall(
      `/markets/search?q=${encodeURIComponent(query)}&limit=${limit}`
    ),

  getTrendingMarkets: (timeframe: "1h" | "24h" | "7d" = "24h") =>
    apiCall(`/markets/trending?timeframe=${timeframe}`),

  getTopMarkets: (limit = 10) => apiCall(`/markets/top?limit=${limit}`),

  getMarketStats: (id: string) => apiCall(`/markets/${id}/stats`),

  getCategories: () => apiCall(`/markets/categories`),

  getEvents: (limit = 50) => apiCall(`/markets/events?limit=${limit}`),
};

/**
 * Trading API
 */
export const tradingApi = {
  getOrderBook: (assetId: string) =>
    apiCall(`/trading/orderbook/${assetId}`),

  getPrice: (assetId: string) => apiCall(`/trading/prices/${assetId}`),

  getQuote: (assetId: string, side: "BUY" | "SELL", quantity: string) =>
    apiCall(
      `/trading/quotes?assetId=${assetId}&side=${side}&quantity=${quantity}`
    ),

  getOpenOrders: (userAddress: string) =>
    apiCall(`/trading/orders?user=${userAddress}`),

  getOrder: (orderId: string) => apiCall(`/trading/orders/${orderId}`),

  createOrder: (order: {
    asset_id: string;
    side: "BUY" | "SELL";
    quantity: string;
    price: string;
    client_order_id?: string;
  }) =>
    apiCall(`/trading/orders`, {
      method: "POST",
      body: JSON.stringify(order),
    }),

  cancelOrder: (orderId: string) =>
    apiCall(`/trading/orders/${orderId}`, {
      method: "DELETE",
    }),

  getFills: (userAddress: string, limit = 50) =>
    apiCall(`/trading/fills?user=${userAddress}&limit=${limit}`),
};

/**
 * Portfolio API
 */
export const portfolioApi = {
  getPortfolio: (address: string) =>
    apiCall(`/portfolio/${address}`),

  getPositions: (address: string) =>
    apiCall(`/portfolio/${address}/positions`),

  getPosition: (address: string, positionId: string) =>
    apiCall(`/portfolio/${address}/positions/${positionId}`),

  getActivity: (
    address: string,
    params?: { limit?: number; offset?: number; type?: string }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append("limit", String(params.limit));
    if (params?.offset) searchParams.append("offset", String(params.offset));
    if (params?.type) searchParams.append("type", params.type);

    return apiCall(`/portfolio/${address}/activity?${searchParams.toString()}`);
  },

  getPnLHistory: (address: string, params?: { start_date?: string; end_date?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.start_date) searchParams.append("start_date", params.start_date);
    if (params?.end_date) searchParams.append("end_date", params.end_date);

    return apiCall(`/portfolio/${address}/pnl?${searchParams.toString()}`);
  },

  getUserHistory: (address: string) =>
    apiCall(`/portfolio/${address}/history`),
};
