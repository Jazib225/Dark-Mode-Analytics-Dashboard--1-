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
    // Get path segments: /api/proxy/gamma/markets -> ['gamma', 'markets']
    const pathSegments = req.query.path as string[];
    
    if (!pathSegments || pathSegments.length < 1) {
      return res.status(400).json({ error: 'Missing API path' });
    }

    const service = pathSegments[0]; // 'gamma', 'clob', or 'data'
    const apiPath = '/' + pathSegments.slice(1).join('/'); // '/markets', etc.
    
    const baseUrl = API_BASES[service];
    if (!baseUrl) {
      return res.status(400).json({ error: `Unknown service: ${service}` });
    }

    // Build the target URL with query parameters
    const queryString = req.url?.includes('?') 
      ? '?' + req.url.split('?')[1].replace(/path=[^&]+&?/, '').replace(/&$/, '')
      : '';
    
    const targetUrl = `${baseUrl}${apiPath}${queryString}`;
    
    console.log(`Proxying to: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: req.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
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
