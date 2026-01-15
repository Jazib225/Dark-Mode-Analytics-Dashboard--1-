import { Router, Request, Response } from "express";
import * as marketService from "../polymarket/marketService";

const router = Router();

// =============================================================================
// GET /api/v2/markets - Optimized market list
// =============================================================================
router.get("/", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const {
      limit = "50",
      offset = "0",
      category = "trending",
      q // search query
    } = req.query;

    let markets;

    // Simple search support
    /* 
       We haven't implemented search in marketService yet.
       We can add it or just ignore for now.
       Let's stick to list types.
    */

    let type: 'trending' | 'new' | 'resolving' = 'trending';
    if (category === 'new') type = 'new';
    if (category === 'resolving') type = 'resolving';

    markets = await marketService.getMarketList(
      type,
      parseInt(String(limit)),
      parseInt(String(offset))
    );

    const duration = Date.now() - startTime;
    res.json({
      success: true,
      data: markets,
      meta: { count: markets.length, duration }
    });
  } catch (error) {
    console.error("Markets Service error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch markets" });
  }
});

// =============================================================================
// GET /api/v2/markets/:id - Market Detail
// =============================================================================
router.get("/:id", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, error: "ID required" });

    const market = await marketService.getMarketDetail(id);

    if (!market) {
      return res.status(404).json({ success: false, error: "Market not found" });
    }

    const duration = Date.now() - startTime;
    res.json({
      success: true,
      data: market,
      meta: { duration }
    });
  } catch (error) {
    console.error("Market Detail Error", error);
    res.status(500).json({ success: false, error: "Failed to fetch market" });
  }
});

// =============================================================================
// Cache Stats (Optional stub)
// =============================================================================
router.get("/cache/stats", (req: Request, res: Response) => {
  res.json({ success: true, message: "Cache stats not implemented in new architecture yet" });
});

export default router;
