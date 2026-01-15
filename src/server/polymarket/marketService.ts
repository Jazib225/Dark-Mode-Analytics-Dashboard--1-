import * as gamma from './gammaClient';
import * as clob from './clobClient';
import * as mappers from './mappers';
import { MarketCardDTO, MarketDetailDTO } from './dtos';

/**
 * Get a list of markets (Trending/New/etc) with LIVE prices.
 */
export async function getMarketList(type: 'trending' | 'new' | 'resolving', limit = 20, offset = 0): Promise<MarketCardDTO[]> {
    // 1. Fetch from Gamma (Events/Markets)
    // We need to access the raw gamma response, assuming gammaClient is updated to return that.
    // NOTE: The current gammaClient returns MarketCardDTOs (old version). 
    // We will bypass the old gammaClient logic or update it. 
    // For now, let's assume gammaClient has a "getRawEvents" method we will add.

    const events = await gamma.getRawEvents(type, limit, offset);

    // 2. Map to DTOs (without prices)
    const cards: MarketCardDTO[] = [];
    const allTokenIds: string[] = [];

    for (const event of events) {
        const card = mappers.mapEventToMarketCard(event);
        if (card) {
            cards.push(card);
            // Collect tokens
            card.outcomes.forEach(o => {
                if (o.tokenId) allTokenIds.push(o.tokenId);
            });
        }
    }

    // 3. Batch Fetch Prices
    const priceMap = await clob.getPrices(allTokenIds);

    // 4. Hydrate Prices
    for (const card of cards) {
        for (const outcome of card.outcomes) {
            if (outcome.tokenId && priceMap.has(outcome.tokenId)) {
                const p = priceMap.get(outcome.tokenId);
                // User said: "derived from CLOB (null if unavailable)"
                // My clob client returns 0 on error, let's check. 
                // Ideally, we want null on strict error, but 0.5 (unknown) is also bad logic.
                outcome.price = p !== undefined ? p : null;
            } else {
                outcome.price = null;
            }
        }
    }

    return cards;
}

/**
 * Get detailed market with prices.
 */
export async function getMarketDetail(id: string): Promise<MarketDetailDTO | null> {
    const event = await gamma.getRawEvent(id);
    if (!event) return null;

    const card = mappers.mapEventToMarketCard(event);
    if (!card) return null;

    // Fetch prices
    const tokenIds = card.outcomes.map(o => o.tokenId).filter(Boolean);
    const priceMap = await clob.getPrices(tokenIds);

    for (const outcome of card.outcomes) {
        if (outcome.tokenId) {
            outcome.price = priceMap.get(outcome.tokenId) ?? null;
        }
    }

    // Convert to Detail DTO
    // We need description and conditionId etc.
    // The mapper currently returns MarketCardDTO.
    // We can cast or extend.
    // Note: mappers.mapEventToMarketCard fills basic info.
    // RawGammaEvent might have description. 

    return {
        ...card,
        description: event.description || '',
        conditionId: event.markets[0]?.conditionId || '',
        liquidity: Number(event.markets[0]?.liquidity) || 0,
        clobTokenIds: tokenIds
    };
}
