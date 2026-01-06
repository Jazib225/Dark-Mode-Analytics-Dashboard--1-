import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Debug URL parsing
  const url = new URL(req.url || '', `https://${req.headers.host}`);
  const pathParts = url.pathname.split('/').filter(Boolean);

  return res.status(200).json({
    url: req.url,
    host: req.headers.host,
    pathname: url.pathname,
    search: url.search,
    pathParts: pathParts,
    query: req.query,
    method: req.method,
    timestamp: new Date().toISOString()
  });
}