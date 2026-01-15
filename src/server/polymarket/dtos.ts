/**
 * Unified Polymarket Data Types (DTOs)
 * 
 * STRICT CONTRACT:
 * - UI components consume ONLY these DTOs.
 * - No raw API shapes in the UI.
 * - All outcomes must be present.
 * - Pricing derived strictly from CLOB token IDs.
 */

// =============================================================================
// Core Data Structures
// =============================================================================

export interface OutcomeDTO {
    name: string;
    tokenId: string;        // REQUIRED for pricing. If missing/unknown, handle gracefully in mapper but field is required.
    price: number | null;   // Derived from CLOB. Null if unavailable/error. 0-1 range (probability).
    image?: string | null;  // For multi-outcome markets (candidate image, etc)
}

export interface MarketCardDTO {
    id: string;             // Market ID (or Condition ID for multi-outcome container)
    slug?: string;
    question: string;
    image: string | null;   // Thumbnail for the card
    outcomes: OutcomeDTO[]; // ALL outcomes (not just Yes/No).
    status: 'active' | 'closed' | 'resolved';

    // Metadata for sorting/filtering
    volume24hr: number;
    volume7d?: number;
    createdAt?: string;
    endDate?: string;
    category?: string;
}

export interface MarketDetailDTO extends MarketCardDTO {
    description: string;
    conditionId: string;
    liquidity: number;      // Keeping liquidity here
    clobTokenIds: string[]; // For historical data fetching if needed
    // Additional detail-specific fields can go here
}

// =============================================================================
// API Response Wrappers
// =============================================================================

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    error?: string;
}

// =============================================================================
// Raw Interfaces (for internal mappers only - do not export to UI)
// =============================================================================

export interface RawGammaMarket {
    id: string;
    question: string;
    conditionId: string;
    slug: string;
    title?: string;
    description?: string;
    image?: string;
    icon?: string;

    // Outcome related
    outcomes?: string | string[];     // JSON string or array
    outcomePrices?: string | number[]; // JSON string or array
    clobTokenIds?: string | string[];  // JSON string or array

    // Group/Event related
    groupItemTitle?: string;
    groupItemImage?: string;

    // Stats
    volume?: string | number;
    volume24hr?: string | number;
    volume7d?: string | number;
    liquidity?: string | number;
    active?: boolean;
    closed?: boolean;
    endDate?: string;
    createdAt?: string;
    category?: string;
    tags?: string[];
}

export interface RawGammaEvent {
    id: string;
    title: string;
    slug: string;
    image?: string;
    icon?: string;
    description?: string;
    markets: RawGammaMarket[];
}
