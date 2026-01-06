import { safeGet } from "../utils/apiRequest";

const GAMMA_API_BASE_URL = "https://gamma-api.polymarket.com";

/**
 * Types for Gamma API responses
 */
export interface Market {
  id: string;
  slug: string;
  title: string;
  description: string;
  image?: string;
  icon?: string;
  marketSlug: string;
  createdAt: string;
  updatedAt: string;
  closedTime?: string;
  active: boolean;
  archived: boolean;
  restricted: boolean;
  closed: boolean;
  volume?: string;
  volumeNum?: number;
  liquidityNum?: number;
  liquidityUSD?: number;
  probability?: string | number;
  lastPriceUsd?: string | number;
  lastTradeTime?: string;
  questionID?: string;
  conditionID?: string;
}

export interface MarketCategory {
  id: string;
  slug: string;
  label: string;
  color?: string;
}

export interface MarketEvent {
  id: string;
  title: string;
  slug: string;
  image?: string;
  createdAt: string;
}

export interface SearchMarketsParams {
  limit?: number;
  offset?: number;
  order?: "volume" | "liquidity" | "createdAt" | "-createdAt";
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  tag?: string;
  slug_in?: string[];
}

export interface Market24HourStats {
  id: string;
  volumeUSD: number;
  tradingVolume: number;
  liquidityUSD: number;
  change24hUSD: number;
  change24hPercent: number;
}

/**
 * GammaClient handles all market discovery and metadata
 * ONLY for: market discovery, browsing, market metadata, events, categories, questions, outcomes, market lists, market details
 */
export class GammaClient {
  private baseURL = GAMMA_API_BASE_URL;

  /**
   * List all markets with optional filters
   */
  async listMarkets(params?: SearchMarketsParams): Promise<Market[]> {
    const searchParams = new URLSearchParams();

    if (params?.limit !== undefined) searchParams.append("limit", String(params.limit));
    if (params?.offset !== undefined) searchParams.append("offset", String(params.offset));
    if (params?.order) searchParams.append("order", params.order);
    if (params?.active !== undefined) searchParams.append("active", String(params.active));
    if (params?.closed !== undefined) searchParams.append("closed", String(params.closed));
    if (params?.archived !== undefined) searchParams.append("archived", String(params.archived));
    if (params?.tag) searchParams.append("tag", params.tag);
    if (params?.slug_in?.length) {
      params.slug_in.forEach((slug) => searchParams.append("slug_in", slug));
    }

    const url = `${this.baseURL}/markets?${searchParams.toString()}`;
    const response = await safeGet<{ data: Market[] }>(url);

    return response.data || [];
  }

  /**
   * Get a single market by ID
   */
  async getMarketById(marketId: string): Promise<Market> {
    if (!marketId) throw new Error("marketId is required");

    const url = `${this.baseURL}/markets/${marketId}`;
    const response = await safeGet<{ data: Market }>(url);

    return response.data;
  }

  /**
   * Get a market by slug
   */
  async getMarketBySlug(slug: string): Promise<Market> {
    if (!slug) throw new Error("slug is required");

    const url = `${this.baseURL}/markets/${slug}`;
    const response = await safeGet<{ data: Market }>(url);

    return response.data;
  }

  /**
   * Search markets by query
   */
  async searchMarkets(
    query: string,
    params?: Omit<SearchMarketsParams, "slug_in">
  ): Promise<Market[]> {
    if (!query) throw new Error("query is required");

    const searchParams = new URLSearchParams({ q: query });

    if (params?.limit) searchParams.append("limit", String(params.limit));
    if (params?.offset) searchParams.append("offset", String(params.offset));
    if (params?.active !== undefined) searchParams.append("active", String(params.active));

    const url = `${this.baseURL}/markets/search?${searchParams.toString()}`;
    const response = await safeGet<{ data: Market[] }>(url);

    return response.data || [];
  }

  /**
   * Get all market categories
   */
  async listCategories(): Promise<MarketCategory[]> {
    const url = `${this.baseURL}/markets/categories`;
    const response = await safeGet<{ data: MarketCategory[] }>(url);

    return response.data || [];
  }

  /**
   * Get all market events
   */
  async listEvents(params?: { limit?: number; offset?: number }): Promise<MarketEvent[]> {
    const searchParams = new URLSearchParams();

    if (params?.limit) searchParams.append("limit", String(params.limit));
    if (params?.offset) searchParams.append("offset", String(params.offset));

    const url = `${this.baseURL}/events?${searchParams.toString()}`;
    const response = await safeGet<{ data: MarketEvent[] }>(url);

    return response.data || [];
  }

  /**
   * Get market 24h stats
   */
  async get24HourStats(marketId: string): Promise<Market24HourStats> {
    if (!marketId) throw new Error("marketId is required");

    const url = `${this.baseURL}/markets/${marketId}/stats`;
    const response = await safeGet<{ data: Market24HourStats }>(url);

    return response.data;
  }

  /**
   * Get trending markets
   */
  async getTrendingMarkets(timeframe: "1h" | "24h" | "7d" = "24h"): Promise<Market[]> {
    const url = `${this.baseURL}/markets/trending?timeframe=${timeframe}`;
    const response = await safeGet<{ data: Market[] }>(url);

    return response.data || [];
  }

  /**
   * Get top performers (by volume)
   */
  async getTopMarkets(limit: number = 10): Promise<Market[]> {
    const url = `${this.baseURL}/markets?order=-volume&limit=${limit}&active=true`;
    const response = await safeGet<{ data: Market[] }>(url);

    return response.data || [];
  }
}

export const gammaClient = new GammaClient();
