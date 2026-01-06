import { safeGet, safePost, safeDelete } from "../utils/apiRequest";

const CLOB_API_BASE_URL = "https://clob.polymarket.com";

/**
 * Types for CLOB API responses
 */
export interface OrderBook {
  id: string;
  asset_id: string;
  yes: PriceLevel[];
  no: PriceLevel[];
}

export interface PriceLevel {
  price: string;
  size: string;
}

export interface OrderBookSnapshot {
  id: string;
  asset_id: string;
  bids: PriceLevel[];
  asks: PriceLevel[];
  mid: string;
  spread: string;
  timestamp: string;
}

export interface Order {
  id: string;
  user: string;
  asset_id: string;
  side: "BUY" | "SELL";
  quantity: string;
  price: string;
  status: "OPEN" | "FILLED" | "CANCELLED" | "PARTIAL_FILL";
  created_at: string;
  updated_at?: string;
}

export interface CreateOrderRequest {
  asset_id: string;
  side: "BUY" | "SELL";
  quantity: string;
  price: string;
  client_order_id?: string;
}

export interface CancelOrderRequest {
  order_id: string;
}

export interface Quote {
  asset_id: string;
  side: "BUY" | "SELL";
  size: string;
  price: string;
  mid: string;
}

export interface PriceQuote {
  id: string;
  yes_price: string;
  no_price: string;
  timestamp: string;
  bid: string;
  ask: string;
  mid: string;
}

export interface Fill {
  id: string;
  order_id: string;
  asset_id: string;
  quantity: string;
  price: string;
  side: "BUY" | "SELL";
  timestamp: string;
}

/**
 * ClobClient handles all trading operations
 * ONLY for: order management, order placement/cancel, orderbooks, prices (CLOB pricing), quotes, fills (if CLOB)
 */
export class ClobClient {
  private baseURL = CLOB_API_BASE_URL;
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  /**
   * Get order book for a market (asset)
   */
  async getOrderBook(assetId: string): Promise<OrderBookSnapshot> {
    if (!assetId) throw new Error("assetId is required");

    const url = `${this.baseURL}/orderbooks/${assetId}`;
    const response = await safeGet<OrderBookSnapshot>(url);

    return response;
  }

  /**
   * Get current price quote for an asset
   */
  async getPriceQuote(assetId: string): Promise<PriceQuote> {
    if (!assetId) throw new Error("assetId is required");

    const url = `${this.baseURL}/prices/${assetId}`;
    const response = await safeGet<PriceQuote>(url);

    return response;
  }

  /**
   * Get quote for buying/selling a specific quantity
   */
  async getQuote(
    assetId: string,
    side: "BUY" | "SELL",
    quantity: string
  ): Promise<Quote> {
    if (!assetId) throw new Error("assetId is required");
    if (!side) throw new Error("side is required (BUY or SELL)");
    if (!quantity) throw new Error("quantity is required");

    const url = `${this.baseURL}/quotes?asset_id=${assetId}&side=${side}&quantity=${quantity}`;
    const response = await safeGet<Quote>(url);

    return response;
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<Order> {
    if (!orderId) throw new Error("orderId is required");

    const url = `${this.baseURL}/orders/${orderId}`;
    const response = await safeGet<Order>(url);

    return response;
  }

  /**
   * Get user's open orders
   */
  async getOpenOrders(userAddress: string): Promise<Order[]> {
    if (!userAddress) throw new Error("userAddress is required");

    const url = `${this.baseURL}/orders?user=${userAddress}&status=OPEN`;
    const response = await safeGet<{ orders: Order[] }>(url);

    return response.orders || [];
  }

  /**
   * Create a new order
   */
  async createOrder(order: CreateOrderRequest): Promise<Order> {
    if (!order.asset_id) throw new Error("asset_id is required");
    if (!order.side) throw new Error("side is required (BUY or SELL)");
    if (!order.quantity) throw new Error("quantity is required");
    if (!order.price) throw new Error("price is required");

    const url = `${this.baseURL}/orders`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await safePost<Order>(url, order, { headers, retries: 0 });

    return response;
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<{ success: boolean }> {
    if (!orderId) throw new Error("orderId is required");

    const url = `${this.baseURL}/orders/${orderId}`;
    const headers: Record<string, string> = {};

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await safeDelete<{ success: boolean }>(url, { headers });

    return response;
  }

  /**
   * Get fills for a user
   */
  async getFills(userAddress: string, params?: { limit?: number; offset?: number }): Promise<Fill[]> {
    if (!userAddress) throw new Error("userAddress is required");

    const searchParams = new URLSearchParams({ user: userAddress });

    if (params?.limit) searchParams.append("limit", String(params.limit));
    if (params?.offset) searchParams.append("offset", String(params.offset));

    const url = `${this.baseURL}/fills?${searchParams.toString()}`;
    const response = await safeGet<{ fills: Fill[] }>(url);

    return response.fills || [];
  }

  /**
   * Get last trade price for an asset
   */
  async getLastTradePrice(assetId: string): Promise<string> {
    if (!assetId) throw new Error("assetId is required");

    const quote = await this.getPriceQuote(assetId);
    return quote.mid;
  }
}

export const clobClient = new ClobClient();
