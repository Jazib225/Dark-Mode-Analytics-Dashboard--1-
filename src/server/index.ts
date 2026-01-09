import express from "express";
import type { Express } from "express";
// Node 18+ has built-in fetch support, no need to import

// Optimized markets endpoint with caching
import marketsV2Router from "./routes/marketsV2";

// Routes no longer needed - frontend calls Polymarket APIs directly via backend proxy
// import marketsRouter from "./routes/markets";
// import tradingRouter from "./routes/trading";
// import portfolioRouter from "./routes/portfolio";

const app: Express = express();
const PORT = parseInt(process.env.BACKEND_PORT || "3001", 10);

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// CORS middleware (allow frontend to call backend)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// =============================================================================
// Optimized Markets V2 API (with server-side caching)
// =============================================================================
app.use("/api/v2/markets", marketsV2Router);

// API Proxy for Polymarket APIs (to avoid CORS issues)
app.get("/api/proxy/:service/*", async (req, res) => {
  try {
    const service = req.params.service;
    const path = (req.params as any)[0];
    const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
    
    let apiUrl = "";
    if (service === "gamma") {
      apiUrl = `https://gamma-api.polymarket.com/${path}`;
    } else if (service === "clob") {
      apiUrl = `https://clob.polymarket.com/${path}`;
    } else if (service === "data") {
      apiUrl = `https://data-api.polymarket.com/${path}`;
    } else {
      return res.status(400).json({ error: "Unknown service" });
    }
    
    if (queryString) {
      apiUrl += `?${queryString}`;
    }
    
    console.log(`Proxying request to: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Polymarket-Dashboard/1.0",
      },
      timeout: 30000,
    } as any);
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).json({ error: "Failed to proxy request" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Endpoint not found" });
});

// Error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Error:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Internal server error",
    });
  }
);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Note: All market data is fetched directly from Polymarket APIs by the frontend`);
});
