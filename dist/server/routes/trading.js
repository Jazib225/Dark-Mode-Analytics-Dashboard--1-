import { Router } from "express";
import { clobClient } from "../clients/ClobClient";
const router = Router();
/**
 * GET /api/trading/orderbook/:assetId
 * Get order book for an asset
 */
router.get("/orderbook/:assetId", async (req, res) => {
    try {
        const { assetId } = req.params;
        if (!assetId) {
            return res.status(400).json({ success: false, error: "assetId is required" });
        }
        const orderBook = await clobClient.getOrderBook(assetId);
        res.json({ success: true, data: orderBook });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch orderbook";
        res.status(500).json({ success: false, error: message });
    }
});
/**
 * GET /api/trading/prices/:assetId
 * Get current price quote for an asset
 */
router.get("/prices/:assetId", async (req, res) => {
    try {
        const { assetId } = req.params;
        if (!assetId) {
            return res.status(400).json({ success: false, error: "assetId is required" });
        }
        const quote = await clobClient.getPriceQuote(assetId);
        res.json({ success: true, data: quote });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch price";
        res.status(500).json({ success: false, error: message });
    }
});
/**
 * GET /api/trading/quotes
 * Get quote for buying/selling a specific quantity
 * Query params: assetId, side (BUY|SELL), quantity
 */
router.get("/quotes", async (req, res) => {
    try {
        const { assetId, side, quantity } = req.query;
        if (!assetId || !side || !quantity) {
            return res.status(400).json({
                success: false,
                error: "assetId, side (BUY|SELL), and quantity are required",
            });
        }
        const quote = await clobClient.getQuote(assetId, side, quantity);
        res.json({ success: true, data: quote });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch quote";
        res.status(500).json({ success: false, error: message });
    }
});
/**
 * GET /api/trading/orders/:orderId
 * Get order by ID
 */
router.get("/orders/:orderId", async (req, res) => {
    try {
        const { orderId } = req.params;
        if (!orderId) {
            return res.status(400).json({ success: false, error: "orderId is required" });
        }
        const order = await clobClient.getOrder(orderId);
        res.json({ success: true, data: order });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch order";
        res.status(500).json({ success: false, error: message });
    }
});
/**
 * GET /api/trading/orders?user=<address>
 * Get user's open orders
 */
router.get("/orders", async (req, res) => {
    try {
        const { user } = req.query;
        if (!user) {
            return res.status(400).json({ success: false, error: "user (address) parameter is required" });
        }
        const orders = await clobClient.getOpenOrders(user);
        res.json({ success: true, data: orders });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch orders";
        res.status(500).json({ success: false, error: message });
    }
});
/**
 * POST /api/trading/orders
 * Create a new order
 * Body: { asset_id, side, quantity, price, client_order_id? }
 */
router.post("/orders", async (req, res) => {
    try {
        const { asset_id, side, quantity, price, client_order_id } = req.body;
        if (!asset_id || !side || !quantity || !price) {
            return res.status(400).json({
                success: false,
                error: "asset_id, side, quantity, and price are required",
            });
        }
        const order = await clobClient.createOrder({
            asset_id,
            side,
            quantity,
            price,
            client_order_id,
        });
        res.json({ success: true, data: order });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create order";
        res.status(400).json({ success: false, error: message });
    }
});
/**
 * DELETE /api/trading/orders/:orderId
 * Cancel an order
 */
router.delete("/orders/:orderId", async (req, res) => {
    try {
        const { orderId } = req.params;
        if (!orderId) {
            return res.status(400).json({ success: false, error: "orderId is required" });
        }
        const result = await clobClient.cancelOrder(orderId);
        res.json({ success: true, data: result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to cancel order";
        res.status(400).json({ success: false, error: message });
    }
});
/**
 * GET /api/trading/fills?user=<address>
 * Get fills for a user
 */
router.get("/fills", async (req, res) => {
    try {
        const { user, limit, offset } = req.query;
        if (!user) {
            return res.status(400).json({ success: false, error: "user (address) parameter is required" });
        }
        const fills = await clobClient.getFills(user, {
            limit: limit ? parseInt(limit) : 50,
            offset: offset ? parseInt(offset) : 0,
        });
        res.json({ success: true, data: fills });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch fills";
        res.status(500).json({ success: false, error: message });
    }
});
export default router;
