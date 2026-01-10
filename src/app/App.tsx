import { useState, useRef, useEffect, useCallback } from "react";
import { Discover } from "./components/Discover";
import { Markets } from "./components/Markets";
import { WalletsList } from "./components/WalletsList";
import { WalletProfile } from "./components/WalletProfile";
import { InsiderLens } from "./components/InsiderLens";
import { Portfolio } from "./components/Portfolio";
import { BookmarkedMarketsBar } from "./components/BookmarkedMarketsBar";
import { SearchResults } from "./components/SearchResults";
import { LoginPage } from "./components/LoginPage";
import { TradeFlow } from "./components/TradeFlow";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Search, X, Clock, TrendingUp, Bookmark, Loader2, LogOut, User, ChevronDown } from "lucide-react";
import paragonLogo from "../assets/paragon-logo.png";
import { getAllActiveMarkets, searchMarkets, initializeMarketCache, instantSearch, prefetchMarketDetail } from "./services/polymarketApi";

// Helper function to format balance - handles both crypto and USD
function formatBalance(amount: number, isWallet: boolean = false): string {
  if (isWallet) {
    // For wallet balances, show crypto amount with up to 5 decimal places
    return amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 5,
    });
  }
  // For USD balances
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Format probability to match bookmarks display (no unnecessary decimals)
function formatProbability(prob: number): string {
  if (prob < 0.1) return "<0.1";
  if (prob > 99.9) return ">99.9";
  if (prob < 1 || prob > 99) {
    return prob.toFixed(1);
  }
  if (Math.abs(prob - Math.round(prob)) < 0.05) {
    return Math.round(prob).toString();
  }
  return prob.toFixed(1);
}

type Page = "discover" | "markets" | "wallets" | "insiderlens" | "portfolio" | "tradeflow" | "search";

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

// User authentication section component
function UserAuthSection({ onLoginClick }: { onLoginClick: () => void }) {
  const { user, isAuthenticated, logout, refreshBalance, isLoading } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showInUsd, setShowInUsd] = useState(false);
  const [solPrice, setSolPrice] = useState<number | null>(null);

  // Fetch SOL price on mount and periodically
  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
        const data = await response.json();
        if (data.solana?.usd) {
          setSolPrice(data.solana.usd);
        }
      } catch (e) {
        console.error("Failed to fetch SOL price:", e);
        // Fallback price if API fails
        setSolPrice(138.89);
      }
    };
    fetchSolPrice();
    const interval = setInterval(fetchSolPrice, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-4">
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <button
        onClick={onLoginClick}
        className="px-4 py-2 bg-[#4a6fa5] text-white text-sm font-medium rounded-lg hover:bg-[#5a7fb5] transition-colors"
      >
        Login
      </button>
    );
  }

  // Determine crypto symbol based on wallet address format
  const getCryptoSymbol = () => {
    if (!user.walletAddress) return "";
    // Ethereum addresses start with 0x and are 42 chars
    if (user.walletAddress.startsWith("0x") && user.walletAddress.length === 42) return "ETH";
    // Solana addresses are base58 encoded, typically 32-44 chars
    return "SOL";
  };

  // Calculate USD value from SOL
  const getUsdValue = () => {
    if (!solPrice) return null;
    return user.balance * solPrice;
  };

  // Format the balance display based on toggle
  const getBalanceDisplay = () => {
    if (user.authMethod !== "wallet") {
      return formatBalance(user.balance / 100, false); // Email/Google users - stored in cents
    }

    const cryptoSymbol = getCryptoSymbol();
    if (showInUsd && solPrice && cryptoSymbol === "SOL") {
      const usdValue = getUsdValue();
      return usdValue !== null ? formatBalance(usdValue, false) : `${formatBalance(user.balance, true)} ${cryptoSymbol}`;
    }
    return `${formatBalance(user.balance, true)} ${cryptoSymbol}`;
  };

  return (
    <>
      {/* Balance Display with Toggle - hidden on very small screens */}
      <div className="hidden md:flex items-center gap-2">
        <div className="text-xs lg:text-[15px] font-light text-gray-300">
          <span className="text-gray-500">Balance:</span>{" "}
          <span className="text-gray-100 font-normal">{getBalanceDisplay()}</span>
        </div>
        {user.authMethod === "wallet" && getCryptoSymbol() === "SOL" && (
          <button
            onClick={() => setShowInUsd(!showInUsd)}
            className="px-1.5 lg:px-2 py-0.5 text-[9px] lg:text-[10px] font-medium rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors border border-gray-700"
            title={showInUsd ? "Show in SOL" : "Show in USD"}
          >
            {showInUsd ? "SOL" : "USD"}
          </button>
        )}
      </div>

      {/* User Menu */}
      <div className="relative">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1 lg:py-1.5 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 rounded-lg hover:border-gray-600/50 transition-colors"
        >
          <div className="w-5 h-5 lg:w-6 lg:h-6 rounded-full bg-gradient-to-br from-[#4a6fa5] to-[#3a5f95] flex items-center justify-center">
            <User className="w-3 h-3 lg:w-4 lg:h-4 text-white" />
          </div>
          <span className="text-xs lg:text-[14px] text-gray-300 font-light max-w-[60px] lg:max-w-[100px] truncate hidden sm:block">
            {user.displayName}
          </span>
          <ChevronDown className={`w-3 h-3 lg:w-4 lg:h-4 text-gray-500 transition-transform ${showUserMenu ? "rotate-180" : ""}`} />
        </button>

        {showUserMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
            <div className="absolute right-0 mt-2 w-56 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-gray-700/50 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="p-4 border-b border-gray-800/50">
                <div className="text-sm text-gray-300 font-medium truncate">{user.displayName}</div>
                {user.email && (
                  <div className="text-xs text-gray-500 truncate mt-1">{user.email}</div>
                )}
                {user.walletAddress && (
                  <div className="text-xs text-gray-500 font-mono truncate mt-1">{user.walletAddress}</div>
                )}
                <div className="mt-3 p-2 bg-[#0a0a0a] rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Balance</span>
                    {user.authMethod === "wallet" && getCryptoSymbol() === "SOL" && (
                      <button
                        onClick={() => setShowInUsd(!showInUsd)}
                        className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                      >
                        {showInUsd ? "SOL" : "USD"}
                      </button>
                    )}
                  </div>
                  <div className="text-lg text-gray-100 font-medium">
                    {getBalanceDisplay()}
                  </div>
                  {user.authMethod === "wallet" && getCryptoSymbol() === "SOL" && solPrice && (
                    <div className="text-xs text-gray-500 mt-1">
                      {showInUsd
                        ? `≈ ${formatBalance(user.balance, true)} SOL`
                        : `≈ ${formatBalance(user.balance * solPrice, false)}`
                      }
                    </div>
                  )}
                </div>
              </div>

              {user.authMethod === "wallet" && (
                <button
                  onClick={() => {
                    refreshBalance();
                    setShowUserMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-800/30 transition-colors flex items-center gap-3"
                >
                  <Loader2 className="w-4 h-4 text-gray-500" />
                  Refresh Balance
                </button>
              )}

              <button
                onClick={() => {
                  logout();
                  setShowUserMenu(false);
                }}
                className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-gray-800/30 transition-colors flex items-center gap-3"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

interface AppContentProps {
  showLoginPage: boolean;
  setShowLoginPage: (show: boolean) => void;
}

function AppContent({ showLoginPage, setShowLoginPage }: AppContentProps) {
  const { login } = useAuth();

  // Navigation history state - tracks where user came from for proper back navigation
  interface NavigationState {
    page: Page;
    marketId: string | null;
    marketData: SelectedMarketData | null;
    walletAddress: string | null;
  }

  const [navigationHistory, setNavigationHistory] = useState<NavigationState[]>([]);

  // Load saved page from localStorage, default to "discover"
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    try {
      const savedPage = localStorage.getItem("paragon_current_page");
      if (savedPage && ["discover", "markets", "wallets", "insiderlens", "portfolio", "search"].includes(savedPage)) {
        return savedPage as Page;
      }
    } catch (e) {
      console.error("Failed to load saved page:", e);
    }
    return "discover";
  });

  const [selectedWalletAddress, setSelectedWalletAddress] = useState<string | null>(() => {
    try {
      return localStorage.getItem("paragon_selected_wallet");
    } catch (e) {
      return null;
    }
  });

  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("paragon_selected_market_id");
    } catch (e) {
      return null;
    }
  });

  const [selectedMarketData, setSelectedMarketData] = useState<SelectedMarketData | null>(() => {
    try {
      const saved = localStorage.getItem("paragon_selected_market_data");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load saved market data:", e);
    }
    return null;
  });

  const [bookmarkedMarkets, setBookmarkedMarkets] = useState<BookmarkedMarket[]>([]);

  // Push current state to navigation history before navigating
  const pushToHistory = useCallback(() => {
    setNavigationHistory(prev => {
      const currentState: NavigationState = {
        page: currentPage,
        marketId: selectedMarketId,
        marketData: selectedMarketData,
        walletAddress: selectedWalletAddress,
      };
      // Limit history to 50 entries
      const newHistory = [...prev, currentState].slice(-50);
      return newHistory;
    });
  }, [currentPage, selectedMarketId, selectedMarketData, selectedWalletAddress]);

  // Go back to previous state
  const goBack = useCallback(() => {
    setNavigationHistory(prev => {
      if (prev.length === 0) {
        // No history - just go to markets list (clear market selection)
        setSelectedMarketId(null);
        setSelectedMarketData(null);
        return prev;
      }

      const newHistory = [...prev];
      const previousState = newHistory.pop();

      if (previousState) {
        setCurrentPage(previousState.page);
        setSelectedMarketId(previousState.marketId);
        setSelectedMarketData(previousState.marketData);
        setSelectedWalletAddress(previousState.walletAddress);
      }

      return newHistory;
    });
  }, []);

  // Save current page to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("paragon_current_page", currentPage);
    } catch (e) {
      console.error("Failed to save current page:", e);
    }
  }, [currentPage]);

  // Save selected market ID to localStorage whenever it changes
  useEffect(() => {
    try {
      if (selectedMarketId) {
        localStorage.setItem("paragon_selected_market_id", selectedMarketId);
      } else {
        localStorage.removeItem("paragon_selected_market_id");
      }
    } catch (e) {
      console.error("Failed to save selected market ID:", e);
    }
  }, [selectedMarketId]);

  // Save selected market data to localStorage whenever it changes
  useEffect(() => {
    try {
      if (selectedMarketData) {
        localStorage.setItem("paragon_selected_market_data", JSON.stringify(selectedMarketData));
      } else {
        localStorage.removeItem("paragon_selected_market_data");
      }
    } catch (e) {
      console.error("Failed to save selected market data:", e);
    }
  }, [selectedMarketData]);

  // Save selected wallet address to localStorage whenever it changes
  useEffect(() => {
    try {
      if (selectedWalletAddress) {
        localStorage.setItem("paragon_selected_wallet", selectedWalletAddress);
      } else {
        localStorage.removeItem("paragon_selected_wallet");
      }
    } catch (e) {
      console.error("Failed to save selected wallet:", e);
    }
  }, [selectedWalletAddress]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      goBack();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [goBack]);

  // Search state (moved from Discover)
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<DisplayMarket[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [allMarketsCache, setAllMarketsCache] = useState<DisplayMarket[]>([]);
  const [isLoadingAllMarkets, setIsLoadingAllMarkets] = useState(false);
  const [searchResultsQuery, setSearchResultsQuery] = useState("");

  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize global market cache on app startup for INSTANT search
  useEffect(() => {
    console.log("🚀 App starting - initializing global market cache...");
    initializeMarketCache();
  }, []);

  // Load ALL active markets for comprehensive search on mount
  useEffect(() => {
    const loadAllMarkets = async () => {
      setIsLoadingAllMarkets(true);
      try {
        // Check for cached data first
        const cached = localStorage.getItem("polymarket_all_markets_cache");
        if (cached) {
          const data = JSON.parse(cached);
          // Use cache if less than 30 minutes old (reduced for fresher data)
          if (data.timestamp && Date.now() - data.timestamp < 30 * 60 * 1000) {
            setAllMarketsCache(data.markets);
            console.log(`Loaded ${data.markets.length} markets from cache for search`);
            setIsLoadingAllMarkets(false);
            // Still refresh in background for newer markets
            refreshMarketsInBackground();
            return;
          }
        }

        // Fetch fresh data from API
        await fetchAndCacheMarkets();
      } catch (e) {
        console.error("Failed to load all markets for search:", e);
      } finally {
        setIsLoadingAllMarkets(false);
      }
    };

    const fetchAndCacheMarkets = async () => {
      const markets = await getAllActiveMarkets();
      if (markets && markets.length > 0) {
        setAllMarketsCache(markets);
        localStorage.setItem("polymarket_all_markets_cache", JSON.stringify({
          markets,
          timestamp: Date.now()
        }));
        console.log(`Fetched ${markets.length} markets from API for search`);
      }
    };

    const refreshMarketsInBackground = async () => {
      try {
        const markets = await getAllActiveMarkets();
        if (markets && markets.length > 0) {
          setAllMarketsCache(markets);
          localStorage.setItem("polymarket_all_markets_cache", JSON.stringify({
            markets,
            timestamp: Date.now()
          }));
          console.log(`Background refresh: ${markets.length} markets updated`);
        }
      } catch (e) {
        // Silent fail for background refresh
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

  // Search through ALL markets (instant search from global cache + API fallback)
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // PRIORITY 1: Use instant search from global cache (sub-millisecond)
    const instantResults = instantSearch(query, 50);
    if (instantResults.length > 0) {
      const mappedResults = instantResults.map(m => ({
        id: m.id,
        name: m.title,
        title: m.title,
        probability: m.probability,
        volume: formatVolume(m.volumeUsd),
        image: m.image,
        groupItemTitle: m.groupItemTitle,
        _score: 100,
      }));
      setSearchResults(mappedResults);
      console.log(`⚡ Instant search: ${instantResults.length} results for "${query}"`);
      setIsSearching(false);
      return;
    }

    // Fallback: search through local cache
    const lowerQuery = query.toLowerCase().trim();
    const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 1);

    const localResults = allMarketsCache
      .filter(market => {
        const name = (market.name || market.title || "").toLowerCase();
        const description = (market.description || "").toLowerCase();
        return queryWords.some(word => name.includes(word) || description.includes(word)) || name.includes(lowerQuery);
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
      .slice(0, 30);

    // Show local results immediately
    if (localResults.length > 0) {
      setSearchResults(localResults);
    }

    // API fallback for comprehensive results
    try {
      const apiResults = await searchMarkets(query, 50);
      if (apiResults && apiResults.length > 0) {
        // Combine API results with local results, deduplicating by ID
        const seenIds = new Set(localResults.map(m => m.id));
        const newApiResults = apiResults
          .filter((m: any) => !seenIds.has(m.id))
          .map((m: any) => ({
            id: m.id,
            name: m.title || m.name,
            title: m.title || m.name,
            probability: m.probability || (m.lastPriceUsd ? m.lastPriceUsd * 100 : 50),
            volume: m.volume || "$0",
            image: m.image || null,
            _score: 50, // Base score for API results
          }));

        // Merge and sort by score
        const combinedResults = [...localResults, ...newApiResults]
          .sort((a: any, b: any) => (b._score || 0) - (a._score || 0))
          .slice(0, 30);

        setSearchResults(combinedResults);
        console.log(`Combined search: ${localResults.length} local + ${newApiResults.length} API = ${combinedResults.length} results`);
      } else if (localResults.length === 0) {
        setSearchResults([]);
      }
    } catch (e) {
      console.error("API search failed:", e);
      // Keep local results if API fails
    }
    setIsSearching(false);
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
    pushToHistory();
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
    pushToHistory();
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

  // Handle Enter key to show full search results page
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      e.preventDefault();
      pushToHistory();
      setSearchResultsQuery(searchQuery.trim());
      setSearchQuery("");
      setIsSearchFocused(false);
      setCurrentPage("search");
    }
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
    pushToHistory();
    setSelectedWalletAddress(walletAddress);
  };

  const closeWalletProfile = () => {
    setSelectedWalletAddress(null);
  };

  return (
    <div className="dark min-h-screen bg-[#0a0a0a] text-gray-100 font-['Inter'] overflow-x-hidden">
      {/* Top Navigation */}
      <header className="border-b border-gray-800/50 bg-gradient-to-b from-[#0d0d0d] to-[#0a0a0a]">
        <nav className="flex items-center h-16 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 lg:gap-8 xl:gap-12 flex-shrink-0">
            <button
              onClick={() => {
                setCurrentPage("discover");
                setSelectedWalletAddress(null);
                setSelectedMarketId(null);
              }}
              className="flex items-center gap-2 lg:gap-3 hover:opacity-80 transition-opacity flex-shrink-0"
            >
              <img src={paragonLogo} alt="Paragon" className="h-8 w-8 lg:h-10 lg:w-10 object-contain" />
              <div className="text-lg lg:text-[22px] font-light tracking-tight text-gray-100 hidden sm:block">PARAGON</div>
            </button>
            <div className="flex items-center gap-2 sm:gap-4 lg:gap-6 xl:gap-8">
              <button
                onClick={() => {
                  setCurrentPage("discover");
                  setSelectedWalletAddress(null);
                  setSelectedMarketId(null);
                }}
                className="relative group py-5"
              >
                <span className={`text-xs sm:text-sm lg:text-[16px] font-light tracking-wide transition-all ${currentPage === "discover" ? "text-gray-100" : "text-gray-400 group-hover:text-gray-200"
                  }`}>
                  DISCOVER
                </span>
                {/* Active/Hover indicator with animated stretching bar and triangle */}
                <div className={`absolute bottom-0 left-0 right-0 flex flex-col items-center transition-opacity duration-200 ${currentPage === "discover" ? "opacity-100" : "opacity-0 group-hover:opacity-70"
                  }`}>
                  <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] border-b-white" />
                  <div className={`h-[2px] bg-white transition-all duration-300 ease-out ${currentPage === "discover" ? "w-full" : "w-0 group-hover:w-full"
                    }`} style={{ marginTop: "-1px" }} />
                </div>
              </button>
              <button
                onClick={() => {
                  setCurrentPage("markets");
                  setSelectedWalletAddress(null);
                  setSelectedMarketId(null);
                }}
                className="relative group py-5"
              >
                <span className={`text-xs sm:text-sm lg:text-[16px] font-light tracking-wide transition-all ${currentPage === "markets" ? "text-gray-100" : "text-gray-400 group-hover:text-gray-200"
                  }`}>
                  MARKETS
                </span>
                <div className={`absolute bottom-0 left-0 right-0 flex flex-col items-center transition-opacity duration-200 ${currentPage === "markets" ? "opacity-100" : "opacity-0 group-hover:opacity-70"
                  }`}>
                  <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] border-b-white" />
                  <div className={`h-[2px] bg-white transition-all duration-300 ease-out ${currentPage === "markets" ? "w-full" : "w-0 group-hover:w-full"
                    }`} style={{ marginTop: "-1px" }} />
                </div>
              </button>
              <button
                onClick={() => {
                  setCurrentPage("insiderlens");
                  setSelectedWalletAddress(null);
                  setSelectedMarketId(null);
                }}
                className="relative group py-5"
              >
                <span className={`text-xs sm:text-sm lg:text-[16px] font-light tracking-wide transition-all ${currentPage === "insiderlens" ? "text-gray-100" : "text-gray-400 group-hover:text-gray-200"
                  }`}>
                  INSIDER
                </span>
                <div className={`absolute bottom-0 left-0 right-0 flex flex-col items-center transition-opacity duration-200 ${currentPage === "insiderlens" ? "opacity-100" : "opacity-0 group-hover:opacity-70"
                  }`}>
                  <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] border-b-white" />
                  <div className={`h-[2px] bg-white transition-all duration-300 ease-out ${currentPage === "insiderlens" ? "w-full" : "w-0 group-hover:w-full"
                    }`} style={{ marginTop: "-1px" }} />
                </div>
              </button>
              <button
                onClick={() => {
                  setCurrentPage("wallets");
                  setSelectedWalletAddress(null);
                  setSelectedMarketId(null);
                }}
                className="relative group py-5"
              >
                <span className={`text-xs sm:text-sm lg:text-[16px] font-light tracking-wide transition-all ${currentPage === "wallets" ? "text-gray-100" : "text-gray-400 group-hover:text-gray-200"
                  }`}>
                  WALLETS
                </span>
                <div className={`absolute bottom-0 left-0 right-0 flex flex-col items-center transition-opacity duration-200 ${currentPage === "wallets" ? "opacity-100" : "opacity-0 group-hover:opacity-70"
                  }`}>
                  <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] border-b-white" />
                  <div className={`h-[2px] bg-white transition-all duration-300 ease-out ${currentPage === "wallets" ? "w-full" : "w-0 group-hover:w-full"
                    }`} style={{ marginTop: "-1px" }} />
                </div>
              </button>
              <button
                onClick={() => {
                  setCurrentPage("tradeflow");
                  setSelectedWalletAddress(null);
                  setSelectedMarketId(null);
                }}
                className="relative group py-5"
              >
                <span className={`text-xs sm:text-sm lg:text-[16px] font-light tracking-wide transition-all ${currentPage === "tradeflow" ? "text-gray-100" : "text-gray-400 group-hover:text-gray-200"
                  }`}>
                  TRADE
                </span>
                <div className={`absolute bottom-0 left-0 right-0 flex flex-col items-center transition-opacity duration-200 ${currentPage === "tradeflow" ? "opacity-100" : "opacity-0 group-hover:opacity-70"
                  }`}>
                  <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] border-b-white" />
                  <div className={`h-[2px] bg-white transition-all duration-300 ease-out ${currentPage === "tradeflow" ? "w-full" : "w-0 group-hover:w-full"
                    }`} style={{ marginTop: "-1px" }} />
                </div>
              </button>
              <button
                onClick={() => {
                  setCurrentPage("portfolio");
                  setSelectedWalletAddress(null);
                  setSelectedMarketId(null);
                }}
                className="relative group py-5"
              >
                <span className={`text-xs sm:text-sm lg:text-[16px] font-light tracking-wide transition-all ${currentPage === "portfolio" ? "text-gray-100" : "text-gray-400 group-hover:text-gray-200"
                  }`}>
                  FOLIO
                </span>
                <div className={`absolute bottom-0 left-0 right-0 flex flex-col items-center transition-opacity duration-200 ${currentPage === "portfolio" ? "opacity-100" : "opacity-0 group-hover:opacity-70"
                  }`}>
                  <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] border-b-white" />
                  <div className={`h-[2px] bg-white transition-all duration-300 ease-out ${currentPage === "portfolio" ? "w-full" : "w-0 group-hover:w-full"
                    }`} style={{ marginTop: "-1px" }} />
                </div>
              </button>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3 lg:gap-6 flex-shrink-0">
            {/* Search Bar */}
            <div ref={searchRef} className="relative">
              <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 z-10" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search..."
                className={`w-[120px] sm:w-[200px] md:w-[280px] lg:w-[350px] xl:w-[400px] bg-[#0d0d0d] border border-gray-800/50 pl-7 sm:pl-10 pr-7 sm:pr-10 py-1.5 sm:py-2 text-xs sm:text-[14px] text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-600/50 transition-all ${isSearchFocused && (searchHistory.length > 0 || searchQuery.trim() || isSearching)
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
                  className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors z-10"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}

              {/* Search Dropdown */}
              {isSearchFocused && (searchHistory.length > 0 || searchQuery.trim() || isSearching) && (
                <div className="absolute top-full left-0 right-0 bg-[#0d0d0d] border border-gray-800/50 border-t-0 rounded-b-lg shadow-xl shadow-black/30 z-50 max-h-[300px] sm:max-h-[400px] overflow-y-auto">
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
                              <span className="text-[#4a6fa5]">{formatProbability(item.probability)}%</span>
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
                          onMouseEnter={() => prefetchMarketDetail(market.id)}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-[#111111] cursor-pointer transition-all"
                        >
                          <TrendingUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] text-gray-200 truncate">{market.name || market.title}</div>
                            <div className="flex items-center gap-4 text-[13px] text-gray-500 mt-0.5">
                              <span className="text-[#4a6fa5]">{formatProbability(Number(market.probability))}%</span>
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
                              className={`w-3.5 h-3.5 ${isBookmarked(market.id) ? "fill-current text-[#4a6fa5]" : ""
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
              className="text-white hover:text-gray-300 transition-colors hidden sm:block"
            >
              <svg className="w-4 h-4 lg:w-5 lg:h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>

            <UserAuthSection onLoginClick={() => setShowLoginPage(true)} />
          </div>
        </nav>
      </header>

      {/* Bookmarked Markets Bar */}
      <BookmarkedMarketsBar
        bookmarkedMarkets={bookmarkedMarkets}
        onNavigate={(marketId) => {
          pushToHistory();
          navigateToMarket(marketId);
        }}
      />

      {/* Main Content */}
      <main className="p-3 sm:p-4 md:p-6 lg:p-8">
        {selectedWalletAddress ? (
          <WalletProfile walletAddress={selectedWalletAddress} onClose={() => {
            // Go back properly instead of just closing
            goBack();
          }} />
        ) : (
          <>
            {currentPage === "discover" && (
              <Discover
                toggleBookmark={toggleBookmark}
                isBookmarked={isBookmarked}
                onWalletClick={openWalletProfile}
                onMarketClick={(market) => {
                  // Push current state to history before navigating
                  pushToHistory();
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
                  pushToHistory();
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
                onBack={goBack}
                onMarketSelect={(market) => {
                  // Save to App state so it gets persisted to localStorage
                  if (market) {
                    // Push current state to history before selecting market
                    pushToHistory();
                    setSelectedMarketId(market.id);
                    setSelectedMarketData(market);
                  } else {
                    // Clear selection (back button pressed)
                    setSelectedMarketId(null);
                    setSelectedMarketData(null);
                  }
                }}
                initialMarketId={selectedMarketId}
                initialMarketData={selectedMarketData}
              />
            )}
            {currentPage === "wallets" && <WalletsList onWalletClick={openWalletProfile} onMarketClick={(marketId) => {
              pushToHistory();
              navigateToMarket(marketId);
            }} />}
            {currentPage === "insiderlens" && <InsiderLens onWalletClick={openWalletProfile} />}
            {currentPage === "tradeflow" && <TradeFlow />}
            {currentPage === "portfolio" && <Portfolio />}
            {currentPage === "search" && (
              <SearchResults
                initialQuery={searchResultsQuery}
                onBack={goBack}
                onMarketSelect={(market) => {
                  pushToHistory();
                  addToSearchHistory(market);
                  setSelectedMarketId(market.id);
                  setSelectedMarketData({
                    id: market.id,
                    name: market.name || market.title || "Unknown",
                    probability: Number(market.probability) || 50,
                    volume: market.volume || "$0",
                  });
                  setCurrentPage("markets");
                }}
                toggleBookmark={toggleBookmark}
                isBookmarked={isBookmarked}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// Wrapper that manages login page state
function AppWithAuth() {
  const { isLoading, login } = useAuth();
  const [showLoginPage, setShowLoginPage] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#4a6fa5] animate-spin" />
      </div>
    );
  }

  if (showLoginPage) {
    return (
      <LoginPage
        onLogin={(user) => {
          login(user);
          setShowLoginPage(false);
        }}
        onClose={() => setShowLoginPage(false)}
      />
    );
  }

  return <AppContent showLoginPage={showLoginPage} setShowLoginPage={setShowLoginPage} />;
}

// Main App component wrapped with AuthProvider
export default function App() {
  return (
    <AuthProvider>
      <AppWithAuth />
    </AuthProvider>
  );
}