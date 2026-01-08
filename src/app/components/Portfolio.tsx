import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { PnLCalendar } from "./PnLCalendar";
import { Plus, X } from "lucide-react";

const openPositions = [
  {
    market: "Will BTC reach $100k by Q1 2026?",
    side: "YES",
    size: "$12,500",
    avgPrice: "0.67",
    currentPrice: "0.67",
    pnl: "+$340",
  },
  {
    market: "US Bitcoin Strategic Reserve established?",
    side: "YES",
    size: "$15,700",
    avgPrice: "0.71",
    currentPrice: "0.71",
    pnl: "+$120",
  },
  {
    market: "DeFi TVL to surpass $200B in 2026?",
    side: "YES",
    size: "$9,100",
    avgPrice: "0.59",
    currentPrice: "0.59",
    pnl: "-$80",
  },
  {
    market: "Major L2 hack resulting in >$50M loss?",
    side: "NO",
    size: "$7,800",
    avgPrice: "0.69",
    currentPrice: "0.69",
    pnl: "+$210",
  },
];

const pnlHistoryData = [
  { date: "Jan 1, 2026", market: "BTC $100k by Q1?", side: "YES", entryPrice: "0.45", exitPrice: "0.67", pnl: "+$2,200" },
  { date: "Dec 28, 2025", market: "ETH 2.0 full rollout?", side: "YES", entryPrice: "0.32", exitPrice: "0.48", pnl: "+$1,600" },
  { date: "Dec 25, 2025", market: "Fed rate cut March?", side: "NO", entryPrice: "0.55", exitPrice: "0.42", pnl: "+$1,300" },
  { date: "Dec 20, 2025", market: "Tesla stock $400?", side: "YES", entryPrice: "0.28", exitPrice: "0.35", pnl: "+$700" },
  { date: "Dec 15, 2025", market: "DeFi TVL $200B?", side: "YES", entryPrice: "0.61", exitPrice: "0.55", pnl: "-$600" },
];

const topTradesData = [
  { date: "Jan 1, 2026", market: "BTC $100k by Q1?", side: "YES", entryPrice: "0.45", exitPrice: "0.67", pnl: "+$2,200", roi: "+48.9%" },
  { date: "Dec 28, 2025", market: "ETH 2.0 full rollout?", side: "YES", entryPrice: "0.32", exitPrice: "0.48", pnl: "+$1,600", roi: "+50.0%" },
  { date: "Dec 25, 2025", market: "Fed rate cut March?", side: "NO", entryPrice: "0.55", exitPrice: "0.42", pnl: "+$1,300", roi: "+30.9%" },
  { date: "Nov 10, 2025", market: "Apple Vision Pro 1M sales?", side: "YES", entryPrice: "0.22", exitPrice: "0.41", pnl: "+$950", roi: "+86.4%" },
  { date: "Oct 5, 2025", market: "Major L2 hack >$50M?", side: "NO", entryPrice: "0.75", exitPrice: "0.88", pnl: "+$780", roi: "+17.3%" },
];

const pnlData = [
  { date: "Jan 1", pnl: 0 },
  { date: "Jan 2", pnl: 2400 },
  { date: "Jan 3", pnl: 4100 },
  { date: "Jan 4", pnl: 5800 },
  { date: "Jan 5", pnl: 7200 },
];

type TabType = "positions" | "pnlHistory" | "topTrades";

export function Portfolio() {
  const [showPnLCalendar, setShowPnLCalendar] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("positions");
  const [trackedWallets, setTrackedWallets] = useState([
    { wallet: "0x742d...3a1f", copyAmount: "$1,000", slippage: "0.5%", gasFee: "Standard", minLiquidity: "$10,000", maxLiquidity: "$1,000,000", minOdds: "0.10", maxOdds: "0.90" },
  ]);
  const [newWallet, setNewWallet] = useState("");

  const addTrackedWallet = () => {
    if (newWallet.trim()) {
      setTrackedWallets([
        ...trackedWallets,
        { wallet: newWallet, copyAmount: "$500", slippage: "0.5%", gasFee: "Standard", minLiquidity: "$10,000", maxLiquidity: "$1,000,000", minOdds: "0.10", maxOdds: "0.90" },
      ]);
      setNewWallet("");
    }
  };

  const removeTrackedWallet = (index: number) => {
    setTrackedWallets(trackedWallets.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-[1800px] mx-auto space-y-6">
      {/* Balances */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#0d0d0d] border border-gray-800 p-4">
          <div className="text-xs text-gray-500 mb-2">Total Balance</div>
          <div className="text-xl text-gray-100">$48,420</div>
        </div>
        <div className="bg-[#0d0d0d] border border-gray-800 p-4">
          <div className="text-xs text-gray-500 mb-2">In Positions</div>
          <div className="text-xl text-gray-100">$45,100</div>
        </div>
        <div className="bg-[#0d0d0d] border border-gray-800 p-4">
          <div className="text-xs text-gray-500 mb-2">Available</div>
          <div className="text-xl text-gray-100">$3,320</div>
        </div>
        <div className="bg-[#0d0d0d] border border-gray-800 p-4">
          <div className="text-xs text-gray-500 mb-2">Total PnL</div>
          <div className="text-xl text-green-500">+$7,200</div>
        </div>
      </div>

      {/* PnL History Graph - Moved above positions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm text-gray-500 uppercase tracking-wider">PnL History</h3>
          <button
            onClick={() => setShowPnLCalendar(true)}
            className="px-3 py-1 bg-[#0d0d0d] border border-gray-800 text-xs text-gray-400 hover:border-gray-700 transition-colors"
          >
            PnL Calendar
          </button>
        </div>
        <div className="bg-[#0d0d0d] border border-gray-800 p-4">
          <ResponsiveContainer width="100%" height={200}>
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
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0d0d0d",
                  border: "1px solid #3a3a3a",
                  borderRadius: 0,
                  fontSize: 11,
                }}
                labelStyle={{ color: "#999" }}
              />
              <Line type="monotone" dataKey="pnl" stroke="#4ade80" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabbed Section: Open Positions / PnL History / Top Trades */}
      <div>
        <div className="flex items-center gap-4 mb-3">
          <button
            onClick={() => setActiveTab("positions")}
            className={`text-sm uppercase tracking-wider transition-colors ${
              activeTab === "positions" ? "text-gray-100" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Open Positions
          </button>
          <button
            onClick={() => setActiveTab("pnlHistory")}
            className={`text-sm uppercase tracking-wider transition-colors ${
              activeTab === "pnlHistory" ? "text-gray-100" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            PnL History
          </button>
          <button
            onClick={() => setActiveTab("topTrades")}
            className={`text-sm uppercase tracking-wider transition-colors ${
              activeTab === "topTrades" ? "text-gray-100" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Top Trades
          </button>
        </div>

        {/* Open Positions Tab */}
        {activeTab === "positions" && (
          <div className="bg-[#0d0d0d] border border-gray-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-gray-500 font-normal">Market</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-normal">Side</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-normal">Size</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-normal">Avg Price</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-normal">Current Price</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-normal">PnL</th>
                </tr>
              </thead>
              <tbody>
                {openPositions.map((position, index) => (
                  <tr key={index} className="border-b border-gray-800/50 hover:bg-[#111111]">
                    <td className="py-2.5 px-4 text-gray-300 max-w-[400px] truncate">
                      {position.market}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`${position.side === "YES" ? "text-green-500" : "text-red-500"}`}
                      >
                        {position.side}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right text-gray-300">{position.size}</td>
                    <td className="py-2.5 px-4 text-right text-gray-400">{position.avgPrice}</td>
                    <td className="py-2.5 px-4 text-right text-gray-400">{position.currentPrice}</td>
                    <td
                      className={`py-2.5 px-4 text-right ${
                        position.pnl.startsWith("+") ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {position.pnl}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PnL History Tab */}
        {activeTab === "pnlHistory" && (
          <div className="bg-[#0d0d0d] border border-gray-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-gray-500 font-normal">Date</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-normal">Market</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-normal">Side</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-normal">Entry Price</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-normal">Exit Price</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-normal">PnL</th>
                </tr>
              </thead>
              <tbody>
                {pnlHistoryData.map((trade, index) => (
                  <tr key={index} className="border-b border-gray-800/50 hover:bg-[#111111]">
                    <td className="py-2.5 px-4 text-gray-400">{trade.date}</td>
                    <td className="py-2.5 px-4 text-gray-300 max-w-[300px] truncate">
                      {trade.market}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`${trade.side === "YES" ? "text-green-500" : "text-red-500"}`}>
                        {trade.side}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right text-gray-400">{trade.entryPrice}</td>
                    <td className="py-2.5 px-4 text-right text-gray-400">{trade.exitPrice}</td>
                    <td
                      className={`py-2.5 px-4 text-right ${
                        trade.pnl.startsWith("+") ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {trade.pnl}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Top Trades Tab */}
        {activeTab === "topTrades" && (
          <div className="bg-[#0d0d0d] border border-gray-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-gray-500 font-normal">Date</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-normal">Market</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-normal">Side</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-normal">Entry</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-normal">Exit</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-normal">PnL</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-normal">ROI</th>
                </tr>
              </thead>
              <tbody>
                {topTradesData.map((trade, index) => (
                  <tr key={index} className="border-b border-gray-800/50 hover:bg-[#111111]">
                    <td className="py-2.5 px-4 text-gray-400">{trade.date}</td>
                    <td className="py-2.5 px-4 text-gray-300 max-w-[250px] truncate">
                      {trade.market}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`${trade.side === "YES" ? "text-green-500" : "text-red-500"}`}>
                        {trade.side}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right text-gray-400">{trade.entryPrice}</td>
                    <td className="py-2.5 px-4 text-right text-gray-400">{trade.exitPrice}</td>
                    <td className="py-2.5 px-4 text-right text-green-500">{trade.pnl}</td>
                    <td className="py-2.5 px-4 text-right text-green-400">{trade.roi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Open Positions - REMOVED (now in tabs above) */}

      {/* Trade Settings */}
      <div>
        <h3 className="text-sm text-gray-500 mb-3 uppercase tracking-wider">Trade Settings</h3>
        <div className="bg-[#0d0d0d] border border-gray-800 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-2">Default Slippage</label>
              <input
                type="text"
                defaultValue="0.5%"
                className="w-full bg-[#0a0a0a] border border-gray-800 px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Default Gas Fee</label>
              <select className="w-full bg-[#0a0a0a] border border-gray-800 px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-gray-700">
                <option>Low</option>
                <option>Standard</option>
                <option>High</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Copy Trade Settings */}
      <div>
        <h3 className="text-sm text-gray-500 mb-3 uppercase tracking-wider">Copy Trade Settings</h3>
        <div className="bg-[#0d0d0d] border border-gray-800">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-4 text-gray-500 font-normal">Wallet</th>
                <th className="text-right py-3 px-4 text-gray-500 font-normal">Copy Amount</th>
                <th className="text-right py-3 px-4 text-gray-500 font-normal">Slippage</th>
                <th className="text-right py-3 px-4 text-gray-500 font-normal">Gas Fee</th>
                <th className="text-right py-3 px-4 text-gray-500 font-normal">Min Liq.</th>
                <th className="text-right py-3 px-4 text-gray-500 font-normal">Max Liq.</th>
                <th className="text-right py-3 px-4 text-gray-500 font-normal">Min Odds</th>
                <th className="text-right py-3 px-4 text-gray-500 font-normal">Max Odds</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {trackedWallets.map((tracked, index) => (
                <tr key={index} className="border-b border-gray-800/50">
                  <td className="py-2.5 px-4 text-gray-300 font-mono">{tracked.wallet}</td>
                  <td className="py-2.5 px-4 text-right">
                    <input
                      type="text"
                      defaultValue={tracked.copyAmount}
                      className="w-20 bg-[#0a0a0a] border border-gray-800 px-2 py-1 text-xs text-gray-300 text-right focus:outline-none focus:border-gray-700"
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <input
                      type="text"
                      defaultValue={tracked.slippage}
                      className="w-14 bg-[#0a0a0a] border border-gray-800 px-2 py-1 text-xs text-gray-300 text-right focus:outline-none focus:border-gray-700"
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <select className="w-20 bg-[#0a0a0a] border border-gray-800 px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-700">
                      <option>Low</option>
                      <option>Standard</option>
                      <option>High</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <input
                      type="text"
                      defaultValue={tracked.minLiquidity}
                      className="w-24 bg-[#0a0a0a] border border-gray-800 px-2 py-1 text-xs text-gray-300 text-right focus:outline-none focus:border-gray-700"
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <input
                      type="text"
                      defaultValue={tracked.maxLiquidity}
                      className="w-24 bg-[#0a0a0a] border border-gray-800 px-2 py-1 text-xs text-gray-300 text-right focus:outline-none focus:border-gray-700"
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <input
                      type="text"
                      defaultValue={tracked.minOdds}
                      className="w-14 bg-[#0a0a0a] border border-gray-800 px-2 py-1 text-xs text-gray-300 text-right focus:outline-none focus:border-gray-700"
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <input
                      type="text"
                      defaultValue={tracked.maxOdds}
                      className="w-14 bg-[#0a0a0a] border border-gray-800 px-2 py-1 text-xs text-gray-300 text-right focus:outline-none focus:border-gray-700"
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => removeTrackedWallet(index)}
                      className="text-gray-600 hover:text-gray-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="border-b border-gray-800/50">
                <td className="py-2.5 px-4" colSpan={9}>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newWallet}
                      onChange={(e) => setNewWallet(e.target.value)}
                      placeholder="Add wallet address..."
                      className="flex-1 bg-[#0a0a0a] border border-gray-800 px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-700"
                    />
                    <button
                      onClick={addTrackedWallet}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#0a0a0a] border border-gray-800 text-xs text-gray-400 hover:border-gray-700 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* PnL Calendar Modal */}
      {showPnLCalendar && <PnLCalendar onClose={() => setShowPnLCalendar(false)} />}
    </div>
  );
}
