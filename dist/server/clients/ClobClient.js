import { safeGet, safePost, safeDelete } from "../utils/apiRequest";
const CLOB_API_BASE_URL = "https://clob.polymarket.com";
/**
 * ClobClient handles all trading operations
 * ONLY for: order management, order placement/cancel, orderbooks, prices (CLOB pricing), quotes, fills (if CLOB)
 */
export class ClobClient {
    constructor(apiKey) {
        this.baseURL = CLOB_API_BASE_URL;
        this.apiKey = apiKey;
    }
    /**
     * Get order book for a market (asset)
     */
    async getOrderBook(assetId) {
        if (!assetId)
            throw new Error("assetId is required");
        const url = `${this.baseURL}/orderbooks/${assetId}`;
        const response = await safeGet(url);
        return response;
    }
    /**
     * Get current price quote for an asset
     */
    async getPriceQuote(assetId) {
        if (!assetId)
            throw new Error("assetId is required");
        const url = `${this.baseURL}/prices/${assetId}`;
        const response = await safeGet(url);
        return response;
    }
    /**
     * Get quote for buying/selling a specific quantity
     */
    async getQuote(assetId, side, quantity) {
        if (!assetId)
            throw new Error("assetId is required");
        if (!side)
            throw new Error("side is required (BUY or SELL)");
        if (!quantity)
            throw new Error("quantity is required");
        const url = `${this.baseURL}/quotes?asset_id=${assetId}&side=${side}&quantity=${quantity}`;
        const response = await safeGet(url);
        return response;
    }
    /**
     * Get order by ID
     */
    async getOrder(orderId) {
        if (!orderId)
            throw new Error("orderId is required");
        const url = `${this.baseURL}/orders/${orderId}`;
        const response = await safeGet(url);
        return response;
    }
    /**
     * Get user's open orders
     */
    async getOpenOrders(userAddress) {
        if (!userAddress)
            throw new Error("userAddress is required");
        const url = `${this.baseURL}/orders?user=${userAddress}&status=OPEN`;
        const response = await safeGet(url);
        return response.orders || [];
    }
    /**
     * Create a new order
     */
    async createOrder(order) {
        if (!order.asset_id)
            throw new Error("asset_id is required");
        if (!order.side)
            throw new Error("side is required (BUY or SELL)");
        if (!order.quantity)
            throw new Error("quantity is required");
        if (!order.price)
            throw new Error("price is required");
        const url = `${this.baseURL}/orders`;
        const headers = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers["Authorization"] = `Bearer ${this.apiKey}`;
        }
        const response = await safePost(url, order, { headers, retries: 0 });
        return response;
    }
    /**
     * Cancel an order
     */
    async cancelOrder(orderId) {
        if (!orderId)
            throw new Error("orderId is required");
        const url = `${this.baseURL}/orders/${orderId}`;
        const headers = {};
        if (this.apiKey) {
            headers["Authorization"] = `Bearer ${this.apiKey}`;
        }
        const response = await safeDelete(url, { headers });
        return response;
    }
    /**
     * Get fills for a user
     */
    async getFills(userAddress, params) {
        if (!userAddress)
            throw new Error("userAddress is required");
        const searchParams = new URLSearchParams({ user: userAddress });
        if (params?.limit)
            searchParams.append("limit", String(params.limit));
        if (params?.offset)
            searchParams.append("offset", String(params.offset));
        const url = `${this.baseURL}/fills?${searchParams.toString()}`;
        const response = await safeGet(url);
        return response.fills || [];
    }
    /**
     * Get last trade price for an asset
     */
    async getLastTradePrice(assetId) {
        if (!assetId)
            throw new Error("assetId is required");
        const quote = await this.getPriceQuote(assetId);
        return quote.mid;
    }
}
export const clobClient = new ClobClient();
