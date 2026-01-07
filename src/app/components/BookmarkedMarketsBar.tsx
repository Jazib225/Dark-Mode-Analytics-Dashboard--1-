import { BookmarkedMarket } from "../App";
import { Bookmark } from "lucide-react";

function formatProbability(prob: number): string {
  if (prob < 0.1) return "<0.1";
  if (prob > 99.9) return ">99.9";
  if (prob < 1 || prob > 99) {
    return prob.toFixed(1);
  }
  if (Math.abs(prob - Math.round(prob)) < 0.05) {
    return Math.round(prob).toString();
  }
  return prob.toFixed(1);
}

interface BookmarkedMarketsBarProps {
  bookmarkedMarkets: BookmarkedMarket[];
  onNavigate: (marketId: string) => void;
}

export function BookmarkedMarketsBar({
  bookmarkedMarkets,
  onNavigate,
}: BookmarkedMarketsBarProps) {
  if (bookmarkedMarkets.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-gray-800/50 bg-gradient-to-b from-[#0d0d0d] to-[#0a0a0a]">
      <div className="flex items-center gap-4 px-8 py-3 overflow-x-auto">
        <Bookmark className="w-5 h-5 text-gray-400 flex-shrink-0" />
        {bookmarkedMarkets.map((market) => (
          <button
            key={market.id}
            onClick={() => onNavigate(market.id)}
            className="flex-shrink-0 flex items-center gap-3 px-4 py-1.5 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 rounded hover:border-gray-600/50 transition-all shadow-sm"
          >
            {market.image ? (
              <img 
                src={market.image} 
                alt="" 
                className="w-6 h-6 rounded object-cover flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-6 h-6 rounded bg-gray-800/50 flex-shrink-0" />
            )}
            <span className="text-gray-300 max-w-[200px] truncate text-[14px] font-light">
              {market.name}
            </span>
            <span className="text-[#4a6fa5] text-[14px] font-normal">{formatProbability(market.probability)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}