/**
 * MarketLink Component - Optimistic Link with Prefetching
 * 
 * This component wraps market navigation with prefetching on hover.
 * When the user hovers over a market card, we begin fetching the data
 * in the background so it's ready when they click.
 * 
 * Architecture:
 * - Uses TanStack Query prefetching
 * - Triggers on onMouseEnter (not viewport, to save bandwidth)
 * - Creates instant navigation experience (< 100ms perceived latency)
 */

import React, { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getPrefetchMarket } from '../hooks/useMarketData';
import { prefetchMarketDetail } from '../services/polymarketApi';

interface MarketLinkProps {
    marketId: string;
    onClick: () => void;
    children: React.ReactNode;
    className?: string;
    // Optional: delay before prefetching (prevents unnecessary fetches on quick mouse movements)
    prefetchDelay?: number;
}

export function MarketLink({
    marketId,
    onClick,
    children,
    className = '',
    prefetchDelay = 100,
}: MarketLinkProps) {
    const queryClient = useQueryClient();
    const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasPrefetchedRef = useRef(false);

    const handleMouseEnter = useCallback(() => {
        // Skip if already prefetched
        if (hasPrefetchedRef.current) return;

        // Clear any existing timer
        if (prefetchTimerRef.current) {
            clearTimeout(prefetchTimerRef.current);
        }

        // Delay prefetch slightly to avoid unnecessary fetches
        prefetchTimerRef.current = setTimeout(async () => {
            try {
                // Mark as prefetched to avoid duplicate fetches
                hasPrefetchedRef.current = true;

                // Use the existing API prefetch (which also caches in memory)
                await prefetchMarketDetail(marketId);

                // Also prefetch in TanStack Query
                const prefetch = getPrefetchMarket(queryClient);
                await prefetch(marketId);

                console.log(`Prefetched market ${marketId} on hover`);
            } catch (error) {
                // Silent fail - prefetch is best effort
                console.log(`Prefetch failed for ${marketId}:`, error);
            }
        }, prefetchDelay);
    }, [marketId, queryClient, prefetchDelay]);

    const handleMouseLeave = useCallback(() => {
        // Cancel prefetch if mouse leaves before delay completes
        if (prefetchTimerRef.current) {
            clearTimeout(prefetchTimerRef.current);
            prefetchTimerRef.current = null;
        }
    }, []);

    const handleClick = useCallback(() => {
        // Clear any pending prefetch timer
        if (prefetchTimerRef.current) {
            clearTimeout(prefetchTimerRef.current);
        }
        onClick();
    }, [onClick]);

    return (
        <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            className={className}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    handleClick();
                }
            }}
        >
            {children}
        </div>
    );
}

/**
 * Hook for prefetching markets in batch
 * Useful for prefetching visible markets in a grid
 */
export function usePrefetchMarkets() {
    const queryClient = useQueryClient();
    const prefetchedIdsRef = useRef(new Set<string>());

    const prefetchMarkets = useCallback(async (marketIds: string[]) => {
        const prefetch = getPrefetchMarket(queryClient);

        // Filter out already prefetched IDs
        const newIds = marketIds.filter(id => !prefetchedIdsRef.current.has(id));

        if (newIds.length === 0) return;

        // Prefetch in parallel (max 3 at a time to avoid overwhelming)
        const batchSize = 3;
        for (let i = 0; i < newIds.length; i += batchSize) {
            const batch = newIds.slice(i, i + batchSize);
            await Promise.allSettled(
                batch.map(async (id) => {
                    prefetchedIdsRef.current.add(id);
                    await prefetch(id);
                })
            );
        }
    }, [queryClient]);

    return { prefetchMarkets };
}

export default MarketLink;
