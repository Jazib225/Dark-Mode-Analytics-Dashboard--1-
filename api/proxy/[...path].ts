import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_BASES: Record<string, string> = {
  gamma: 'https://gamma-api.polymarket.com',
  clob: 'https://clob.polymarket.com',
  data: 'https://data-api.polymarket.com',
};

// Simple proxy rotation for Vercel serverless functions
// Note: For production, consider using a proper proxy service
interface ProxyConfig {
  url: string;
  auth?: { username: string; password: string };
}

function getProxies(): ProxyConfig[] {
  const proxyList = process.env.PROXY_LIST;
  if (!proxyList) return [];

  return proxyList.split(',').map(proxy => {
    try {
      const url = new URL(proxy.trim());
      return {
        url: `${url.protocol}//${url.host}`,
        auth: url.username ? { username: url.username, password: url.password } : undefined,
      };
    } catch {
      return null;
    }
  }).filter((p): p is ProxyConfig => p !== null);
}

// Round-robin proxy selection
let proxyIndex = 0;
function getNextProxy(): ProxyConfig | null {
  const proxies = getProxies();
  if (proxies.length === 0) return null;
  const proxy = proxies[proxyIndex % proxies.length];
  proxyIndex++;
  return proxy;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get path segments: /api/proxy/gamma/markets -> ['gamma', 'markets']
    const pathSegments = req.query.path as string[];

    if (!pathSegments || pathSegments.length < 1) {
      return res.status(400).json({ error: 'Missing API path' });
    }

    const service = pathSegments[0]; // 'gamma', 'clob', or 'data'
    const apiPath = pathSegments.slice(1).join('/'); // 'markets', etc.

    const baseUrl = API_BASES[service];
    if (!baseUrl) {
      return res.status(400).json({ error: `Unknown service: ${service}` });
    }

    // Build query string from all query params except 'path'
    const queryParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'path' && typeof value === 'string') {
        queryParams[key] = value;
      }
    }
    const queryString = new URLSearchParams(queryParams).toString();

    // Build target URL exactly like local server
    let targetUrl = `${baseUrl}/${apiPath}`;
    if (queryString) {
      targetUrl += `?${queryString}`;
    }

    console.log(`Proxying to: ${targetUrl}`);

    // Get proxy if configured
    const proxy = getNextProxy();

    // Build headers
    const headers: HeadersInit = {
      'User-Agent': 'Polymarket-Dashboard/1.0',
      'Accept': 'application/json',
    };

    // Add proxy auth if needed (for some proxy setups in serverless)
    if (proxy?.auth) {
      headers['Proxy-Authorization'] = `Basic ${Buffer.from(`${proxy.auth.username}:${proxy.auth.password}`).toString('base64')}`;
    }

    // Note: Vercel's serverless functions don't support native proxy agents
    // For full proxy support in Vercel, you would need to:
    // 1. Use a proxy provider that supports API-based requests (like Bright Data's API)
    // 2. Or deploy to a platform that supports HTTP agents (like a VPS)
    // 3. Or use a proxy-as-a-service that accepts your request and forwards it

    const response = await fetch(targetUrl, {
      method: req.method || 'GET',
      headers,
    });

    if (!response.ok) {
      console.error(`API error: ${response.status} ${response.statusText}`);

      // Check for rate limiting
      if (response.status === 429) {
        return res.status(429).json({
          error: 'Rate limited by Polymarket API',
          message: 'Configure PROXY_LIST environment variable for proxy rotation',
          retryAfter: response.headers.get('retry-after') || '60',
        });
      }

      return res.status(response.status).json({
        error: `API returned ${response.status}`,
        url: targetUrl
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

