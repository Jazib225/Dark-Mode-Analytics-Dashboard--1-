import { Router, Request, Response } from "express";
import { gammaClient } from "../clients/GammaClient";

const router = Router();

/**
 * GET /api/markets
 * List all markets with optional filters
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { limit, offset, order, active, closed, archived, tag } = req.query;

    const markets = await gammaClient.listMarkets({
      limit: limit ? parseInt(limit as string) : 100,
      offset: offset ? parseInt(offset as string) : 0,
      order: order as any,
      active: active === "true" ? true : active === "false" ? false : undefined,
      closed: closed === "true" ? true : closed === "false" ? false : undefined,
      archived: archived === "true" ? true : archived === "false" ? false : undefined,
      tag: tag as string,
    });

    res.json({ success: true, data: markets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch markets";
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/markets/trending
 * Get trending markets
 */
router.get("/trending", async (req: Request, res: Response) => {
  try {
    const { timeframe } = req.query;
    const markets = await gammaClient.getTrendingMarkets(
      (timeframe as "1h" | "24h" | "7d") || "24h"
    );

    res.json({ success: true, data: markets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch trending markets";
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/markets/top
 * Get top markets by volume
 */
router.get("/top", async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const markets = await gammaClient.getTopMarkets(limit ? parseInt(limit as string) : 10);

    res.json({ success: true, data: markets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch top markets";
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/markets/search
 * Search for markets by query
 */
router.get("/search", async (req: Request, res: Response) => {
  try {
    const { q, limit, offset } = req.query;

    if (!q) {
      return res.status(400).json({ success: false, error: "query parameter 'q' is required" });
    }

    const markets = await gammaClient.searchMarkets(q as string, {
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json({ success: true, data: markets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to search markets";
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/markets/categories
 * Get all market categories
 */
router.get("/categories", async (req: Request, res: Response) => {
  try {
    const categories = await gammaClient.listCategories();

    res.json({ success: true, data: categories });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch categories";
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/markets/events
 * Get market events
 */
router.get("/events", async (req: Request, res: Response) => {
  try {
    const { limit, offset } = req.query;

    const events = await gammaClient.listEvents({
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json({ success: true, data: events });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch events";
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/markets/:id
 * Get a single market by ID
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, error: "Market ID is required" });
    }

    const market = await gammaClient.getMarketById(id);

    res.json({ success: true, data: market });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch market";
    res.status(404).json({ success: false, error: message });
  }
});

/**
 * GET /api/markets/:id/stats
 * Get market 24h stats
 */
router.get("/:id/stats", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, error: "Market ID is required" });
    }

    const stats = await gammaClient.get24HourStats(id);

    res.json({ success: true, data: stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch market stats";
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
