import { ArrowLeft } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface WalletProfileProps {
  walletAddress: string;
  onClose: () => void;
}

const pnlData = [
  { date: "Jan 1", pnl: 0 },
  { date: "Jan 2", pnl: 12400 },
  { date: "Jan 3", pnl: 28900 },
  { date: "Jan 4", pnl: 45200 },
  { date: "Jan 5", pnl: 89100 },
  { date: "Jan 6", pnl: 147293 },
];

const tradeHistory = [
  {
    timestamp: "2026-01-05 12:34:21",
    market: "Will BTC reach $100k by Q1 2026?",
    side: "YES",
    size: "$12,500",
    price: "0.67",
    outcome: "Open",
  },
  {
    timestamp: "2026-01-04 18:23:45",
    market: "ETH 2.0 full rollout in 2026?",
    side: "NO",
    size: "$8,200",
    price: "0.58",
    outcome: "Closed",
  },
  {
    timestamp: "2026-01-04 14:12:09",
    market: "US Bitcoin Strategic Reserve established?",
    side: "YES",
    size: "$15,700",
    price: "0.71",
    outcome: "Open",
  },
  {
    timestamp: "2026-01-03 22:45:33",
    market: "New SEC crypto regulation proposal this quarter?",
    side: "NO",
    size: "$6,400",
    price: "0.46",
    outcome: "Closed",
  },
  {
    timestamp: "2026-01-03 16:28:14",
    market: "DeFi TVL to surpass $200B in 2026?",
    side: "YES",
    size: "$9,100",
    price: "0.59",
    outcome: "Open",
  },
  {
    timestamp: "2026-01-02 11:19:52",
    market: "Solana TVL to exceed Ethereum by year-end?",
    side: "NO",
    size: "$11,300",
    price: "0.77",
    outcome: "Closed",
  },
  {
    timestamp: "2026-01-02 09:05:28",
    market: "Major L2 hack resulting in >$50M loss?",
    side: "NO",
    size: "$7,800",
    price: "0.69",
    outcome: "Open",
  },
];

const connections = [
  { wallet: "0x8f3c...9b2d", transfers: 12, volume: "$34,200" },
  { wallet: "0x4a9b...7e5c", transfers: 8, volume: "$28,900" },
  { wallet: "0x1c7d...4f8a", transfers: 5, volume: "$15,600" },
  { wallet: "0x6e2f...1b9c", transfers: 3, volume: "$9,400" },
];

export function WalletProfile({ walletAddress, onClose }: WalletProfileProps) {
  return (
    <div className="max-w-[1800px] mx-auto space-y-8">
      {/* Wallet Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={onClose}
            className="mt-1 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-light tracking-tight text-gray-100 mb-3 font-mono">
              {walletAddress}
            </h1>
            <div className="flex items-center gap-8 text-xs">
              <div>
                <div className="text-gray-500 mb-1 font-light uppercase tracking-wide">
                  Total PnL
                </div>
                <div className="text-green-500 font-normal text-sm">+$147,293</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1 font-light uppercase tracking-wide">
                  Win Rate
                </div>
                <div className="text-gray-300 font-normal text-sm">78.3%</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1 font-light uppercase tracking-wide">
                  Total Volume
                </div>
                <div className="text-gray-300 font-normal text-sm">$1,284,920</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1 font-light uppercase tracking-wide">
                  Markets Traded
                </div>
                <div className="text-gray-300 font-normal text-sm">47</div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="px-5 py-2 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 rounded text-xs font-light text-gray-300 hover:border-gray-600/50 transition-all shadow-sm">
            Watch
          </button>
          <button className="px-5 py-2 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 rounded text-xs font-light text-gray-300 hover:border-gray-600/50 transition-all shadow-sm">
            Copy
          </button>
        </div>
      </div>

      {/* PnL Chart */}
      <div>
        <h3 className="text-lg font-light tracking-tight text-gray-300 mb-4 uppercase">
          PnL Chart
        </h3>
        <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl p-6 shadow-xl shadow-black/20">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={pnlData}>
              <XAxis
                dataKey="date"
                stroke="#3a3a3a"
                tick={{ fill: "#666", fontSize: 10 }}
                axisLine={false}
              />
              <YAxis
                stroke="#3a3a3a"
                tick={{ fill: "#666", fontSize: 10 }}
                axisLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0d0d0d",
                  border: "1px solid #3a3a3a",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                labelStyle={{ color: "#999" }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, "PnL"]}
              />
              <Line
                type="monotone"
                dataKey="pnl"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trade History */}
      <div>
        <h3 className="text-lg font-light tracking-tight text-gray-300 mb-4 uppercase">
          Trade History
        </h3>
        <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl overflow-hidden shadow-xl shadow-black/20">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800/50 bg-gradient-to-b from-[#111111] to-[#0d0d0d]">
                <th className="text-left py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                  Timestamp
                </th>
                <th className="text-left py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                  Market
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
                <th className="text-left py-4 px-5 text-gray-500 font-light tracking-wide uppercase">
                  Outcome
                </th>
              </tr>
            </thead>
            <tbody>
              {tradeHistory.map((trade, index) => (
                <tr
                  key={index}
                  className={`border-b border-gray-800/30 hover:bg-gradient-to-r hover:from-[#111111] hover:to-transparent transition-all duration-150 ${
                    index === tradeHistory.length - 1 ? "border-b-0" : ""
                  }`}
                >
                  <td className="py-3.5 px-5 text-gray-500 font-mono font-light">
                    {trade.timestamp}
                  </td>
                  <td className="py-3.5 px-5 text-gray-300 max-w-[400px] truncate font-light">
                    {trade.market}
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
                  <td className="py-3.5 px-5 text-gray-400 font-light">{trade.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Wallet Connection Graph */}
      <div>
        <h3 className="text-lg font-light tracking-tight text-gray-300 mb-4 uppercase">
          Wallet Connections
        </h3>
        <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl p-8 shadow-xl shadow-black/20">
          {/* Simplified connection visualization */}
          <div className="flex items-center justify-center gap-12">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full border-2 border-[#4a6fa5] bg-gradient-to-br from-[#1a1a2e] to-[#0d0d0d] flex items-center justify-center mb-3 shadow-lg">
                <span className="text-xs text-gray-300 font-mono font-light">
                  {walletAddress.slice(0, 6)}
                </span>
              </div>
              <div className="text-xs text-gray-500 font-light uppercase tracking-wide">
                Current
              </div>
            </div>
            <div className="flex-1 grid grid-cols-4 gap-6">
              {connections.map((conn, index) => (
                <div key={index} className="text-center">
                  <div className="w-14 h-14 rounded-full border border-gray-700/50 bg-gradient-to-br from-[#151515] to-[#0a0a0a] flex items-center justify-center mb-2 relative shadow-md">
                    <span className="text-[11px] text-gray-500 font-mono">{conn.wallet}</span>
                    <div className="absolute -left-10 top-1/2 w-10 h-[1px] bg-gradient-to-r from-gray-800 to-transparent"></div>
                  </div>
                  <div className="text-[11px] text-gray-600 font-light">{conn.transfers} txs</div>
                  <div className="text-[11px] text-gray-500 font-light">{conn.volume}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
