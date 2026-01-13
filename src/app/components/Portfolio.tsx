import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { PnLCalendar } from "./PnLCalendar";
import { Plus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

// Helper function to format balance
function formatBalance(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

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
  const { user, isAuthenticated } = useAuth();
  const [showPnLCalendar, setShowPnLCalendar] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("positions");
  const [trackedWallets, setTrackedWallets] = useState([
    { wallet: "0x742d...3a1f", copyAmount: "$1,000", slippage: "0.5%", gasFee: "Standard", minLiquidity: "$10,000", maxLiquidity: "$1,000,000", minOdds: "0.10", maxOdds: "0.90" },
  ]);
  const [newWallet, setNewWallet] = useState("");

  // Calculate portfolio values
  const availableBalance = isAuthenticated && user ? user.balance : 0;
  // For demo purposes, show some position values if user is logged in with balance
  const inPositions = isAuthenticated && user && user.balance > 0 ? Math.round(user.balance * 13.6) : 0; // Simulated position value
  const totalPnL = isAuthenticated && user && user.balance > 0 ? Math.round(user.balance * 2.17) : 0; // Simulated PnL
  const totalBalance = availableBalance + inPositions;

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
    <div className="main-content" style={{ maxWidth: '1800px' }}>
      {/* Balances */}
      <div className="portfolio-grid">
        <div className="portfolio-card">
          <div className="portfolio-card-label">Total Balance</div>
          <div className="portfolio-card-value">{formatBalance(totalBalance)}</div>
        </div>
        <div className="portfolio-card">
          <div className="portfolio-card-label">In Positions</div>
          <div className="portfolio-card-value">{formatBalance(inPositions)}</div>
        </div>
        <div className="portfolio-card">
          <div className="portfolio-card-label">Available</div>
          <div className="portfolio-card-value">{formatBalance(availableBalance)}</div>
        </div>
        <div className="portfolio-card">
          <div className="portfolio-card-label">Total PnL</div>
          <div className="portfolio-card-value" style={{ color: totalPnL >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)' }}>
            {totalPnL >= 0 ? "+" : ""}{formatBalance(totalPnL)}
          </div>
        </div>
      </div>

      {/* PnL History Graph - Moved above positions */}
      <div style={{ marginTop: 'var(--sp-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
          <h3 style={{ fontSize: 'var(--fs-sm)', color: 'rgb(107, 114, 128)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PnL History</h3>
          <button
            onClick={() => setShowPnLCalendar(true)}
            style={{ padding: 'var(--sp-2) var(--sp-3)', background: '#0d0d0d', border: '1px solid rgba(55, 65, 81, 0.3)', fontSize: 'var(--fs-xs)', color: 'rgb(156, 163, 175)', borderRadius: 'var(--r-sm)' }}
          >
            PnL Calendar
          </button>
        </div>
        <div style={{ background: '#0d0d0d', border: '1px solid rgba(55, 65, 81, 0.3)', padding: 'var(--sp-4)' }}>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={pnlData}>
              <XAxis
                dataKey="date"
                stroke="#3a3a3a"
                tick={{ fill: "#666", fontSize: 'var(--fs-xs)' }}
                axisLine={false}
              />
              <YAxis
                stroke="#3a3a3a"
                tick={{ fill: "#666", fontSize: 'var(--fs-xs)' }}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0d0d0d",
                  border: "1px solid #3a3a3a",
                  borderRadius: 0,
                  fontSize: 'var(--fs-xs)',
                }}
                labelStyle={{ color: "#999" }}
              />
              <Line type="monotone" dataKey="pnl" stroke="#4ade80" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabbed Section: Open Positions / PnL History / Top Trades */}
      <div style={{ marginTop: 'var(--sp-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-3)', overflowX: 'auto' }}>
          <button
            onClick={() => setActiveTab("positions")}
            style={{ fontSize: 'var(--fs-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', color: activeTab === "positions" ? 'rgb(243, 244, 246)' : 'rgb(107, 114, 128)', transition: 'color 0.15s', whiteSpace: 'nowrap' }}
          >
            Open Positions
          </button>
          <button
            onClick={() => setActiveTab("pnlHistory")}
            style={{ fontSize: 'var(--fs-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', color: activeTab === "pnlHistory" ? 'rgb(243, 244, 246)' : 'rgb(107, 114, 128)', transition: 'color 0.15s', whiteSpace: 'nowrap' }}
          >
            PnL History
          </button>
          <button
            onClick={() => setActiveTab("topTrades")}
            style={{ fontSize: 'var(--fs-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', color: activeTab === "topTrades" ? 'rgb(243, 244, 246)' : 'rgb(107, 114, 128)', transition: 'color 0.15s', whiteSpace: 'nowrap' }}
          >
            Top Trades
          </button>
        </div>

        {/* Open Positions Tab */}
        {activeTab === "positions" && (
          <div className="bg-[#0d0d0d] border border-gray-800 overflow-x-auto">
            <table className="w-full text-xs min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2.5 sm:py-3 px-3 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">Market</th>
                  <th className="text-left py-2.5 sm:py-3 px-3 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">Side</th>
                  <th className="text-right py-2.5 sm:py-3 px-3 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">Size</th>
                  <th className="text-right py-2.5 sm:py-3 px-3 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">Avg</th>
                  <th className="text-right py-2.5 sm:py-3 px-3 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">Current</th>
                  <th className="text-right py-2.5 sm:py-3 px-3 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">PnL</th>
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
                      className={`py-2.5 px-4 text-right ${position.pnl.startsWith("+") ? "text-green-500" : "text-red-500"
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
          <div className="bg-[#0d0d0d] border border-gray-800 overflow-x-auto">
            <table className="w-full text-xs min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2.5 sm:py-3 px-3 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">Date</th>
                  <th className="text-left py-2.5 sm:py-3 px-3 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">Market</th>
                  <th className="text-left py-2.5 sm:py-3 px-3 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">Side</th>
                  <th className="text-right py-2.5 sm:py-3 px-3 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">Entry</th>
                  <th className="text-right py-2.5 sm:py-3 px-3 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">Exit</th>
                  <th className="text-right py-2.5 sm:py-3 px-3 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">PnL</th>
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
                      className={`py-2.5 px-4 text-right ${trade.pnl.startsWith("+") ? "text-green-500" : "text-red-500"
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
          <div className="bg-[#0d0d0d] border border-gray-800 overflow-x-auto">
            <table className="w-full text-xs min-w-[550px]">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2.5 sm:py-3 px-3 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">Date</th>
                  <th className="text-left py-2.5 sm:py-3 px-3 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">Market</th>
                  <th className="text-left py-2.5 sm:py-3 px-3 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">Side</th>
                  <th className="text-right py-2.5 sm:py-3 px-3 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">Entry</th>
                  <th className="text-right py-2.5 sm:py-3 px-3 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">Exit</th>
                  <th className="text-right py-2.5 sm:py-3 px-3 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">PnL</th>
                  <th className="text-right py-2.5 sm:py-3 px-3 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">ROI</th>
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
        <div className="bg-[#0d0d0d] border border-gray-800 overflow-x-auto">
          <table className="w-full text-xs min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-2.5 sm:py-3 px-3 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">Wallet</th>
                <th className="text-right py-2.5 sm:py-3 px-2 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">Amount</th>
                <th className="text-right py-2.5 sm:py-3 px-2 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">Slip</th>
                <th className="text-right py-2.5 sm:py-3 px-2 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">Gas</th>
                <th className="text-right py-2.5 sm:py-3 px-2 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">MinL</th>
                <th className="text-right py-2.5 sm:py-3 px-2 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">MaxL</th>
                <th className="text-right py-2.5 sm:py-3 px-2 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">MinO</th>
                <th className="text-right py-2.5 sm:py-3 px-2 sm:px-4 text-gray-500 font-normal text-[10px] sm:text-xs">MaxO</th>
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
