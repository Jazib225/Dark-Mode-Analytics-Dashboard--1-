import { useState, useEffect } from "react";
import { Plus, Bell, BellOff } from "lucide-react";

interface TrackedWallet {
  address: string;
  label: string;
  notificationsEnabled: boolean;
  totalPnL: string;
  winRate: string;
  lastActive: string;
}

interface FeedItem {
  id: string;
  timestamp: string;
  wallet: string;
  market: string;
  action: "entry" | "exit" | "BUY" | "SELL";
  size: string;
  probability: number;
}

interface WalletsListProps {
  onWalletClick: (address: string) => void;
}

// Initial feed items for simulation
const initialFeedItems: FeedItem[] = [
  { id: "1", timestamp: "14:32:15", wallet: "0x742d...3a1f", market: "Will BTC reach $100k by Q1 2026?", action: "entry", size: "$15,000", probability: 67 },
  { id: "2", timestamp: "14:31:42", wallet: "0x8f3c...9b2d", market: "ETH 2.0 full rollout in 2026?", action: "exit", size: "$8,500", probability: 42 },
  { id: "3", timestamp: "14:30:18", wallet: "0x4a9b...7e5c", market: "Fed rate cut in March?", action: "entry", size: "$12,000", probability: 55 },
];

export function WalletsList({ onWalletClick }: WalletsListProps) {
  const [trackedWallets, setTrackedWallets] = useState<TrackedWallet[]>([
    {
      address: "0x742d...3a1f",
      label: "Smart Trader #1",
      notificationsEnabled: true,
      totalPnL: "+$147,293",
      winRate: "78.3%",
      lastActive: "4m ago",
    },
    {
      address: "0x8f3c...9b2d",
      label: "Top Performer",
      notificationsEnabled: true,
      totalPnL: "+$132,891",
      winRate: "74.1%",
      lastActive: "12m ago",
    },
    {
      address: "0x4a9b...7e5c",
      label: "",
      notificationsEnabled: false,
      totalPnL: "+$98,456",
      winRate: "81.2%",
      lastActive: "1h ago",
    },
  ]);

  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [newWalletLabel, setNewWalletLabel] = useState("");
  const [feedItems, setFeedItems] = useState<FeedItem[]>(initialFeedItems);

  const toggleNotifications = (address: string) => {
    setTrackedWallets((prev) =>
      prev.map((wallet) =>
        wallet.address === address
          ? { ...wallet, notificationsEnabled: !wallet.notificationsEnabled }
          : wallet
      )
    );
  };

  const addWallet = () => {
    if (newWalletAddress.trim()) {
      setTrackedWallets([
        ...trackedWallets,
        {
          address: newWalletAddress,
          label: newWalletLabel,
          notificationsEnabled: false,
          totalPnL: "$0",
          winRate: "0%",
          lastActive: "Never",
        },
      ]);
      setNewWalletAddress("");
      setNewWalletLabel("");
    }
  };

  // Simulate new feed items
  useEffect(() => {
    const markets = [
      "Will BTC reach $100k by Q1 2026?",
      "ETH 2.0 full rollout in 2026?",
      "Fed rate cut in March?",
      "Will Tesla stock hit $400?",
      "Apple Vision Pro sales > 1M units?",
    ];

    const interval = setInterval(() => {
      const newItem: FeedItem = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        wallet: `0x${Math.random().toString(16).substring(2, 6)}...${Math.random()
          .toString(16)
          .substring(2, 6)}`,
        market: markets[Math.floor(Math.random() * markets.length)],
        action: Math.random() > 0.5 ? "entry" : "exit",
        size: `$${(Math.random() * 20000 + 5000).toFixed(0)}`,
        probability: Math.floor(Math.random() * 60 + 20),
      };
      setFeedItems((prev) => [newItem, ...prev].slice(0, 20));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-[1800px] mx-auto">
      {/* 50/50 Split Layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left Side - Wallets */}
        <div className="space-y-4">
          <h2 className="text-[17px] font-light tracking-tight text-gray-300 uppercase">Tracked Wallets</h2>

          {/* Add New Wallet */}
          <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl p-4 shadow-xl shadow-black/20">
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={newWalletAddress}
                onChange={(e) => setNewWalletAddress(e.target.value)}
                placeholder="Wallet address..."
                className="bg-gradient-to-br from-[#111111] to-[#0a0a0a] border border-gray-800/50 rounded px-3 py-2 text-[12px] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-700/50 font-light shadow-inner"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newWalletLabel}
                  onChange={(e) => setNewWalletLabel(e.target.value)}
                  placeholder="Label (optional)..."
                  className="flex-1 bg-gradient-to-br from-[#111111] to-[#0a0a0a] border border-gray-800/50 rounded px-3 py-2 text-[12px] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-700/50 font-light shadow-inner"
                />
                <button
                  onClick={addWallet}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 rounded text-[12px] font-light text-gray-300 hover:border-gray-600/50 transition-all shadow-sm"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Tracked Wallets List */}
          <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl overflow-hidden shadow-xl shadow-black/20">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-gray-800/50 bg-gradient-to-b from-[#111111] to-[#0d0d0d]">
                  <th className="text-left py-3 px-4 text-gray-500 font-light tracking-wide uppercase">Wallet</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-light tracking-wide uppercase">Label</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-light tracking-wide uppercase">PnL</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-light tracking-wide uppercase">Win%</th>
                  <th className="text-center py-3 px-4 text-gray-500 font-light tracking-wide uppercase w-12">
                    <Bell className="w-3 h-3 mx-auto" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {trackedWallets.map((wallet, index) => (
                  <tr
                    key={wallet.address}
                    className={`border-b border-gray-800/30 hover:bg-gradient-to-r hover:from-[#111111] hover:to-transparent transition-all duration-150 ${
                      index === trackedWallets.length - 1 ? "border-b-0" : ""
                    }`}
                  >
                    <td
                      className="py-3 px-4 text-gray-300 font-mono font-light cursor-pointer hover:text-[#4a6fa5] transition-colors text-[11px]"
                      onClick={() => onWalletClick(wallet.address)}
                    >
                      {wallet.address}
                    </td>
                    <td className="py-3 px-4 text-gray-400 font-light truncate max-w-[100px]">{wallet.label || "—"}</td>
                    <td
                      className={`py-3 px-4 text-right font-light ${
                        wallet.totalPnL.startsWith("+") ? "text-green-500" : "text-gray-400"
                      }`}
                    >
                      {wallet.totalPnL}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-300 font-light">{wallet.winRate}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => toggleNotifications(wallet.address)}
                        className="text-gray-600 hover:text-gray-400 transition-colors"
                      >
                        {wallet.notificationsEnabled ? (
                          <Bell className="w-3 h-3 text-[#4a6fa5]" />
                        ) : (
                          <BellOff className="w-3 h-3" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side - Live Feed */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[17px] font-light tracking-tight text-gray-300 uppercase">Live Activity Feed</h2>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          </div>

          <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl overflow-hidden shadow-xl shadow-black/20">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-gray-800/50 bg-gradient-to-b from-[#111111] to-[#0d0d0d]">
                  <th className="text-left py-3 px-4 text-gray-500 font-light tracking-wide uppercase">Time</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-light tracking-wide uppercase">Wallet</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-light tracking-wide uppercase">Market</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-light tracking-wide uppercase">Action</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-light tracking-wide uppercase">Size</th>
                </tr>
              </thead>
              <tbody>
                {feedItems.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`border-b border-gray-800/30 hover:bg-gradient-to-r hover:from-[#111111] hover:to-transparent transition-all duration-150 ${
                      index === feedItems.length - 1 ? "border-b-0" : ""
                    } ${index === 0 ? "animate-fade-in" : ""}`}
                  >
                    <td className="py-3 px-4 text-gray-500 font-mono font-light text-[10px]">
                      {item.timestamp}
                    </td>
                    <td
                      className="py-3 px-4 text-gray-400 font-mono font-light cursor-pointer hover:text-[#4a6fa5] transition-colors text-[11px]"
                      onClick={() => onWalletClick(item.wallet)}
                    >
                      {item.wallet}
                    </td>
                    <td className="py-3 px-4 text-gray-300 max-w-[180px] truncate font-light">
                      {item.market}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-normal text-[11px] ${
                          item.action === "entry" ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {item.action.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-300 font-light">{item.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}