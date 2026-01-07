import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Bookmark, Clock, X, TrendingUp, Loader2 } from "lucide-react";
import { BookmarkedMarket } from "../App";
import { getTrendingMarkets } from "../services/polymarketApi";

interface DiscoverProps {
  toggleBookmark: (market: BookmarkedMarket) => void;
  isBookmarked: (marketId: string) => boolean;
  onWalletClick: (address: string) => void;
  onMarketClick: (market: any) => void;
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

export function Discover({ toggleBookmark, isBookmarked, onWalletClick, onMarketClick }: DiscoverProps) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("24h");
  const [allMarkets, setAllMarkets] = useState<DisplayMarket[]>([]);
  const [displayedCount, setDisplayedCount] = useState(INITIAL_LOAD);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<DisplayMarket[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load search history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("polymarket_search_history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSearchHistory(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load search history:", e);
    }
  }, []);

  // Save search history to localStorage whenever it changes
  useEffect(() => {
    if (searchHistory.length > 0) {
      localStorage.setItem("polymarket_search_history", JSON.stringify(searchHistory));
    }
  }, [searchHistory]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fast local search using cached data
  const performSearch = useCallback((query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    
    const lowerQuery = query.toLowerCase().trim();
    const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 1);
    
    // Search through cached markets
    const results = cachedAllMarkets
      .filter(market => {
        const name = (market.name || market.title || "").toLowerCase();
        // Check if any query word matches
        return queryWords.some(word => name.includes(word)) || name.includes(lowerQuery);
      })
      .map(market => {
        const name = (market.name || market.title || "").toLowerCase();
        let score = 0;
        
        // Exact phrase match
        if (name.includes(lowerQuery)) score += 100;
        
        // Word matches
        queryWords.forEach(word => {
          if (name.includes(word)) score += 10;
          if (name.startsWith(word)) score += 5;
        });
        
        return { ...market, _score: score };
      })
      .sort((a: any, b: any) => b._score - a._score)
      .slice(0, 20);
    
    setSearchResults(results);
    setIsSearching(false);
  }, []);

  // Debounced search on query change
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    if (searchQuery.trim()) {
      setIsSearching(true);
      searchDebounceRef.current = setTimeout(() => {
        performSearch(searchQuery);
      }, 150); // Faster debounce since search is now local
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
    
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, performSearch]);

  // Add market to search history
  const addToSearchHistory = useCallback((market: DisplayMarket) => {
    const historyItem: SearchHistoryItem = {
      id: market.id,
      name: market.name || market.title || "Unknown",
      probability: Number(market.probability) || 0,
      volume: market.volume || "$0",
      timestamp: Date.now(),
    };
    
    setSearchHistory(prev => {
      const filtered = prev.filter(item => item.id !== market.id);
      const newHistory = [historyItem, ...filtered].slice(0, 10);
      // Immediately save to localStorage
      localStorage.setItem("polymarket_search_history", JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  // Clear search history
  const clearSearchHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem("polymarket_search_history");
  };

  // Remove single item from history
  const removeFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchHistory(prev => {
      const newHistory = prev.filter(item => item.id !== id);
      localStorage.setItem("polymarket_search_history", JSON.stringify(newHistory));
      return newHistory;
    });
  };

  // Handle market selection from search
  const handleMarketSelect = (market: DisplayMarket) => {
    addToSearchHistory(market);
    setSearchQuery("");
    setIsSearchFocused(false);
    onMarketClick(market);
  };

  // Handle selecting from history
  const handleHistorySelect = (item: SearchHistoryItem) => {
    const market: DisplayMarket = {
      id: item.id,
      name: item.name,
      probability: item.probability,
      volume: item.volume,
    };
    setSearchQuery("");
    setIsSearchFocused(false);
    onMarketClick(market);
  };

  // Handle clicking on a market from the table
  const handleTableMarketClick = (market: DisplayMarket) => {
    addToSearchHistory(market);
    onMarketClick(market);
  };

  // Fetch markets
  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        setLoading(true);
        setError(null);
        setDisplayedCount(INITIAL_LOAD);
        
        const data = await getTrendingMarkets(timeFilter);
        
        if (!Array.isArray(data)) {
          throw new Error("Invalid data format");
        }
        
        const displayMarkets = data
          .filter((m: any) => m && m.title)
          .map((m: any) => convertApiMarketToDisplay(m, timeFilter));
        
        setAllMarkets(displayMarkets);
        
        // Update cache for search
        cachedAllMarkets = displayMarkets;
        cacheTimeFilter = timeFilter;
        
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch markets";
        console.error("Error fetching markets:", message);
        setError(message);
        setAllMarkets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
  }, [timeFilter]);

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

  return (
    <div className="max-w-[1800px] mx-auto space-y-8">
      {/* Search */}
      <div ref={searchRef} className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 z-10" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          placeholder="Search markets on Polymarket..."
          className={`w-full bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 px-12 py-3 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-700/50 shadow-inner transition-all ${
            isSearchFocused && (searchHistory.length > 0 || searchQuery.trim() || isSearching) 
              ? "rounded-t-lg rounded-b-none border-b-transparent" 
              : "rounded-lg"
          }`}
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery("");
              setSearchResults([]);
              searchInputRef.current?.focus();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        
        {/* Search Dropdown - Only show when there's content to display */}
        {isSearchFocused && (searchHistory.length > 0 || searchQuery.trim() || isSearching) && (
          <div className="absolute top-full left-0 right-0 bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 border-t-0 rounded-b-lg shadow-xl shadow-black/30 z-50 max-h-[400px] overflow-y-auto">
            {/* Show history when no query and has history */}
            {!searchQuery.trim() && searchHistory.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800/30">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Recently Viewed Markets</span>
                  <button
                    onClick={clearSearchHistory}
                    className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    Clear all
                  </button>
                </div>
                {searchHistory.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleHistorySelect(item)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gradient-to-r hover:from-[#111111] hover:to-transparent cursor-pointer group transition-all"
                  >
                    <Clock className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-300 truncate">{item.name}</div>
                      <div className="flex items-center gap-4 text-xs text-gray-600 mt-0.5">
                        <span className="text-[#4a6fa5]">{item.probability}%</span>
                        <span className="text-green-600">{item.volume}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => removeFromHistory(item.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-gray-400 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Show loading state */}
            {searchQuery.trim() && isSearching && (
              <div className="px-4 py-6 text-center">
                <div className="animate-spin w-5 h-5 border-2 border-gray-700 border-t-gray-400 rounded-full mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Searching markets...</p>
              </div>
            )}
            
            {/* Show search results */}
            {searchQuery.trim() && !isSearching && searchResults.length > 0 && (
              <div>
                <div className="px-4 py-2 border-b border-gray-800/30">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">
                    {searchResults.length} market{searchResults.length !== 1 ? "s" : ""} found
                  </span>
                </div>
                {searchResults.map((market) => (
                  <div
                    key={market.id}
                    onClick={() => handleMarketSelect(market)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gradient-to-r hover:from-[#111111] hover:to-transparent cursor-pointer transition-all"
                  >
                    <TrendingUp className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-300 truncate">{market.name || market.title}</div>
                      <div className="flex items-center gap-4 text-xs text-gray-600 mt-0.5">
                        <span className="text-[#4a6fa5]">{market.probability}%</span>
                        <span className="text-green-600">{market.volume}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark({
                          id: market.id,
                          name: market.name || market.title || "Unknown",
                          probability: Number(market.probability) || 0,
                        });
                      }}
                      className="text-gray-600 hover:text-[#4a6fa5] transition-all"
                    >
                      <Bookmark
                        className={`w-3.5 h-3.5 ${
                          isBookmarked(market.id) ? "fill-current text-[#4a6fa5]" : ""
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* No results */}
            {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
              <div className="px-4 py-8 text-center">
                <Search className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No markets found for "{searchQuery}"</p>
                <p className="text-xs text-gray-600 mt-1">Try a different search term</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Trending Markets */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-light tracking-tight text-gray-300 uppercase">
            Trending Markets
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTimeFilter("24h")}
              className={`px-4 py-1.5 text-xs font-light tracking-wide rounded transition-all ${
                timeFilter === "24h"
                  ? "bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 text-gray-200 shadow-sm"
                  : "bg-transparent border border-gray-800/30 text-gray-500 hover:text-gray-400 hover:border-gray-700/50"
              }`}
            >
              24H
            </button>
            <button
              onClick={() => setTimeFilter("7d")}
              className={`px-4 py-1.5 text-xs font-light tracking-wide rounded transition-all ${
                timeFilter === "7d"
                  ? "bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 text-gray-200 shadow-sm"
                  : "bg-transparent border border-gray-800/30 text-gray-500 hover:text-gray-400 hover:border-gray-700/50"
              }`}
            >
              7D
            </button>
            <button
              onClick={() => setTimeFilter("1m")}
              className={`px-4 py-1.5 text-xs font-light tracking-wide rounded transition-all ${
                timeFilter === "1m"
                  ? "bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 text-gray-200 shadow-sm"
                  : "bg-transparent border border-gray-800/30 text-gray-500 hover:text-gray-400 hover:border-gray-700/50"
              }`}
            >
              1M
            </button>
          </div>
        </div>
        <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl overflow-hidden shadow-xl shadow-black/20">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800/50 bg-gradient-to-b from-[#111111] to-[#0d0d0d]">
                <th className="text-left py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                  Market
                </th>
                <th className="text-right py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                  Probability
                </th>
                <th className="text-right py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                  {timeFilter === "24h" ? "24h" : timeFilter === "7d" ? "7d" : "1M"} Volume
                </th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading markets...
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-red-500">
                    Error: {error}
                  </td>
                </tr>
              ) : allMarkets.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">
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
                    <td className="py-3.5 px-5 text-gray-300 max-w-[500px] truncate font-light">
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
                        className="text-gray-600 hover:text-[#4a6fa5] transition-all duration-200"
                      >
                        <Bookmark
                          className={`w-3.5 h-3.5 ${
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
              className="px-8 py-3 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 rounded-lg text-sm font-light text-gray-300 hover:text-gray-100 hover:border-gray-600/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Load More Markets
                  <span className="text-gray-500 text-xs">
                    ({allMarkets.length - displayedCount} remaining)
                  </span>
                </>
              )}
            </button>
          </div>
        )}
        
        {/* All loaded indicator */}
        {!loading && !hasMoreMarkets && allMarkets.length > INITIAL_LOAD && (
          <div className="text-center mt-4 text-gray-600 text-xs">
            All {allMarkets.length} markets loaded
          </div>
        )}
      </div>
    </div>
  );
}
