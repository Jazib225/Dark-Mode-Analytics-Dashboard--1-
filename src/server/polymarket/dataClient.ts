/**
 * Data API Client - User Positions & Activity ONLY
 * 
 * This client handles:
 * - User portfolio/positions
 * - User activity/history
 * - Realized/unrealized PnL
 * - User-level stats
 * 
 * DO NOT use this client for:
 * - Market metadata (use gammaClient)
 * - Orderbooks/prices (use clobClient)
 */

import {
    PortfolioDTO,
    PositionDTO,
} from './dtos';
import {
    userPositionsCache,
    userPositionsKey,
    getWithRevalidation,
    dedupedFetch,
    fetchWithTimeout,
    fetchWithRetry,
} from './cache';

const DATA_API_BASE = 'https://data-api.polymarket.com';
const DEFAULT_TIMEOUT = 8000;
const MAX_RETRIES = 2;

// =============================================================================
// Portfolio Endpoints
// =============================================================================

/**
 * Get user portfolio overview
 */
export async function getUserPortfolio(
    userAddress: string
): Promise<{ portfolio: PortfolioDTO | null; fromCache: boolean; duration: number }> {
    if (!userAddress) {
        return { portfolio: null, fromCache: false, duration: 0 };
    }

    const cacheKey = userPositionsKey(userAddress);

    const result = await getWithRevalidation(
        cacheKey,
        userPositionsCache,
        () => dedupedFetch(cacheKey, async () => {
            const url = `${DATA_API_BASE}/portfolios/${userAddress}`;

            try {
                const data = await fetchWithRetry(
                    async () => {
                        const response = await fetchWithTimeout(url, { timeout: DEFAULT_TIMEOUT });
                        if (!response.ok) {
                            throw new Error(`Data API error: ${response.status}`);
                        }
                        return response.json();
                    },
                    { maxRetries: MAX_RETRIES }
                );

                return transformPortfolio(data, userAddress);
            } catch (error) {
                console.error(`Failed to get portfolio for ${userAddress}:`, error);
                // Return empty portfolio on error
                return {
                    address: userAddress,
                    totalBalance: 0,
                    availableBalance: 0,
                    positionsValue: 0,
                    totalPnl: 0,
                    totalPnlPercent: 0,
                    positions: [],
                    updatedAt: new Date().toISOString(),
                };
            }
        })
    );

    return {
        portfolio: result.data,
        fromCache: result.fromCache,
        duration: result.duration,
    };
}

/**
 * Get user positions only
 */
export async function getUserPositions(
    userAddress: string
): Promise<{ positions: PositionDTO[]; fromCache: boolean; duration: number }> {
    const portfolioResult = await getUserPortfolio(userAddress);

    return {
        positions: portfolioResult.portfolio?.positions || [],
        fromCache: portfolioResult.fromCache,
        duration: portfolioResult.duration,
    };
}

/**
 * Get user activity/trade history
 */
export async function getUserActivity(
    userAddress: string,
    limit: number = 50,
    offset: number = 0
): Promise<{ activity: any[]; fromCache: boolean; duration: number }> {
    if (!userAddress) {
        return { activity: [], fromCache: false, duration: 0 };
    }

    const cacheKey = `user:activity:${userAddress}:${limit}:${offset}`;

    return getWithRevalidation(
        cacheKey,
        userPositionsCache,
        () => dedupedFetch(cacheKey, async () => {
            const url = `${DATA_API_BASE}/portfolios/${userAddress}/activity?limit=${limit}&offset=${offset}`;

            try {
                const data = await fetchWithRetry(
                    async () => {
                        const response = await fetchWithTimeout(url, { timeout: DEFAULT_TIMEOUT });
                        if (!response.ok) {
                            throw new Error(`Data API error: ${response.status}`);
                        }
                        return response.json();
                    },
                    { maxRetries: MAX_RETRIES }
                );

                return data.activity || [];
            } catch (error) {
                console.error(`Failed to get activity for ${userAddress}:`, error);
                return [];
            }
        })
    );
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Transform raw portfolio data to DTO
 */
function transformPortfolio(raw: any, address: string): PortfolioDTO {
    const positions: PositionDTO[] = (raw.positions || []).map((p: any) => ({
        marketId: p.market_id || p.marketId || '',
        marketTitle: p.market_title || p.marketTitle || 'Unknown Market',
        outcome: p.outcome || 'Yes',
        side: p.side || 'YES',
        size: parseFloat(String(p.quantity || p.size || 0)) || 0,
        avgEntryPrice: parseFloat(String(p.entry_price || p.avgEntryPrice || 0)) || 0,
        currentPrice: parseFloat(String(p.current_price || p.currentPrice || 0)) || 0,
        unrealizedPnl: parseFloat(String(p.unrealized_pnl || p.unrealizedPnl || 0)) || 0,
        unrealizedPnlPercent: parseFloat(String(p.unrealized_pnl_percent || p.unrealizedPnlPercent || 0)) || 0,
    }));

    return {
        address,
        totalBalance: parseFloat(String(raw.total_balance || raw.totalBalance || 0)) || 0,
        availableBalance: parseFloat(String(raw.available_balance || raw.availableBalance || 0)) || 0,
        positionsValue: parseFloat(String(raw.positions_value || raw.positionsValue || 0)) || 0,
        totalPnl: parseFloat(String(raw.total_pnl || raw.totalPnl || 0)) || 0,
        totalPnlPercent: parseFloat(String(raw.total_pnl_percent || raw.totalPnlPercent || 0)) || 0,
        positions,
        updatedAt: raw.updated_at || raw.updatedAt || new Date().toISOString(),
    };
}
