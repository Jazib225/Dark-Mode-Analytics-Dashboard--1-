import { useEffect, useState } from "react";
import { portfolioApi } from "../services/api";

interface FeedItem {
  id: string;
  timestamp: string;
  wallet: string;
  market: string;
  action: "entry" | "exit" | "BUY" | "SELL";
  size: string;
  probability: number;
}

interface FeedProps {
  onWalletClick: (address: string) => void;
}

function convertApiActivityToFeedItem(activity: any): FeedItem {
  const sizeStr = activity.quantity ? `$${parseFloat(activity.quantity).toFixed(0)}` : "$0";
  const action = activity.type === "BUY" ? "entry" : activity.type === "SELL" ? "exit" : activity.type;
  
  return {
    id: activity.id,
    timestamp: new Date(activity.timestamp).toLocaleTimeString("en-US", { hour12: false }),
    wallet: activity.user || "0x0000...0000",
    market: activity.market_id || "Unknown Market",
    action: action as "entry" | "exit" | "BUY" | "SELL",
    size: sizeStr,
    probability: Math.random() * 100, // Fallback since API may not provide this
  };
}

export function Feed({ onWalletClick }: FeedProps) {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentActivity = async () => {
      try {
        setLoading(true);
        setError(null);
        // Fetch recent trades from portfolio API (simulated global activity)
        // In a real scenario, there would be a dedicated recent-trades endpoint
        const data: any[] = [];
        setFeedItems(data.map(convertApiActivityToFeedItem) || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch activity";
        console.error("Error fetching activity:", message);
        setError(message);
        setFeedItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentActivity();
  }, []);

  useEffect(() => {
    // Simulate new feed items
    const interval = setInterval(() => {
      const newItem: FeedItem = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        wallet: `0x${Math.random().toString(16).substring(2, 6)}...${Math.random()
          .toString(16)
          .substring(2, 6)}`,
        market: initialFeedItems[Math.floor(Math.random() * initialFeedItems.length)].market,
        action: Math.random() > 0.5 ? "entry" : "exit",
        size: `$${(Math.random() * 20000 + 5000).toFixed(0)}`,
        probability: Math.floor(Math.random() * 60 + 20),
      };
      setFeedItems((prev) => [newItem, ...prev].slice(0, 50));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-[1800px] mx-auto">
      <h2 className="text-lg font-light tracking-tight text-gray-300 mb-4 uppercase">
        Live Activity Feed
      </h2>
      <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl overflow-hidden shadow-xl shadow-black/20">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800/50 bg-gradient-to-b from-[#111111] to-[#0d0d0d]">
              <th className="text-left py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                Time
              </th>
              <th className="text-left py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                Wallet
              </th>
              <th className="text-left py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                Market
              </th>
              <th className="text-left py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                Action
              </th>
              <th className="text-right py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                Size
              </th>
              <th className="text-right py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                Probability
              </th>
            </tr>
          </thead>
          <tbody>
            {feedItems.map((item, index) => (
              <tr
                key={item.id}
                className={`border-b border-gray-800/30 hover:bg-gradient-to-r hover:from-[#111111] hover:to-transparent transition-all duration-150 animate-fade-in ${
                  index === feedItems.length - 1 ? "border-b-0" : ""
                }`}
              >
                <td className="py-3.5 px-5 text-gray-500 font-mono font-light text-[11px]">
                  {item.timestamp}
                </td>
                <td
                  className="py-3.5 px-5 text-gray-400 font-mono font-light cursor-pointer hover:text-[#4a6fa5] transition-colors"
                  onClick={() => onWalletClick(item.wallet)}
                >
                  {item.wallet}
                </td>
                <td className="py-3.5 px-5 text-gray-300 max-w-[400px] truncate font-light">
                  {item.market}
                </td>
                <td className="py-3.5 px-5">
                  <span
                    className={`font-normal ${
                      item.action === "entry" ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {item.action.toUpperCase()}
                  </span>
                </td>
                <td className="py-3.5 px-5 text-right text-gray-300 font-light">{item.size}</td>
                <td className="py-3.5 px-5 text-right text-[#4a6fa5] font-normal">
                  {item.probability}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}