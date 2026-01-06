import { ArrowLeft, Bookmark } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";

interface MarketDetailProps {
  market: {
    id: string;
    name: string;
    probability: number;
    volume: string;
    change24h: string;
  };
  isBookmarked: boolean;
  toggleBookmark: () => void;
  onBack: () => void;
  onWalletClick?: (address: string) => void;
}

const probabilityData = [
  { time: "00:00", probability: 58 },
  { time: "04:00", probability: 61 },
  { time: "08:00", probability: 63 },
  { time: "12:00", probability: 65 },
  { time: "16:00", probability: 64 },
  { time: "20:00", probability: 67 },
];

const recentTrades = [
  {
    timestamp: "2026-01-05 14:23:17",
    wallet: "0x742d...3a1f",
    side: "YES",
    size: "$12,500",
    price: "0.67",
  },
  {
    timestamp: "2026-01-05 14:21:43",
    wallet: "0x8f3c...9b2d",
    side: "NO",
    size: "$8,200",
    price: "0.33",
  },
  {
    timestamp: "2026-01-05 14:18:09",
    wallet: "0x4a9b...7e5c",
    side: "YES",
    size: "$15,700",
    price: "0.66",
  },
  {
    timestamp: "2026-01-05 14:15:32",
    wallet: "0x1c7d...4f8a",
    side: "YES",
    size: "$6,400",
    price: "0.65",
  },
  {
    timestamp: "2026-01-05 14:12:58",
    wallet: "0x6e2f...1b9c",
    side: "NO",
    size: "$9,100",
    price: "0.34",
  },
];

const topTraders = [
  { wallet: "0x742d...3a1f", position: "YES", size: "$47,300", avgPrice: "0.64", pnl: "+$8,920" },
  { wallet: "0x8f3c...9b2d", position: "YES", size: "$38,200", avgPrice: "0.62", pnl: "+$7,450" },
  { wallet: "0x4a9b...7e5c", position: "NO", size: "$29,800", avgPrice: "0.36", pnl: "-$1,240" },
  { wallet: "0x1c7d...4f8a", position: "YES", size: "$23,500", avgPrice: "0.63", pnl: "+$3,870" },
];

export function MarketDetail({
  market,
  isBookmarked,
  toggleBookmark,
  onBack,
  onWalletClick,
}: MarketDetailProps) {
  const [tradeAmount, setTradeAmount] = useState("");
  const [tradeSide, setTradeSide] = useState<"YES" | "NO">("YES");

  return (
    <div className="max-w-[1800px] mx-auto">
      <div className="grid grid-cols-[1fr,360px] gap-8">
        {/* Left Column - Market Data */}
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <button
                onClick={onBack}
                className="mt-1 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-2xl font-light tracking-tight text-gray-100 mb-2">
                  {market.name}
                </h1>
                <div className="flex items-center gap-6 text-xs text-gray-500 font-light">
                  <span>
                    Volume: <span className="text-gray-400">{market.volume}</span>
                  </span>
                  <span
                    className={market.change24h.startsWith("+") ? "text-green-500" : "text-red-500"}
                  >
                    24h: {market.change24h}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={toggleBookmark}
              className="text-gray-600 hover:text-[#4a6fa5] transition-all duration-200"
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? "fill-current text-[#4a6fa5]" : ""}`} />
            </button>
          </div>

          {/* Probability Chart */}
          <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl p-6 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-light tracking-wide text-gray-400 uppercase">
                Probability
              </h3>
              <div className="text-3xl font-light text-[#4a6fa5] tracking-tight">
                {market.probability}%
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={probabilityData}>
                <XAxis
                  dataKey="time"
                  stroke="#3a3a3a"
                  tick={{ fill: "#666", fontSize: 10 }}
                  axisLine={false}
                />
                <YAxis
                  stroke="#3a3a3a"
                  tick={{ fill: "#666", fontSize: 10 }}
                  axisLine={false}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0d0d0d",
                    border: "1px solid #3a3a3a",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  labelStyle={{ color: "#999" }}
                />
                <Line
                  type="monotone"
                  dataKey="probability"
                  stroke="#4a6fa5"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Trades */}
          <div>
            <h3 className="text-lg font-light tracking-tight text-gray-300 mb-4 uppercase">
              Recent Trades
            </h3>
            <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl overflow-hidden shadow-xl shadow-black/20">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800/50 bg-gradient-to-b from-[#111111] to-[#0d0d0d]">
                    <th className="text-left py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                      Timestamp
                    </th>
                    <th className="text-left py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                      Wallet
                    </th>
                    <th className="text-left py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                      Side
                    </th>
                    <th className="text-right py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                      Size
                    </th>
                    <th className="text-right py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                      Price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.map((trade, index) => (
                    <tr
                      key={index}
                      className={`border-b border-gray-800/30 hover:bg-gradient-to-r hover:from-[#111111] hover:to-transparent transition-all duration-150 ${
                        index === recentTrades.length - 1 ? "border-b-0" : ""
                      }`}
                    >
                      <td className="py-3.5 px-5 text-gray-500 font-mono font-light text-[11px]">
                        {trade.timestamp}
                      </td>
                      <td
                        className="py-3.5 px-5 text-gray-400 font-mono font-light cursor-pointer hover:text-[#4a6fa5] transition-colors"
                        onClick={() => onWalletClick?.(trade.wallet)}
                      >
                        {trade.wallet}
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`font-normal ${
                            trade.side === "YES" ? "text-green-500" : "text-red-500"
                          }`}
                        >
                          {trade.side}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right text-gray-300 font-light">
                        {trade.size}
                      </td>
                      <td className="py-3.5 px-5 text-right text-gray-400 font-light">
                        {trade.price}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Traders */}
          <div>
            <h3 className="text-lg font-light tracking-tight text-gray-300 mb-4 uppercase">
              Top Traders in This Market
            </h3>
            <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl overflow-hidden shadow-xl shadow-black/20">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800/50 bg-gradient-to-b from-[#111111] to-[#0d0d0d]">
                    <th className="text-left py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                      Wallet
                    </th>
                    <th className="text-left py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                      Position
                    </th>
                    <th className="text-right py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                      Size
                    </th>
                    <th className="text-right py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                      Avg Price
                    </th>
                    <th className="text-right py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                      PnL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topTraders.map((trader, index) => (
                    <tr
                      key={index}
                      className={`border-b border-gray-800/30 hover:bg-gradient-to-r hover:from-[#111111] hover:to-transparent transition-all duration-150 ${
                        index === topTraders.length - 1 ? "border-b-0" : ""
                      }`}
                    >
                      <td
                        className="py-3.5 px-5 text-gray-300 font-mono font-light cursor-pointer hover:text-[#4a6fa5] transition-colors"
                        onClick={() => onWalletClick?.(trader.wallet)}
                      >
                        {trader.wallet}
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`font-normal ${
                            trader.position === "YES" ? "text-green-500" : "text-red-500"
                          }`}
                        >
                          {trader.position}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right text-gray-300 font-light">
                        {trader.size}
                      </td>
                      <td className="py-3.5 px-5 text-right text-gray-400 font-light">
                        {trader.avgPrice}
                      </td>
                      <td
                        className={`py-3.5 px-5 text-right font-light ${
                          trader.pnl.startsWith("+") ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {trader.pnl}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - Trading Panel */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl p-6 sticky top-8 shadow-xl shadow-black/20">
            <h3 className="text-sm font-light tracking-wide text-gray-400 mb-6 uppercase">
              Trade
            </h3>

            {/* Side Selection */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setTradeSide("YES")}
                className={`py-3 text-xs font-normal tracking-wide rounded transition-all ${
                  tradeSide === "YES"
                    ? "bg-gradient-to-br from-green-900/40 to-green-900/20 border border-green-700/50 text-green-400 shadow-sm"
                    : "bg-gradient-to-br from-[#111111] to-[#0a0a0a] border border-gray-800/30 text-gray-500 hover:border-gray-700/50"
                }`}
              >
                YES
              </button>
              <button
                onClick={() => setTradeSide("NO")}
                className={`py-3 text-xs font-normal tracking-wide rounded transition-all ${
                  tradeSide === "NO"
                    ? "bg-gradient-to-br from-red-900/40 to-red-900/20 border border-red-700/50 text-red-400 shadow-sm"
                    : "bg-gradient-to-br from-[#111111] to-[#0a0a0a] border border-gray-800/30 text-gray-500 hover:border-gray-700/50"
                }`}
              >
                NO
              </button>
            </div>

            {/* Amount Input */}
            <div className="mb-6">
              <label className="block text-xs text-gray-500 mb-2 font-light uppercase tracking-wide">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-gray-600">
                  $
                </span>
                <input
                  type="text"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gradient-to-br from-[#111111] to-[#0a0a0a] border border-gray-800/50 rounded pl-7 pr-4 py-3 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-700/50 font-light shadow-inner"
                />
              </div>
            </div>

            {/* Trade Info */}
            <div className="mb-6 space-y-3 text-xs">
              <div className="flex justify-between text-gray-500 font-light">
                <span>Current Price</span>
                <span className="text-gray-400 font-normal">
                  {tradeSide === "YES" ? "0.67" : "0.33"}
                </span>
              </div>
              <div className="flex justify-between text-gray-500 font-light">
                <span>Potential Payout</span>
                <span className="text-gray-400 font-normal">
                  {tradeAmount ? `$${(parseFloat(tradeAmount) * 1.49).toFixed(2)}` : "$0.00"}
                </span>
              </div>
              <div className="flex justify-between text-gray-500 font-light">
                <span>Max Profit</span>
                <span className="text-green-500 font-normal">
                  {tradeAmount ? `+$${(parseFloat(tradeAmount) * 0.49).toFixed(2)}` : "$0.00"}
                </span>
              </div>
            </div>

            {/* Buy Button */}
            <button className="w-full py-3 bg-gradient-to-br from-[#5a7fb5] to-[#4a6fa5] text-gray-100 text-xs font-normal tracking-wide rounded hover:from-[#6a8fc5] hover:to-[#5a7fb5] transition-all shadow-lg">
              Buy {tradeSide}
            </button>

            {/* Balance */}
            <div className="mt-6 pt-6 border-t border-gray-800/50 text-xs text-gray-500 font-light">
              <div className="flex justify-between">
                <span>Available Balance</span>
                <span className="text-gray-400 font-normal">$3,320.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
