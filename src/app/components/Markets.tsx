import { useState, useEffect } from "react";
import { Bookmark, Loader2, TrendingUp, Sparkles, Clock, Search } from "lucide-react";
import { BookmarkedMarket } from "../App";
import { MarketDetail } from "./MarketDetail";
import { getTrendingMarkets } from "../services/polymarketApi";
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
  if (cents < 1 || cents > 99) {
    return cents.toFixed(1);
  }
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
  image?: string | null;
}

type TimeFilter = "24h" | "7d" | "1m";

const MARKETS_CACHE_PREFIX = "polymarket_markets_v2_";
const CACHE_EXPIRY_MS = 2 * 60 * 60 * 1000;

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

function loadCachedMarkets(timeFilter: TimeFilter): DisplayMarket[] | null {
  try {
    const cached = localStorage.getItem(MARKETS_CACHE_PREFIX + timeFilter);
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

const INITIAL_LOAD = 15;
const LOAD_MORE_COUNT = 15;

export function Markets({ toggleBookmark, isBookmarked, onWalletClick, onMarketSelect, onBack, initialMarketId, initialMarketData }: MarketsProps) {
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(initialMarketId ?? null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("24h");

  useEffect(() => {
    if (initialMarketId !== undefined && initialMarketId !== selectedMarketId) {
      setSelectedMarketId(initialMarketId);
    }
  }, [initialMarketId]);
  
  const [allMarkets, setAllMarkets] = useState<DisplayMarket[]>(() => {
    const cached = loadCachedMarkets("24h");
    return cached || [];
  });
  const [displayedCount, setDisplayedCount] = useState(INITIAL_LOAD);
  const [loading, setLoading] = useState(() => {
    return loadCachedMarkets("24h") === null;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleTableMarketClick = (market: DisplayMarket) => {
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

  useEffect(() => {
    const fetchMarkets = async () => {
      const cached = loadCachedMarkets(timeFilter);
      
      if (cached && cached.length > 0) {
        setAllMarkets(cached);
        setLoading(false);
        setDisplayedCount(INITIAL_LOAD);
        setIsRefreshing(true);
        preloadImages(cached);
      } else {
        setLoading(true);
        setDisplayedCount(INITIAL_LOAD);
      }
      
      setError(null);
      
      try {
        const { markets: data } = await fetchMarketList(timeFilter);
        
        if (!Array.isArray(data)) {
          throw new Error("Invalid data format");
        }
        
        const displayMarkets = data
          .filter((m: MarketCardDTO) => m && m.question)
          .map((m: MarketCardDTO) => convertV2MarketToDisplay(m, timeFilter));
        
        setAllMarkets(displayMarkets);
        saveCachedMarkets(displayMarkets, timeFilter);
        preloadImages(displayMarkets);
        
      } catch (err) {
        console.warn("V2 API failed, falling back to legacy:", err);
        try {
          const data = await getTrendingMarkets(timeFilter);
          if (Array.isArray(data)) {
            const displayMarkets = data
              .filter((m: any) => m && (m.title || m.question))
              .map((m: any) => ({
                id: m.id,
                name: m.question || m.title,
                title: m.question || m.title,
                probability: m.probability || 50,
                yesPriceCents: m.yesPriceCents || m.probability,
                noPriceCents: m.noPriceCents || (100 - (m.probability || 50)),
                volume: formatVolume(parseFloat(m.volumeUsd || 0)),
                volumeUsd: String(m.volumeUsd || 0),
                image: m.image || null,
              }));
            setAllMarkets(displayMarkets);
            saveCachedMarkets(displayMarkets, timeFilter);
            preloadImages(displayMarkets);
          }
        } catch (fallbackErr) {
          const message = fallbackErr instanceof Error ? fallbackErr.message : "Failed to fetch markets";
          console.error("Error fetching markets:", message);
          if (!cached || cached.length === 0) {
            setError(message);
            setAllMarkets([]);
          }
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    };

    fetchMarkets();
  }, [timeFilter]);

  useEffect(() => {
    const prefetchTimeout = setTimeout(() => {
      prefetchOtherTimeframes(timeFilter);
    }, 1500);
    
    return () => clearTimeout(prefetchTimeout);
  }, [timeFilter]);

  const handleLoadMore = () => {
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayedCount(prev => Math.min(prev + LOAD_MORE_COUNT, allMarkets.length));
      setLoadingMore(false);
    }, 200);
  };

  const displayedMarkets = allMarkets.slice(0, displayedCount);
  const hasMoreMarkets = displayedCount < allMarkets.length;

  const trendingMarkets = displayedMarkets;
  const newMarkets = [...allMarkets].slice(0, displayedCount);
  const resolvingSoonMarkets = [...allMarkets].slice(0, displayedCount);

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
      selectedMarket = allMarkets.find((m) => m.id === selectedMarketId);
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

  // Render a column with markets
  const renderColumn = (title: string, icon: React.ReactNode, markets: DisplayMarket[]) => (
    <div className="flex flex-col h-full border-l border-slate-800 first:border-l-0 bg-slate-900/30">
      {/* Column Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <h2 className="text-lg font-bold text-white">{title}</h2>
        </div>
        <p className="text-sm text-slate-400">{markets.length} markets</p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {markets.length > 0 ? (
          markets.map((market) => (
            <div
              key={market.id}
              onClick={() => {
                handleTableMarketClick(market);
                prefetchMarketDetail(market.id);
              }}
              className="cursor-pointer group"
            >
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-blue-600 hover:bg-slate-800 transition-all duration-200">
                <h3 className="font-semibold text-white text-sm mb-2 line-clamp-2 group-hover:text-blue-400">
                  {market.name || market.title}
                </h3>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                  <span className="inline-block px-2 py-1 bg-slate-700/50 rounded text-xs">
                    {market.volume}
                  </span>
                  {market.probability && (
                    <span className="font-medium text-blue-400">
                      {Math.round(Number(market.probability) || 0)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
            No markets available
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-screen h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 z-20 bg-slate-950/80 backdrop-blur-sm border-b border-slate-800">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-white">Markets</h1>
            <div className="flex items-center gap-4">
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
              {isRefreshing && (
                <div className="flex items-center gap-1.5 text-[14px] text-gray-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Updating...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 bg-slate-950">
        {loading && !allMarkets.length ? (
          <div className="col-span-full flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
              <p className="text-slate-300">Loading markets...</p>
            </div>
          </div>
        ) : error && !allMarkets.length ? (
          <div className="col-span-full flex items-center justify-center h-full">
            <div className="text-center">
              <Search className="w-12 h-12 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-300">Error: {error}</p>
            </div>
          </div>
        ) : allMarkets.length > 0 ? (
          <>
            {renderColumn("🔥 Trending", <TrendingUp className="w-5 h-5 text-orange-500" />, trendingMarkets)}
            {renderColumn("✨ New", <Sparkles className="w-5 h-5 text-blue-500" />, newMarkets)}
            {renderColumn("⏰ Resolving Soon", <Clock className="w-5 h-5 text-green-500" />, resolvingSoonMarkets)}
          </>
        ) : (
          <div className="col-span-full flex items-center justify-center h-full">
            <div className="text-center">
              <Search className="w-12 h-12 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-300">No markets found</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
