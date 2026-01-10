/**
 * ProxyManager - Manages a pool of rotating proxies to bypass IP-based rate limiting
 * 
 * Supports multiple proxy providers:
 * - Datacenter proxies (fastest, cheapest, but may get blocked)
 * - Residential proxies (most reliable, looks like real users)
 * - Mobile proxies (best success rate, most expensive)
 * 
 * Usage:
 * 1. Set PROXY_LIST environment variable with comma-separated proxy URLs
 * 2. Or configure a proxy provider API (Bright Data, Oxylabs, SmartProxy, etc.)
 */

import { Agent } from 'http';
import { Agent as HttpsAgent } from 'https';

export interface ProxyConfig {
    host: string;
    port: number;
    auth?: {
        username: string;
        password: string;
    };
    protocol: 'http' | 'https' | 'socks5';
    type?: 'datacenter' | 'residential' | 'mobile';
    country?: string;
    lastUsed?: number;
    failCount?: number;
    successCount?: number;
    avgLatency?: number;
}

export interface ProxyStats {
    totalProxies: number;
    healthyProxies: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgLatency: number;
    rateLimitHits: number;
}

interface ProxyProviderConfig {
    provider: 'brightdata' | 'oxylabs' | 'smartproxy' | 'webshare' | 'custom';
    apiKey?: string;
    username?: string;
    password?: string;
    zone?: string;
    country?: string;
    sessionType?: 'rotating' | 'sticky';
}

/**
 * ProxyManager handles proxy rotation, health checking, and load balancing
 */
export class ProxyManager {
    private proxies: ProxyConfig[] = [];
    private currentIndex = 0;
    private stats: ProxyStats = {
        totalProxies: 0,
        healthyProxies: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgLatency: 0,
        rateLimitHits: 0,
    };

    // Proxy rotation settings
    private maxFailures = 3;
    private cooldownMs = 60000; // 1 minute cooldown for failed proxies
    private minDelayBetweenRequests = 100; // Minimum ms between requests to same proxy

    // Rate limiting awareness
    private rateLimitedProxies = new Map<string, number>(); // proxy -> timestamp until available

    constructor() {
        this.loadProxiesFromEnv();
    }

    /**
     * Load proxies from environment variables
     * Supports multiple formats:
     * - PROXY_LIST: comma-separated list of proxy URLs
     * - PROXY_PROVIDER: pre-configured provider (brightdata, oxylabs, etc.)
     */
    private loadProxiesFromEnv(): void {
        // Method 1: Direct proxy list
        const proxyList = process.env.PROXY_LIST;
        if (proxyList) {
            const urls = proxyList.split(',').map(s => s.trim()).filter(Boolean);
            for (const url of urls) {
                const proxy = this.parseProxyUrl(url);
                if (proxy) {
                    this.proxies.push(proxy);
                }
            }
            console.log(`📡 Loaded ${this.proxies.length} proxies from PROXY_LIST`);
        }

        // Method 2: Proxy provider configuration
        const provider = process.env.PROXY_PROVIDER as ProxyProviderConfig['provider'];
        if (provider) {
            this.configureProvider({
                provider,
                apiKey: process.env.PROXY_API_KEY,
                username: process.env.PROXY_USERNAME,
                password: process.env.PROXY_PASSWORD,
                zone: process.env.PROXY_ZONE,
                country: process.env.PROXY_COUNTRY || 'us',
                sessionType: (process.env.PROXY_SESSION_TYPE as 'rotating' | 'sticky') || 'rotating',
            });
        }

        this.stats.totalProxies = this.proxies.length;
        this.stats.healthyProxies = this.proxies.length;
    }

    /**
     * Parse a proxy URL into ProxyConfig
     * Supports formats:
     * - http://user:pass@host:port
     * - socks5://user:pass@host:port
     * - host:port:user:pass
     */
    private parseProxyUrl(url: string): ProxyConfig | null {
        try {
            // Format: protocol://user:pass@host:port
            if (url.includes('://')) {
                const parsed = new URL(url);
                return {
                    host: parsed.hostname,
                    port: parseInt(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80),
                    protocol: parsed.protocol.replace(':', '') as 'http' | 'https' | 'socks5',
                    auth: parsed.username ? {
                        username: decodeURIComponent(parsed.username),
                        password: decodeURIComponent(parsed.password || ''),
                    } : undefined,
                    failCount: 0,
                    successCount: 0,
                };
            }

            // Format: host:port:user:pass or host:port
            const parts = url.split(':');
            if (parts.length >= 2) {
                return {
                    host: parts[0],
                    port: parseInt(parts[1]),
                    protocol: 'http',
                    auth: parts.length >= 4 ? {
                        username: parts[2],
                        password: parts[3],
                    } : undefined,
                    failCount: 0,
                    successCount: 0,
                };
            }
        } catch (e) {
            console.error(`Failed to parse proxy URL: ${url}`, e);
        }
        return null;
    }

    /**
     * Configure a proxy provider with their specific endpoint format
     */
    private configureProvider(config: ProxyProviderConfig): void {
        switch (config.provider) {
            case 'brightdata':
                // Bright Data (formerly Luminati) rotating residential proxy
                // Format: brd-customer-CUSTOMER-zone-ZONE:PASSWORD@brd.superproxy.io:22225
                if (config.username && config.password && config.zone) {
                    this.proxies.push({
                        host: 'brd.superproxy.io',
                        port: 22225,
                        protocol: 'http',
                        auth: {
                            username: `brd-customer-${config.username}-zone-${config.zone}${config.country ? `-country-${config.country}` : ''}`,
                            password: config.password,
                        },
                        type: 'residential',
                        country: config.country,
                        failCount: 0,
                        successCount: 0,
                    });
                    console.log('📡 Configured Bright Data residential proxy');
                }
                break;

            case 'oxylabs':
                // Oxylabs rotating residential proxy
                // Format: customer-USER-cc-COUNTRY:PASSWORD@pr.oxylabs.io:7777
                if (config.username && config.password) {
                    this.proxies.push({
                        host: 'pr.oxylabs.io',
                        port: 7777,
                        protocol: 'http',
                        auth: {
                            username: `customer-${config.username}${config.country ? `-cc-${config.country}` : ''}`,
                            password: config.password,
                        },
                        type: 'residential',
                        country: config.country,
                        failCount: 0,
                        successCount: 0,
                    });
                    console.log('📡 Configured Oxylabs residential proxy');
                }
                break;

            case 'smartproxy':
                // SmartProxy rotating residential proxy
                // Format: user:pass@gate.smartproxy.com:7000
                if (config.username && config.password) {
                    this.proxies.push({
                        host: 'gate.smartproxy.com',
                        port: 7000,
                        protocol: 'http',
                        auth: {
                            username: config.username,
                            password: config.password,
                        },
                        type: 'residential',
                        country: config.country,
                        failCount: 0,
                        successCount: 0,
                    });
                    console.log('📡 Configured SmartProxy residential proxy');
                }
                break;

            case 'webshare':
                // Webshare.io proxy (affordable datacenter proxies)
                // API returns list of proxies
                if (config.apiKey) {
                    // For Webshare, we'd need to fetch the proxy list from their API
                    // This is a simplified version - in production you'd call their API
                    console.log('📡 Webshare configured - call loadWebshareProxies() to fetch list');
                }
                break;

            case 'custom':
                // Custom proxy - already loaded from PROXY_LIST
                break;
        }
    }

    /**
     * Add proxies dynamically (e.g., from a proxy provider API)
     */
    public addProxies(proxies: ProxyConfig[]): void {
        this.proxies.push(...proxies);
        this.stats.totalProxies = this.proxies.length;
        this.stats.healthyProxies = this.proxies.filter(p => (p.failCount || 0) < this.maxFailures).length;
    }

    /**
     * Get the next available proxy using round-robin with health checking
     */
    public getNextProxy(): ProxyConfig | null {
        if (this.proxies.length === 0) {
            return null; // No proxies configured - use direct connection
        }

        const now = Date.now();
        const startIndex = this.currentIndex;

        // Round-robin through proxies, skipping unhealthy ones
        do {
            const proxy = this.proxies[this.currentIndex];
            this.currentIndex = (this.currentIndex + 1) % this.proxies.length;

            const proxyKey = this.getProxyKey(proxy);

            // Check if proxy is rate limited
            const rateLimitUntil = this.rateLimitedProxies.get(proxyKey);
            if (rateLimitUntil && now < rateLimitUntil) {
                continue; // Skip rate limited proxy
            }

            // Check if proxy has too many failures
            if ((proxy.failCount || 0) >= this.maxFailures) {
                // Check if cooldown has passed
                if (proxy.lastUsed && now - proxy.lastUsed < this.cooldownMs) {
                    continue; // Still in cooldown
                }
                // Reset failure count after cooldown
                proxy.failCount = 0;
            }

            // Check minimum delay between requests to same proxy
            if (proxy.lastUsed && now - proxy.lastUsed < this.minDelayBetweenRequests) {
                continue; // Too soon
            }

            proxy.lastUsed = now;
            return proxy;

        } while (this.currentIndex !== startIndex);

        // All proxies are unavailable - return first one anyway
        console.warn('⚠️ All proxies are rate limited or failed, using first available');
        const proxy = this.proxies[0];
        proxy.lastUsed = now;
        return proxy;
    }

    /**
     * Get a random proxy (for concurrent requests)
     */
    public getRandomProxy(): ProxyConfig | null {
        if (this.proxies.length === 0) return null;

        const healthyProxies = this.proxies.filter(p =>
            (p.failCount || 0) < this.maxFailures &&
            !this.isRateLimited(p)
        );

        if (healthyProxies.length === 0) {
            // All proxies unhealthy - return random one anyway
            return this.proxies[Math.floor(Math.random() * this.proxies.length)];
        }

        return healthyProxies[Math.floor(Math.random() * healthyProxies.length)];
    }

    /**
     * Get multiple unique proxies for parallel requests
     */
    public getProxiesForBatch(count: number): ProxyConfig[] {
        if (this.proxies.length === 0) return [];

        const healthyProxies = this.proxies.filter(p =>
            (p.failCount || 0) < this.maxFailures &&
            !this.isRateLimited(p)
        );

        const availableProxies = healthyProxies.length > 0 ? healthyProxies : this.proxies;
        const result: ProxyConfig[] = [];

        // If we have fewer proxies than requested, we'll reuse them
        for (let i = 0; i < count; i++) {
            result.push(availableProxies[i % availableProxies.length]);
        }

        return result;
    }

    /**
     * Check if a proxy is currently rate limited
     */
    private isRateLimited(proxy: ProxyConfig): boolean {
        const rateLimitUntil = this.rateLimitedProxies.get(this.getProxyKey(proxy));
        return rateLimitUntil ? Date.now() < rateLimitUntil : false;
    }

    /**
     * Mark a proxy as successful
     */
    public markSuccess(proxy: ProxyConfig, latencyMs: number): void {
        proxy.successCount = (proxy.successCount || 0) + 1;
        proxy.avgLatency = proxy.avgLatency
            ? (proxy.avgLatency + latencyMs) / 2
            : latencyMs;

        // Clear rate limit if any
        this.rateLimitedProxies.delete(this.getProxyKey(proxy));

        this.stats.successfulRequests++;
        this.stats.totalRequests++;
        this.updateHealthyCount();
    }

    /**
     * Mark a proxy as failed
     */
    public markFailure(proxy: ProxyConfig, isRateLimit = false): void {
        proxy.failCount = (proxy.failCount || 0) + 1;
        this.stats.failedRequests++;
        this.stats.totalRequests++;

        if (isRateLimit) {
            this.stats.rateLimitHits++;
            // Rate limit this proxy for longer
            const backoffMs = Math.min(300000, 30000 * Math.pow(2, proxy.failCount || 1)); // 30s to 5min
            this.rateLimitedProxies.set(this.getProxyKey(proxy), Date.now() + backoffMs);
            console.warn(`🚫 Proxy ${proxy.host}:${proxy.port} rate limited for ${backoffMs / 1000}s`);
        }

        this.updateHealthyCount();
    }

    /**
     * Build proxy URL for use with fetch/request libraries
     */
    public getProxyUrl(proxy: ProxyConfig): string {
        const auth = proxy.auth
            ? `${encodeURIComponent(proxy.auth.username)}:${encodeURIComponent(proxy.auth.password)}@`
            : '';
        return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
    }

    /**
     * Get unique key for a proxy
     */
    private getProxyKey(proxy: ProxyConfig): string {
        return `${proxy.host}:${proxy.port}`;
    }

    /**
     * Update the healthy proxy count
     */
    private updateHealthyCount(): void {
        this.stats.healthyProxies = this.proxies.filter(p =>
            (p.failCount || 0) < this.maxFailures &&
            !this.isRateLimited(p)
        ).length;
    }

    /**
     * Get current stats
     */
    public getStats(): ProxyStats {
        return { ...this.stats };
    }

    /**
     * Check if proxies are configured
     */
    public hasProxies(): boolean {
        return this.proxies.length > 0;
    }

    /**
     * Get proxy count
     */
    public getProxyCount(): number {
        return this.proxies.length;
    }

    /**
     * Reset all proxy stats and cooldowns
     */
    public reset(): void {
        for (const proxy of this.proxies) {
            proxy.failCount = 0;
            proxy.successCount = 0;
            proxy.avgLatency = undefined;
            proxy.lastUsed = undefined;
        }
        this.rateLimitedProxies.clear();
        this.stats = {
            totalProxies: this.proxies.length,
            healthyProxies: this.proxies.length,
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            avgLatency: 0,
            rateLimitHits: 0,
        };
    }
}

// Singleton instance
export const proxyManager = new ProxyManager();

// Export for testing
export default ProxyManager;
