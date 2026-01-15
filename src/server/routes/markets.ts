/**
 * Express Route: /api/markets
 * 
 * Handles market list and detail requests for local development.
 * Mirrors the Vercel API routes: api/markets/index.ts and api/markets/[...id].ts
 */

import { Router } from 'express';
import {
  getTrendingMarkets,
  getNewMarkets,
  getNearlyResolvedMarkets,
  getMarketById,
  getOrderBook,
} from '../polymarket';

const router = Router();

// =============================================================================
// GET /api/markets - List markets (trending, new, nearly-resolved)
// =============================================================================
router.get('/', async (req, res) => {
  const startTime = Date.now();

  try {
    const type = (req.query.type as string) || 'trending';
    const limit = parseInt(String(req.query.limit || '50'), 10);
    const offset = parseInt(String(req.query.offset || '0'), 10);
    const hoursAhead = parseInt(String(req.query.hoursAhead || '72'), 10);

    console.log(`[Markets API] Fetching ${type} markets (limit=${limit}, offset=${offset})...`);

    let result: { markets: any[]; fromCache: boolean; duration: number };

    switch (type) {
      case 'new':
        result = await getNewMarkets(limit, offset);
        break;
      case 'nearly-resolved':
        result = await getNearlyResolvedMarkets(limit, offset, hoursAhead);
        break;
      case 'trending':
      default:
        result = await getTrendingMarkets(limit, offset);
        break;
    }

    const duration = Date.now() - startTime;
    console.log(`[Markets API] ${type}: ${result.markets.length} markets in ${duration}ms (cached: ${result.fromCache})`);

    // Set cache headers
    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');

    return res.json({
      success: true,
      data: result.markets,
      meta: {
        count: result.markets.length,
        type,
        duration,
        cached: result.fromCache,
      },
    });

  } catch (error) {
    console.error('[Markets API] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch markets',
    });
  }
});

// =============================================================================
// GET /api/markets/:id - Get market detail
// =============================================================================
router.get('/:id', async (req, res) => {
  const startTime = Date.now();
  const marketId = req.params.id;

  // Handle orderbook sub-route
  if (req.path.endsWith('/orderbook')) {
    // This is handled by the next route
    return res.status(404).json({ success: false, error: 'Use /api/markets/:id/orderbook' });
  }

  try {
    console.log(`[Markets API] Fetching detail for market ${marketId}...`);

    const result = await getMarketById(marketId);

    if (!result.market) {
      return res.status(404).json({ success: false, error: 'Market not found' });
    }

    const duration = Date.now() - startTime;
    console.log(`[Markets API] Detail fetched in ${duration}ms (cached: ${result.fromCache})`);

    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');

    return res.json({
      success: true,
      data: result.market,
      meta: { duration, cached: result.fromCache },
    });

  } catch (error) {
    console.error('[Markets API] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch market detail',
    });
  }
});

// =============================================================================
// GET /api/markets/:id/orderbook - Get orderbook for a market
// =============================================================================
router.get('/:id/orderbook', async (req, res) => {
  const startTime = Date.now();
  const marketId = req.params.id;
  const tokenId = req.query.tokenId as string;

  if (!tokenId) {
    return res.status(400).json({ success: false, error: 'tokenId query param required' });
  }

  try {
    console.log(`[Markets API] Fetching orderbook for token ${tokenId}...`);

    const result = await getOrderBook(marketId, tokenId);

    const duration = Date.now() - startTime;
    console.log(`[Markets API] Orderbook fetched in ${duration}ms (cached: ${result.fromCache})`);

    res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=15');

    return res.json({
      success: true,
      data: result.orderbook,
      meta: { duration, cached: result.fromCache },
    });

  } catch (error) {
    console.error('[Markets API] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch orderbook',
    });
  }
});

export default router;
