import { useState, useEffect } from "react";
import { Bookmark, ChevronDown } from "lucide-react";
import { BookmarkedMarket } from "../App";
import { MarketDetail } from "./MarketDetail";
import { marketsApi } from "../services/api";

interface MarketsProps {
  toggleBookmark: (market: BookmarkedMarket) => void;
  isBookmarked: (marketId: string) => boolean;
  onWalletClick?: (address: string) => void;
  initialMarketId?: string | null;
}

interface DisplayMarket {
  id: string;
  name: string;
  probability: number;
  volume: string;
  volumeNum?: number;
  change24h: string;
  smartWalletActivity: string;
}

function convertApiMarketToDisplay(market: any): DisplayMarket {
  const volume = market.volumeNum || 0;
  const volumeStr = volume > 1000000 ? `$${(volume / 1000000).toFixed(1)}M` : 
                    volume > 1000 ? `$${(volume / 1000).toFixed(0)}K` : 
                    `$${volume}`;
  
  return {
    id: market.id,
    name: market.title || market.name || "Unknown",
    probability: Math.round(parseFloat(String(market.lastPriceUsd || 0.5)) * 100),
    volume: volumeStr,
    volumeNum: volume,
    change24h: "+0%",
    smartWalletActivity: "Medium",
  };
}

export function Markets({ toggleBookmark, isBookmarked, onWalletClick, initialMarketId }: MarketsProps) {
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(initialMarketId || null);
  const [sortBy, setSortBy] = useState<"trending" | "category" | "bookmarked">("trending");
  const [allMarkets, setAllMarkets] = useState<DisplayMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await marketsApi.listMarkets({ limit: 100 });
        const displayMarkets = (data || []).map(convertApiMarketToDisplay);
        setAllMarkets(displayMarkets);
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
  }, []);

  if (selectedMarketId) {
    const selectedMarket = allMarkets.find((m) => m.id === selectedMarketId);
    if (selectedMarket) {
      return (
        <MarketDetail
          market={selectedMarket}
          isBookmarked={isBookmarked(selectedMarketId)}
          toggleBookmark={() =>
            toggleBookmark({
              id: selectedMarket.id,
              name: selectedMarket.name,
              probability: selectedMarket.probability,
            })
          }
          onBack={() => setSelectedMarketId(null)}
          onWalletClick={onWalletClick}
        />
      );
    }
  }

  return (
    <div className="max-w-[1800px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-light tracking-tight text-gray-300 uppercase">All Markets</h2>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "trending" | "category" | "bookmarked")}
            className="appearance-none bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 rounded px-4 py-1.5 pr-9 text-xs font-light text-gray-300 focus:outline-none focus:border-gray-600/50 cursor-pointer shadow-sm"
          >
            <option value="trending">Sort by Trending</option>
            <option value="category">Sort by Category</option>
            <option value="bookmarked">Sort by Bookmarked</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        </div>
      </div>
      <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl overflow-hidden shadow-xl shadow-black/20">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800/50 bg-gradient-to-b from-[#111111] to-[#0d0d0d]">
              <th className="text-left py-4 px-5 text-gray-500 font-light tracking-wide uppercase">Market</th>
              <th className="text-right py-4 px-5 text-gray-500 font-light tracking-wide uppercase">Probability</th>
              <th className="text-right py-4 px-5 text-gray-500 font-light tracking-wide uppercase">Volume</th>
              <th className="text-right py-4 px-5 text-gray-500 font-light tracking-wide uppercase">24h Change</th>
              <th className="text-right py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                Smart Wallet Activity
              </th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  Loading markets...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-red-500">
                  Error: {error}
                </td>
              </tr>
            ) : allMarkets.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  No markets found
                </td>
              </tr>
            ) : (
              allMarkets.map((market, index) => (
                <tr
                  key={market.id}
                  className={`border-b border-gray-800/30 hover:bg-gradient-to-r hover:from-[#111111] hover:to-transparent transition-all duration-150 cursor-pointer ${
                    index === allMarkets.length - 1 ? "border-b-0" : ""
                  }`}
                >
                  <td
                    className="py-3.5 px-5 text-gray-300 max-w-[500px] truncate font-light"
                    onClick={() => setSelectedMarketId(market.id)}
                  >
                    {market.name}
                  </td>
                  <td className="py-3.5 px-5 text-right text-[#4a6fa5] font-normal">{market.probability}%</td>
                  <td className="py-3.5 px-5 text-right text-gray-400 font-light">{market.volume}</td>
                  <td
                    className={`py-3.5 px-5 text-right font-light ${
                      market.change24h.startsWith("+") ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {market.change24h}
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <span
                      className={`font-light ${
                        market.smartWalletActivity === "High"
                          ? "text-green-500"
                          : market.smartWalletActivity === "Medium"
                          ? "text-yellow-600"
                          : "text-gray-600"
                      }`}
                    >
                      {market.smartWalletActivity}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark({
                          id: market.id,
                          name: market.name,
                          probability: market.probability,
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
  );
}