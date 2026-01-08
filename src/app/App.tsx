import { useState, useRef, useEffect, useCallback } from "react";
import { Discover } from "./components/Discover";
import { Markets } from "./components/Markets";
import { WalletsList } from "./components/WalletsList";
import { WalletProfile } from "./components/WalletProfile";
import { InsiderLens } from "./components/InsiderLens";
import { Portfolio } from "./components/Portfolio";
import { BookmarkedMarketsBar } from "./components/BookmarkedMarketsBar";
import { Search, X, Clock, TrendingUp, Bookmark, Loader2 } from "lucide-react";
import paragonLogo from "../assets/paragon-logo.png";
import { getAllActiveMarkets, searchMarkets } from "./services/polymarketApi";

type Page = "discover" | "markets" | "wallets" | "insiderlens" | "portfolio";

export interface BookmarkedMarket {
  id: string;
  name: string;
  probability: number;
  volume?: string;
  image?: string | null;
}

interface SelectedMarketData {
  id: string;
  name: string;
  probability: number;
  volume: string;
}

interface SearchHistoryItem {
  id: string;
  name: string;
  probability: number;
  volume: string;
  timestamp: number;
}

interface DisplayMarket {
  id: string;
  title?: string;
  name?: string;
  probability?: number | string;
  volume?: string;
  image?: string | null;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("discover");
  const [selectedWalletAddress, setSelectedWalletAddress] = useState<string | null>(null);
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [selectedMarketData, setSelectedMarketData] = useState<SelectedMarketData | null>(null);
  const [bookmarkedMarkets, setBookmarkedMarkets] = useState<BookmarkedMarket[]>([]);

  // Search state (moved from Discover)
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<DisplayMarket[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [allMarketsCache, setAllMarketsCache] = useState<DisplayMarket[]>([]);
  const [isLoadingAllMarkets, setIsLoadingAllMarkets] = useState(false);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load ALL active markets for comprehensive search on mount
  useEffect(() => {
    const loadAllMarkets = async () => {
      setIsLoadingAllMarkets(true);
      try {
        // Check for cached data first
        const cached = localStorage.getItem("polymarket_all_markets_cache");
        if (cached) {
          const data = JSON.parse(cached);
          // Use cache if less than 2 hours old (extended for faster loads)
          if (data.timestamp && Date.now() - data.timestamp < 2 * 60 * 60 * 1000) {
            setAllMarketsCache(data.markets);
            console.log(`Loaded ${data.markets.length} markets from cache for search`);
            setIsLoadingAllMarkets(false);
            return;
          }
        }
        
        // Fetch fresh data from API
        const markets = await getAllActiveMarkets();
        if (markets && markets.length > 0) {
          setAllMarketsCache(markets);
          // Cache for 5 minutes
          localStorage.setItem("polymarket_all_markets_cache", JSON.stringify({
            markets,
            timestamp: Date.now()
          }));
          console.log(`Fetched ${markets.length} markets from API for search`);
        }
      } catch (e) {
        console.error("Failed to load all markets for search:", e);
      } finally {
        setIsLoadingAllMarkets(false);
      }
    };
    
    loadAllMarkets();
  }, []);

  // Load search history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("polymarket_search_history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const trimmed = parsed.slice(0, 5);
          setSearchHistory(trimmed);
          if (parsed.length > 5) {
            localStorage.setItem("polymarket_search_history", JSON.stringify(trimmed));
          }
        }
      }
    } catch (e) {
      console.error("Failed to load search history:", e);
      localStorage.removeItem("polymarket_search_history");
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search through ALL markets (local cache + API fallback)
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    
    const lowerQuery = query.toLowerCase().trim();
    const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 1);
    
    // First search through local cache (instant results)
    let localResults = allMarketsCache
      .filter(market => {
        const name = (market.name || market.title || "").toLowerCase();
        return queryWords.some(word => name.includes(word)) || name.includes(lowerQuery);
      })
      .map(market => {
        const name = (market.name || market.title || "").toLowerCase();
        let score = 0;
        if (name.includes(lowerQuery)) score += 100;
        queryWords.forEach(word => {
          if (name.includes(word)) score += 10;
          if (name.startsWith(word)) score += 5;
        });
        return { ...market, _score: score };
      })
      .sort((a: any, b: any) => b._score - a._score)
      .slice(0, 20);
    
    // If we have local results, show them immediately
    if (localResults.length > 0) {
      setSearchResults(localResults);
      setIsSearching(false);
    } else {
      // If no local results, try API search
      try {
        const apiResults = await searchMarkets(query, 20);
        if (apiResults && apiResults.length > 0) {
          setSearchResults(apiResults.map((m: any) => ({
            id: m.id,
            name: m.title || m.name,
            title: m.title || m.name,
            probability: m.probability || (m.lastPriceUsd ? m.lastPriceUsd * 100 : 50),
            volume: m.volume || "$0",
            image: m.image || null,
          })));
        } else {
          setSearchResults([]);
        }
      } catch (e) {
        console.error("API search failed:", e);
        setSearchResults([]);
      }
      setIsSearching(false);
    }
  }, [allMarketsCache]);

  // Debounced search
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    if (searchQuery.trim()) {
      setIsSearching(true);
      searchDebounceRef.current = setTimeout(() => {
        performSearch(searchQuery);
      }, 150);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
    
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, performSearch]);

  // Add to search history
  const addToSearchHistory = useCallback((market: DisplayMarket) => {
    const historyItem: SearchHistoryItem = {
      id: market.id,
      name: market.name || market.title || "Unknown",
      probability: Number(market.probability) || 0,
      volume: market.volume || "$0",
      timestamp: Date.now(),
    };
    
    setSearchHistory(prev => {
      const filtered = prev.filter(item => item.id !== market.id);
      const newHistory = [historyItem, ...filtered].slice(0, 5);
      localStorage.setItem("polymarket_search_history", JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  // Clear search history
  const clearSearchHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem("polymarket_search_history");
  };

  // Remove from history
  const removeFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchHistory(prev => {
      const newHistory = prev.filter(item => item.id !== id);
      localStorage.setItem("polymarket_search_history", JSON.stringify(newHistory));
      return newHistory;
    });
  };

  // Handle market selection from search
  const handleSearchMarketSelect = (market: DisplayMarket) => {
    addToSearchHistory(market);
    setSearchQuery("");
    setIsSearchFocused(false);
    setSelectedMarketId(market.id);
    setSelectedMarketData({
      id: market.id,
      name: market.name || market.title || "Unknown",
      probability: Number(market.probability) || 50,
      volume: market.volume || "$0",
    });
    setCurrentPage("markets");
  };

  // Handle selecting from history
  const handleHistorySelect = (item: SearchHistoryItem) => {
    addToSearchHistory({
      id: item.id,
      name: item.name,
      probability: item.probability,
      volume: item.volume,
    });
    setSearchQuery("");
    setIsSearchFocused(false);
    setSelectedMarketId(item.id);
    setSelectedMarketData({
      id: item.id,
      name: item.name,
      probability: item.probability,
      volume: item.volume,
    });
    setCurrentPage("markets");
  };

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
    <div className="dark min-h-screen bg-[#0a0a0a] text-gray-100 font-['Inter']">
      {/* Top Navigation */}
      <header className="border-b border-gray-800/50 bg-gradient-to-b from-[#0d0d0d] to-[#0a0a0a]">
        <nav className="flex items-center h-16 px-8">
          <div className="flex items-center gap-12">
            <button
              onClick={() => {
                setCurrentPage("discover");
                setSelectedWalletAddress(null);
                setSelectedMarketId(null);
              }}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <img src={paragonLogo} alt="Paragon" className="h-10 w-10 object-contain" />
              <div className="text-[22px] font-light tracking-tight text-gray-100">PARAGON</div>
            </button>
            <div className="flex items-center gap-8">
              <button
                onClick={() => {
                  setCurrentPage("discover");
                  setSelectedWalletAddress(null);
                  setSelectedMarketId(null);
                }}
                className={`text-[16px] font-light tracking-wide transition-all ${
                  currentPage === "discover" ? "text-gray-100" : "text-gray-400 hover:text-gray-200"
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
                className={`text-[16px] font-light tracking-wide transition-all ${
                  currentPage === "markets" ? "text-gray-100" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                MARKETS
              </button>
              <button
                onClick={() => {
                  setCurrentPage("insiderlens");
                  setSelectedWalletAddress(null);
                  setSelectedMarketId(null);
                }}
                className={`text-[16px] font-light tracking-wide transition-all ${
                  currentPage === "insiderlens" ? "text-gray-100" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                INSIDERLENS
              </button>
              <button
                onClick={() => {
                  setCurrentPage("wallets");
                  setSelectedWalletAddress(null);
                  setSelectedMarketId(null);
                }}
                className={`text-[16px] font-light tracking-wide transition-all ${
                  currentPage === "wallets" ? "text-gray-100" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                WALLETS
              </button>
              <button
                onClick={() => {
                  setCurrentPage("portfolio");
                  setSelectedWalletAddress(null);
                  setSelectedMarketId(null);
                }}
                className={`text-[16px] font-light tracking-wide transition-all ${
                  currentPage === "portfolio" ? "text-gray-100" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                PORTFOLIO
              </button>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-6">
            {/* Search Bar */}
            <div ref={searchRef} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 z-10" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                placeholder="Search markets..."
                className={`w-[400px] bg-[#0d0d0d] border border-gray-800/50 pl-10 pr-10 py-2 text-[14px] text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-600/50 transition-all ${
                  isSearchFocused && (searchHistory.length > 0 || searchQuery.trim() || isSearching) 
                    ? "rounded-t-lg rounded-b-none border-b-transparent" 
                    : "rounded-lg"
                }`}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors z-10"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              
              {/* Search Dropdown */}
              {isSearchFocused && (searchHistory.length > 0 || searchQuery.trim() || isSearching) && (
                <div className="absolute top-full left-0 right-0 bg-[#0d0d0d] border border-gray-800/50 border-t-0 rounded-b-lg shadow-xl shadow-black/30 z-50 max-h-[400px] overflow-y-auto">
                  {/* History */}
                  {!searchQuery.trim() && searchHistory.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800/30">
                        <span className="text-[13px] text-gray-400 uppercase tracking-wide">Recently Searched</span>
                        <button
                          onClick={clearSearchHistory}
                          className="text-[13px] text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          Clear all
                        </button>
                      </div>
                      {searchHistory.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleHistorySelect(item)}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-[#111111] cursor-pointer group transition-all"
                        >
                          <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] text-gray-200 truncate">{item.name}</div>
                            <div className="flex items-center gap-4 text-[13px] text-gray-500 mt-0.5">
                              <span className="text-[#4a6fa5]">{item.probability}%</span>
                              <span className="text-green-500">{item.volume}</span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => removeFromHistory(item.id, e)}
                            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Loading */}
                  {searchQuery.trim() && isSearching && (
                    <div className="px-4 py-6 text-center">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-gray-400" />
                      <p className="text-[14px] text-gray-400">Searching markets...</p>
                    </div>
                  )}
                  
                  {/* Results */}
                  {searchQuery.trim() && !isSearching && searchResults.length > 0 && (
                    <div>
                      <div className="px-4 py-2 border-b border-gray-800/30">
                        <span className="text-[12px] text-gray-400 uppercase tracking-wide">
                          {searchResults.length} market{searchResults.length !== 1 ? "s" : ""} found
                        </span>
                      </div>
                      {searchResults.map((market) => (
                        <div
                          key={market.id}
                          onClick={() => handleSearchMarketSelect(market)}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-[#111111] cursor-pointer transition-all"
                        >
                          <TrendingUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] text-gray-200 truncate">{market.name || market.title}</div>
                            <div className="flex items-center gap-4 text-[13px] text-gray-500 mt-0.5">
                              <span className="text-[#4a6fa5]">{market.probability}%</span>
                              <span className="text-green-500">{market.volume}</span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBookmark({
                                id: market.id,
                                name: market.name || market.title || "Unknown",
                                probability: Number(market.probability) || 0,
                                image: market.image || null,
                              });
                            }}
                            className="text-gray-500 hover:text-[#4a6fa5] transition-all"
                          >
                            <Bookmark
                              className={`w-3.5 h-3.5 ${
                                isBookmarked(market.id) ? "fill-current text-[#4a6fa5]" : ""
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* No results */}
                  {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
                    <div className="px-4 py-8 text-center">
                      <Search className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                      <p className="text-[14px] text-gray-400">No markets found for "{searchQuery}"</p>
                      <p className="text-[13px] text-gray-500 mt-1">Try a different search term</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* X (Twitter) Logo - moved between search and balance */}
            <a
              href="https://x.com/ParagonAnalyst"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-gray-300 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            
            <div className="text-[15px] font-light text-gray-300">
              <span className="text-gray-500">Balance:</span>{" "}
              <span className="text-gray-100 font-normal">$3,320.00</span>
            </div>
            
            {/* Login Button */}
            <button className="px-4 py-1.5 bg-gradient-to-br from-[#4a6fa5] to-[#3a5f95] text-white text-[14px] font-light rounded hover:opacity-90 transition-opacity">
              Login
            </button>
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
                onMarketClick={(market) => {
                  setSelectedMarketId(market.id);
                  setSelectedMarketData({
                    id: market.id,
                    name: market.name || market.title || "Unknown",
                    probability: Number(market.probability) || 50,
                    volume: market.volume || "$0",
                  });
                  setCurrentPage("markets");
                }}
                onNavigate={(page) => {
                  setCurrentPage(page as Page);
                  setSelectedWalletAddress(null);
                  setSelectedMarketId(null);
                }}
              />
            )}
            {currentPage === "markets" && (
              <Markets 
                toggleBookmark={toggleBookmark} 
                isBookmarked={isBookmarked}
                onWalletClick={openWalletProfile}
                initialMarketId={selectedMarketId}
                initialMarketData={selectedMarketData}
              />
            )}
            {currentPage === "wallets" && <WalletsList onWalletClick={openWalletProfile} onMarketClick={navigateToMarket} />}
            {currentPage === "insiderlens" && <InsiderLens onWalletClick={openWalletProfile} />}
            {currentPage === "portfolio" && <Portfolio />}
          </>
        )}
      </main>
    </div>
  );
}