import {
    MarketCardDTO,
    OutcomeDTO,
    RawGammaEvent,
    RawGammaMarket
} from './dtos';

/**
 * Parses a JSON string or returns the value if already parsed
 */
function safeParse<T>(input: string | T | undefined, fallback: T): T {
    if (input === undefined || input === null) return fallback;
    if (typeof input === 'string') {
        try {
            return JSON.parse(input);
        } catch (e) {
            return fallback;
        }
    }
    return input;
}

/**
 * Maps a single RawGammaMarket (Binary/Closed-Form) to a list of OutcomeDTOs
 */
function mapBinaryOutcomes(market: RawGammaMarket): OutcomeDTO[] {
    const rawOutcomes = safeParse<string[]>(market.outcomes, ['Yes', 'No']);
    const rawTokenIds = safeParse<string[]>(market.clobTokenIds, []);

    // Ensure we have token IDs. If not, we can't do pricing.
    // In a binary market: [YesToken, NoToken] usually

    if (rawTokenIds.length < 2) {
        // Fallback or error state? The user said "If tokenId missing... mark price as null and log error"
        // We will create outcomes with empty tokenIds to signal failure downstream
        console.warn(`[Mapper] Missing tokens for market ${market.id}`);
    }

    return rawOutcomes.map((name, index) => {
        return {
            name: name,
            tokenId: rawTokenIds[index] || '', // Empty string indicates missing
            price: null, // To be filled by CLOB
            image: null
        };
    });
}

/**
 * Maps a RawGammaEvent (which might be a Multi-Outcome Market container) to a MarketCardDTO.
 * 
 * Logic:
 * - If event has > 1 market, treat it as a Multi-Outcome Market (e.g. "Who looks cool?").
 *   - The "Card" is the Event.
 *   - The "Outcomes" are the individual markets (Yes/No tokens? No, usually "Yes" token of the group item).
 * 
 * - If event has 1 market:
 *   - Treat as standard Binary/Categorical.
 */
export function mapEventToMarketCard(event: RawGammaEvent): MarketCardDTO | null {
    if (!event.markets || event.markets.length === 0) return null;

    // Filter valid markets
    const validMarkets = event.markets.filter(m => !m.closed && m.active !== false); // Should we show closed? User said "active/closed/resolved" status, so maybe show them.
    // Let's stick to showing what's in the list.

    const markets = event.markets;
    const isMultiOutcomeGroup = markets.length > 1;

    let id: string;
    let question: string;
    let slug: string;
    let image: string | null;
    let outcomes: OutcomeDTO[];
    let category: string | undefined;

    if (isMultiOutcomeGroup) {
        // GROUP MARKET
        // Use Event details for the Card
        id = event.id; // Or should we use the Event ID as the Market ID? 
        // The frontend expects a "marketId" to link to. 
        // For group markets, usually we link to one of the markets or the event slug?
        // Standard Polymarket links to the event slug or one market ID.
        // We will use the first market ID as the "ID" but keep event metadata.
        // WAIT: If we use Event ID, the detail page needs to support Event ID.
        // Let's use the first market's conditionId or such? 
        // Best practice: Use the slug for navigation.
        // For the DTO `id`, we must provide something unique.

        // Actually, for "Show all outcomes", we list the markets.
        id = markets[0].id; // Use first market ID as canonical? 
        question = event.title;
        slug = event.slug;
        image = event.image || event.icon || markets[0].image || null;
        category = markets[0].category;

        // Map each sub-market as an outcome
        outcomes = markets.map(m => {
            // For a group market, "Outcomes" are the markets themselves.
            // "Price" is the price of the "Yes" outcome of that market.
            // We need the "Yes" token ID.
            const tokenIds = safeParse<string[]>(m.clobTokenIds, []);
            const yesTokenId = tokenIds[0]; // Convention: 0 is Yes (Long), 1 is No (Short) usually? 
            // Need to verify convention. 
            // Gamma "clobTokenIds" usually: [ "token1", "token2" ] matching "outcomes": ["Yes", "No"]
            // So Yes is index 0.

            return {
                name: m.groupItemTitle || m.question || 'Unknown',
                tokenId: yesTokenId || '',
                price: null,
                image: m.groupItemImage || m.image || m.icon || null
            };
        });

    } else {
        // SINGLE MARKET (Binary/Categorical)
        const market = markets[0];
        id = market.id;
        question = market.question;
        slug = market.slug || event.slug;
        image = market.image || market.icon || event.image || null;
        category = market.category;

        outcomes = mapBinaryOutcomes(market);
    }

    // Status aggregation
    const isClosed = markets.every(m => m.closed);
    const isResolved = markets.every(m => m.active === false);
    const status = isResolved ? 'resolved' : isClosed ? 'closed' : 'active';

    // Volume aggregation
    const volume24hr = markets.reduce((acc, m) => acc + (Number(m.volume24hr) || 0), 0);
    const volume7d = markets.reduce((acc, m) => acc + (Number(m.volume7d) || 0), 0);

    return {
        id,
        slug,
        question,
        image,
        outcomes,
        status,
        volume24hr,
        volume7d,
        category,
        createdAt: markets[0].createdAt,
        endDate: markets[0].endDate,
    };
}
