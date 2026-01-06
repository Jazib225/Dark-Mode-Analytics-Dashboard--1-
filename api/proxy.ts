import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_BASES: Record<string, string> = {
  gamma: 'https://gamma-api.polymarket.com',
  clob: 'https://clob.polymarket.com',
  data: 'https://data-api.polymarket.com',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Parse the URL path: /api/proxy/gamma/markets -> service=gamma, apiPath=markets
    const url = new URL(req.url || '', `https://${req.headers.host}`);
    const pathParts = url.pathname.split('/').filter(Boolean); // ['api', 'proxy', 'gamma', 'markets']
    
    if (pathParts.length < 3) {
      return res.status(400).json({ error: 'Invalid path format. Expected: /api/proxy/service/path' });
    }
    
    const service = pathParts[2]; // 'gamma'
    const apiPath = pathParts.slice(3).join('/'); // 'markets'
    
    const baseUrl = API_BASES[service];
    if (!baseUrl) {
      return res.status(400).json({ error: `Unknown service: ${service}` });
    }

    // Build target URL with query string
    let targetUrl = `${baseUrl}/${apiPath}`;
    if (url.search) {
      targetUrl += url.search;
    }
    
    console.log(`Proxying to: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: req.method || 'GET',
      headers: {
        'User-Agent': 'Polymarket-Dashboard/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`API error: ${response.status} ${response.statusText}`);
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