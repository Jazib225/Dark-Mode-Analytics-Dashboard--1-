import { TrendingUp, Users, PieChart, Eye } from "lucide-react";

interface DiscoverProps {
  toggleBookmark: (market: any) => void;
  isBookmarked: (marketId: string) => boolean;
  onWalletClick: (address: string) => void;
  onMarketClick: (market: any) => void;
  onNavigate?: (page: string) => void;
}

export function Discover({ onNavigate }: DiscoverProps) {
  const pages = [
    {
      id: "markets",
      title: "Markets",
      description: "Browse trending prediction markets with real-time data and analytics",
      icon: TrendingUp,
      previewBg: "from-[#1a2a3a] to-[#0d1520]",
    },
    {
      id: "wallets",
      title: "Wallets",
      description: "Track whale wallets, follow top traders, and monitor wallet activity",
      icon: Users,
      previewBg: "from-[#2a1a3a] to-[#150d20]",
    },
    {
      id: "portfolio",
      title: "Portfolio",
      description: "Track your positions, PnL, and performance across all markets",
      icon: PieChart,
      previewBg: "from-[#1a3a2a] to-[#0d2015]",
    },
    {
      id: "insiderlens",
      title: "InsidersLens",
      description: "Advanced analytics and insider insights for informed trading decisions",
      icon: Eye,
      previewBg: "from-[#3a2a1a] to-[#201510]",
    },
  ];

  const handleNavigation = (pageId: string) => {
    if (onNavigate) {
      onNavigate(pageId);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-8">
        <h1 className="text-[28px] font-light tracking-tight text-gray-100 mb-2">
          Welcome to Paragon
        </h1>
        <p className="text-[16px] text-gray-400 font-light">
          Your gateway to prediction market analytics and insights
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {pages.map((page) => {
          const Icon = page.icon;
          return (
            <div
              key={page.id}
              onClick={() => handleNavigation(page.id)}
              className="group cursor-pointer"
            >
              <div className="border-2 border-white/20 hover:border-white/40 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-white/5">
                {/* Preview Image Area */}
                <div className={`h-[280px] bg-gradient-to-br ${page.previewBg} relative overflow-hidden`}>
                  {/* Placeholder preview content */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Icon className="w-24 h-24 text-white/20 group-hover:text-white/30 transition-all duration-300" />
                  </div>
                  
                  {/* Grid pattern overlay */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="w-full h-full" style={{
                      backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                      `,
                      backgroundSize: '20px 20px'
                    }} />
                  </div>

                  {/* Fake chart lines for markets */}
                  {page.id === "markets" && (
                    <svg className="absolute bottom-6 left-6 right-6 h-16 opacity-30">
                      <polyline
                        fill="none"
                        stroke="#4a6fa5"
                        strokeWidth="2"
                        points="0,50 40,45 80,30 120,38 160,18 200,25 240,12 280,22 320,10"
                      />
                    </svg>
                  )}

                  {/* Wallet icons for wallets */}
                  {page.id === "wallets" && (
                    <div className="absolute bottom-6 left-6 right-6 flex justify-around opacity-30">
                      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                        <Users className="w-6 h-6 text-white/60" />
                      </div>
                      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                        <Users className="w-6 h-6 text-white/60" />
                      </div>
                      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                        <Users className="w-6 h-6 text-white/60" />
                      </div>
                    </div>
                  )}

                  {/* Fake pie chart for portfolio */}
                  {page.id === "portfolio" && (
                    <svg className="absolute bottom-6 right-6 w-20 h-20 opacity-30" viewBox="0 0 32 32">
                      <circle cx="16" cy="16" r="12" fill="none" stroke="#22c55e" strokeWidth="4" strokeDasharray="40 75" />
                      <circle cx="16" cy="16" r="12" fill="none" stroke="#4a6fa5" strokeWidth="4" strokeDasharray="25 75" strokeDashoffset="-40" />
                      <circle cx="16" cy="16" r="12" fill="none" stroke="#eab308" strokeWidth="4" strokeDasharray="10 75" strokeDashoffset="-65" />
                    </svg>
                  )}

                  {/* Eye/lens graphic for InsidersLens */}
                  {page.id === "insiderlens" && (
                    <div className="absolute bottom-6 left-6 right-6 flex justify-center opacity-30">
                      <div className="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                          <Eye className="w-6 h-6 text-white/60" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Content Area */}
                <div className="p-6 bg-gradient-to-b from-[#0d0d0d] to-[#0a0a0a]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <Icon className="w-6 h-6 text-gray-300" />
                    </div>
                    <h3 className="text-[22px] font-medium text-gray-100 tracking-tight">
                      {page.title}
                    </h3>
                  </div>
                  <p className="text-[15px] text-gray-400 font-light leading-relaxed">
                    {page.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
