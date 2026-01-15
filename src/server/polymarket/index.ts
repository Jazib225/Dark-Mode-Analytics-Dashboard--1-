/**
 * Polymarket Data Layer - Unified Exports
 * 
 * This module provides the SINGLE SOURCE OF TRUTH for all Polymarket data.
 * 
 * API Routing Rules (enforced by architecture):
 * 
 * 1) GAMMA API — Market discovery + metadata ONLY
 *    - getTrendingMarkets()
 *    - getNewMarkets()
 *    - getNearlyResolvedMarkets()
 *    - getMarketById()
 *    - searchMarkets()
 * 
 * 2) CLOB API — Prices & orderbooks ONLY
 *    - getOrderBook()
 *    - getPrice()
 *    - getBatchPrices()
 * 
 * 3) DATA API — User positions/activity ONLY
 *    - getUserPortfolio()
 *    - getUserPositions()
 *    - getUserActivity()
 */

// =============================================================================
// DTOs - Typed data contracts for frontend
// =============================================================================
export type {
    MarketCardDTO,
    MarketDetailDTO,
    OrderBookDTO,
    OrderBookLevel,
    PositionDTO,
    PortfolioDTO,
    ApiResponse,
    MarketListResponse,
    MarketDetailResponse,
    OrderBookResponse,
    PortfolioResponse,
} from './dtos';

export {
    transformToMarketCard,
    transformToMarketDetail,
    transformToOrderBook,
} from './dtos';

// =============================================================================
// Gamma Client - Market Discovery & Metadata
// =============================================================================
export {
    getTrendingMarkets,
    getNewMarkets,
    getNearlyResolvedMarkets,
    getMarketById,
    searchMarkets,
    getAllMarkets,
} from './gammaClient';

// =============================================================================
// CLOB Client - Prices & Orderbooks
// =============================================================================
export {
    getOrderBook,
    getPrice,
    getBatchPrices,
    getLiveOrderBook,
} from './clobClient';

// =============================================================================
// Data Client - User Positions & Activity
// =============================================================================
export {
    getUserPortfolio,
    getUserPositions,
    getUserActivity,
} from './dataClient';

// =============================================================================
// Cache Utilities
// =============================================================================
export {
    marketListCache,
    marketDetailCache,
    orderBookCache,
    userPositionsCache,
    getTimingStats,
    logTiming,
} from './cache';
