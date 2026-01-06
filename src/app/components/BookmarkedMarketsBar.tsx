import { BookmarkedMarket } from "../App";

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
      <div className="flex items-center gap-3 px-8 py-3 overflow-x-auto">
        {bookmarkedMarkets.map((market) => (
          <button
            key={market.id}
            onClick={() => onNavigate(market.id)}
            className="flex-shrink-0 flex items-center gap-3 px-4 py-1.5 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 rounded hover:border-gray-600/50 transition-all shadow-sm"
          >
            <span className="text-gray-400 max-w-[220px] truncate text-xs font-light">
              {market.name}
            </span>
            <span className="text-[#4a6fa5] text-xs font-normal">{market.probability}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}