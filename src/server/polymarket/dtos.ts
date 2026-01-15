/**
 * Unified Polymarket Data Types (DTOs)
 * 
 * These slim DTOs are the contract between backend and frontend.
 * They ensure:
 * - Minimal payload size for fast transfers
 * - Type safety across the stack
 * - Consistent field naming
 */

// =============================================================================
// Market Card DTO - For list views (Trending, New, Resolving columns)
// =============================================================================
export interface MarketCardDTO {
    id: string;
    slug: string;
    question: string;
    image: string | null;
    outcomes: string[];
    outcomePrices: number[];  // 0-1 range (e.g., [0.65, 0.35])
    probability: number;       // 0-100 for display (e.g., 65)
    volume24hr: number;
    volume7d: number;
    volume1mo: number;
    liquidity: number;
    status: 'active' | 'closed' | 'resolved';
    category: string | null;
    eventTitle: string | null;
    endDate: string | null;     // ISO string
    createdAt: string;          // ISO string
    lastUpdated: number;        // Unix timestamp ms
}

// =============================================================================
// Market Detail DTO - For market detail page (extends card)
// =============================================================================
export interface MarketDetailDTO extends MarketCardDTO {
    description: string;
    conditionId: string;
    clobTokenIds: string[];
    // Orderbook fetched separately for progressive loading
}

// =============================================================================
// Orderbook DTO - Fetched separately for progressive loading
// =============================================================================
export interface OrderBookLevel {
    price: number;  // 0-1 range
    size: number;   // USD value
}

export interface OrderBookDTO {
    marketId: string;
    tokenId: string;
    bids: OrderBookLevel[];  // Highest price first
    asks: OrderBookLevel[];  // Lowest price first
    bestBid: number;
    bestAsk: number;
    mid: number;
    spread: number;
    lastUpdated: number;
}

// =============================================================================
// User Position DTO - For portfolio views
// =============================================================================
export interface PositionDTO {
    marketId: string;
    marketTitle: string;
    outcome: string;
    side: 'YES' | 'NO';
    size: number;
    avgEntryPrice: number;
    currentPrice: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
}

// =============================================================================
// User Portfolio DTO
// =============================================================================
export interface PortfolioDTO {
    address: string;
    totalBalance: number;
    availableBalance: number;
    positionsValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    positions: PositionDTO[];
    updatedAt: string;
}

// =============================================================================
// API Response Wrappers
// =============================================================================
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    meta?: {
        count?: number;
        duration?: number;
        cached?: boolean;
    };
    error?: string;
}

export interface MarketListResponse extends ApiResponse<MarketCardDTO[]> { }
export interface MarketDetailResponse extends ApiResponse<MarketDetailDTO> { }
export interface OrderBookResponse extends ApiResponse<OrderBookDTO> { }
export interface PortfolioResponse extends ApiResponse<PortfolioDTO> { }

// =============================================================================
// Transform Helper Types
// =============================================================================
export interface RawGammaMarket {
    id?: string;
    conditionId?: string;
    slug?: string;
    question?: string;
    title?: string;
    description?: string;
    image?: string;
    outcomes?: string | string[];
    outcomePrices?: string | number[];
    clobTokenIds?: string | string[];
    volume24hr?: string | number;
    volume1wk?: string | number;
    volume7d?: string | number;
    volume1mo?: string | number;
    liquidity?: string | number;
    liquidityNum?: number;
    bestBid?: string | number;
    active?: boolean;
    closed?: boolean;
    endDate?: string;
    createdAt?: string;
    tag?: string;
    category?: string;
    groupItemTitle?: string;
}

export interface RawGammaEvent {
    id: string;
    title: string;
    slug: string;
    image?: string;
    markets?: RawGammaMarket[];
}

// =============================================================================
// Transformation Functions
// =============================================================================

/**
 * Transform raw Gamma API market to MarketCardDTO
 */
export function transformToMarketCard(raw: RawGammaMarket, eventTitle?: string): MarketCardDTO {
    // Parse outcome prices
    let outcomePrices: number[] = [0.5, 0.5];
    if (raw.outcomePrices) {
        try {
            const prices = typeof raw.outcomePrices === 'string'
                ? JSON.parse(raw.outcomePrices)
                : raw.outcomePrices;
            if (Array.isArray(prices)) {
                outcomePrices = prices.map((p: any) => parseFloat(String(p)) || 0.5);
            }
        } catch (e) { /* use defaults */ }
    }

    // Fallback price from bestBid
    if (outcomePrices[0] === 0.5 && raw.bestBid) {
        const bid = parseFloat(String(raw.bestBid));
        if (!isNaN(bid) && bid > 0 && bid < 1) {
            outcomePrices = [bid, 1 - bid];
        }
    }

    // Parse outcomes
    let outcomes: string[] = ['Yes', 'No'];
    if (raw.outcomes) {
        try {
            outcomes = typeof raw.outcomes === 'string'
                ? JSON.parse(raw.outcomes)
                : (Array.isArray(raw.outcomes) ? raw.outcomes : ['Yes', 'No']);
        } catch (e) { /* use defaults */ }
    }

    // Determine status
    let status: 'active' | 'closed' | 'resolved' = 'active';
    if (raw.closed) {
        status = 'closed';
    } else if (raw.active === false) {
        status = 'resolved';
    }

    return {
        id: raw.id || raw.conditionId || '',
        slug: raw.slug || '',
        question: raw.question || raw.title || 'Unknown Market',
        image: raw.image || null,
        outcomes,
        outcomePrices,
        probability: Math.round(outcomePrices[0] * 1000) / 10, // 1 decimal place, 0-100
        volume24hr: parseFloat(String(raw.volume24hr || 0)) || 0,
        volume7d: parseFloat(String(raw.volume1wk || raw.volume7d || 0)) || 0,
        volume1mo: parseFloat(String(raw.volume1mo || 0)) || 0,
        liquidity: parseFloat(String(raw.liquidity || raw.liquidityNum || 0)) || 0,
        status,
        category: raw.tag || raw.category || raw.groupItemTitle || null,
        eventTitle: eventTitle || null,
        endDate: raw.endDate || null,
        createdAt: raw.createdAt || new Date().toISOString(),
        lastUpdated: Date.now(),
    };
}

/**
 * Transform raw Gamma API market to MarketDetailDTO
 */
export function transformToMarketDetail(raw: RawGammaMarket, eventTitle?: string): MarketDetailDTO {
    const card = transformToMarketCard(raw, eventTitle);

    // Parse clobTokenIds
    let clobTokenIds: string[] = [];
    if (raw.clobTokenIds) {
        try {
            clobTokenIds = typeof raw.clobTokenIds === 'string'
                ? JSON.parse(raw.clobTokenIds)
                : (Array.isArray(raw.clobTokenIds) ? raw.clobTokenIds : []);
        } catch (e) { /* use empty array */ }
    }

    return {
        ...card,
        description: raw.description || '',
        conditionId: raw.conditionId || raw.id || '',
        clobTokenIds,
    };
}

/**
 * Transform raw CLOB orderbook to OrderBookDTO
 */
export function transformToOrderBook(
    raw: { bids?: any[]; asks?: any[] },
    marketId: string,
    tokenId: string
): OrderBookDTO {
    // Parse and sort bids (highest price first - best bid)
    const bids = (raw.bids || [])
        .map((b: any) => ({
            price: parseFloat(String(b.price || 0)),
            size: parseFloat(String(b.size || 0)),
        }))
        .filter((b: OrderBookLevel) => b.price > 0 && b.size > 0)
        .sort((a: OrderBookLevel, b: OrderBookLevel) => b.price - a.price)
        .slice(0, 10);

    // Parse and sort asks (lowest price first - best ask)
    const asks = (raw.asks || [])
        .map((a: any) => ({
            price: parseFloat(String(a.price || 0)),
            size: parseFloat(String(a.size || 0)),
        }))
        .filter((a: OrderBookLevel) => a.price > 0 && a.size > 0)
        .sort((a: OrderBookLevel, b: OrderBookLevel) => a.price - b.price)
        .slice(0, 10);

    const bestBid = bids.length > 0 ? bids[0].price : 0;
    const bestAsk = asks.length > 0 ? asks[0].price : 1;
    const mid = (bestBid + bestAsk) / 2;
    const spread = bestAsk - bestBid;

    return {
        marketId,
        tokenId,
        bids,
        asks,
        bestBid,
        bestAsk,
        mid,
        spread,
        lastUpdated: Date.now(),
    };
}
