import { useState, useEffect, useMemo } from "react";
import { Bookmark, Loader2, Filter } from "lucide-react";
import { BookmarkedMarket } from "../App";
import { MarketDetail } from "./MarketDetail";
import {
  fetchMarketsSummary,
  getTrendingMarkets as getTrendingFromSummary,
  getNewMarkets as getNewFromSummary,
  getResolvingSoonMarkets,
  prefetchMarketDetail,
  type MarketSummary,
} from "../../data/markets/marketsApi";
import {
  formatTimeUntilClose
} from "../services/polymarketApi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
// RadioGroup no longer used - replaced Yes/No filter with Liquidity filter

// ============================================================================
// Type Definitions
// ============================================================================

type MarketCategory = "sports" | "crypto" | "politics" | "finance" | "tech";
type ColumnKey = "trending" | "new" | "resolving";

interface ColumnFilter {
  volumeMin?: number;
  volumeMax?: number;
  oddsMin?: number;
  oddsMax?: number;
  liquidityMin?: number;
  liquidityMax?: number;
}

// Format cents with proper precision like Polymarket (e.g., 0.4¢, 99.6¢)
function formatCents(cents: number): string {
  if (cents < 0.1) return "<0.1";
  if (cents > 99.9) return ">99.9";
  // Show one decimal place for precision on extremes
  if (cents < 1 || cents > 99) {
    return cents.toFixed(1);
  }
  // For values between 1-99, show integer if close, otherwise one decimal
  if (Math.abs(cents - Math.round(cents)) < 0.05) {
    return Math.round(cents).toString();
  }
  return cents.toFixed(1);
}

interface MarketsProps {
  toggleBookmark: (market: BookmarkedMarket) => void;
  isBookmarked: (marketId: string) => boolean;
  onWalletClick?: (address: string) => void;
  onMarketSelect?: (market: { id: string; name: string; probability: number; volume: string } | null) => void;
  onBack?: () => void;
  initialMarketId?: string | null;
  initialMarketData?: {
    id: string;
    name: string;
    probability: number;
    volume: string;
  } | null;
}


// Import ID is needed or define it.
// We'll define a local interface for display.

interface OutcomeDisplay {
  name: string;
  price: number | null; // 0-1
  tokenId?: string;
}

interface DisplayMarket {
  id: string;
  title?: string;
  name?: string;
  outcomes: OutcomeDisplay[]; // New strict list
  volume?: string;
  volumeUsd?: string;
  volumeNum?: number;
  liquidity?: number;
  image?: string | null;
  createdAt?: string;
  endDate?: string;
  timeUntilClose?: number;
  category?: string;
}

// ... existing cache code ...

// ... load/save cache functions ... (keep them)
// BUT we need to be careful about JSON.parse compatibility with new structure.
// Old cache had yesPriceCents. New cache has outcomes.
// If we load old cache, it might break.
// We should update the CACHE_PREFIX to invalidate old cache.
const MARKETS_CACHE_PREFIX = "polymarket_markets_v4_"; // Bump version

// ... preloadImages ... (keep)

// ... loadCachedMarkets ... (keep)

// ... saveCachedMarkets ... (keep)

function convertMarketSummaryToDisplay(market: MarketSummary): DisplayMarket {
  const volumeNum = market.volume24hr || 0;

  // Map outcomes
  const outcomes = market.outcomes?.map(o => ({
    name: o.name,
    price: o.price,
    tokenId: o.tokenId
  })) || [];

  return {
    id: market.id,
    name: market.title,
    title: market.title,
    outcomes,
    volumeUsd: String(volumeNum),
    volumeNum: volumeNum,
    volume: formatVolume(volumeNum),
    liquidity: market.liquidity || 0,
    image: market.image || null,
    category: market.category || undefined,
    createdAt: market.createdAt,
    endDate: market.endDate || undefined,
  };
}

// ... formatVolume ... (keep)

// ... normalizeCategory ... (keep)

// ... Filtering Helpers ... 
// We need to update getMarketOddsPct to use the best outcome or implied?
// Filters currently use "odds". For multi-outcome, maybe max odds?
function getMarketOddsPct(m: DisplayMarket): number {
  if (m.outcomes && m.outcomes.length > 0) {
    // Use the highest probability outcome as the proxy?
    // Or specific one?
    // Let's use max price * 100
    const prices = m.outcomes.map(o => (o.price || 0) * 100);
    return Math.max(...prices);
  }
  return 50;
}

// ... applyColumnFilter ... (keep)

// ... (keep countActiveFilters, FilterPopover) ...

// ============================================================================
// Market Card Component - Reusable across all columns
// ============================================================================
interface MarketCardProps {
  market: DisplayMarket;
  onClick: () => void;
  onBookmark: () => void;
  isBookmarked: boolean;
  showEndDate?: boolean;
}

function MarketCard({ market, onClick, onBookmark, isBookmarked, showEndDate }: MarketCardProps) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => prefetchMarketDetail(market.id)}
      className="market-card group flex items-start gap-3 p-3 bg-[#111111] border border-gray-800/30 rounded-lg hover:border-gray-700/50 transition-all cursor-pointer relative"
    >
      {/* Market Image */}
      <div className="flex-shrink-0 w-12 h-12 rounded-md overflow-hidden bg-gray-800/50">
        {market.image ? (
          <img
            src={market.image}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-700 text-xs">
            img
          </div>
        )}
      </div>

      {/* Market Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[var(--fs-sm)] font-medium text-gray-200 leading-tight mb-2 line-clamp-2">
          {market.name || market.title}
        </p>

        {/* Outcomes List */}
        <div className="flex flex-wrap gap-2 mb-2">
          {market.outcomes.slice(0, 4).map((outcome, idx) => {
            const price = outcome.price !== null ? outcome.price : 0.5; // Default if null? or hide?
            const pct = Math.round(price * 100);
            const colorClass = pct > 50 ? "text-green-400 bg-green-900/10 border-green-900/20" : "text-gray-400 bg-gray-800/30 border-gray-700/30";

            return (
              <div key={idx} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] border ${colorClass}`}>
                <span className="font-medium text-gray-300 truncate max-w-[60px]">{outcome.name}</span>
                <span className="font-bold">{pct}%</span>
              </div>
            );
          })}
          {market.outcomes.length > 4 && (
            <span className="text-[10px] text-gray-600 self-center">+{market.outcomes.length - 4}</span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[10px] text-gray-500 font-mono">
          {!showEndDate && market.volume && (
            <span>Vol: {market.volume}</span>
          )}
          {showEndDate && market.timeUntilClose && (
            <span className="text-orange-400">
              Ends {formatTimeUntilClose(market.timeUntilClose)}
            </span>
          )}
        </div>
      </div>

      {/* Bookmark Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onBookmark();
        }}
        className="absolute top-2 right-2 text-gray-600 hover:text-[#4a6fa5] transition-all duration-200 opacity-0 group-hover:opacity-100"
      >
        <Bookmark className={`w-4 h-4 ${isBookmarked ? "fill-current text-[#4a6fa5] opacity-100" : ""}`} />
      </button>
    </div>
  );
}


// ============================================================================
// Column Loading Skeleton
// ============================================================================
function ColumnSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-gradient-to-br from-[#111111] to-[#0a0a0a] border border-gray-800/30 rounded-lg animate-pulse">
          <div className="w-10 h-10 bg-gray-800/50 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-800/50 rounded w-3/4" />
            <div className="h-3 bg-gray-800/50 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Markets Component
// ============================================================================
export function Markets({
  toggleBookmark,
  isBookmarked,
  onWalletClick,
  onMarketSelect,
  onBack,
  initialMarketId,
  initialMarketData
}: MarketsProps) {
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(initialMarketId ?? null);

  // Category filter (global for all columns)
  const [selectedCategory, setSelectedCategory] = useState<"all" | MarketCategory>("all");

  // Per-column filters (independent state for each column)
  const [filtersByColumn, setFiltersByColumn] = useState<Record<ColumnKey, ColumnFilter>>({
    trending: {},
    new: {},
    resolving: {},
  });

  // State for all three columns (raw data)
  const [trendingMarketsRaw, setTrendingMarketsRaw] = useState<DisplayMarket[]>(() =>
    loadCachedMarkets(MARKETS_CACHE_PREFIX + "trending_24h") || []
  );
  const [newMarketsRaw, setNewMarketsRaw] = useState<DisplayMarket[]>(() =>
    loadCachedMarkets(MARKETS_CACHE_PREFIX + "new") || []
  );
  const [nearlyResolvedMarketsRaw, setNearlyResolvedMarketsRaw] = useState<DisplayMarket[]>(() =>
    loadCachedMarkets(MARKETS_CACHE_PREFIX + "resolved") || []
  );

  // Loading states for each column
  const [loadingTrending, setLoadingTrending] = useState(() =>
    !loadCachedMarkets(MARKETS_CACHE_PREFIX + "trending_24h")
  );
  const [loadingNew, setLoadingNew] = useState(() =>
    !loadCachedMarkets(MARKETS_CACHE_PREFIX + "new")
  );
  const [loadingResolved, setLoadingResolved] = useState(() =>
    !loadCachedMarkets(MARKETS_CACHE_PREFIX + "resolved")
  );

  // Refresh indicators
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination state
  const [trendingDisplayed, setTrendingDisplayed] = useState(INITIAL_LOAD);
  const [newDisplayed, setNewDisplayed] = useState(INITIAL_LOAD);
  const [resolvedDisplayed, setResolvedDisplayed] = useState(INITIAL_LOAD);

  // Sync selectedMarketId when initialMarketId changes
  useEffect(() => {
    if (initialMarketId !== undefined && initialMarketId !== selectedMarketId) {
      setSelectedMarketId(initialMarketId);
    }
  }, [initialMarketId]);

  // Handle clicking on a market
  const handleMarketClick = (market: DisplayMarket) => {
    setSelectedMarketId(market.id);
    if (onMarketSelect) {
      onMarketSelect({
        id: market.id,
        name: market.name || market.title || "Unknown",
        probability: Number(market.probability) || 50,
        volume: market.volume || "$0",
      });
    }
  };

  // Fetch all market data using optimized API
  useEffect(() => {
    const fetchAllMarkets = async () => {
      console.log('⏱️ Starting optimized market fetch...');
      const startTime = performance.now();

      // Check caches first
      const cachedTrending = loadCachedMarkets(MARKETS_CACHE_PREFIX + "trending_24h");
      const cachedNew = loadCachedMarkets(MARKETS_CACHE_PREFIX + "new");
      const cachedResolved = loadCachedMarkets(MARKETS_CACHE_PREFIX + "resolved");

      // Use cached data immediately for instant render
      if (cachedTrending && cachedTrending.length > 0) {
        setTrendingMarketsRaw(cachedTrending);
        setLoadingTrending(false);
        preloadImages(cachedTrending);
      }
      if (cachedNew && cachedNew.length > 0) {
        setNewMarketsRaw(cachedNew);
        setLoadingNew(false);
        preloadImages(cachedNew);
      }
      if (cachedResolved && cachedResolved.length > 0) {
        setNearlyResolvedMarketsRaw(cachedResolved);
        setLoadingResolved(false);
        preloadImages(cachedResolved);
      }

      // If any cache was used, show refresh indicator
      if (cachedTrending || cachedNew || cachedResolved) {
        setIsRefreshing(true);
      }

      // Fetch all three columns in parallel using optimized API
      try {
        const [trendingResult, newResult, resolvingResult] = await Promise.all([
          // Trending Markets (sorted by volume)
          fetchMarketsSummary({ sortBy: 'volume', limit: 100 }),
          // New Markets (sorted by createdAt)
          fetchMarketsSummary({ sortBy: 'newest', limit: 50 }),
          // Resolving Soon Markets (sorted by endDate)
          fetchMarketsSummary({ sortBy: 'endingSoon', limit: 50 }),
        ]);

        const fetchTime = performance.now() - startTime;
        console.log(`⏱️ All fetches completed in ${fetchTime.toFixed(0)}ms`);

        // Update trending
        if (trendingResult.markets.length > 0) {
          const trending = getTrendingFromSummary(trendingResult.markets, 50);
          const displayTrending = trending.map(convertMarketSummaryToDisplay);
          setTrendingMarketsRaw(displayTrending);
          saveCachedMarkets(displayTrending, MARKETS_CACHE_PREFIX + "trending_24h");
          preloadImages(displayTrending);
        }
        setLoadingTrending(false);

        // Update new markets
        if (newResult.markets.length > 0) {
          const newMarketsList = getNewFromSummary(newResult.markets, 30);
          const displayNew = newMarketsList.map(convertMarketSummaryToDisplay);
          setNewMarketsRaw(displayNew);
          saveCachedMarkets(displayNew, MARKETS_CACHE_PREFIX + "new");
          preloadImages(displayNew);
        }
        setLoadingNew(false);

        // Update resolving soon (filter to only markets ending within 72 hours)
        if (resolvingResult.markets.length > 0) {
          const resolving = getResolvingSoonMarkets(resolvingResult.markets, 72, 30);
          const displayResolved = resolving.map(m => ({
            ...convertMarketSummaryToDisplay(m),
            timeUntilClose: m.endDate ? new Date(m.endDate).getTime() - Date.now() : undefined,
          }));
          setNearlyResolvedMarketsRaw(displayResolved);
          saveCachedMarkets(displayResolved, MARKETS_CACHE_PREFIX + "resolved");
          preloadImages(displayResolved);
        }
        setLoadingResolved(false);

        const totalTime = performance.now() - startTime;
        console.log(`✅ Markets page loaded in ${totalTime.toFixed(0)}ms`);

      } catch (error) {
        console.error("Error fetching markets:", error);
        setLoadingTrending(false);
        setLoadingNew(false);
        setLoadingResolved(false);
      } finally {
        setIsRefreshing(false);
      }
    };

    fetchAllMarkets();
  }, []);

  // ============================================================================
  // Intelligent Polling - Auto-refresh every 15s, pause when tab hidden
  // ============================================================================
  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let isVisible = true;

    const startPolling = () => {
      if (pollInterval) return;
      pollInterval = setInterval(() => {
        if (isVisible && !isRefreshing) {
          console.log('🔄 Auto-refreshing markets...');
          // Trigger a background refresh without showing loading spinners
          fetchMarketsSummary({ sortBy: 'volume', limit: 100 }).then(result => {
            if (result.markets.length > 0) {
              const displayMarkets = result.markets.map(convertMarketSummaryToDisplay);
              setTrendingMarketsRaw(displayMarkets);
              saveCachedMarkets(displayMarkets, MARKETS_CACHE_PREFIX + "trending_24h");
              console.log(`✅ Auto-refreshed ${result.markets.length} trending markets`);
            }
          }).catch(() => { });
        }
      }, 15000); // Poll every 15 seconds
    };

    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isVisible = false;
        stopPolling();
        console.log('⏸️ Paused polling (tab hidden)');
      } else {
        isVisible = true;
        startPolling();
        console.log('▶️ Resumed polling (tab visible)');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startPolling();

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRefreshing]);

  // Apply category filter to all columns
  const applyCategoryFilter = (markets: DisplayMarket[]): DisplayMarket[] => {
    if (selectedCategory === "all") return markets;
    return markets.filter(m => normalizeCategory(m.category) === selectedCategory);
  };

  // Filtered and processed markets
  const trendingMarkets = useMemo(() => {
    const categoryFiltered = applyCategoryFilter(trendingMarketsRaw);
    return applyColumnFilter(categoryFiltered, filtersByColumn.trending);
  }, [trendingMarketsRaw, selectedCategory, filtersByColumn.trending]);

  const newMarkets = useMemo(() => {
    const categoryFiltered = applyCategoryFilter(newMarketsRaw);
    return applyColumnFilter(categoryFiltered, filtersByColumn.new);
  }, [newMarketsRaw, selectedCategory, filtersByColumn.new]);

  const nearlyResolvedMarkets = useMemo(() => {
    const categoryFiltered = applyCategoryFilter(nearlyResolvedMarketsRaw);
    return applyColumnFilter(categoryFiltered, filtersByColumn.resolving);
  }, [nearlyResolvedMarketsRaw, selectedCategory, filtersByColumn.resolving]);

  // Displayed markets (paginated)
  const displayedTrending = useMemo(() =>
    trendingMarkets.slice(0, trendingDisplayed),
    [trendingMarkets, trendingDisplayed]
  );
  const displayedNew = useMemo(() =>
    newMarkets.slice(0, newDisplayed),
    [newMarkets, newDisplayed]
  );
  const displayedResolved = useMemo(() =>
    nearlyResolvedMarkets.slice(0, resolvedDisplayed),
    [nearlyResolvedMarkets, resolvedDisplayed]
  );

  // Update column filter
  const updateColumnFilter = (column: ColumnKey, filter: ColumnFilter) => {
    setFiltersByColumn(prev => ({
      ...prev,
      [column]: filter,
    }));
  };

  const clearColumnFilter = (column: ColumnKey) => {
    setFiltersByColumn(prev => ({
      ...prev,
      [column]: { side: "any" },
    }));
  };

  // Show market detail if selected
  if (selectedMarketId) {
    let selectedMarket: DisplayMarket | undefined;

    if (initialMarketData && initialMarketData.id === selectedMarketId) {
      selectedMarket = {
        id: initialMarketData.id,
        name: initialMarketData.name,
        probability: initialMarketData.probability,
        volume: initialMarketData.volume,
      };
    } else {
      selectedMarket = trendingMarkets.find((m) => m.id === selectedMarketId)
        || newMarkets.find((m) => m.id === selectedMarketId)
        || nearlyResolvedMarkets.find((m) => m.id === selectedMarketId);
    }

    if (!selectedMarket && selectedMarketId) {
      selectedMarket = {
        id: selectedMarketId,
        name: "Loading...",
        probability: 50,
        volume: "$0",
      };
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
              image: selectedMarket!.image || null,
            })
          }
          onBack={() => {
            if (onBack) {
              onBack();
            } else {
              setSelectedMarketId(null);
              if (onMarketSelect) {
                onMarketSelect(null);
              }
            }
          }}
          onWalletClick={onWalletClick}
        />
      );
    }
  }

  // Helper for bookmark action
  const handleBookmark = (market: DisplayMarket) => {
    toggleBookmark({
      id: market.id,
      name: market.name || market.title || "Unknown",
      probability: Number(market.probability) || 0,
      image: market.image || null,
    });
  };

  return (
    <div className="w-full max-w-[var(--container-max)] mx-auto px-[var(--container-pad)]">
      {/* Header with Category Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[var(--sp-3)] sm:gap-0 mb-[var(--sp-4)] sm:mb-[var(--sp-5)]">
        <div className="flex items-center gap-[var(--sp-2)] sm:gap-[var(--sp-3)]">
          <h1 className="text-[var(--fs-xl)] sm:text-[var(--fs-2xl)] font-light tracking-tight text-gray-100">
            Markets
          </h1>
          {isRefreshing && (
            <div className="flex items-center gap-[var(--sp-1)] text-[var(--fs-xs)] text-gray-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="hidden sm:inline">Updating...</span>
            </div>
          )}
        </div>

        {/* Category Dropdown */}
        <div className="flex items-center gap-[var(--sp-2)]">
          <span className="text-[var(--fs-xs)] text-gray-500">Category:</span>
          <Select
            value={selectedCategory}
            onValueChange={(value) => setSelectedCategory(value as "all" | MarketCategory)}
          >
            <SelectTrigger className="w-[140px] h-8 bg-[#111111] border-gray-700/50 text-[var(--fs-sm)] text-gray-200">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="bg-[#111111] border-gray-700/50">
              <SelectItem value="all" className="text-gray-200">All</SelectItem>
              <SelectItem value="sports" className="text-gray-200">Sports</SelectItem>
              <SelectItem value="crypto" className="text-gray-200">Crypto</SelectItem>
              <SelectItem value="politics" className="text-gray-200">Politics</SelectItem>
              <SelectItem value="finance" className="text-gray-200">Finance</SelectItem>
              <SelectItem value="tech" className="text-gray-200">Tech</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 3-Column Grid Layout - CSS-only responsive */}
      <div className="markets-3col">

        {/* Column 1: Trending Markets */}
        <div className="market-column">
          {/* Column Header */}
          <div className="market-column-header">
            <h2>Trending Markets</h2>
            <div className="flex items-center gap-2">
              <span className="text-[var(--fs-xs)] text-gray-500">By volume</span>
              <FilterPopover
                filter={filtersByColumn.trending}
                onApply={(f) => updateColumnFilter("trending", f)}
                onClear={() => clearColumnFilter("trending")}
              />
            </div>
          </div>

          {/* Column Content */}
          <div className="market-column-content space-y-2">
            {loadingTrending ? (
              <ColumnSkeleton rows={8} />
            ) : displayedTrending.length === 0 ? (
              <p className="text-center text-gray-500 py-8 text-[var(--fs-sm)]">No trending markets found</p>
            ) : (
              <>
                {displayedTrending.map((market) => (
                  <MarketCard
                    key={market.id}
                    market={market}
                    onClick={() => handleMarketClick(market)}
                    onBookmark={() => handleBookmark(market)}
                    isBookmarked={isBookmarked(market.id)}
                  />
                ))}
                {trendingDisplayed < trendingMarkets.length && (
                  <button
                    onClick={() => setTrendingDisplayed(prev => prev + LOAD_MORE_COUNT)}
                    className="w-full py-2 text-[var(--fs-xs)] text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    Load more ({trendingMarkets.length - trendingDisplayed} remaining)
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Column 2: New Markets */}
        <div className="market-column">
          {/* Column Header */}
          <div className="market-column-header">
            <h2>New Markets</h2>
            <div className="flex items-center gap-2">
              <span className="text-[var(--fs-xs)] text-gray-500">Newest first</span>
              <FilterPopover
                filter={filtersByColumn.new}
                onApply={(f) => updateColumnFilter("new", f)}
                onClear={() => clearColumnFilter("new")}
              />
            </div>
          </div>

          {/* Column Content */}
          <div className="market-column-content space-y-2">
            {loadingNew ? (
              <ColumnSkeleton rows={8} />
            ) : displayedNew.length === 0 ? (
              <p className="text-center text-gray-500 py-8 text-[var(--fs-sm)]">No new markets found</p>
            ) : (
              <>
                {displayedNew.map((market) => (
                  <MarketCard
                    key={market.id}
                    market={market}
                    onClick={() => handleMarketClick(market)}
                    onBookmark={() => handleBookmark(market)}
                    isBookmarked={isBookmarked(market.id)}
                  />
                ))}
                {newDisplayed < newMarkets.length && (
                  <button
                    onClick={() => setNewDisplayed(prev => prev + LOAD_MORE_COUNT)}
                    className="w-full py-2 text-[var(--fs-xs)] text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    Load more ({newMarkets.length - newDisplayed} remaining)
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Column 3: Nearly Resolved Markets */}
        <div className="market-column">
          {/* Column Header */}
          <div className="market-column-header">
            <h2>Resolving Soon</h2>
            <div className="flex items-center gap-2">
              <span className="text-[var(--fs-xs)] text-gray-500">Next 72h</span>
              <FilterPopover
                filter={filtersByColumn.resolving}
                onApply={(f) => updateColumnFilter("resolving", f)}
                onClear={() => clearColumnFilter("resolving")}
              />
            </div>
          </div>

          {/* Column Content */}
          <div className="market-column-content space-y-2">
            {loadingResolved ? (
              <ColumnSkeleton rows={8} />
            ) : displayedResolved.length === 0 ? (
              <p className="text-center text-gray-500 py-8 text-[var(--fs-sm)]">No markets closing soon</p>
            ) : (
              <>
                {displayedResolved.map((market) => (
                  <MarketCard
                    key={market.id}
                    market={market}
                    onClick={() => handleMarketClick(market)}
                    onBookmark={() => handleBookmark(market)}
                    isBookmarked={isBookmarked(market.id)}
                    showEndDate={true}
                  />
                ))}
                {resolvedDisplayed < nearlyResolvedMarkets.length && (
                  <button
                    onClick={() => setResolvedDisplayed(prev => prev + LOAD_MORE_COUNT)}
                    className="w-full py-2 text-[var(--fs-xs)] text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    Load more ({nearlyResolvedMarkets.length - resolvedDisplayed} remaining)
                  </button>
                )}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
