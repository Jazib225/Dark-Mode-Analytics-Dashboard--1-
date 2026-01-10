/**
 * Proxy-aware fetch utility with automatic retry and rotation
 * 
 * This module provides a fetch wrapper that:
 * - Automatically routes requests through rotating proxies
 * - Handles rate limiting with intelligent backoff
 * - Retries failed requests with different proxies
 * - Supports concurrent requests through different IPs
 */

import { proxyManager, ProxyConfig } from './ProxyManager';

// Types
export interface ProxyFetchOptions extends RequestInit {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    useProxy?: boolean;
    preferredProxy?: ProxyConfig;
    onProxySwitch?: (oldProxy: ProxyConfig | null, newProxy: ProxyConfig | null) => void;
}

export interface ProxyFetchResult<T = any> {
    data: T;
    proxy: ProxyConfig | null;
    latencyMs: number;
    retryCount: number;
}

// Constants
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;

// Rate limit detection patterns
const RATE_LIMIT_STATUS_CODES = [429, 503, 520, 521, 522, 523, 524];
const RATE_LIMIT_HEADERS = ['retry-after', 'x-ratelimit-remaining', 'x-rate-limit-remaining'];

/**
 * Build headers for proxy authentication
 */
function buildProxyHeaders(proxy: ProxyConfig | null): HeadersInit {
    const headers: HeadersInit = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
    };

    // Add proxy auth header if needed (for some proxy setups)
    if (proxy?.auth) {
        const authString = Buffer.from(`${proxy.auth.username}:${proxy.auth.password}`).toString('base64');
        headers['Proxy-Authorization'] = `Basic ${authString}`;
    }

    return headers;
}

/**
 * Create an abort controller with timeout
 */
function createTimeoutController(timeout: number): { controller: AbortController; timeoutId: ReturnType<typeof setTimeout> } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    return { controller, timeoutId };
}

/**
 * Check if response indicates rate limiting
 */
function isRateLimited(response: Response): boolean {
    // Check status code
    if (RATE_LIMIT_STATUS_CODES.includes(response.status)) {
        return true;
    }

    // Check headers
    for (const header of RATE_LIMIT_HEADERS) {
        const value = response.headers.get(header);
        if (value === '0' || (header === 'retry-after' && value)) {
            return true;
        }
    }

    return false;
}

/**
 * Parse retry-after header value
 */
function parseRetryAfter(response: Response): number {
    const retryAfter = response.headers.get('retry-after');
    if (!retryAfter) return DEFAULT_RETRY_DELAY;

    // Can be a number (seconds) or a date
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
        return seconds * 1000; // Convert to ms
    }

    // Try parsing as date
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
        return Math.max(0, date.getTime() - Date.now());
    }

    return DEFAULT_RETRY_DELAY;
}

/**
 * Make a fetch request through a proxy (if configured)
 * Node.js 18+ doesn't have built-in proxy support in fetch, so we use environment variables
 */
async function fetchThroughProxy(
    url: string,
    proxy: ProxyConfig | null,
    options: RequestInit
): Promise<Response> {
    // If proxy is configured, set environment variables for undici/Node fetch
    // Note: In production, you might want to use a proper proxy agent like https-proxy-agent
    if (proxy) {
        const proxyUrl = proxyManager.getProxyUrl(proxy);

        // For Node.js fetch, we need to use the global dispatcher
        // This is a simplified approach - in production, use https-proxy-agent or similar
        process.env.HTTP_PROXY = proxyUrl;
        process.env.HTTPS_PROXY = proxyUrl;
        process.env.http_proxy = proxyUrl;
        process.env.https_proxy = proxyUrl;
    }

    try {
        const response = await fetch(url, options);
        return response;
    } finally {
        // Clean up proxy env vars
        if (proxy) {
            delete process.env.HTTP_PROXY;
            delete process.env.HTTPS_PROXY;
            delete process.env.http_proxy;
            delete process.env.https_proxy;
        }
    }
}

/**
 * Main proxy-aware fetch function with automatic retry and rotation
 */
export async function proxyFetch<T = any>(
    url: string,
    options: ProxyFetchOptions = {}
): Promise<ProxyFetchResult<T>> {
    const {
        timeout = DEFAULT_TIMEOUT,
        retries = DEFAULT_RETRIES,
        retryDelay = DEFAULT_RETRY_DELAY,
        useProxy = true,
        preferredProxy,
        onProxySwitch,
        ...fetchOptions
    } = options;

    let lastError: Error | null = null;
    let retryCount = 0;
    let currentProxy = preferredProxy || (useProxy && proxyManager.hasProxies() ? proxyManager.getNextProxy() : null);

    for (let attempt = 0; attempt <= retries; attempt++) {
        const startTime = Date.now();
        const { controller, timeoutId } = createTimeoutController(timeout);

        try {
            // Build request options
            const requestOptions: RequestInit = {
                ...fetchOptions,
                signal: controller.signal,
                headers: {
                    ...buildProxyHeaders(currentProxy),
                    ...(fetchOptions.headers as Record<string, string> || {}),
                },
            };

            // Make the request
            const response = await fetchThroughProxy(url, currentProxy, requestOptions);
            clearTimeout(timeoutId);
            const latencyMs = Date.now() - startTime;

            // Check for rate limiting
            if (isRateLimited(response)) {
                if (currentProxy) {
                    proxyManager.markFailure(currentProxy, true);
                }

                // If we have more retries, try a different proxy
                if (attempt < retries) {
                    const waitTime = parseRetryAfter(response);
                    console.warn(`Rate limited on ${url}, waiting ${waitTime}ms before retry with different proxy`);

                    await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 5000)));

                    const oldProxy = currentProxy;
                    currentProxy = proxyManager.getNextProxy();
                    onProxySwitch?.(oldProxy, currentProxy);
                    retryCount++;
                    continue;
                }

                throw new Error(`Rate limited after ${retries + 1} attempts: ${response.status}`);
            }

            // Check for other errors
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Success - mark proxy as successful
            if (currentProxy) {
                proxyManager.markSuccess(currentProxy, latencyMs);
            }

            // Parse response
            const data = await response.json() as T;

            return {
                data,
                proxy: currentProxy,
                latencyMs,
                retryCount,
            };

        } catch (error) {
            clearTimeout(timeoutId);
            lastError = error instanceof Error ? error : new Error(String(error));

            // Log the error
            const proxyInfo = currentProxy ? `via ${currentProxy.host}:${currentProxy.port}` : 'direct';
            console.error(`Fetch failed (${proxyInfo}): ${lastError.message}`);

            // Mark proxy as failed (but not rate limited)
            if (currentProxy && !lastError.message.includes('aborted')) {
                proxyManager.markFailure(currentProxy, false);
            }

            // If we have more retries, try again
            if (attempt < retries) {
                const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
                console.log(`Retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1})`);

                await new Promise(resolve => setTimeout(resolve, delay));

                const oldProxy = currentProxy;
                currentProxy = proxyManager.getNextProxy();
                onProxySwitch?.(oldProxy, currentProxy);
                retryCount++;
            }
        }
    }

    throw lastError || new Error('Fetch failed after all retries');
}

/**
 * Fetch multiple URLs concurrently through different proxies
 * This is the key function for fast parallel scraping
 */
export async function proxyFetchBatch<T = any>(
    urls: string[],
    options: Omit<ProxyFetchOptions, 'preferredProxy'> & {
        maxConcurrent?: number;
        onProgress?: (completed: number, total: number, url: string, success: boolean) => void;
    } = {}
): Promise<Map<string, ProxyFetchResult<T> | Error>> {
    const {
        maxConcurrent = 10,
        onProgress,
        ...fetchOptions
    } = options;

    const results = new Map<string, ProxyFetchResult<T> | Error>();

    // Get proxies for the batch
    const proxies = proxyManager.getProxiesForBatch(Math.min(maxConcurrent, urls.length));

    // Process in batches to control concurrency
    let completed = 0;

    async function fetchUrl(url: string, proxyIndex: number): Promise<void> {
        const proxy = proxies.length > 0 ? proxies[proxyIndex % proxies.length] : null;

        try {
            const result = await proxyFetch<T>(url, {
                ...fetchOptions,
                preferredProxy: proxy || undefined,
                useProxy: proxies.length > 0,
            });
            results.set(url, result);
            completed++;
            onProgress?.(completed, urls.length, url, true);
        } catch (error) {
            results.set(url, error instanceof Error ? error : new Error(String(error)));
            completed++;
            onProgress?.(completed, urls.length, url, false);
        }
    }

    // Process URLs in batches
    for (let i = 0; i < urls.length; i += maxConcurrent) {
        const batch = urls.slice(i, i + maxConcurrent);
        await Promise.all(batch.map((url, index) => fetchUrl(url, i + index)));
    }

    return results;
}

/**
 * Fetch with automatic pagination support
 * Useful for scraping all pages of market data
 */
export async function proxyFetchAllPages<T = any>(
    baseUrl: string,
    options: ProxyFetchOptions & {
        pageSize?: number;
        maxPages?: number;
        offsetParam?: string;
        limitParam?: string;
        getNextOffset?: (response: T, currentOffset: number, pageSize: number) => number | null;
        extractItems?: (response: T) => any[];
        onPage?: (pageNum: number, items: any[]) => void;
    } = {}
): Promise<any[]> {
    const {
        pageSize = 500,
        maxPages = 100,
        offsetParam = 'offset',
        limitParam = 'limit',
        getNextOffset = (_, offset, size) => offset + size,
        extractItems = (response: any) => Array.isArray(response) ? response : (response?.data || response?.markets || response?.events || []),
        onPage,
        ...fetchOptions
    } = options;

    const allItems: any[] = [];
    let offset = 0;
    let pageNum = 0;

    while (pageNum < maxPages) {
        // Build URL with pagination params
        const url = new URL(baseUrl);
        url.searchParams.set(offsetParam, String(offset));
        url.searchParams.set(limitParam, String(pageSize));

        try {
            const result = await proxyFetch<T>(url.toString(), fetchOptions);
            const items = extractItems(result.data);

            if (!items || items.length === 0) {
                console.log(`Pagination complete: no more items at offset ${offset}`);
                break;
            }

            allItems.push(...items);
            onPage?.(pageNum, items);
            console.log(`Page ${pageNum + 1}: fetched ${items.length} items (total: ${allItems.length})`);

            // Calculate next offset
            const nextOffset = getNextOffset(result.data, offset, pageSize);
            if (nextOffset === null || nextOffset === offset) {
                break;
            }

            offset = nextOffset;
            pageNum++;

            // Small delay between pages to be respectful
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
            console.error(`Failed to fetch page ${pageNum + 1} at offset ${offset}:`, error);
            break;
        }
    }

    return allItems;
}

/**
 * Wrapper for Polymarket API calls with built-in proxy support
 */
export const polymarketProxyFetch = {
    gamma: <T = any>(path: string, params?: Record<string, string>, options?: ProxyFetchOptions) => {
        const url = new URL(`https://gamma-api.polymarket.com${path}`);
        if (params) {
            Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
        }
        return proxyFetch<T>(url.toString(), options);
    },

    clob: <T = any>(path: string, params?: Record<string, string>, options?: ProxyFetchOptions) => {
        const url = new URL(`https://clob.polymarket.com${path}`);
        if (params) {
            Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
        }
        return proxyFetch<T>(url.toString(), options);
    },

    data: <T = any>(path: string, params?: Record<string, string>, options?: ProxyFetchOptions) => {
        const url = new URL(`https://data-api.polymarket.com${path}`);
        if (params) {
            Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
        }
        return proxyFetch<T>(url.toString(), options);
    },
};

export default proxyFetch;
