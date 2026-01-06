import { useState } from "react";
import { Discover } from "./components/Discover";
import { Markets } from "./components/Markets";
import { WalletsList } from "./components/WalletsList";
import { WalletProfile } from "./components/WalletProfile";
import { Feed } from "./components/Feed";
import { Portfolio } from "./components/Portfolio";
import { BookmarkedMarketsBar } from "./components/BookmarkedMarketsBar";
import { X } from "lucide-react";

type Page = "discover" | "markets" | "wallets" | "feed" | "portfolio";

export interface BookmarkedMarket {
  id: string;
  name: string;
  probability: number;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("discover");
  const [selectedWalletAddress, setSelectedWalletAddress] = useState<string | null>(null);
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [bookmarkedMarkets, setBookmarkedMarkets] = useState<BookmarkedMarket[]>([
    { id: "1", name: "Will BTC reach $100k by Q1 2026?", probability: 67 },
    { id: "5", name: "ETH 2.0 full rollout in 2026?", probability: 42 },
  ]);

  const toggleBookmark = (market: BookmarkedMarket) => {
    setBookmarkedMarkets((prev) => {
      const exists = prev.find((m) => m.id === market.id);
      if (exists) {
        return prev.filter((m) => m.id !== market.id);
      } else {
        return [...prev, market];
      }
    });
  };

  const isBookmarked = (marketId: string) => {
    return bookmarkedMarkets.some((m) => m.id === marketId);
  };

  const navigateToMarket = (marketId: string) => {
    setSelectedMarketId(marketId);
    setCurrentPage("markets");
  };

  const openWalletProfile = (walletAddress: string) => {
    setSelectedWalletAddress(walletAddress);
  };

  const closeWalletProfile = () => {
    setSelectedWalletAddress(null);
  };

  return (
    <div className="dark min-h-screen bg-[#0a0a0a] text-gray-100">
      {/* Top Navigation */}
      <header className="border-b border-gray-800/50 bg-gradient-to-b from-[#0d0d0d] to-[#0a0a0a]">
        <nav className="flex items-center h-16 px-8">
          <div className="flex items-center gap-12">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">P</div>
              <div className="text-xl font-light tracking-tight text-gray-100">PARAGON</div>
            </div>
            <div className="flex items-center gap-8">
              <button
                onClick={() => {
                  setCurrentPage("discover");
                  setSelectedWalletAddress(null);
                  setSelectedMarketId(null);
                }}
                className={`text-[13px] font-light tracking-wide transition-all ${
                  currentPage === "discover" ? "text-gray-100" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                DISCOVER
              </button>
              <button
                onClick={() => {
                  setCurrentPage("markets");
                  setSelectedWalletAddress(null);
                  setSelectedMarketId(null);
                }}
                className={`text-[13px] font-light tracking-wide transition-all ${
                  currentPage === "markets" ? "text-gray-100" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                MARKETS
              </button>
              <button
                onClick={() => {
                  setCurrentPage("wallets");
                  setSelectedWalletAddress(null);
                  setSelectedMarketId(null);
                }}
                className={`text-[13px] font-light tracking-wide transition-all ${
                  currentPage === "wallets" ? "text-gray-100" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                WALLETS
              </button>
              <button
                onClick={() => {
                  setCurrentPage("feed");
                  setSelectedWalletAddress(null);
                  setSelectedMarketId(null);
                }}
                className={`text-[13px] font-light tracking-wide transition-all ${
                  currentPage === "feed" ? "text-gray-100" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                FEED
              </button>
              <button
                onClick={() => {
                  setCurrentPage("portfolio");
                  setSelectedWalletAddress(null);
                  setSelectedMarketId(null);
                }}
                className={`text-[13px] font-light tracking-wide transition-all ${
                  currentPage === "portfolio" ? "text-gray-100" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                PORTFOLIO
              </button>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-6">
            <div className="text-sm font-light text-gray-400">
              <span className="text-gray-600">Balance:</span>{" "}
              <span className="text-gray-200 font-normal">$3,320.00</span>
            </div>
            <a
              href="https://x.com/ParagonAnalyst"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </a>
          </div>
        </nav>
      </header>

      {/* Bookmarked Markets Bar */}
      <BookmarkedMarketsBar
        bookmarkedMarkets={bookmarkedMarkets}
        onNavigate={navigateToMarket}
      />

      {/* Main Content */}
      <main className="p-8">
        {selectedWalletAddress ? (
          <WalletProfile walletAddress={selectedWalletAddress} onClose={closeWalletProfile} />
        ) : (
          <>
            {currentPage === "discover" && (
              <Discover 
                toggleBookmark={toggleBookmark} 
                isBookmarked={isBookmarked}
                onWalletClick={openWalletProfile}
              />
            )}
            {currentPage === "markets" && (
              <Markets 
                toggleBookmark={toggleBookmark} 
                isBookmarked={isBookmarked}
                onWalletClick={openWalletProfile}
                initialMarketId={selectedMarketId}
              />
            )}
            {currentPage === "wallets" && <WalletsList onWalletClick={openWalletProfile} />}
            {currentPage === "feed" && <Feed onWalletClick={openWalletProfile} />}
            {currentPage === "portfolio" && <Portfolio />}
          </>
        )}
      </main>
    </div>
  );
}