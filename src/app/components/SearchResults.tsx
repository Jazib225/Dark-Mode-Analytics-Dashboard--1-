import { useState, useEffect, useCallback } from "react";
import { Search, TrendingUp, Bookmark, Loader2, ArrowLeft, SortAsc } from "lucide-react";
import { searchMarkets, instantSearch, getCacheStats } from "../services/polymarketApi";
import { BookmarkedMarket } from "../App";

interface DisplayMarket {
  id: string;
  title?: string;
  name?: string;
  probability?: number | string;
  volume?: string;
  image?: string | null;
}

interface SearchResultsProps {
  initialQuery: string;
  onBack: () => void;
  onMarketSelect: (market: DisplayMarket) => void;
  toggleBookmark: (market: BookmarkedMarket) => void;
  isBookmarked: (marketId: string) => boolean;
}

type SortOption = "relevance" | "volume" | "probability";

export function SearchResults({
  initialQuery,
  onBack,
  onMarketSelect,
  toggleBookmark,
  isBookmarked,
}: SearchResultsProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [results, setResults] = useState<DisplayMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("relevance");
  const [hasSearched, setHasSearched] = useState(false);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    
    try {
      // PRIORITY 1: Use instant search from global cache (sub-millisecond)
      const cacheStats = getCacheStats();
      const cachedResults = instantSearch(query, 100);
      
      if (cachedResults.length > 0) {
        const formattedResults = cachedResults.map((m: any) => ({
          id: m.id,
          name: m.title,
          title: m.title,
          probability: m.probability || 50,
          volume: m.volumeUsd ? `$${(m.volumeUsd / 1000000).toFixed(1)}M` : "$0",
          volumeNum: m.volumeUsd || 0,
          image: m.image || null,
          groupItemTitle: m.groupItemTitle,
        }));
        setResults(formattedResults);
        console.log(`⚡ SearchResults: ${cachedResults.length} instant results for "${query}" (cache has ${cacheStats.totalMarkets} markets)`);
        setIsLoading(false);
        return;
      }
      
      // FALLBACK: If cache is empty, use API search
      const searchResults = await searchMarkets(query, 100);
      
      if (searchResults && searchResults.length > 0) {
        const formattedResults = searchResults.map((m: any) => ({
          id: m.id,
          name: m.title || m.name,
          title: m.title || m.name,
          probability: m.probability || 50,
          volume: m.volume || "$0",
          volumeNum: m.volumeUsd || 0,
          image: m.image || null,
        }));
        setResults(formattedResults);
      } else {
        setResults([]);
      }
    } catch (e) {
      console.error("Search failed:", e);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial search on mount
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery, performSearch]);

  // Handle new search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery);
  };

  // Sort results
  const sortedResults = [...results].sort((a: any, b: any) => {
    if (sortBy === "volume") {
      const volA = parseFloat(String(a.volumeNum || 0));
      const volB = parseFloat(String(b.volumeNum || 0));
      return volB - volA;
    }
    if (sortBy === "probability") {
      const probA = Number(a.probability) || 0;
      const probB = Number(b.probability) || 0;
      return probB - probA;
    }
    // Default: relevance (keep original order from API)
    return 0;
  });

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header with back button and search */}
      <div className="mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[14px]">Back</span>
        </button>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="flex items-center gap-4">
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all markets..."
              className="w-full bg-[#111111] border border-gray-800/50 pl-12 pr-4 py-3 text-[15px] text-gray-200 placeholder-gray-500 rounded-lg focus:outline-none focus:border-gray-600/50 transition-all"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-[#4a6fa5] text-white text-[14px] font-medium rounded-lg hover:bg-[#5a7fb5] transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Results Header */}
      {hasSearched && !isLoading && (
        <div className="flex items-center justify-between mb-6">
          <div className="text-gray-400 text-[14px]">
            {results.length > 0 ? (
              <span>
                Found <span className="text-gray-200 font-medium">{results.length}</span> market{results.length !== 1 ? "s" : ""} for "{initialQuery}"
              </span>
            ) : (
              <span>No results found for "{initialQuery}"</span>
            )}
          </div>

          {/* Sort Options */}
          {results.length > 0 && (
            <div className="flex items-center gap-2">
              <SortAsc className="w-4 h-4 text-gray-500" />
              <span className="text-[13px] text-gray-500 mr-2">Sort by:</span>
              <div className="flex gap-1">
                {(["relevance", "volume", "probability"] as SortOption[]).map((option) => (
                  <button
                    key={option}
                    onClick={() => setSortBy(option)}
                    className={`px-3 py-1 text-[13px] rounded transition-all ${
                      sortBy === option
                        ? "bg-[#4a6fa5]/20 text-[#4a6fa5] border border-[#4a6fa5]/30"
                        : "bg-[#111111] text-gray-400 border border-gray-800/50 hover:text-gray-200"
                    }`}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#4a6fa5] mb-4" />
          <p className="text-gray-400 text-[15px]">Searching all markets...</p>
          <p className="text-gray-500 text-[13px] mt-1">Including niche and low-liquidity markets</p>
        </div>
      )}

      {/* Results Grid */}
      {!isLoading && results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedResults.map((market) => (
            <div
              key={market.id}
              onClick={() => onMarketSelect(market)}
              className="bg-[#111111] border border-gray-800/50 rounded-xl p-4 hover:border-gray-700/50 cursor-pointer transition-all group"
            >
              <div className="flex items-start gap-3">
                {market.image ? (
                  <img
                    src={market.image}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-[#1a1a1a] flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5 text-gray-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] text-gray-200 font-medium leading-tight line-clamp-2 group-hover:text-white transition-colors">
                    {market.name || market.title}
                  </h3>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-[13px] text-[#4a6fa5] font-medium">
                      {market.probability}%
                    </span>
                    <span className="text-[13px] text-green-500">
                      {market.volume}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBookmark({
                      id: market.id,
                      name: market.name || market.title || "Unknown",
                      probability: Number(market.probability) || 0,
                      image: market.image || null,
                    });
                  }}
                  className="text-gray-500 hover:text-[#4a6fa5] transition-all flex-shrink-0"
                >
                  <Bookmark
                    className={`w-4 h-4 ${
                      isBookmarked(market.id) ? "fill-current text-[#4a6fa5]" : ""
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Results State */}
      {!isLoading && hasSearched && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <Search className="w-12 h-12 text-gray-600 mb-4" />
          <h3 className="text-gray-300 text-[18px] font-medium mb-2">No markets found</h3>
          <p className="text-gray-500 text-[14px] text-center max-w-md">
            We couldn't find any markets matching "{initialQuery}". Try different keywords or check your spelling.
          </p>
          <div className="mt-6 text-[13px] text-gray-500">
            <p>Search tips:</p>
            <ul className="mt-2 space-y-1 text-gray-400">
              <li>• Try using fewer or different keywords</li>
              <li>• Check for typos or spelling errors</li>
              <li>• Use more general terms</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
