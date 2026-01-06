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

const pnlData = [
  { date: "Jan 1", pnl: 0 },
  { date: "Jan 2", pnl: 2400 },
  { date: "Jan 3", pnl: 4100 },
  { date: "Jan 4", pnl: 5800 },
  { date: "Jan 5", pnl: 7200 },
];

export function Portfolio() {
  const [showPnLCalendar, setShowPnLCalendar] = useState(false);
  const [trackedWallets, setTrackedWallets] = useState([
    { wallet: "0x742d...3a1f", copyAmount: "$1,000", slippage: "0.5%", gasFee: "Standard" },
  ]);
  const [newWallet, setNewWallet] = useState("");

  const addTrackedWallet = () => {
    if (newWallet.trim()) {
      setTrackedWallets([
        ...trackedWallets,
        { wallet: newWallet, copyAmount: "$500", slippage: "0.5%", gasFee: "Standard" },
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

      {/* Open Positions */}
      <div>
        <h3 className="text-sm text-gray-500 mb-3 uppercase tracking-wider">Open Positions</h3>
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
      </div>

      {/* PnL History */}
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
                      className="w-24 bg-[#0a0a0a] border border-gray-800 px-2 py-1 text-xs text-gray-300 text-right focus:outline-none focus:border-gray-700"
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <input
                      type="text"
                      defaultValue={tracked.slippage}
                      className="w-16 bg-[#0a0a0a] border border-gray-800 px-2 py-1 text-xs text-gray-300 text-right focus:outline-none focus:border-gray-700"
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <select className="w-24 bg-[#0a0a0a] border border-gray-800 px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-700">
                      <option>Low</option>
                      <option>Standard</option>
                      <option>High</option>
                    </select>
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
                <td className="py-2.5 px-4" colSpan={5}>
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
