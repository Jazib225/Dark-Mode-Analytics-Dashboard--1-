import { TrendingUp, Users, PieChart, Eye, Zap } from "lucide-react";

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
    {
      id: "tradeflow",
      title: "TradeFlow",
      description: "Build automated trading logic with drag-and-drop workflow nodes",
      icon: Zap,
      previewBg: "from-[#2a3a1a] to-[#152010]",
    },
  ];

  const handleNavigation = (pageId: string) => {
    if (onNavigate) {
      onNavigate(pageId);
    }
  };

  return (
    <div className="main-content">
      <div style={{ marginBottom: 'var(--sp-5)' }}>
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 300, letterSpacing: '-0.01em', color: 'rgb(243, 244, 246)', marginBottom: 'var(--sp-2)' }}>
          Welcome to Paragon
        </h1>
        <p style={{ fontSize: 'var(--fs-md)', color: 'rgb(156, 163, 175)', fontWeight: 300 }}>
          Your gateway to prediction market analytics and insights
        </p>
      </div>

      <div className="discover-grid">
        {pages.map((page) => {
          const Icon = page.icon;
          return (
            <div
              key={page.id}
              onClick={() => handleNavigation(page.id)}
              className="discover-card group"
            >
              <div className="border-2 border-white/20 hover:border-white/40 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-white/5">
                {/* Preview Image Area */}
                <div className={`discover-card-preview bg-gradient-to-br ${page.previewBg}`}>
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

                  {/* Workflow nodes visualization for TradeFlow */}
                  {page.id === "tradeflow" && (
                    <svg className="absolute bottom-6 left-6 right-6 h-16 opacity-30" viewBox="0 0 320 64" preserveAspectRatio="xMidYMid meet">
                      {/* Node boxes */}
                      <rect x="10" y="20" width="40" height="24" fill="none" stroke="#4a7c7e" strokeWidth="1.5" rx="2" />
                      <text x="30" y="37" textAnchor="middle" fontSize="8" fill="#4a7c7e">M</text>
                      <rect x="80" y="20" width="40" height="24" fill="none" stroke="#4a7c7e" strokeWidth="1.5" rx="2" />
                      <text x="100" y="37" textAnchor="middle" fontSize="8" fill="#4a7c7e">E</text>
                      <rect x="150" y="20" width="40" height="24" fill="none" stroke="#4a7c7e" strokeWidth="1.5" rx="2" />
                      <text x="170" y="37" textAnchor="middle" fontSize="8" fill="#4a7c7e">X</text>
                      <rect x="220" y="20" width="40" height="24" fill="none" stroke="#4a7c7e" strokeWidth="1.5" rx="2" />
                      <text x="240" y="37" textAnchor="middle" fontSize="8" fill="#4a7c7e">P</text>
                      {/* Connection arrows */}
                      <line x1="50" y1="32" x2="80" y2="32" stroke="#4a7c7e" strokeWidth="1" markerEnd="url(#arrowhead)" />
                      <line x1="120" y1="32" x2="150" y2="32" stroke="#4a7c7e" strokeWidth="1" markerEnd="url(#arrowhead)" />
                      <line x1="190" y1="32" x2="220" y2="32" stroke="#4a7c7e" strokeWidth="1" markerEnd="url(#arrowhead)" />
                      <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                          <polygon points="0 0, 6 3, 0 6" fill="#4a7c7e" />
                        </marker>
                      </defs>
                    </svg>
                  )}
                </div>

                {/* Content Area */}
                <div className="discover-card-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
                    <div className="discover-card-icon">
                      <Icon />
                    </div>
                    <h3 className="discover-card-title">
                      {page.title}
                    </h3>
                  </div>
                  <p className="discover-card-desc">
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
