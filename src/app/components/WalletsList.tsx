import { useState } from "react";
import { Plus, Bell, BellOff } from "lucide-react";

interface TrackedWallet {
  address: string;
  label: string;
  notificationsEnabled: boolean;
  totalPnL: string;
  winRate: string;
  lastActive: string;
}

interface WalletsListProps {
  onWalletClick: (address: string) => void;
}

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

  return (
    <div className="max-w-[1800px] mx-auto space-y-6">
      <h2 className="text-lg font-light tracking-tight text-gray-300 uppercase">Tracked Wallets</h2>

      {/* Add New Wallet */}
      <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl p-5 shadow-xl shadow-black/20">
        <div className="grid grid-cols-[1fr,1fr,auto] gap-4">
          <input
            type="text"
            value={newWalletAddress}
            onChange={(e) => setNewWalletAddress(e.target.value)}
            placeholder="Wallet address..."
            className="bg-gradient-to-br from-[#111111] to-[#0a0a0a] border border-gray-800/50 rounded px-4 py-2.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-700/50 font-light shadow-inner"
          />
          <input
            type="text"
            value={newWalletLabel}
            onChange={(e) => setNewWalletLabel(e.target.value)}
            placeholder="Label (optional)..."
            className="bg-gradient-to-br from-[#111111] to-[#0a0a0a] border border-gray-800/50 rounded px-4 py-2.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-700/50 font-light shadow-inner"
          />
          <button
            onClick={addWallet}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 rounded text-xs font-light text-gray-300 hover:border-gray-600/50 transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Wallet
          </button>
        </div>
      </div>

      {/* Tracked Wallets List */}
      <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl overflow-hidden shadow-xl shadow-black/20">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800/50 bg-gradient-to-b from-[#111111] to-[#0d0d0d]">
              <th className="text-left py-4 px-5 text-gray-500 font-light tracking-wide uppercase">Wallet</th>
              <th className="text-left py-4 px-5 text-gray-500 font-light tracking-wide uppercase">Label</th>
              <th className="text-right py-4 px-5 text-gray-500 font-light tracking-wide uppercase">Total PnL</th>
              <th className="text-right py-4 px-5 text-gray-500 font-light tracking-wide uppercase">Win Rate</th>
              <th className="text-right py-4 px-5 text-gray-500 font-light tracking-wide uppercase">Last Active</th>
              <th className="text-center py-4 px-5 text-gray-500 font-light tracking-wide uppercase w-24">Notifications</th>
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
                  className="py-3.5 px-5 text-gray-300 font-mono font-light cursor-pointer hover:text-[#4a6fa5] transition-colors"
                  onClick={() => onWalletClick(wallet.address)}
                >
                  {wallet.address}
                </td>
                <td className="py-3.5 px-5 text-gray-400 font-light">{wallet.label || "—"}</td>
                <td
                  className={`py-3.5 px-5 text-right font-light ${
                    wallet.totalPnL.startsWith("+") ? "text-green-500" : "text-gray-400"
                  }`}
                >
                  {wallet.totalPnL}
                </td>
                <td className="py-3.5 px-5 text-right text-gray-300 font-light">{wallet.winRate}</td>
                <td className="py-3.5 px-5 text-right text-gray-500 font-light">{wallet.lastActive}</td>
                <td className="py-3.5 px-5 text-center">
                  <button
                    onClick={() => toggleNotifications(wallet.address)}
                    className="text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    {wallet.notificationsEnabled ? (
                      <Bell className="w-3.5 h-3.5 text-[#4a6fa5]" />
                    ) : (
                      <BellOff className="w-3.5 h-3.5" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}