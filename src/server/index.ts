import express from "express";
import type { Express } from "express";
import marketsRouter from "./routes/markets";
import tradingRouter from "./routes/trading";
import portfolioRouter from "./routes/portfolio";

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

// Routes
app.use("/api/markets", marketsRouter);
app.use("/api/trading", tradingRouter);
app.use("/api/portfolio", portfolioRouter);

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
  console.log(`   Markets API: http://localhost:${PORT}/api/markets`);
  console.log(`   Trading API: http://localhost:${PORT}/api/trading`);
  console.log(`   Portfolio API: http://localhost:${PORT}/api/portfolio`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});
