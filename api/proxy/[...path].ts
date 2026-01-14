import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_BASES: Record<string, string> = {
  gamma: 'https://gamma-api.polymarket.com',
  clob: 'https://clob.polymarket.com',
  data: 'https://data-api.polymarket.com',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers explicitly (backup to vercel.json)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

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

    // Build query string correctly handling arrays
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'path') {
        if (Array.isArray(value)) {
          value.forEach(v => queryParams.append(key, v));
        } else if (value !== undefined) {
          queryParams.append(key, value);
        }
      }
    }

    // Build target URL
    let targetUrl = `${baseUrl}/${apiPath}`;
    const queryString = queryParams.toString();
    if (queryString) {
      targetUrl += `?${queryString}`;
    }

    console.log(`[Proxy] Forwarding to: ${targetUrl}`);

    const headers: HeadersInit = {
      'User-Agent': 'Polymarket-Dashboard/1.0',
      'Accept': 'application/json',
    };

    const response = await fetch(targetUrl, {
      method: req.method || 'GET',
      headers,
    });

    if (!response.ok) {
      console.error(`[Proxy] API error: ${response.status} ${response.statusText} from ${targetUrl}`);

      // Pass through the error response if possible
      try {
        const errorData = await response.json();
        return res.status(response.status).json(errorData);
      } catch {
        return res.status(response.status).json({
          error: `Upstream API returned ${response.status}`,
          url: targetUrl
        });
      }
    }

    const data = await response.json();

    // Add cache headers for Vercel edge caching (30s fresh, 5m stale)
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');

    // Add ETag for conditional requests if not present
    if (!res.getHeader('ETag')) {
      const hash = Buffer.from(JSON.stringify(data).slice(0, 100)).toString('base64').slice(0, 16);
      res.setHeader('ETag', `"${hash}"`);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('[Proxy] Internal Handler Error:', error);
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
