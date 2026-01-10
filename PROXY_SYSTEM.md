# Proxy System Documentation

## Overview

This project includes a robust proxy rotation system designed to bypass IP-based rate limiting when scraping Polymarket data. Without proxies, fetching all 23,000+ markets can trigger rate limits. With proxies, you can distribute requests across multiple IPs for faster, more reliable scraping.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend (React)                               │
│  polymarketApi.ts - Requests go through backend proxy                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Backend (Express)                              │
│  /api/proxy/:service/* - Routes requests through ProxyManager           │
│  /api/bulk/markets - Batch fetch with proxy rotation                    │
│  /api/proxy/stats - Monitor proxy health                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                     ┌──────────────┼──────────────┐
                     ▼              ▼              ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │ Proxy 1  │  │ Proxy 2  │  │ Proxy N  │
              └──────────┘  └──────────┘  └──────────┘
                     │              │              │
                     └──────────────┼──────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Polymarket APIs                                   │
│  gamma-api.polymarket.com - Market discovery, metadata                  │
│  clob.polymarket.com - Order books, trading                             │
│  data-api.polymarket.com - Historical data, portfolios                  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. ProxyManager (`src/server/proxy/ProxyManager.ts`)

Manages a pool of rotating proxies with:

- **Round-robin rotation** - Distributes requests evenly
- **Health tracking** - Marks failed proxies for cooldown
- **Rate limit detection** - Backs off rate-limited proxies
- **Provider support** - Works with Bright Data, Oxylabs, SmartProxy, etc.

```typescript
import { proxyManager } from './proxy/ProxyManager';

// Get next available proxy
const proxy = proxyManager.getNextProxy();

// Mark proxy success/failure
proxyManager.markSuccess(proxy, latencyMs);
proxyManager.markFailure(proxy, isRateLimit);

// Check stats
const stats = proxyManager.getStats();
```

### 2. proxyFetch (`src/server/proxy/proxyFetch.ts`)

Proxy-aware fetch wrapper with:

- **Automatic retry** - Retries failed requests with different proxies
- **Rate limit handling** - Detects 429 status and rotates proxies
- **Batch fetching** - Concurrent requests through multiple proxies
- **Pagination support** - Fetches all pages automatically

```typescript
import { proxyFetch, proxyFetchBatch, proxyFetchAllPages } from './proxy/proxyFetch';

// Single request
const result = await proxyFetch('https://gamma-api.polymarket.com/markets');

// Batch requests (concurrent)
const results = await proxyFetchBatch(urls, { maxConcurrent: 10 });

// Paginated fetch (all pages)
const allItems = await proxyFetchAllPages('https://gamma-api.polymarket.com/events');
```

### 3. MarketScraper (`src/server/proxy/MarketScraper.ts`)

High-level scraping utilities:

- **fetchAllMarketsFromEvents** - Scrapes all markets efficiently
- **fetchMarketDetails** - Enriches market data concurrently
- **streamAllMarkets** - Memory-efficient streaming generator
- **benchmarkProxies** - Test proxy performance

```typescript
import { fetchAllMarketsFromEvents, benchmarkProxies } from './proxy/MarketScraper';

// Scrape all markets
const markets = await fetchAllMarketsFromEvents({
  activeOnly: true,
  onProgress: (progress) => console.log(progress),
});

// Benchmark proxies
const benchmark = await benchmarkProxies(10);
console.log(`Avg latency: ${benchmark.avgLatency}ms`);
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Option 1: Direct proxy list
PROXY_LIST=http://user:pass@proxy1.com:8080,http://user:pass@proxy2.com:8080

# Option 2: Proxy provider (Bright Data example)
PROXY_PROVIDER=brightdata
PROXY_USERNAME=brd-customer-XXXXX
PROXY_PASSWORD=your_password
PROXY_ZONE=residential
PROXY_COUNTRY=us
```

### Supported Providers

| Provider | Type | Price | Setup |
|----------|------|-------|-------|
| Bright Data | Residential | ~$15-25/GB | `PROXY_PROVIDER=brightdata` |
| Oxylabs | Residential | ~$15/GB | `PROXY_PROVIDER=oxylabs` |
| SmartProxy | Residential | ~$12.5/GB | `PROXY_PROVIDER=smartproxy` |
| Webshare.io | Datacenter | ~$0.05/proxy/mo | `PROXY_PROVIDER=webshare` |

## API Endpoints

### GET `/api/proxy/:service/*`

Proxies requests to Polymarket APIs through rotating proxies.

```bash
# Example: Fetch markets
curl http://localhost:3001/api/proxy/gamma/markets?limit=100
```

### GET `/api/bulk/markets`

Fetches all markets using optimized batch scraping.

```bash
curl http://localhost:3001/api/bulk/markets
```

Response:

```json
{
  "success": true,
  "data": {
    "markets": [...],
    "count": 23456,
    "durationMs": 45000,
    "proxyStats": {
      "totalRequests": 150,
      "successfulRequests": 147,
      "failedRequests": 3,
      "rateLimitHits": 1
    }
  }
}
```

### GET `/api/proxy/stats`

Returns current proxy health statistics.

```bash
curl http://localhost:3001/api/proxy/stats
```

Response:

```json
{
  "success": true,
  "data": {
    "hasProxies": true,
    "proxyCount": 5,
    "totalRequests": 1000,
    "successfulRequests": 980,
    "failedRequests": 20,
    "avgLatency": 250,
    "rateLimitHits": 5,
    "healthyProxies": 4
  }
}
```

## Performance Comparison

| Configuration | Time to fetch all markets | Success Rate |
|---------------|---------------------------|--------------|
| No proxies | 2-4 hours (with rate limits) | ~60% |
| 1 proxy | ~30 minutes | ~85% |
| 5 proxies | ~10 minutes | ~95% |
| 10+ proxies | ~3-5 minutes | ~99% |

## Best Practices

1. **Start with fewer proxies** - Begin with 3-5 proxies and scale up based on success rate

2. **Use residential proxies for production** - Datacenter proxies may get blocked

3. **Monitor proxy stats** - Check `/api/proxy/stats` regularly

4. **Implement caching** - Don't re-fetch data unnecessarily (use MarketCache)

5. **Respect rate limits** - Even with proxies, add small delays between requests

6. **Handle failures gracefully** - Always have fallback logic for when all proxies fail

## Troubleshooting

### All proxies failing

- Check proxy credentials
- Try different proxy provider
- Check if Polymarket is blocking your proxy's IP range

### Still getting rate limited

- Reduce concurrent requests
- Increase delay between requests
- Use more proxies

### Slow performance

- Check proxy latency with `benchmarkProxies()`
- Try proxies in regions closer to Polymarket servers (US)
- Reduce retry count for faster failures

## Vercel Deployment

For Vercel serverless functions, proxy support is limited because:

1. Vercel doesn't support custom HTTP agents
2. Environment variables work but native proxy routing doesn't

Workarounds:

1. Use a proxy provider's REST API (like Bright Data's SERP API)
2. Deploy backend to a VPS instead of Vercel
3. Use Vercel Edge Functions with fetch (no proxy needed from edge locations)

## Security Notes

- Never commit proxy credentials to git
- Use environment variables for all sensitive data
- Rotate proxy credentials regularly
- Monitor for unusual usage patterns
