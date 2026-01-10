/**
 * TanStack Query hooks for market data
 * Implements Stale-While-Revalidate pattern for instant loading
 * 
 * Architecture based on Polymarket's streaming database approach:
 * - staleTime: Data considered fresh for this duration (no refetch)
 * - gcTime: Data kept in memory for instant access on navigation back
 * - Prefetch on hover for optimistic loading
 */

import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import {
    getMarketDetails,
    getMarketPriceHistory,
    getMarketTrades,
    getOrderBook,
    getCachedMarketDetail,
    getCachedPriceHistory,
    getCachedTrades,
    getCachedOrderBook,
    getMarketFromCache,
    getAllMarketDataParallel,
    type AllMarketData,
} from '../services/polymarketApi';

// Query key factory for consistent key management
export const marketKeys = {
    all: ['markets'] as const,
    lists: () => [...marketKeys.all, 'list'] as const,
    list: (filters: string) => [...marketKeys.lists(), { filters }] as const,
    details: () => [...marketKeys.all, 'detail'] as const,
    detail: (id: string) => [...marketKeys.details(), id] as const,
    allData: (id: string) => [...marketKeys.detail(id), 'all'] as const,
    priceHistory: (id: string, interval: string) => [...marketKeys.detail(id), 'priceHistory', interval] as const,
    trades: (id: string) => [...marketKeys.detail(id), 'trades'] as const,
    orderBook: (tokenId: string) => ['orderBook', tokenId] as const,
};

/**
 * Hook for fetching all market data in parallel
 * This is the main hook for the market detail page
 * 
 * Configuration:
 * - staleTime: 60 seconds - data is fresh, no background refetch
 * - gcTime: 5 minutes - keep in memory for instant back-navigation
 */
export function useAllMarketData(marketId: string | null) {
    return useQuery({
        queryKey: marketKeys.allData(marketId || ''),
        queryFn: async () => {
            if (!marketId) throw new Error('No market ID provided');
            return getAllMarketDataParallel(marketId);
        },
        enabled: !!marketId,
        staleTime: 60 * 1000, // 60 seconds - data considered fresh
        gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache
        placeholderData: () => {
            // Use cached data as placeholder for instant loading
            if (!marketId) return undefined;
            const cached = getCachedMarketDetail(marketId);
            if (cached) {
                return {
                    details: cached,
                    priceHistory: getCachedPriceHistory(marketId, '1d') || [],
                    trades: getCachedTrades(marketId, 20) || [],
                    orderBook: { bids: [], asks: [], spread: 0 },
                    tradersCount: 0,
                    topHolders: [],
                    topTraders: [],
                    relatedMarkets: [],
                } as AllMarketData;
            }
            return undefined;
        },
    });
}

/**
 * Hook for market details only (lighter weight)
 */
export function useMarketDetails(marketId: string | null) {
    return useQuery({
        queryKey: marketKeys.detail(marketId || ''),
        queryFn: async () => {
            if (!marketId) throw new Error('No market ID provided');
            return getMarketDetails(marketId);
        },
        enabled: !!marketId,
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        placeholderData: () => {
            if (!marketId) return undefined;
            // Try to get basic info from global cache for instant placeholder
            const basicInfo = getMarketFromCache(marketId);
            if (basicInfo) {
                return {
                    id: basicInfo.id,
                    question: basicInfo.title,
                    title: basicInfo.title,
                    probability: basicInfo.probability,
                    volume: basicInfo.volumeUsd,
                    volume24hr: basicInfo.volume24hr,
                    liquidity: basicInfo.liquidity,
                    image: basicInfo.image,
                    endDate: basicInfo.endDate,
                    outcomes: basicInfo.outcomes,
                    outcomePrices: basicInfo.outcomePrices,
                    conditionId: basicInfo.conditionId,
                    clobTokenIds: basicInfo.clobTokenIds,
                };
            }
            return getCachedMarketDetail(marketId);
        },
    });
}

/**
 * Hook for price history
 */
export function usePriceHistory(marketId: string | null, interval: string = '1d') {
    return useQuery({
        queryKey: marketKeys.priceHistory(marketId || '', interval),
        queryFn: async () => {
            if (!marketId) throw new Error('No market ID provided');
            return getMarketPriceHistory(marketId, interval);
        },
        enabled: !!marketId,
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        placeholderData: () => {
            if (!marketId) return undefined;
            return getCachedPriceHistory(marketId, interval);
        },
    });
}

/**
 * Hook for recent trades
 */
export function useRecentTrades(marketId: string | null, limit: number = 20) {
    return useQuery({
        queryKey: marketKeys.trades(marketId || ''),
        queryFn: async () => {
            if (!marketId) throw new Error('No market ID provided');
            return getMarketTrades(marketId, limit);
        },
        enabled: !!marketId,
        staleTime: 30 * 1000, // Trades update more frequently
        gcTime: 2 * 60 * 1000,
        placeholderData: () => {
            if (!marketId) return undefined;
            return getCachedTrades(marketId, limit);
        },
    });
}

/**
 * Hook for order book
 */
export function useOrderBook(tokenId: string | null) {
    return useQuery({
        queryKey: marketKeys.orderBook(tokenId || ''),
        queryFn: async () => {
            if (!tokenId) throw new Error('No token ID provided');
            return getOrderBook(tokenId);
        },
        enabled: !!tokenId,
        staleTime: 10 * 1000, // Order book updates very frequently
        gcTime: 60 * 1000,
        placeholderData: () => {
            if (!tokenId) return undefined;
            return getCachedOrderBook(tokenId);
        },
    });
}

/**
 * Prefetch market data on hover
 * Call this when user hovers over a market card
 */
export function usePrefetchMarket() {
    const queryClient = useQueryClient();

    return async (marketId: string) => {
        // Check if already in cache
        const existingData = queryClient.getQueryData(marketKeys.allData(marketId));
        if (existingData) {
            return; // Already cached, no need to prefetch
        }

        // Prefetch in background
        await queryClient.prefetchQuery({
            queryKey: marketKeys.allData(marketId),
            queryFn: () => getAllMarketDataParallel(marketId),
            staleTime: 60 * 1000,
        });
    };
}

/**
 * Get prefetch function without hook (for use in callbacks)
 */
export function getPrefetchMarket(queryClient: QueryClient) {
    return async (marketId: string) => {
        const existingData = queryClient.getQueryData(marketKeys.allData(marketId));
        if (existingData) return;

        await queryClient.prefetchQuery({
            queryKey: marketKeys.allData(marketId),
            queryFn: () => getAllMarketDataParallel(marketId),
            staleTime: 60 * 1000,
        });
    };
}

/**
 * Invalidate market data (force refresh)
 */
export function useInvalidateMarketData() {
    const queryClient = useQueryClient();

    return (marketId: string) => {
        queryClient.invalidateQueries({ queryKey: marketKeys.detail(marketId) });
        queryClient.invalidateQueries({ queryKey: marketKeys.allData(marketId) });
    };
}
