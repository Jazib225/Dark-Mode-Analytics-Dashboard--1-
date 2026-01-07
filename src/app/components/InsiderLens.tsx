import { Trophy, Medal, Award, TrendingUp, Users, Target } from "lucide-react";

interface InsiderLensProps {
  onWalletClick: (address: string) => void;
}

// Placeholder leaderboard data
const leaderboardData = [
  { rank: 1, wallet: "0x742d...3a1f", label: "Alpha Hunter", pnl: "+$847,293", winRate: "89.2%", trades: 1247, score: 9850 },
  { rank: 2, wallet: "0x8f3c...9b2d", label: "Market Maker", pnl: "+$632,891", winRate: "85.1%", trades: 982, score: 9420 },
  { rank: 3, wallet: "0x4a9b...7e5c", label: "Whale Watch", pnl: "+$498,456", winRate: "82.7%", trades: 756, score: 8890 },
  { rank: 4, wallet: "0x1c2d...4e5f", label: "", pnl: "+$421,234", winRate: "79.3%", trades: 634, score: 8340 },
  { rank: 5, wallet: "0x9d8e...7f6g", label: "Risk Taker", pnl: "+$387,129", winRate: "76.8%", trades: 589, score: 7920 },
  { rank: 6, wallet: "0x2a3b...5c6d", label: "", pnl: "+$312,456", winRate: "74.2%", trades: 512, score: 7450 },
  { rank: 7, wallet: "0x6e7f...8g9h", label: "Steady Eddie", pnl: "+$278,901", winRate: "71.9%", trades: 478, score: 6980 },
  { rank: 8, wallet: "0x3b4c...2d1e", label: "", pnl: "+$234,567", winRate: "69.5%", trades: 423, score: 6510 },
  { rank: 9, wallet: "0x7c8d...9e0f", label: "Night Owl", pnl: "+$198,234", winRate: "67.1%", trades: 389, score: 6040 },
  { rank: 10, wallet: "0x4d5e...6f7g", label: "", pnl: "+$167,890", winRate: "64.8%", trades: 356, score: 5570 },
];

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-400" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
  if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
  return <span className="text-gray-500 font-mono w-5 text-center">{rank}</span>;
};

const getRankBg = (rank: number) => {
  if (rank === 1) return "bg-gradient-to-r from-yellow-500/10 to-transparent border-l-2 border-yellow-500/50";
  if (rank === 2) return "bg-gradient-to-r from-gray-400/10 to-transparent border-l-2 border-gray-400/50";
  if (rank === 3) return "bg-gradient-to-r from-amber-600/10 to-transparent border-l-2 border-amber-600/50";
  return "";
};

export function InsiderLens({ onWalletClick }: InsiderLensProps) {
  return (
    <div className="max-w-[1800px] mx-auto space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl p-5 shadow-xl shadow-black/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <Trophy className="w-5 h-5 text-yellow-400" />
            </div>
            <span className="text-[14px] text-gray-400 font-light uppercase tracking-wide">Top Performer</span>
          </div>
          <div className="text-[24px] font-light text-gray-100">Alpha Hunter</div>
          <div className="text-[14px] text-green-500 font-light mt-1">+$847,293 PnL</div>
        </div>

        <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl p-5 shadow-xl shadow-black/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-[#4a6fa5]/10 border border-[#4a6fa5]/20">
              <Users className="w-5 h-5 text-[#4a6fa5]" />
            </div>
            <span className="text-[14px] text-gray-400 font-light uppercase tracking-wide">Active Traders</span>
          </div>
          <div className="text-[24px] font-light text-gray-100">2,847</div>
          <div className="text-[14px] text-gray-500 font-light mt-1">Last 24 hours</div>
        </div>

        <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl p-5 shadow-xl shadow-black/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <Target className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-[14px] text-gray-400 font-light uppercase tracking-wide">Avg Win Rate</span>
          </div>
          <div className="text-[24px] font-light text-gray-100">73.4%</div>
          <div className="text-[14px] text-gray-500 font-light mt-1">Top 100 traders</div>
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[19px] font-light tracking-tight text-gray-200 uppercase">
              Leaderboard
            </h2>
            <span className="text-[12px] text-gray-500 font-light px-2 py-1 bg-gray-800/50 rounded">
              Updated hourly
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-1.5 text-[14px] font-light tracking-wide rounded transition-all bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 text-gray-200 shadow-sm">
              All Time
            </button>
            <button className="px-4 py-1.5 text-[14px] font-light tracking-wide rounded transition-all bg-transparent border border-gray-800/30 text-gray-400 hover:text-gray-300 hover:border-gray-700/50">
              Monthly
            </button>
            <button className="px-4 py-1.5 text-[14px] font-light tracking-wide rounded transition-all bg-transparent border border-gray-800/30 text-gray-400 hover:text-gray-300 hover:border-gray-700/50">
              Weekly
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl overflow-hidden shadow-xl shadow-black/20">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-gray-800/50 bg-gradient-to-b from-[#111111] to-[#0d0d0d]">
                <th className="text-left py-4 px-5 text-gray-400 font-light tracking-wide uppercase w-16">Rank</th>
                <th className="text-left py-4 px-5 text-gray-400 font-light tracking-wide uppercase">Wallet</th>
                <th className="text-left py-4 px-5 text-gray-400 font-light tracking-wide uppercase">Label</th>
                <th className="text-right py-4 px-5 text-gray-400 font-light tracking-wide uppercase">Total PnL</th>
                <th className="text-right py-4 px-5 text-gray-400 font-light tracking-wide uppercase">Win Rate</th>
                <th className="text-right py-4 px-5 text-gray-400 font-light tracking-wide uppercase">Trades</th>
                <th className="text-right py-4 px-5 text-gray-400 font-light tracking-wide uppercase">Score</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardData.map((trader, index) => (
                <tr
                  key={trader.wallet}
                  className={`border-b border-gray-800/30 hover:bg-gradient-to-r hover:from-[#111111] hover:to-transparent transition-all duration-150 cursor-pointer ${
                    index === leaderboardData.length - 1 ? "border-b-0" : ""
                  } ${getRankBg(trader.rank)}`}
                  onClick={() => onWalletClick(trader.wallet)}
                >
                  <td className="py-3.5 px-5">
                    <div className="flex items-center justify-center">
                      {getRankIcon(trader.rank)}
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-gray-300 font-mono font-light hover:text-[#4a6fa5] transition-colors">
                    {trader.wallet}
                  </td>
                  <td className="py-3.5 px-5 text-gray-400 font-light">
                    {trader.label || "—"}
                  </td>
                  <td className="py-3.5 px-5 text-right text-green-500 font-light">
                    {trader.pnl}
                  </td>
                  <td className="py-3.5 px-5 text-right text-gray-300 font-light">
                    {trader.winRate}
                  </td>
                  <td className="py-3.5 px-5 text-right text-gray-400 font-light">
                    {trader.trades.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <span className="text-[#4a6fa5] font-medium">
                      {trader.score.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Load More */}
        <div className="flex justify-center mt-6">
          <button className="px-8 py-3 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 rounded-lg text-[15px] font-light text-gray-200 hover:text-gray-100 hover:border-gray-600/50 transition-all flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            View Full Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}
