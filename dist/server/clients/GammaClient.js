import { safeGet } from "../utils/apiRequest";
const GAMMA_API_BASE_URL = "https://gamma-api.polymarket.com";
/**
 * GammaClient handles all market discovery and metadata
 * ONLY for: market discovery, browsing, market metadata, events, categories, questions, outcomes, market lists, market details
 */
export class GammaClient {
    constructor() {
        this.baseURL = GAMMA_API_BASE_URL;
    }
    /**
     * List all markets with optional filters
     */
    async listMarkets(params) {
        const searchParams = new URLSearchParams();
        if (params?.limit !== undefined)
            searchParams.append("limit", String(params.limit));
        if (params?.offset !== undefined)
            searchParams.append("offset", String(params.offset));
        if (params?.order)
            searchParams.append("order", params.order);
        if (params?.active !== undefined)
            searchParams.append("active", String(params.active));
        if (params?.closed !== undefined)
            searchParams.append("closed", String(params.closed));
        if (params?.archived !== undefined)
            searchParams.append("archived", String(params.archived));
        if (params?.tag)
            searchParams.append("tag", params.tag);
        if (params?.slug_in?.length) {
            params.slug_in.forEach((slug) => searchParams.append("slug_in", slug));
        }
        const url = `${this.baseURL}/markets?${searchParams.toString()}`;
        const response = await safeGet(url);
        return response.data || [];
    }
    /**
     * Get a single market by ID
     */
    async getMarketById(marketId) {
        if (!marketId)
            throw new Error("marketId is required");
        const url = `${this.baseURL}/markets/${marketId}`;
        const response = await safeGet(url);
        return response.data;
    }
    /**
     * Get a market by slug
     */
    async getMarketBySlug(slug) {
        if (!slug)
            throw new Error("slug is required");
        const url = `${this.baseURL}/markets/${slug}`;
        const response = await safeGet(url);
        return response.data;
    }
    /**
     * Search markets by query
     */
    async searchMarkets(query, params) {
        if (!query)
            throw new Error("query is required");
        const searchParams = new URLSearchParams({ q: query });
        if (params?.limit)
            searchParams.append("limit", String(params.limit));
        if (params?.offset)
            searchParams.append("offset", String(params.offset));
        if (params?.active !== undefined)
            searchParams.append("active", String(params.active));
        const url = `${this.baseURL}/markets/search?${searchParams.toString()}`;
        const response = await safeGet(url);
        return response.data || [];
    }
    /**
     * Get all market categories
     */
    async listCategories() {
        const url = `${this.baseURL}/markets/categories`;
        const response = await safeGet(url);
        return response.data || [];
    }
    /**
     * Get all market events
     */
    async listEvents(params) {
        const searchParams = new URLSearchParams();
        if (params?.limit)
            searchParams.append("limit", String(params.limit));
        if (params?.offset)
            searchParams.append("offset", String(params.offset));
        const url = `${this.baseURL}/events?${searchParams.toString()}`;
        const response = await safeGet(url);
        return response.data || [];
    }
    /**
     * Get market 24h stats
     */
    async get24HourStats(marketId) {
        if (!marketId)
            throw new Error("marketId is required");
        const url = `${this.baseURL}/markets/${marketId}/stats`;
        const response = await safeGet(url);
        return response.data;
    }
    /**
     * Get trending markets
     */
    async getTrendingMarkets(timeframe = "24h") {
        const url = `${this.baseURL}/markets/trending?timeframe=${timeframe}`;
        const response = await safeGet(url);
        return response.data || [];
    }
    /**
     * Get top performers (by volume)
     */
    async getTopMarkets(limit = 10) {
        const url = `${this.baseURL}/markets?order=-volume&limit=${limit}&active=true`;
        const response = await safeGet(url);
        return response.data || [];
    }
}
export const gammaClient = new GammaClient();
