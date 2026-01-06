import { Router, Request, Response } from "express";
import { dataClient } from "../clients/DataClient";

const router = Router();

/**
 * GET /api/portfolio/:address
 * Get user portfolio overview
 */
router.get("/:address", async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!address) {
      return res.status(400).json({ success: false, error: "address is required" });
    }

    const portfolio = await dataClient.getPortfolio(address);

    res.json({ success: true, data: portfolio });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch portfolio";
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/portfolio/:address/positions
 * Get user positions
 */
router.get("/:address/positions", async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!address) {
      return res.status(400).json({ success: false, error: "address is required" });
    }

    const positions = await dataClient.getPositions(address);

    res.json({ success: true, data: positions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch positions";
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/portfolio/:address/positions/:positionId
 * Get a specific position
 */
router.get("/:address/positions/:positionId", async (req: Request, res: Response) => {
  try {
    const { address, positionId } = req.params;

    if (!address || !positionId) {
      return res.status(400).json({ success: false, error: "address and positionId are required" });
    }

    const position = await dataClient.getPosition(address, positionId);

    res.json({ success: true, data: position });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch position";
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/portfolio/:address/activity
 * Get user activity/trades
 */
router.get("/:address/activity", async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { limit, offset, start_date, end_date, type } = req.query;

    if (!address) {
      return res.status(400).json({ success: false, error: "address is required" });
    }

    const activity = await dataClient.getActivity(address, {
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
      start_date: start_date as string,
      end_date: end_date as string,
      type: type as "BUY" | "SELL" | "DEPOSIT" | "WITHDRAW" | undefined,
    });

    res.json({ success: true, data: activity });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch activity";
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/portfolio/:address/pnl
 * Get PnL history
 */
router.get("/:address/pnl", async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { start_date, end_date } = req.query;

    if (!address) {
      return res.status(400).json({ success: false, error: "address is required" });
    }

    const pnlHistory = await dataClient.getPnLHistory(address, {
      start_date: start_date as string,
      end_date: end_date as string,
    });

    res.json({ success: true, data: pnlHistory });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch PnL history";
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/portfolio/:address/history
 * Get user trading history stats
 */
router.get("/:address/history", async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!address) {
      return res.status(400).json({ success: false, error: "address is required" });
    }

    const history = await dataClient.getUserHistory(address);

    res.json({ success: true, data: history });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch user history";
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
