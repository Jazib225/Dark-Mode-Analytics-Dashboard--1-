import { useState, useEffect, useMemo } from "react";
import { Bookmark, Loader2, TrendingUp, Sparkles, Clock } from "lucide-react";
import { BookmarkedMarket } from "../App";
import { MarketDetail } from "./MarketDetail";
import {
  getTrendingMarkets,
  getNewMarkets,
  getNearlyResolvedMarkets,
  formatTimeUntilClose
} from "../services/polymarketApi";
import {
  fetchMarketList,
  prefetchMarketDetail,
  prefetchOtherTimeframes,
  type MarketCardDTO
} from "../services/marketDataClient";

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
  image?: string | null;
  createdAt?: string;
  endDate?: string;
  timeUntilClose?: number;
}

type TimeFilter = "24h" | "7d" | "1m";

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

function convertApiMarketToDisplay(market: any, timeframe: TimeFilter = "24h"): DisplayMarket {
  let volumeUsd = market.volumeUsd;
  if (timeframe === "24h") {
    volumeUsd = market.volume24hr || market.volumeUsd;
  } else if (timeframe === "7d") {
    volumeUsd = market.volume7d || market.volumeUsd;
  } else if (timeframe === "1m") {
    volumeUsd = market.volume1mo || market.volumeUsd;
  }

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
    volume: formatVolume(parseFloat(String(volumeUsd || 0))),
    image: market.image || null,
    createdAt: market.createdAt,
    endDate: market.endDate,
    timeUntilClose: market.timeUntilClose,
  };
}

function convertV2MarketToDisplay(market: MarketCardDTO, timeframe: TimeFilter = "24h"): DisplayMarket {
  let volumeNum = 0;
  if (timeframe === "24h") {
    volumeNum = market.volume24hr || 0;
  } else if (timeframe === "7d") {
    volumeNum = market.volume7d || 0;
  } else if (timeframe === "1m") {
    volumeNum = market.volume1mo || 0;
  }

  const probability = market.probability || 50;
  const yesPriceCents = probability;
  const noPriceCents = 100 - probability;

  return {
    id: market.id,
    name: market.question,
    title: market.question,
    probability: probability,
    yesPriceCents,
    noPriceCents,
    volumeUsd: String(volumeNum),
    volume: formatVolume(volumeNum),
    image: market.image || null,
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
const INITIAL_LOAD = 10;
const LOAD_MORE_COUNT = 10;

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
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("24h");

  // State for all three columns
  const [trendingMarkets, setTrendingMarkets] = useState<DisplayMarket[]>(() =>
    loadCachedMarkets(MARKETS_CACHE_PREFIX + "trending_" + "24h") || []
  );
  const [newMarkets, setNewMarkets] = useState<DisplayMarket[]>(() =>
    loadCachedMarkets(MARKETS_CACHE_PREFIX + "new") || []
  );
  const [nearlyResolvedMarkets, setNearlyResolvedMarkets] = useState<DisplayMarket[]>(() =>
    loadCachedMarkets(MARKETS_CACHE_PREFIX + "resolved") || []
  );

  // Loading states for each column
  const [loadingTrending, setLoadingTrending] = useState(() =>
    !loadCachedMarkets(MARKETS_CACHE_PREFIX + "trending_" + "24h")
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

  // Fetch all market data in parallel
  useEffect(() => {
    const fetchAllMarkets = async () => {
      // Check caches first
      const cachedTrending = loadCachedMarkets(MARKETS_CACHE_PREFIX + "trending_" + timeFilter);
      const cachedNew = loadCachedMarkets(MARKETS_CACHE_PREFIX + "new");
      const cachedResolved = loadCachedMarkets(MARKETS_CACHE_PREFIX + "resolved");

      // Use cached data if available
      if (cachedTrending && cachedTrending.length > 0) {
        setTrendingMarkets(cachedTrending);
        setLoadingTrending(false);
        preloadImages(cachedTrending);
      }
      if (cachedNew && cachedNew.length > 0) {
        setNewMarkets(cachedNew);
        setLoadingNew(false);
        preloadImages(cachedNew);
      }
      if (cachedResolved && cachedResolved.length > 0) {
        setNearlyResolvedMarkets(cachedResolved);
        setLoadingResolved(false);
        preloadImages(cachedResolved);
      }

      // If any cache was used, show refresh indicator
      if (cachedTrending || cachedNew || cachedResolved) {
        setIsRefreshing(true);
      }

      // Fetch all three columns in parallel (no waterfall!)
      try {
        const [trendingData, newData, resolvedData] = await Promise.all([
          // Trending Markets - Use V2 API with fallback
          (async () => {
            try {
              const { markets } = await fetchMarketList(timeFilter);
              if (Array.isArray(markets) && markets.length > 0) {
                return markets
                  .filter((m: MarketCardDTO) => m && m.question)
                  .map((m: MarketCardDTO) => convertV2MarketToDisplay(m, timeFilter));
              }
            } catch (e) {
              console.warn("V2 API failed, using fallback:", e);
            }
            // Fallback to legacy API
            const data = await getTrendingMarkets(timeFilter);
            return data
              .filter((m: any) => m && m.title)
              .map((m: any) => convertApiMarketToDisplay(m, timeFilter));
          })(),
          // New Markets
          getNewMarkets(30),
          // Nearly Resolved Markets
          getNearlyResolvedMarkets(72, 30),
        ]);

        // Update trending
        if (trendingData && trendingData.length > 0) {
          setTrendingMarkets(trendingData);
          saveCachedMarkets(trendingData, MARKETS_CACHE_PREFIX + "trending_" + timeFilter);
          preloadImages(trendingData);
        }
        setLoadingTrending(false);

        // Update new markets
        if (newData && newData.length > 0) {
          const displayNew = newData.map((m: any) => convertApiMarketToDisplay(m, "24h"));
          setNewMarkets(displayNew);
          saveCachedMarkets(displayNew, MARKETS_CACHE_PREFIX + "new");
          preloadImages(displayNew);
        }
        setLoadingNew(false);

        // Update nearly resolved
        if (resolvedData && resolvedData.length > 0) {
          const displayResolved = resolvedData.map((m: any) => ({
            ...convertApiMarketToDisplay(m, "24h"),
            timeUntilClose: m.timeUntilClose,
            endDate: m.endDate,
          }));
          setNearlyResolvedMarkets(displayResolved);
          saveCachedMarkets(displayResolved, MARKETS_CACHE_PREFIX + "resolved");
          preloadImages(displayResolved);
        }
        setLoadingResolved(false);

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
  }, [timeFilter]);

  // Prefetch other timeframes in background
  useEffect(() => {
    const prefetchTimeout = setTimeout(() => {
      prefetchOtherTimeframes(timeFilter);
    }, 1500);
    return () => clearTimeout(prefetchTimeout);
  }, [timeFilter]);

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
      {/* Time Filter Header */}
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
        <div className="flex items-center gap-[var(--sp-1)] sm:gap-[var(--sp-2)]">
          <button
            onClick={() => setTimeFilter("24h")}
            className={`px-[var(--sp-3)] sm:px-[var(--sp-4)] py-[var(--sp-2)] text-[var(--fs-xs)] sm:text-[var(--fs-sm)] font-light tracking-wide rounded-[var(--r-md)] transition-all ${timeFilter === "24h"
              ? "bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 text-gray-200 shadow-sm"
              : "bg-transparent border border-gray-800/30 text-gray-400 hover:text-gray-300 hover:border-gray-700/50"
              }`}
          >
            24H
          </button>
          <button
            onClick={() => setTimeFilter("7d")}
            className={`px-[var(--sp-3)] sm:px-[var(--sp-4)] py-[var(--sp-2)] text-[var(--fs-xs)] sm:text-[var(--fs-sm)] font-light tracking-wide rounded-[var(--r-md)] transition-all ${timeFilter === "7d"
              ? "bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 text-gray-200 shadow-sm"
              : "bg-transparent border border-gray-800/30 text-gray-400 hover:text-gray-300 hover:border-gray-700/50"
              }`}
          >
            7D
          </button>
          <button
            onClick={() => setTimeFilter("1m")}
            className={`px-[var(--sp-3)] sm:px-[var(--sp-4)] py-[var(--sp-2)] text-[var(--fs-xs)] sm:text-[var(--fs-sm)] font-light tracking-wide rounded-[var(--r-md)] transition-all ${timeFilter === "1m"
              ? "bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 text-gray-200 shadow-sm"
              : "bg-transparent border border-gray-800/30 text-gray-400 hover:text-gray-300 hover:border-gray-700/50"
              }`}
          >
            1M
          </button>
        </div>
      </div>

      {/* 3-Column Grid Layout - CSS-only responsive */}
      <div className="markets-3col">

        {/* Column 1: Trending Markets */}
        <div className="market-column">
          {/* Column Header */}
          <div className="market-column-header">
            <h2>
              <TrendingUp className="w-[var(--icon-sm)] h-[var(--icon-sm)] text-[#4a6fa5]" />
              Trending
            </h2>
            <span>By {timeFilter} volume</span>
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
            <h2>
              <Sparkles className="w-[var(--icon-sm)] h-[var(--icon-sm)] text-emerald-500" />
              New Markets
            </h2>
            <span>Newest first</span>
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
            <h2>
              <Clock className="w-[var(--icon-sm)] h-[var(--icon-sm)] text-orange-500" />
              Closing Soon
            </h2>
            <span>Next 72h</span>
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
