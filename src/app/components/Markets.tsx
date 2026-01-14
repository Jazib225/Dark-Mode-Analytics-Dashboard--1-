import { useState, useEffect, useMemo } from "react";
import { Bookmark, Loader2, Filter } from "lucide-react";
import { BookmarkedMarket } from "../App";
import { MarketDetail } from "./MarketDetail";
import {
  fetchMarketsSummary,
  getTrendingMarkets as getTrendingFromSummary,
  getNewMarkets as getNewFromSummary,
  getResolvingSoonMarkets,
  type MarketSummary,
} from "../../data/markets/marketsApi";
import {
  formatTimeUntilClose
} from "../services/polymarketApi";
import {
  prefetchMarketDetail,
} from "../services/marketDataClient";
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

interface DisplayMarket {
  id: string;
  title?: string;
  name?: string;
  probability?: number | string;
  yesPriceCents?: number;
  noPriceCents?: number;
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

// LocalStorage cache keys
const MARKETS_CACHE_PREFIX = "polymarket_markets_v3_";
const CACHE_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes for faster updates

// Preload images for faster display
function preloadImages(markets: DisplayMarket[]): void {
  markets.forEach(market => {
    if (market.image) {
      const img = new Image();
      img.src = market.image;
    }
  });
}

interface CachedData {
  markets: DisplayMarket[];
  timestamp: number;
}

function loadCachedMarkets(cacheKey: string): DisplayMarket[] | null {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const data: CachedData = JSON.parse(cached);
      if (Date.now() - data.timestamp < CACHE_EXPIRY_MS) {
        return data.markets;
      }
    }
  } catch (e) {
    console.error("Failed to load cached markets:", e);
  }
  return null;
}

function saveCachedMarkets(markets: DisplayMarket[], cacheKey: string): void {
  try {
    const data: CachedData = {
      markets,
      timestamp: Date.now(),
    };
    localStorage.setItem(cacheKey, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save markets cache:", e);
  }
}

function convertApiMarketToDisplay(market: any): DisplayMarket {
  const volumeUsd = market.volume24hr || market.volumeUsd;

  let yesPriceCents = market.yesPriceCents;
  let noPriceCents = market.noPriceCents;

  if (yesPriceCents === undefined || yesPriceCents === null) {
    const yesPrice = market.lastPriceUsd ? parseFloat(String(market.lastPriceUsd)) : 0.5;
    yesPriceCents = yesPrice * 100;
    noPriceCents = 100 - yesPriceCents;
  }

  const probability = yesPriceCents;

  return {
    id: market.id,
    name: market.title || market.name,
    title: market.title || market.name,
    probability: probability,
    yesPriceCents,
    noPriceCents,
    volumeUsd: String(volumeUsd),
    volumeNum: parseFloat(String(volumeUsd || 0)),
    volume: formatVolume(parseFloat(String(volumeUsd || 0))),
    image: market.image || null,
    createdAt: market.createdAt,
    endDate: market.endDate,
    timeUntilClose: market.timeUntilClose,
    category: market.groupItemTitle || market.category || market.tag,
  };
}

function convertMarketSummaryToDisplay(market: MarketSummary): DisplayMarket {
  const volumeNum = market.volume24hr || 0;
  const probability = market.yesPrice * 100;
  const yesPriceCents = probability;
  const noPriceCents = 100 - probability;

  return {
    id: market.id,
    name: market.title,
    title: market.title,
    probability: probability,
    yesPriceCents,
    noPriceCents,
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

function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `$${(volume / 1000000).toFixed(2)}M`;
  } else if (volume >= 1000) {
    return `$${(volume / 1000).toFixed(2)}K`;
  }
  return `$${volume.toFixed(2)}`;
}

// ============================================================================
// Category Normalization Helper
// ============================================================================

const normalizeCategory = (raw: string | undefined): MarketCategory | null => {
  if (!raw) return null;
  const lower = raw.toLowerCase();

  // Map common variations to standard categories
  if (lower.includes("sport") || lower.includes("nfl") || lower.includes("nba") ||
    lower.includes("soccer") || lower.includes("football") || lower.includes("baseball") ||
    lower.includes("hockey") || lower.includes("tennis") || lower.includes("golf")) {
    return "sports";
  }
  if (lower.includes("crypto") || lower.includes("bitcoin") || lower.includes("ethereum") ||
    lower.includes("btc") || lower.includes("eth") || lower.includes("token") ||
    lower.includes("defi") || lower.includes("blockchain")) {
    return "crypto";
  }
  if (lower.includes("politic") || lower.includes("election") || lower.includes("president") ||
    lower.includes("senate") || lower.includes("congress") || lower.includes("governor") ||
    lower.includes("trump") || lower.includes("biden") || lower.includes("vote")) {
    return "politics";
  }
  if (lower.includes("finance") || lower.includes("stock") || lower.includes("market") ||
    lower.includes("fed") || lower.includes("interest") || lower.includes("gdp") ||
    lower.includes("inflation") || lower.includes("economy")) {
    return "finance";
  }
  if (lower.includes("tech") || lower.includes("ai") || lower.includes("apple") ||
    lower.includes("google") || lower.includes("microsoft") || lower.includes("openai") ||
    lower.includes("software") || lower.includes("startup")) {
    return "tech";
  }
  return null;
};

// ============================================================================
// Filtering Helpers
// ============================================================================

function getMarketVolume(m: DisplayMarket): number {
  if (m.volumeNum !== undefined) return m.volumeNum;
  if (m.volumeUsd) return parseFloat(m.volumeUsd) || 0;
  return 0;
}

function getMarketOddsPct(m: DisplayMarket): number {
  if (m.yesPriceCents !== undefined) return m.yesPriceCents;
  if (typeof m.probability === "number") return m.probability;
  if (typeof m.probability === "string") return parseFloat(m.probability) || 50;
  return 50;
}

function applyColumnFilter(markets: DisplayMarket[], filter: ColumnFilter): DisplayMarket[] {
  return markets.filter(m => {
    const volume = getMarketVolume(m);
    const oddsPct = getMarketOddsPct(m);
    const liquidity = m.liquidity || 0; // Use actual liquidity field

    const volumeOk =
      (filter.volumeMin == null || volume >= filter.volumeMin) &&
      (filter.volumeMax == null || volume <= filter.volumeMax);

    const oddsOk =
      (filter.oddsMin == null || oddsPct >= filter.oddsMin) &&
      (filter.oddsMax == null || oddsPct <= filter.oddsMax);

    const liquidityOk =
      (filter.liquidityMin == null || liquidity >= filter.liquidityMin) &&
      (filter.liquidityMax == null || liquidity <= filter.liquidityMax);

    return volumeOk && oddsOk && liquidityOk;
  });
}

function countActiveFilters(filter: ColumnFilter): number {
  let count = 0;
  if (filter.volumeMin != null) count++;
  if (filter.volumeMax != null) count++;
  if (filter.oddsMin != null) count++;
  if (filter.oddsMax != null) count++;
  if (filter.liquidityMin != null) count++;
  if (filter.liquidityMax != null) count++;
  return count;
}

// Constants for pagination
const INITIAL_LOAD = 10;
const LOAD_MORE_COUNT = 10;

// ============================================================================
// Filter Popover Component
// ============================================================================

interface FilterPopoverProps {
  filter: ColumnFilter;
  onApply: (filter: ColumnFilter) => void;
  onClear: () => void;
}

function FilterPopover({ filter, onApply, onClear }: FilterPopoverProps) {
  const [localFilter, setLocalFilter] = useState<ColumnFilter>(filter);
  const [isOpen, setIsOpen] = useState(false);

  // Validation
  const volumeError = localFilter.volumeMin != null && localFilter.volumeMax != null &&
    localFilter.volumeMin > localFilter.volumeMax;
  const oddsError = localFilter.oddsMin != null && localFilter.oddsMax != null &&
    localFilter.oddsMin > localFilter.oddsMax;
  const hasError = volumeError || oddsError;

  const activeCount = countActiveFilters(filter);

  const handleApply = () => {
    if (!hasError) {
      onApply(localFilter);
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    const clearedFilter: ColumnFilter = {};
    setLocalFilter(clearedFilter);
    onClear();
    setIsOpen(false);
  };

  // Reset local filter when popover opens
  useEffect(() => {
    if (isOpen) {
      setLocalFilter(filter);
    }
  }, [isOpen, filter]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center gap-1 px-2 py-1 text-[var(--fs-xs)] text-gray-400 hover:text-gray-200 
                     bg-gray-800/30 hover:bg-gray-800/50 border border-gray-700/30 rounded-md transition-all"
        >
          <Filter className="w-3 h-3" />
          <span className="hidden sm:inline">Filter</span>
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#4a6fa5] text-white text-[10px] 
                           font-medium rounded-full flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 bg-[#111111] border border-gray-700/50 p-4 space-y-4"
        align="end"
      >
        {/* Volume Filter */}
        <div className="space-y-2">
          <label className="text-[var(--fs-xs)] text-gray-400 font-medium">Volume ($)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              min={0}
              value={localFilter.volumeMin ?? ""}
              onChange={(e) => setLocalFilter({
                ...localFilter,
                volumeMin: e.target.value ? Math.max(0, Number(e.target.value)) : undefined
              })}
              className="w-full px-2 py-1.5 text-[var(--fs-sm)] bg-gray-900/50 border border-gray-700/50 
                       rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#4a6fa5]"
            />
            <span className="text-gray-500">-</span>
            <input
              type="number"
              placeholder="Max"
              min={0}
              value={localFilter.volumeMax ?? ""}
              onChange={(e) => setLocalFilter({
                ...localFilter,
                volumeMax: e.target.value ? Math.max(0, Number(e.target.value)) : undefined
              })}
              className="w-full px-2 py-1.5 text-[var(--fs-sm)] bg-gray-900/50 border border-gray-700/50 
                       rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#4a6fa5]"
            />
          </div>
          {volumeError && (
            <p className="text-[var(--fs-xs)] text-red-400">Min must be ≤ Max</p>
          )}
        </div>

        {/* Odds Filter */}
        <div className="space-y-2">
          <label className="text-[var(--fs-xs)] text-gray-400 font-medium">Odds (%)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              min={0}
              max={100}
              value={localFilter.oddsMin ?? ""}
              onChange={(e) => setLocalFilter({
                ...localFilter,
                oddsMin: e.target.value ? Math.min(100, Math.max(0, Number(e.target.value))) : undefined
              })}
              className="w-full px-2 py-1.5 text-[var(--fs-sm)] bg-gray-900/50 border border-gray-700/50 
                       rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#4a6fa5]"
            />
            <span className="text-gray-500">-</span>
            <input
              type="number"
              placeholder="Max"
              min={0}
              max={100}
              value={localFilter.oddsMax ?? ""}
              onChange={(e) => setLocalFilter({
                ...localFilter,
                oddsMax: e.target.value ? Math.min(100, Math.max(0, Number(e.target.value))) : undefined
              })}
              className="w-full px-2 py-1.5 text-[var(--fs-sm)] bg-gray-900/50 border border-gray-700/50 
                       rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#4a6fa5]"
            />
          </div>
          {oddsError && (
            <p className="text-[var(--fs-xs)] text-red-400">Min must be ≤ Max</p>
          )}
        </div>

        {/* Liquidity Filter */}
        <div className="space-y-2">
          <label className="text-[var(--fs-xs)] text-gray-400 font-medium">Liquidity ($)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              min={0}
              value={localFilter.liquidityMin ?? ""}
              onChange={(e) => setLocalFilter({
                ...localFilter,
                liquidityMin: e.target.value ? Math.max(0, Number(e.target.value)) : undefined
              })}
              className="w-full px-2 py-1.5 text-[var(--fs-sm)] bg-gray-900/50 border border-gray-700/50 
                       rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#4a6fa5]"
            />
            <span className="text-gray-500">-</span>
            <input
              type="number"
              placeholder="Max"
              min={0}
              value={localFilter.liquidityMax ?? ""}
              onChange={(e) => setLocalFilter({
                ...localFilter,
                liquidityMax: e.target.value ? Math.max(0, Number(e.target.value)) : undefined
              })}
              className="w-full px-2 py-1.5 text-[var(--fs-sm)] bg-gray-900/50 border border-gray-700/50 
                       rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#4a6fa5]"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
          <button
            onClick={handleClear}
            className="flex-1 px-3 py-1.5 text-[var(--fs-sm)] text-gray-400 hover:text-gray-200 
                     bg-transparent border border-gray-700/50 rounded transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleApply}
            disabled={hasError}
            className="flex-1 px-3 py-1.5 text-[var(--fs-sm)] text-white bg-[#4a6fa5] hover:bg-[#5a7fb5] 
                     rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

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
  const yesCents = market.yesPriceCents ?? Number(market.probability);
  const probabilityDisplay = yesCents < 1 ? "<1" : formatCents(yesCents);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => prefetchMarketDetail(market.id)}
      className="market-card group"
    >
      {/* Market Image */}
      {market.image ? (
        <img
          src={market.image}
          alt=""
          className="market-card-image"
          loading="eager"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div className="market-card-image bg-gray-800/50" />
      )}

      {/* Market Info */}
      <div className="market-card-info">
        <p className="market-card-title">
          {market.name || market.title}
        </p>
        <div className="market-card-meta">
          <span className="market-card-probability">{probabilityDisplay}%</span>
          {showEndDate && market.timeUntilClose && (
            <span className="text-[var(--fs-xs)] text-orange-400/80 bg-orange-900/20 px-[var(--sp-2)] py-[var(--sp-1)] rounded-[var(--r-sm)]">
              {formatTimeUntilClose(market.timeUntilClose)}
            </span>
          )}
          {!showEndDate && market.volume && (
            <span className="market-card-volume">{market.volume}</span>
          )}
        </div>
      </div>

      {/* Bookmark Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onBookmark();
        }}
        className="text-gray-600 hover:text-[#4a6fa5] transition-all duration-200 flex-shrink-0 opacity-0 group-hover:opacity-100"
      >
        <Bookmark className={`w-[var(--icon-sm)] h-[var(--icon-sm)] ${isBookmarked ? "fill-current text-[#4a6fa5] opacity-100" : ""}`} />
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
