import { useState, useEffect } from "react";
import { Search, Bookmark } from "lucide-react";
import { BookmarkedMarket } from "../App";
import { getTrendingMarkets, getActiveMarkets } from "../services/polymarketApi";

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

type TimeFilter = "24h" | "7d" | "1m";

function convertApiMarketToDisplay(market: any, timeframe: TimeFilter = "24h"): DisplayMarket {
  // Determine which volume field to use based on timeframe
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

export function Discover({ toggleBookmark, isBookmarked, onWalletClick, onMarketClick }: DiscoverProps) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("24h");
  const [markets, setMarkets] = useState<DisplayMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        setLoading(true);
        setError(null);
        // Get trending markets for the selected timeframe
        const data = await getTrendingMarkets(timeFilter);
        
        // Safely handle data
        if (!Array.isArray(data)) {
          throw new Error("Invalid data format");
        }
        
        const displayMarkets = data
          .filter((m: any) => m && m.title) // Only markets with titles
          .map((m: any) => convertApiMarketToDisplay(m, timeFilter))
          .slice(0, 50); // Top 50 trending markets
        
        setMarkets(displayMarkets);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch markets";
        console.error("Error fetching markets:", message);
        setError(message);
        setMarkets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
  }, [timeFilter]);

  return (
    <div className="max-w-[1800px] mx-auto space-y-8">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
        <input
          type="text"
          placeholder="Search by wallet or market..."
          className="w-full bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-lg px-12 py-3 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-700/50 shadow-inner"
        />
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
                    Loading markets...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-red-500">
                    Error: {error}
                  </td>
                </tr>
              ) : markets.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">
                    No active markets found
                  </td>
                </tr>
              ) : (
                markets.map((market, index) => (
                  <tr
                    key={market.id}
                    onClick={() => onMarketClick(market)}
                    className={`border-b border-gray-800/30 hover:bg-gradient-to-r hover:from-[#111111] hover:to-transparent transition-all duration-150 cursor-pointer ${
                      index === markets.length - 1 ? "border-b-0" : ""
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
      </div>
    </div>
  );
}
