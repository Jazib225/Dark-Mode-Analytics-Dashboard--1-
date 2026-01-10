/**
 * TanStack Query Provider
 * 
 * Wraps the application with QueryClientProvider for data caching.
 * This enables the Stale-While-Revalidate pattern for instant loading.
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a single query client instance
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Default stale time: 60 seconds
            // Data is considered fresh and won't be refetched during this window
            staleTime: 60 * 1000,

            // Default garbage collection time: 5 minutes
            // Data remains in memory for instant back-navigation
            gcTime: 5 * 60 * 1000,

            // Retry failed requests 1 time
            retry: 1,

            // Don't refetch on window focus by default (can be overridden per query)
            refetchOnWindowFocus: false,

            // Don't refetch on reconnect automatically
            refetchOnReconnect: false,
        },
    },
});

// Export query client for use in prefetch functions
export { queryClient };

interface QueryProviderProps {
    children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}

export default QueryProvider;
