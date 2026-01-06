# API Reference Guide

## Overview
This guide documents all available API clients and endpoints for the Polymarket Analytics Dashboard backend integration.

---

## GammaClient (Market Discovery)
**Base URL**: `https://gamma-api.polymarket.com`  
**File**: `src/server/clients/GammaClient.ts`  
**Purpose**: Market browsing, discovery, metadata, categories, events

### Methods

#### `listMarkets(params?: SearchMarketsParams): Promise<Market[]>`
List all markets with optional filters
```typescript
const markets = await gammaClient.listMarkets({
  limit: 50,
  offset: 0,
  order: 'volume',
  active: true
});
```
**Endpoint**: `GET /markets`

#### `getMarketById(marketId: string): Promise<Market>`
Get a single market by its ID
```typescript
const market = await gammaClient.getMarketById('market-123');
```
**Endpoint**: `GET /markets/{id}`

#### `getMarketBySlug(slug: string): Promise<Market>`
Get a market by its slug
```typescript
const market = await gammaClient.getMarketBySlug('bitcoin-2026');
```
**Endpoint**: `GET /markets/{slug}`

#### `searchMarkets(query: string, params?): Promise<Market[]>`
Search for markets by query string
```typescript
const results = await gammaClient.searchMarkets('bitcoin', {
  limit: 50
});
```
**Endpoint**: `GET /markets/search?q={query}`

#### `listCategories(): Promise<MarketCategory[]>`
Get all market categories
```typescript
const categories = await gammaClient.listCategories();
```
**Endpoint**: `GET /markets/categories`

#### `listEvents(params?): Promise<MarketEvent[]>`
Get market events
```typescript
const events = await gammaClient.listEvents({
  limit: 20,
  offset: 0
});
```
**Endpoint**: `GET /events`

#### `get24HourStats(marketId: string): Promise<Market24HourStats>`
Get 24-hour statistics for a market
```typescript
const stats = await gammaClient.get24HourStats('market-123');
// Returns: {
//   id, volumeUSD, tradingVolume, liquidityUSD,
//   change24hUSD, change24hPercent
// }
```
**Endpoint**: `GET /markets/{id}/stats`

#### `getTrendingMarkets(timeframe?: '1h' | '24h' | '7d'): Promise<Market[]>`
Get trending markets for a timeframe
```typescript
const trending = await gammaClient.getTrendingMarkets('24h');
```
**Endpoint**: `GET /markets/trending?timeframe=24h`

#### `getTopMarkets(limit?: number): Promise<Market[]>`
Get top markets by trading volume
```typescript
const topMarkets = await gammaClient.getTopMarkets(10);
```
**Endpoint**: `GET /markets?order=-volume&limit=10&active=true`

---

## ClobClient (Trading Operations)
**Base URL**: `https://clob.polymarket.com`  
**File**: `src/server/clients/ClobClient.ts`  
**Purpose**: Order management, orderbooks, prices, quotes, fills

### Methods

#### `getOrderBook(assetId: string): Promise<OrderBookSnapshot>`
Get current order book snapshot for an asset
```typescript
const orderBook = await clobClient.getOrderBook('asset-123');
// Returns: { id, asset_id, bids, asks, mid, spread, timestamp }
```
**Endpoint**: `GET /orderbooks/{assetId}`

#### `getPriceQuote(assetId: string): Promise<PriceQuote>`
Get current price quote
```typescript
const quote = await clobClient.getPriceQuote('asset-123');
// Returns: { id, yes_price, no_price, bid, ask, mid, timestamp }
```
**Endpoint**: `GET /prices/{assetId}`

#### `getQuote(assetId: string, side: 'BUY' | 'SELL', quantity: string): Promise<Quote>`
Get quote for specific quantity and side
```typescript
const quote = await clobClient.getQuote('asset-123', 'BUY', '100');
// Returns: { asset_id, side, size, price, mid }
```
**Endpoint**: `GET /quotes?asset_id={id}&side=BUY&quantity={qty}`

#### `getOrder(orderId: string): Promise<Order>`
Get order by ID
```typescript
const order = await clobClient.getOrder('order-123');
// Returns: { id, user, asset_id, side, quantity, price, status, created_at }
```
**Endpoint**: `GET /orders/{orderId}`

#### `getOpenOrders(userAddress: string): Promise<Order[]>`
Get user's open orders
```typescript
const orders = await clobClient.getOpenOrders('0x123...');
```
**Endpoint**: `GET /orders?user={address}&status=OPEN`

#### `createOrder(order: CreateOrderRequest): Promise<Order>`
Create a new order
```typescript
const newOrder = await clobClient.createOrder({
  asset_id: 'asset-123',
  side: 'BUY',
  quantity: '100',
  price: '0.75',
  client_order_id: 'order-abc'
});
```
**Endpoint**: `POST /orders`
**Body**:
```json
{
  "asset_id": "string",
  "side": "BUY|SELL",
  "quantity": "string",
  "price": "string",
  "client_order_id": "string (optional)"
}
```

#### `cancelOrder(orderId: string): Promise<{ success: boolean }>`
Cancel an open order
```typescript
const result = await clobClient.cancelOrder('order-123');
```
**Endpoint**: `DELETE /orders/{orderId}`

#### `getFills(userAddress: string, params?): Promise<Fill[]>`
Get fills/executions for a user
```typescript
const fills = await clobClient.getFills('0x123...', {
  limit: 50,
  offset: 0
});
// Returns: [{ id, order_id, asset_id, quantity, price, side, timestamp }]
```
**Endpoint**: `GET /fills?user={address}&limit={limit}&offset={offset}`

#### `getLastTradePrice(assetId: string): Promise<string>`
Get the last traded price for an asset
```typescript
const price = await clobClient.getLastTradePrice('asset-123');
```
**Endpoint**: `GET /prices/{assetId}` (returns mid price)

---

## DataClient (Portfolio & History)
**Base URL**: `https://data-api.polymarket.com`  
**File**: `src/server/clients/DataClient.ts`  
**Purpose**: User positions, portfolio, activity, PnL, history

### Methods

#### `getPortfolio(userAddress: string): Promise<Portfolio>`
Get user portfolio overview
```typescript
const portfolio = await dataClient.getPortfolio('0x123...');
// Returns: {
//   address, total_balance, available_balance, positions_value,
//   total_pnl, total_pnl_percent, positions, updated_at
// }
```
**Endpoint**: `GET /portfolios/{address}`

#### `getPositions(userAddress: string): Promise<Position[]>`
Get all user positions
```typescript
const positions = await dataClient.getPositions('0x123...');
// Each position: {
//   id, user, asset_id, market_id, quantity, entry_price,
//   current_price, unrealized_pnl, unrealized_pnl_percent,
//   side, opened_at
// }
```
**Endpoint**: `GET /portfolios/{address}/positions`

#### `getPosition(userAddress: string, positionId: string): Promise<Position>`
Get a specific position
```typescript
const position = await dataClient.getPosition('0x123...', 'pos-123');
```
**Endpoint**: `GET /portfolios/{address}/positions/{positionId}`

#### `getActivity(userAddress: string, params?): Promise<Activity[]>`
Get user activity/trades
```typescript
const activity = await dataClient.getActivity('0x123...', {
  limit: 50,
  offset: 0,
  start_date: '2026-01-01',
  end_date: '2026-01-31',
  type: 'BUY'  // or 'SELL', 'DEPOSIT', 'WITHDRAW'
});
// Each activity: {
//   id, user, type, asset_id, market_id,
//   quantity, price, pnl, timestamp
// }
```
**Endpoint**: `GET /portfolios/{address}/activity`

#### `getPnLHistory(userAddress: string, params?): Promise<PnLSnapshot[]>`
Get PnL history snapshots
```typescript
const pnl = await dataClient.getPnLHistory('0x123...', {
  start_date: '2026-01-01',
  end_date: '2026-01-31'
});
// Each snapshot: {
//   date, pnl, balance, positions_count
// }
```
**Endpoint**: `GET /portfolios/{address}/pnl`

#### `getUserHistory(userAddress: string): Promise<UserHistory>`
Get user trading history and stats
```typescript
const history = await dataClient.getUserHistory('0x123...');
// Returns: {
//   address, total_trades, win_rate, avg_pnl, total_pnl,
//   positions_opened, positions_closed, first_trade, last_trade
// }
```
**Endpoint**: `GET /users/{address}/history`

#### `getRecentTrades(params?): Promise<Activity[]>`
Get recent trades (global, paginated)
```typescript
const recent = await dataClient.getRecentTrades({
  limit: 50,
  offset: 0
});
```
**Endpoint**: `GET /activity`

#### `getTopTraders(params?): Promise<UserHistory[]>`
Get top traders by PnL
```typescript
const topTraders = await dataClient.getTopTraders({
  limit: 10,
  timeframe: '24h'  // or '7d', '30d', 'all'
});
```
**Endpoint**: `GET /users/top`

---

## Backend Route Handlers

### Markets Routes (`/api/markets`)
```
GET    /api/markets                 # List all markets
GET    /api/markets/:id             # Get market by ID
GET    /api/markets/trending        # Trending markets
GET    /api/markets/top             # Top markets
GET    /api/markets/search          # Search markets
GET    /api/markets/categories      # Get categories
GET    /api/markets/events          # Get events
GET    /api/markets/:id/stats       # Get market stats
```

### Trading Routes (`/api/trading`)
```
GET    /api/trading/orderbook/:assetId    # Get orderbook
GET    /api/trading/prices/:assetId       # Get price
GET    /api/trading/quotes                # Get quote
GET    /api/trading/orders/:orderId       # Get order
GET    /api/trading/orders                # Get user orders
POST   /api/trading/orders                # Create order
DELETE /api/trading/orders/:orderId       # Cancel order
GET    /api/trading/fills                 # Get fills
```

### Portfolio Routes (`/api/portfolio`)
```
GET    /api/portfolio/:address              # Get portfolio
GET    /api/portfolio/:address/positions    # Get positions
GET    /api/portfolio/:address/positions/:id # Get position
GET    /api/portfolio/:address/activity     # Get activity
GET    /api/portfolio/:address/pnl          # Get PnL history
GET    /api/portfolio/:address/history      # Get user history
```

---

## Frontend API Service

**File**: `src/app/services/api.ts`

### marketsApi
```typescript
marketsApi.listMarkets()           // GET /markets
marketsApi.getMarket(id)           // GET /markets/:id
marketsApi.getTrendingMarkets()    // GET /markets/trending
marketsApi.getTopMarkets()         // GET /markets/top
marketsApi.searchMarkets(q)        // GET /markets/search
marketsApi.getMarketStats(id)      // GET /markets/:id/stats
marketsApi.getCategories()         // GET /markets/categories
marketsApi.getEvents()             // GET /markets/events
```

### tradingApi
```typescript
tradingApi.getOrderBook(assetId)          // GET /trading/orderbook/:id
tradingApi.getPrice(assetId)              // GET /trading/prices/:id
tradingApi.getQuote(assetId, side, qty)   // GET /trading/quotes
tradingApi.getOpenOrders(userAddress)     // GET /trading/orders
tradingApi.getOrder(orderId)              // GET /trading/orders/:id
tradingApi.createOrder(order)             // POST /trading/orders
tradingApi.cancelOrder(orderId)           // DELETE /trading/orders/:id
tradingApi.getFills(userAddress)          // GET /trading/fills
```

### portfolioApi
```typescript
portfolioApi.getPortfolio(address)        // GET /portfolio/:address
portfolioApi.getPositions(address)        // GET /portfolio/:address/positions
portfolioApi.getPosition(address, id)     // GET /portfolio/:address/positions/:id
portfolioApi.getActivity(address)         // GET /portfolio/:address/activity
portfolioApi.getPnLHistory(address)       // GET /portfolio/:address/pnl
portfolioApi.getUserHistory(address)      // GET /portfolio/:address/history
```

---

## Error Handling

All client methods throw errors with detailed information:

```typescript
try {
  const markets = await gammaClient.listMarkets();
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('HTTP 404')) {
      // Market not found
    } else if (error.message.includes('timeout')) {
      // Request timed out
    } else {
      // Other error
      console.error('Error:', error.message);
    }
  }
}
```

### Error Properties
```typescript
interface ApiError extends Error {
  statusCode?: number;      // HTTP status code
  response?: unknown;       // Response body
  message: string;          // Error message
}
```

---

## Usage Examples

### Example 1: Get Trending Markets
```typescript
import { marketsApi } from '../services/api';

const Discover = () => {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await marketsApi.getTrendingMarkets('24h');
        setMarkets(data);
      } catch (error) {
        console.error('Failed to fetch markets:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div>Loading...</div>;
  return <div>{markets.map(m => <div key={m.id}>{m.title}</div>)}</div>;
};
```

### Example 2: Get Order Book
```typescript
import { tradingApi } from '../services/api';

const OrderBook = ({ assetId }) => {
  const [orderBook, setOrderBook] = useState(null);

  useEffect(() => {
    (async () => {
      const data = await tradingApi.getOrderBook(assetId);
      setOrderBook(data);
    })();
  }, [assetId]);

  return (
    <div>
      <div>Bid: {orderBook?.bids[0]?.price}</div>
      <div>Ask: {orderBook?.asks[0]?.price}</div>
    </div>
  );
};
```

### Example 3: Get User Portfolio
```typescript
import { portfolioApi } from '../services/api';

const Portfolio = ({ userAddress }) => {
  const [portfolio, setPortfolio] = useState(null);

  useEffect(() => {
    (async () => {
      const data = await portfolioApi.getPortfolio(userAddress);
      setPortfolio(data);
    })();
  }, [userAddress]);

  return (
    <div>
      <div>Balance: ${portfolio?.total_balance}</div>
      <div>PnL: ${portfolio?.total_pnl}</div>
      <div>Positions: {portfolio?.positions.length}</div>
    </div>
  );
};
```

---

## Response Types

### Market
```typescript
interface Market {
  id: string;
  slug: string;
  title: string;
  description: string;
  image?: string;
  active: boolean;
  closed: boolean;
  volume?: string;
  liquidityUSD?: number;
  probability?: string | number;
  lastPriceUsd?: string | number;
}
```

### Position
```typescript
interface Position {
  id: string;
  user: string;
  asset_id: string;
  market_id: string;
  quantity: string;
  entry_price: string;
  current_price: string;
  unrealized_pnl: string;
  side: "LONG" | "SHORT";
  opened_at: string;
}
```

### Order
```typescript
interface Order {
  id: string;
  user: string;
  asset_id: string;
  side: "BUY" | "SELL";
  quantity: string;
  price: string;
  status: "OPEN" | "FILLED" | "CANCELLED" | "PARTIAL_FILL";
  created_at: string;
}
```

---

**API Documentation Complete**  
For more details, see IMPLEMENTATION.md or inline code comments.
