/**
 * API request utility with retry logic, timeout, and error handling
 */
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second
/**
 * Validates that required parameters are present
 */
export function validateRequired(params, required) {
    for (const key of required) {
        if (!params[key]) {
            throw new Error(`Missing required parameter: ${key}`);
        }
    }
}
/**
 * Creates a fetch request with timeout
 */
async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            method: options.method,
            headers: options.headers,
            body: options.body,
            signal: controller.signal,
        });
        return response;
    }
    finally {
        clearTimeout(timeoutId);
    }
}
/**
 * Main API request handler with retry logic
 */
export async function apiRequest(url, options = {}) {
    const { timeout = DEFAULT_TIMEOUT, retries = DEFAULT_RETRIES, retryDelay = DEFAULT_RETRY_DELAY, method = "GET", headers = {}, body, } = options;
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetchWithTimeout(url, { method, headers, body }, timeout);
            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                error.statusCode = response.status;
                try {
                    error.response = await response.json();
                }
                catch {
                    error.response = await response.text();
                }
                // Don't retry non-idempotent methods or 4xx errors (except 429)
                if (method && method !== "GET" && response.status !== 429) {
                    throw error;
                }
                // Don't retry 4xx errors except rate limit (429)
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    throw error;
                }
                lastError = error;
            }
            else {
                const data = await response.json();
                return data;
            }
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            // If this is the last attempt or a non-retriable error, throw
            if (attempt === retries) {
                throw lastError;
            }
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
    }
    throw lastError || new Error("API request failed");
}
/**
 * Safe request wrapper for idempotent GET requests
 */
export async function safeGet(url, options = {}) {
    return apiRequest(url, {
        ...options,
        method: "GET",
    });
}
/**
 * POST request (not retried by default)
 */
export async function safePost(url, body, options = {}) {
    return apiRequest(url, {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        retries: 0, // Don't retry POST by default
    });
}
/**
 * DELETE request (not retried by default)
 */
export async function safeDelete(url, options = {}) {
    return apiRequest(url, {
        ...options,
        method: "DELETE",
        retries: 0, // Don't retry DELETE by default
    });
}
