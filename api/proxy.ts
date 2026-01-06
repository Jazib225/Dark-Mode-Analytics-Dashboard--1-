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
    // Get service and path from query parameters
    const service = req.query.service as string;
    const path = req.query.path as string;
    
    if (!service || !path) {
      return res.status(400).json({ 
        error: 'Missing required parameters. Use: ?service=gamma&path=/markets&other=params' 
      });
    }
    
    const baseUrl = API_BASES[service];
    if (!baseUrl) {
      return res.status(400).json({ error: `Unknown service: ${service}` });
    }

    // Build query string from remaining parameters (excluding service and path)
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'service' && key !== 'path' && typeof value === 'string') {
        queryParams.append(key, value);
      }
    }
    
    // Build target URL
    let targetUrl = `${baseUrl}${path}`;
    const queryString = queryParams.toString();
    if (queryString) {
      targetUrl += `?${queryString}`;
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