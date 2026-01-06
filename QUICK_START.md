# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies
```bash
npm install
```
This installs all frontend and backend dependencies including Express, TypeScript, and build tools.

### Step 2: Start Development Servers
```bash
npm run dev
```
This starts:
- **Backend**: `http://localhost:3001` (Express server with Polymarket API clients)
- **Frontend**: `http://localhost:5173` (Vite dev server with React app)

Or run separately:
```bash
npm run dev:server    # Backend only
npm run dev:frontend  # Frontend only
```

### Step 3: Test the APIs
```bash
# Terminal 1: Start servers
npm run dev

# Terminal 2: Test endpoints
curl http://localhost:3001/api/markets
curl http://localhost:3001/api/markets/trending
curl http://localhost:3001/api/health
```

### Step 4: Open Frontend
Open `http://localhost:5173` in your browser and navigate:
- **Discover** → Trending markets (via Gamma API)
- **Markets** → All markets list (via Gamma API)
- **Portfolio** → User positions (via Data API)
- **Feed** → Recent activity (via Data API)

---

## 📚 What Was Built

### Backend (Port 3001)
Three specialized API clients that route to correct Polymarket endpoints:
- **Gamma API** (`/api/markets/*`) - Market discovery & metadata
- **CLOB API** (`/api/trading/*`) - Orders, orderbooks, pricing
- **Data API** (`/api/portfolio/*`) - User positions & activity

### Frontend
Updated React components that call backend endpoints instead of mock data:
- Discover.tsx - Fetches trending markets
- Markets.tsx - Fetches market list
- Feed.tsx - Ready for activity data
- Portfolio.tsx - Ready for position data

---

## 🔧 Common Commands

```bash
# Development
npm run dev              # Both servers
npm run dev:server      # Backend only
npm run dev:frontend    # Frontend only

# Building
npm run build           # Build both
npm run build:server    # Build backend
npm run build:frontend  # Build frontend

# Testing (add these if you want)
npm test
npm run lint
```

---

## 🌍 API Endpoints

### Markets (Gamma API)
```
GET /api/markets                    # All markets
GET /api/markets/:id                # Single market
GET /api/markets/trending           # Trending markets
GET /api/markets/top                # Top by volume
GET /api/markets/search?q=query     # Search
```

### Trading (CLOB API)
```
GET /api/trading/orderbook/:id      # Order book
GET /api/trading/prices/:id         # Current price
POST /api/trading/orders            # Place order
```

### Portfolio (Data API)
```
GET /api/portfolio/:address         # User portfolio
GET /api/portfolio/:address/activity # User trades
```

Test with:
```bash
curl http://localhost:3001/api/markets?limit=5
curl http://localhost:3001/api/markets/trending
```

---

## 🔍 How It Works

```
React Component (Frontend)
        ↓
    api.ts (Client Service)
        ↓
Backend Route (Express)
        ↓
API Client (Gamma/CLOB/Data)
        ↓
Polymarket API
```

### Example: Get Markets
1. Discover.tsx calls `marketsApi.getTrendingMarkets()`
2. Frontend api.ts makes request to `http://localhost:3001/api/markets/trending`
3. Backend routes to GammaClient
4. GammaClient calls `https://gamma-api.polymarket.com/markets/trending`
5. Response flows back through the chain
6. Component renders markets list

---

## 🛠️ Configuration

### Environment Variables
Create/edit `.env.local`:
```env
BACKEND_PORT=3001
VITE_API_URL=http://localhost:3001/api
```

The backend reads:
- `BACKEND_PORT` - Server port (default: 3001)

The frontend reads:
- `VITE_API_URL` - Backend URL (default: http://localhost:3001/api)
- Any var starting with `VITE_` is available in browser code

---

## 📦 What's Included

### Backend (New)
- Express server
- 3 API clients (Gamma, CLOB, Data)
- 3 route handlers (markets, trading, portfolio)
- HTTP utilities (timeout, retry, validation)
- Error handling & CORS

### Frontend (Updated)
- API service layer (marketsApi, tradingApi, portfolioApi)
- Updated Discover, Markets, Feed components
- Loading/error states
- Type-safe API calls

### Tools
- TypeScript (both frontend & backend)
- Concurrently (run multiple scripts)
- TSX (run TS in Node directly)
- Express (web server)

---

## ⚠️ Important Notes

1. **Node.js Version**: Requires Node 18+ (for native fetch support)
2. **Port Conflicts**: Make sure ports 3001 and 5173 are free
3. **API Keys**: Currently using public Polymarket APIs. For trading (CLOB), you'll need API keys in production
4. **CORS**: Backend allows all origins in dev. Restrict in production!
5. **Environment**: `VITE_API_URL` controls where frontend calls backend (useful for different environments)

---

## 🐛 Troubleshooting

### Port 3001 already in use
```bash
# Kill the process (macOS/Linux)
lsof -ti:3001 | xargs kill -9

# Or use a different port
BACKEND_PORT=3002 npm run dev:server
```

### Frontend can't connect to backend
- Check VITE_API_URL in .env.local
- Verify backend is running: `curl http://localhost:3001/health`
- Check browser console for CORS errors

### TypeScript errors
```bash
npm run build:server   # Check backend
npm run build:frontend # Check frontend
```

### "Cannot find module" errors
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 📖 Documentation

- **IMPLEMENTATION.md** - Detailed technical docs
- **BACKEND_INTEGRATION_SUMMARY.md** - Feature overview
- **FILE_MANIFEST.md** - List of all changes

---

## 🎯 Next Steps

1. **Test Locally** - Run `npm run dev` and browse http://localhost:5173
2. **Check Endpoints** - Use curl to test API endpoints
3. **Update Components** - Enhance MarketDetail, Portfolio with live data
4. **Add Auth** - Implement wallet signing for CLOB operations
5. **Deploy** - Build and deploy backend + frontend to production

---

## 📞 Support

### Common Tasks

**Get all markets:**
```bash
curl http://localhost:3001/api/markets?limit=100
```

**Get trending markets:**
```bash
curl http://localhost:3001/api/markets/trending?timeframe=24h
```

**Get market by ID:**
```bash
curl http://localhost:3001/api/markets/market-id-here
```

**Search markets:**
```bash
curl "http://localhost:3001/api/markets/search?q=bitcoin&limit=10"
```

**Check backend health:**
```bash
curl http://localhost:3001/health
```

---

## ✅ Verification

After running `npm run dev`, you should see:
```
✓ Backend running on http://localhost:3001
✓ Frontend running on http://localhost:5173
✓ Hot reload enabled
✓ TypeScript strict mode active
```

Visit http://localhost:5173 and:
- Discover page should show trending markets
- Markets page should show market list
- Navigation should work between pages
- Check Network tab for `/api/` calls to backend

---

**You're all set! Happy developing! 🚀**
