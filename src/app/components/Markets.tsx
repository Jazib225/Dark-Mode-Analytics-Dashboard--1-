import { useState, useEffect, useCallback } from "react";
import { Bookmark, Clock, Loader2 } from "lucide-react";
import { BookmarkedMarket } from "../App";
import { MarketDetail } from "./MarketDetail";
import { getTrendingMarkets } from "../services/polymarketApi";

interface MarketsProps {
  toggleBookmark: (market: BookmarkedMarket) => void;
  isBookmarked: (marketId: string) => boolean;
  onWalletClick?: (address: string) => void;
  initialMarketId?: string | null;
  initialMarketData?: {
    id: string;
    name: string;
    probability: number;
    volume: string;
  } | null;
}

interface DisplayMarket {
  id: string;
  title?: string;
  name?: string;
  probability?: number | string;
  volume?: string;
  volumeUsd?: string;
  volumeNum?: number;
}

interface SearchHistoryItem {
  id: string;
  name: string;
  probability: number;
  volume: string;
  timestamp: number;
}

type TimeFilter = "24h" | "7d" | "1m";

// Global cache for all markets (to enable fast search)
let cachedAllMarkets: DisplayMarket[] = [];
let cacheTimeFilter: TimeFilter | null = null;

// LocalStorage cache keys - separate cache per timeFilter for instant switching
const MARKETS_CACHE_PREFIX = "polymarket_markets_";
const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes - longer cache for faster loads

interface CachedData {
  markets: DisplayMarket[];
  timestamp: number;
}

// Load cached markets from localStorage for specific timeFilter
function loadCachedMarkets(timeFilter: TimeFilter): DisplayMarket[] | null {
  try {
    const cached = localStorage.getItem(MARKETS_CACHE_PREFIX + timeFilter);
    if (cached) {
      const data: CachedData = JSON.parse(cached);
      // Check if cache is not expired
      if (Date.now() - data.timestamp < CACHE_EXPIRY_MS) {
        return data.markets;
      }
    }
  } catch (e) {
    console.error("Failed to load cached markets:", e);
  }
  return null;
}

// Save markets to localStorage cache for specific timeFilter
function saveCachedMarkets(markets: DisplayMarket[], timeFilter: TimeFilter): void {
  try {
    const data: CachedData = {
      markets,
      timestamp: Date.now(),
    };
    localStorage.setItem(MARKETS_CACHE_PREFIX + timeFilter, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save markets cache:", e);
  }
}

function convertApiMarketToDisplay(market: any, timeframe: TimeFilter = "24h"): DisplayMarket {
  let volumeUsd = market.volumeUsd;
  if (timeframe === "24h") {
    volumeUsd = market.volume24hr || market.volumeUsd;
  } else if (timeframe === "7d") {
    volumeUsd = market.volume7d || market.volumeUsd;
  } else if (timeframe === "1m") {
    volumeUsd = market.volume1mo || market.volumeUsd;
  }
  
  return {
    id: market.id,
    name: market.title || market.name,
    title: market.title || market.name,
    probability: market.lastPriceUsd
      ? (parseFloat(String(market.lastPriceUsd)) * 100).toFixed(1)
      : market.probability,
    volumeUsd: String(volumeUsd),
    volume: formatVolume(parseFloat(String(volumeUsd || 0))),
  };
}

function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `$${(volume / 1000000).toFixed(2)}M`;
  } else if (volume >= 1000) {
    return `$${(volume / 1000).toFixed(2)}K`;
  }
  return `$${volume.toFixed(2)}`;
}

// Constants for pagination
const INITIAL_LOAD = 15;
const LOAD_MORE_COUNT = 15;

export function Markets({ toggleBookmark, isBookmarked, onWalletClick, initialMarketId, initialMarketData }: MarketsProps) {
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(initialMarketId || null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("24h");
  
  // Initialize with cached data if available for instant load
  const [allMarkets, setAllMarkets] = useState<DisplayMarket[]>(() => {
    const cached = loadCachedMarkets("24h");
    if (cached) {
      cachedAllMarkets = cached;
      cacheTimeFilter = "24h";
      return cached;
    }
    return [];
  });
  const [displayedCount, setDisplayedCount] = useState(INITIAL_LOAD);
  const [loading, setLoading] = useState(() => {
    // Only show loading if no cached data
    return loadCachedMarkets("24h") === null;
  });
  const [isRefreshing, setIsRefreshing] = useState(false); // Background refresh indicator
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Recently viewed state (for table clicks)
  const [recentlyViewed, setRecentlyViewed] = useState<SearchHistoryItem[]>([]);

  // Load recently viewed from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("polymarket_recently_viewed");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRecentlyViewed(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load recently viewed:", e);
    }
  }, []);

  // Save recently viewed to localStorage whenever it changes
  useEffect(() => {
    if (recentlyViewed.length > 0) {
      localStorage.setItem("polymarket_recently_viewed", JSON.stringify(recentlyViewed));
    }
  }, [recentlyViewed]);

  // Add market to recently viewed (only from table clicks)
  const addToRecentlyViewed = useCallback((market: DisplayMarket) => {
    const historyItem: SearchHistoryItem = {
      id: market.id,
      name: market.name || market.title || "Unknown",
      probability: Number(market.probability) || 0,
      volume: market.volume || "$0",
      timestamp: Date.now(),
    };
    
    setRecentlyViewed(prev => {
      const filtered = prev.filter(item => item.id !== market.id);
      const newHistory = [historyItem, ...filtered].slice(0, 5); // Keep only 5 most recent
      // Immediately save to localStorage
      localStorage.setItem("polymarket_recently_viewed", JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  // Clear recently viewed
  const clearRecentlyViewed = () => {
    setRecentlyViewed([]);
    localStorage.removeItem("polymarket_recently_viewed");
  };

  // Handle clicking on a market from the table
  const handleTableMarketClick = (market: DisplayMarket) => {
    addToRecentlyViewed(market);
    setSelectedMarketId(market.id);
  };

  // Handle clicking on a recently viewed market
  const handleRecentlyViewedClick = (item: SearchHistoryItem) => {
    setSelectedMarketId(item.id);
  };

  // Fetch markets with cache-first strategy
  useEffect(() => {
    const fetchMarkets = async () => {
      // Check for cached data first
      const cached = loadCachedMarkets(timeFilter);
      
      if (cached && cached.length > 0) {
        // Use cached data immediately (no loading state)
        setAllMarkets(cached);
        cachedAllMarkets = cached;
        cacheTimeFilter = timeFilter;
        setLoading(false);
        setDisplayedCount(INITIAL_LOAD);
        
        // Refresh in background
        setIsRefreshing(true);
      } else {
        // No cache - show loading
        setLoading(true);
        setDisplayedCount(INITIAL_LOAD);
      }
      
      setError(null);
      
      try {
        const data = await getTrendingMarkets(timeFilter);
        
        if (!Array.isArray(data)) {
          throw new Error("Invalid data format");
        }
        
        const displayMarkets = data
          .filter((m: any) => m && m.title)
          .map((m: any) => convertApiMarketToDisplay(m, timeFilter));
        
        setAllMarkets(displayMarkets);
        
        // Update memory cache for search
        cachedAllMarkets = displayMarkets;
        cacheTimeFilter = timeFilter;
        
        // Save to localStorage cache
        saveCachedMarkets(displayMarkets, timeFilter);
        
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch markets";
        console.error("Error fetching markets:", message);
        // Only show error if we don't have cached data
        if (!cached || cached.length === 0) {
          setError(message);
          setAllMarkets([]);
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    };

    fetchMarkets();
  }, [timeFilter]);

  // Prefetch other time filters in background for instant switching
  useEffect(() => {
    const prefetchOtherFilters = async () => {
      const filters: TimeFilter[] = ["24h", "7d", "1m"];
      const otherFilters = filters.filter(f => f !== timeFilter);
      
      for (const filter of otherFilters) {
        // Skip if already cached
        if (loadCachedMarkets(filter)) continue;
        
        try {
          const data = await getTrendingMarkets(filter);
          if (Array.isArray(data)) {
            const displayMarkets = data
              .filter((m: any) => m && m.title)
              .map((m: any) => convertApiMarketToDisplay(m, filter));
            saveCachedMarkets(displayMarkets, filter);
          }
        } catch (e) {
          // Silent fail for prefetch
        }
      }
    };

    // Prefetch after initial load completes (with delay to not block main fetch)
    const prefetchTimeout = setTimeout(prefetchOtherFilters, 2000);
    return () => clearTimeout(prefetchTimeout);
  }, []);

  // Load more markets handler
  const handleLoadMore = () => {
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayedCount(prev => Math.min(prev + LOAD_MORE_COUNT, allMarkets.length));
      setLoadingMore(false);
    }, 200);
  };

  // Get markets to display (paginated)
  const displayedMarkets = allMarkets.slice(0, displayedCount);
  const hasMoreMarkets = displayedCount < allMarkets.length;

  // Show market detail if selected
  if (selectedMarketId) {
    // Use initialMarketData if it matches, otherwise find from allMarkets
    let selectedMarket: DisplayMarket | undefined;
    
    if (initialMarketData && initialMarketData.id === selectedMarketId) {
      selectedMarket = {
        id: initialMarketData.id,
        name: initialMarketData.name,
        probability: initialMarketData.probability,
        volume: initialMarketData.volume,
      };
    } else {
      selectedMarket = allMarkets.find((m) => m.id === selectedMarketId);
    }
    
    if (selectedMarket) {
      return (
        <MarketDetail
          market={{
            id: selectedMarket.id,
            name: selectedMarket.name || selectedMarket.title || "Unknown",
            probability: Number(selectedMarket.probability) || 0,
            volume: selectedMarket.volume || "$0",
          }}
          isBookmarked={isBookmarked(selectedMarketId)}
          toggleBookmark={() =>
            toggleBookmark({
              id: selectedMarket!.id,
              name: selectedMarket!.name || selectedMarket!.title || "Unknown",
              probability: Number(selectedMarket!.probability) || 0,
            })
          }
          onBack={() => setSelectedMarketId(null)}
          onWalletClick={onWalletClick}
        />
      );
    }
  }

  return (
    <div className="max-w-[1800px] mx-auto space-y-8">
      {/* Recently Viewed Markets - Only from table clicks */}
      {recentlyViewed.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-light tracking-tight text-gray-400 uppercase flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recently Viewed
            </h3>
            <button
              onClick={clearRecentlyViewed}
              className="text-[14px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              Clear all
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {recentlyViewed.slice(0, 5).map((item) => (
              <div
                key={item.id}
                onClick={() => handleRecentlyViewedClick(item)}
                className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-lg p-3 hover:border-gray-700/50 cursor-pointer transition-all group"
              >
                <div className="text-[15px] text-gray-200 truncate mb-2 group-hover:text-gray-100 transition-colors">
                  {item.name}
                </div>
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-[#4a6fa5] font-medium">{item.probability}%</span>
                  <span className="text-green-500">{item.volume}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trending Markets */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[19px] font-light tracking-tight text-gray-200 uppercase">
              Trending Markets
            </h2>
            {isRefreshing && (
              <div className="flex items-center gap-1.5 text-[14px] text-gray-500">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Updating...</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTimeFilter("24h")}
              className={`px-4 py-1.5 text-[14px] font-light tracking-wide rounded transition-all ${
                timeFilter === "24h"
                  ? "bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 text-gray-200 shadow-sm"
                  : "bg-transparent border border-gray-800/30 text-gray-400 hover:text-gray-300 hover:border-gray-700/50"
              }`}
            >
              24H
            </button>
            <button
              onClick={() => setTimeFilter("7d")}
              className={`px-4 py-1.5 text-[14px] font-light tracking-wide rounded transition-all ${
                timeFilter === "7d"
                  ? "bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 text-gray-200 shadow-sm"
                  : "bg-transparent border border-gray-800/30 text-gray-400 hover:text-gray-300 hover:border-gray-700/50"
              }`}
            >
              7D
            </button>
            <button
              onClick={() => setTimeFilter("1m")}
              className={`px-4 py-1.5 text-[14px] font-light tracking-wide rounded transition-all ${
                timeFilter === "1m"
                  ? "bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 text-gray-200 shadow-sm"
                  : "bg-transparent border border-gray-800/30 text-gray-400 hover:text-gray-300 hover:border-gray-700/50"
              }`}
            >
              1M
            </button>
          </div>
        </div>
        <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl overflow-hidden shadow-xl shadow-black/20">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-gray-800/50 bg-gradient-to-b from-[#111111] to-[#0d0d0d]">
                <th className="text-left py-4 px-5 text-gray-400 font-light tracking-wide uppercase">
                  Market
                </th>
                <th className="text-right py-4 px-5 text-gray-400 font-light tracking-wide uppercase">
                  Probability
                </th>
                <th className="text-right py-4 px-5 text-gray-400 font-light tracking-wide uppercase">
                  {timeFilter === "24h" ? "24h" : timeFilter === "7d" ? "7d" : "1M"} Volume
                </th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // Skeleton loading rows - shows instantly, feels faster
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-800/30 animate-pulse">
                    <td className="py-3.5 px-5">
                      <div className="h-5 bg-gray-800/50 rounded w-3/4"></div>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="h-5 bg-gray-800/50 rounded w-12 ml-auto"></div>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="h-5 bg-gray-800/50 rounded w-16 ml-auto"></div>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="h-5 bg-gray-800/50 rounded w-4 ml-auto"></div>
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-red-400 text-[15px]">
                    Error: {error}
                  </td>
                </tr>
              ) : allMarkets.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400 text-[15px]">
                    No active markets found
                  </td>
                </tr>
              ) : (
                displayedMarkets.map((market, index) => (
                  <tr
                    key={market.id}
                    onClick={() => handleTableMarketClick(market)}
                    className={`border-b border-gray-800/30 hover:bg-gradient-to-r hover:from-[#111111] hover:to-transparent transition-all duration-150 cursor-pointer ${
                      index === displayedMarkets.length - 1 ? "border-b-0" : ""
                    }`}
                  >
                    <td className="py-3.5 px-5 text-gray-200 max-w-[500px] truncate font-light">
                      {market.name || market.title}
                    </td>
                    <td className="py-3.5 px-5 text-right text-[#4a6fa5] font-normal">
                      {market.probability}%
                    </td>
                    <td className="py-3.5 px-5 text-right text-green-500 font-light">
                      {market.volume}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBookmark({
                            id: market.id,
                            name: market.name || market.title || "Unknown",
                            probability: Number(market.probability) || 0,
                          });
                        }}
                        className="text-gray-500 hover:text-[#4a6fa5] transition-all duration-200"
                      >
                        <Bookmark
                          className={`w-4 h-4 ${
                            isBookmarked(market.id) ? "fill-current text-[#4a6fa5]" : ""
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Load More Button */}
        {!loading && hasMoreMarkets && (
          <div className="flex justify-center mt-6">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-8 py-3 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 rounded-lg text-[15px] font-light text-gray-200 hover:text-gray-100 hover:border-gray-600/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Load More Markets
                  <span className="text-gray-400 text-[13px]">
                    ({allMarkets.length - displayedCount} remaining)
                  </span>
                </>
              )}
            </button>
          </div>
        )}
        
        {/* All loaded indicator */}
        {!loading && !hasMoreMarkets && allMarkets.length > INITIAL_LOAD && (
          <div className="text-center mt-4 text-gray-500 text-[14px]">
            All {allMarkets.length} markets loaded
          </div>
        )}
      </div>
    </div>
  );
}
