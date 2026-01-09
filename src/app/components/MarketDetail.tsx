import { ArrowLeft, Bookmark, TrendingUp, TrendingDown, DollarSign, Users, Activity, Minus, Plus, Loader2, BarChart3, Trophy, Wallet } from "lucide-react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { useState, useEffect, useMemo } from "react";
import { getMarketDetails, getMarketPriceHistory, getMarketTrades, getEventWithMarkets, getClobPrices, getOrderBook, getMarketTradersCount, getMarketTopHolders, getMarketTopTraders, getCachedMarketDetail, getMarketFromCache } from "../services/polymarketApi";
import { useAuth } from "../context/AuthContext";

// Helper function to format balance
function formatBalance(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

interface MarketDetailProps {
  market: {
    id: string;
    name: string;
    probability: number;
    volume: string;
    change24h?: string;
    volumeUsd?: string;
  };
  isBookmarked: boolean;
  toggleBookmark: () => void;
  onBack: () => void;
  onWalletClick?: (address: string) => void;
}

interface MarketData {
  id: string;
  name: string;
  title: string;
  description: string;
  yesPrice: number;
  noPrice: number;
  probability: number;
  spread: number;
  volume: string;
  volumeUsd: number;
  volume24hr: string;
  volume24hrNum: number;
  liquidity: string;
  liquidityNum: number;
  outcomes: string[];
  outcomePrices: number[];
  endDate: string;
  uniqueTraders: number;
  tradesCount: number;
  orderBook: any;
  image?: string | null;
}

// Multi-outcome market structure
interface OutcomeMarket {
  id: string;
  question: string;
  outcome: string;
  yesPrice: number;
  noPrice: number;
  yesPriceCents: number;
  noPriceCents: number;
  volume: string;
  volumeNum: number;
}

interface EventData {
  id: string;
  title: string;
  isMultiOutcome: boolean;
  markets: OutcomeMarket[];
  targetMarket?: OutcomeMarket;
}

interface PricePoint {
  time: string;
  timestamp: number;
  probability: number;
}

interface Trade {
  id: string;
  timestamp: string;
  wallet: string;
  side: string;
  size: string;
  price: number;
}

interface OrderBookLevel {
  price: number;
  size: number;
}

interface OrderBookData {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
}

interface TopHolder {
  wallet: string;
  displayWallet: string;
  name: string | null;
  amount: number;
  side: string;
  profileImage: string | null;
}

interface TopTrader {
  wallet: string;
  displayWallet: string;
  name: string | null;
  totalVolume: number;
  tradeCount: number;
  profileImage: string | null;
}

type ActivityTab = "trades" | "holders" | "traders" | "orderbook";

// Format cents with proper precision like Polymarket (e.g., 0.4¢, 99.6¢)
function formatCents(cents: number): string {
  if (cents < 0.1) return "<0.1";
  if (cents > 99.9) return ">99.9";
  // Show one decimal place for precision
  if (cents < 1 || cents > 99) {
    return cents.toFixed(1);
  }
  // For values between 1-99, show integer if close, otherwise one decimal
  if (Math.abs(cents - Math.round(cents)) < 0.05) {
    return Math.round(cents).toString();
  }
  return cents.toFixed(1);
}

export function MarketDetail({
  market,
  isBookmarked,
  toggleBookmark,
  onBack,
  onWalletClick,
}: MarketDetailProps) {
  const { user, isAuthenticated } = useAuth();
  const [tradeAmount, setTradeAmount] = useState("");
  const [tradeSide, setTradeSide] = useState<"YES" | "NO">("YES");
  const [shareQuantity, setShareQuantity] = useState(0);
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeMarket | null>(null);
  
  // Real data states
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBookData>({ bids: [], asks: [], spread: 0 });
  const [tradersCount, setTradersCount] = useState<number>(0);
  const [topHolders, setTopHolders] = useState<TopHolder[]>([]);
  const [topTraders, setTopTraders] = useState<TopTrader[]>([]);
  const [activeActivityTab, setActiveActivityTab] = useState<ActivityTab>("trades");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [isLoadingChart, setIsLoadingChart] = useState(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for cached/instant data on mount - show immediately without loading
  const instantData = useMemo(() => {
    // Check if we have cached market detail
    const cachedDetail = getCachedMarketDetail(market.id);
    if (cachedDetail) {
      return cachedDetail;
    }
    
    // Check if we have the market in global cache (from markets list)
    const cachedMarket = getMarketFromCache(market.id);
    if (cachedMarket) {
      // Convert cached market to MarketData format for instant display
      return {
        id: cachedMarket.id,
        name: cachedMarket.title,
        title: cachedMarket.title,
        description: cachedMarket.description || '',
        yesPrice: cachedMarket.probability / 100,
        noPrice: 1 - (cachedMarket.probability / 100),
        probability: cachedMarket.probability,
        spread: 0,
        volume: `$${(cachedMarket.volumeUsd / 1000000).toFixed(1)}M`,
        volumeUsd: cachedMarket.volumeUsd,
        volume24hr: `$${(cachedMarket.volume24hr / 1000).toFixed(0)}K`,
        volume24hrNum: cachedMarket.volume24hr,
        liquidity: `$${(cachedMarket.liquidity / 1000).toFixed(0)}K`,
        liquidityNum: cachedMarket.liquidity,
        outcomes: cachedMarket.outcomes ? (typeof cachedMarket.outcomes === 'string' ? JSON.parse(cachedMarket.outcomes) : cachedMarket.outcomes) : ["Yes", "No"],
        outcomePrices: cachedMarket.outcomePrices ? (typeof cachedMarket.outcomePrices === 'string' ? JSON.parse(cachedMarket.outcomePrices).map(Number) : cachedMarket.outcomePrices) : [cachedMarket.probability / 100, 1 - cachedMarket.probability / 100],
        endDate: cachedMarket.endDate,
        uniqueTraders: 0,
        tradesCount: 0,
        image: cachedMarket.image,
      };
    }
    
    return null;
  }, [market.id]);

  // Fetch real market data on mount - ALL IN PARALLEL
  useEffect(() => {
    const fetchAllData = async () => {
      // If we have instant data, don't show the main loading state
      if (instantData) {
        setMarketData(instantData);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
      setError(null);
      
      try {
        // Start ALL fetches in parallel - don't wait for one to complete before starting another
        const detailsPromise = getMarketDetails(market.id);
        const eventPromise = getEventWithMarkets(market.id);
        const historyPromise = getMarketPriceHistory(market.id, "1d");
        const tradesPromise = getMarketTrades(market.id, 10);
        
        // Wait for details first (needed for other fetches)
        const details = await detailsPromise;
        
        if (details) {
          setMarketData(details);
          setIsLoadingDetails(false);
          
          // Now we can start fetches that depend on details
          const tokenId = details.clobTokenIds?.[0] || 
            (typeof details.clobTokenIds === 'string' ? JSON.parse(details.clobTokenIds)[0] : null);
          const marketConditionId = details.conditionId || market.id;
          
          // Start remaining fetches in parallel
          const orderBookPromise = tokenId ? getOrderBook(tokenId) : Promise.resolve({ bids: [], asks: [], spread: 0 });
          const tradersCountPromise = getMarketTradersCount(marketConditionId);
          const holdersPromise = getMarketTopHolders(marketConditionId, 20);
          const tradersPromise = getMarketTopTraders(marketConditionId, 20);
          
          // Process results as they come in (event data)
          const event = await eventPromise;
          if (event) {
            setEventData(event);
            if (event.isMultiOutcome && event.targetMarket) {
              setSelectedOutcome(event.targetMarket);
            }
          }
          
          // Process price history
          const history = await historyPromise;
          if (history && history.length > 0) {
            setPriceHistory(history);
          } else {
            // Generate placeholder data
            const now = new Date();
            const placeholderHistory: PricePoint[] = [];
            const baseProb = details?.probability || market.probability || 50;
            for (let i = 6; i >= 0; i--) {
              const date = new Date(now);
              date.setDate(date.getDate() - i);
              const variance = (Math.random() - 0.5) * 10;
              placeholderHistory.push({
                time: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                timestamp: date.getTime(),
                probability: Math.max(1, Math.min(99, baseProb + variance)),
              });
            }
            setPriceHistory(placeholderHistory);
          }
          setIsLoadingChart(false);
          
          // Process trades
          const trades = await tradesPromise;
          if (trades && trades.length > 0) {
            setRecentTrades(trades);
          } else {
            setRecentTrades([
              { id: "1", timestamp: new Date().toLocaleString(), wallet: "0x742d...3a1f", side: "YES", size: "$12,500", price: 0.67 },
              { id: "2", timestamp: new Date().toLocaleString(), wallet: "0x8f3c...9b2d", side: "NO", size: "$8,200", price: 0.33 },
              { id: "3", timestamp: new Date().toLocaleString(), wallet: "0x4a9b...7e5c", side: "YES", size: "$15,700", price: 0.65 },
            ]);
          }
          
          // Process remaining parallel fetches
          const [bookData, tradersNum, holders, traders] = await Promise.all([
            orderBookPromise,
            tradersCountPromise,
            holdersPromise,
            tradersPromise
          ]);
          
          if (bookData && (bookData.bids?.length > 0 || bookData.asks?.length > 0)) {
            setOrderBook(bookData);
          }
          
          if (tradersNum > 0) {
            setTradersCount(tradersNum);
          }
          
          if (holders.length > 0) {
            setTopHolders(holders);
          }
          
          if (traders.length > 0) {
            setTopTraders(traders);
          }
          
          setIsLoadingActivity(false);
        }
      } catch (err) {
        console.error("Error fetching market data:", err);
        setError("Failed to load market data");
      } finally {
        setIsLoading(false);
        setIsLoadingDetails(false);
        setIsLoadingChart(false);
        setIsLoadingActivity(false);
      }
    };
    
    fetchAllData();
  }, [market.id, instantData]);

  // Use real data or fallback to props with safe number conversion
  const safeNumber = (val: any, fallback: number) => {
    const num = parseFloat(String(val));
    return isNaN(num) ? fallback : num;
  };
  
  // Get yes/no prices with proper fallbacks
  // For multi-outcome markets, use the selected outcome's prices
  const activeOutcome = selectedOutcome || (eventData?.targetMarket);
  const yesPrice = activeOutcome?.yesPrice ?? marketData?.yesPrice ?? safeNumber(market.probability, 50) / 100;
  const noPrice = activeOutcome?.noPrice ?? marketData?.noPrice ?? (1 - yesPrice);
  const yesPriceCents = activeOutcome?.yesPriceCents ?? Math.round(yesPrice * 100);
  const noPriceCents = activeOutcome?.noPriceCents ?? Math.round(noPrice * 100);
  const currentProbability = activeOutcome ? activeOutcome.yesPrice * 100 : (marketData?.probability ?? safeNumber(market.probability, 50));
  const currentPrice = tradeSide === "YES" ? yesPrice : noPrice;
  const currentVolume = marketData?.volume ?? market.volume ?? "$0";
  const currentVolume24h = marketData?.volume24hr ?? "$0";
  const currentLiquidity = marketData?.liquidity ?? "$0";
  // Use tradersCount from API if available, otherwise fall back to marketData.uniqueTraders
  const uniqueTraders = tradersCount > 0 ? tradersCount : (marketData?.uniqueTraders ?? 0);
  
  // Check if this is a multi-outcome market
  const isMultiOutcome = eventData?.isMultiOutcome && eventData.markets.length > 1;

  const calculateShares = (amount: string) => {
    const numAmount = parseFloat(amount) || 0;
    return numAmount > 0 ? Math.floor(numAmount / currentPrice) : 0;
  };

  const calculateAmount = (shares: number) => {
    return (shares * currentPrice).toFixed(2);
  };

  const handleAmountChange = (value: string) => {
    setTradeAmount(value);
    setShareQuantity(calculateShares(value));
  };

  const handleSharesChange = (change: number) => {
    const newShares = Math.max(0, shareQuantity + change);
    setShareQuantity(newShares);
    setTradeAmount(calculateAmount(newShares));
  };

  const potentialPayout = shareQuantity * 1;
  const potentialProfit = potentialPayout - (parseFloat(tradeAmount) || 0);
  const returnPercent = tradeAmount && parseFloat(tradeAmount) > 0 
    ? ((potentialProfit / parseFloat(tradeAmount)) * 100).toFixed(1) 
    : "0";

  return (
    <div className="max-w-[1800px] mx-auto">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-light">Back to Markets</span>
      </button>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          <span className="ml-3 text-gray-400">Loading market data...</span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Main Split Layout */}
      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT SIDE - Market Info & Chart */}
          <div className="space-y-6">
            {/* Market Header */}
            <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl p-6 shadow-xl shadow-black/20">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4 flex-1 pr-4">
                  {marketData?.image ? (
                    <img 
                      src={marketData.image} 
                      alt="" 
                      className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gray-800/50 flex-shrink-0" />
                  )}
                  <h1 className="text-xl font-light tracking-tight text-gray-100 leading-relaxed">
                    {marketData?.name || market.name}
                  </h1>
                </div>
                <button
                  onClick={toggleBookmark}
                  className="text-gray-600 hover:text-[#4a6fa5] transition-all duration-200 flex-shrink-0"
                >
                  <Bookmark className={`w-5 h-5 ${isBookmarked ? "fill-current text-[#4a6fa5]" : ""}`} />
                </button>
              </div>

              {/* Market Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                <div className="bg-gradient-to-br from-[#111111] to-[#0a0a0a] rounded-lg p-4 border border-gray-800/30">
                  <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                    <Activity className="w-3 h-3" />
                    <span>Probability</span>
                  </div>
                  <div className="text-xl font-light text-[#4a6fa5]">{currentProbability.toFixed(1)}%</div>
                </div>
                <div className="bg-gradient-to-br from-[#111111] to-[#0a0a0a] rounded-lg p-4 border border-gray-800/30">
                  <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                    <DollarSign className="w-3 h-3" />
                    <span>Volume</span>
                  </div>
                  <div className="text-xl font-light text-gray-300">{currentVolume}</div>
                </div>
                <div className="bg-gradient-to-br from-[#111111] to-[#0a0a0a] rounded-lg p-4 border border-gray-800/30">
                  <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                    <DollarSign className="w-3 h-3" />
                    <span>Liquidity</span>
                  </div>
                  <div className="text-xl font-light text-gray-300">{currentLiquidity}</div>
                </div>
                <div className="bg-gradient-to-br from-[#111111] to-[#0a0a0a] rounded-lg p-4 border border-gray-800/30">
                  <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                    <Users className="w-3 h-3" />
                    <span>Traders</span>
                  </div>
                  <div className="text-xl font-light text-gray-300">{uniqueTraders > 0 ? uniqueTraders.toLocaleString() : "—"}</div>
                </div>
              </div>

              {/* Multi-Outcome Markets Display (like Polymarket's Fed decision layout) */}
              {isMultiOutcome && eventData?.markets && (
                <div className="mt-6">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Outcomes</div>
                  <div className="space-y-2">
                    {eventData.markets.map((outcome) => {
                      const isSelected = selectedOutcome?.id === outcome.id;
                      const probability = outcome.yesPrice * 100;
                      const yesCentsDisplay = formatCents(outcome.yesPriceCents);
                      const noCentsDisplay = formatCents(outcome.noPriceCents);
                      return (
                        <div
                          key={outcome.id}
                          onClick={() => {
                            setSelectedOutcome(outcome);
                            setTradeSide("YES");
                            setShareQuantity(0);
                            setTradeAmount("");
                          }}
                          className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-all ${
                            isSelected
                              ? "bg-gradient-to-r from-[#4a6fa5]/20 to-[#4a6fa5]/10 border border-[#4a6fa5]/50"
                              : "bg-gradient-to-br from-[#111111] to-[#0a0a0a] border border-gray-800/30 hover:border-gray-700/50"
                          }`}
                        >
                          <div className="flex-1">
                            <div className={`text-sm font-normal ${isSelected ? "text-gray-100" : "text-gray-300"}`}>
                              {outcome.outcome || outcome.question}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">{outcome.volume} Vol.</div>
                          </div>
                          <div className="text-right flex items-center gap-4">
                            <div className="text-xl font-light text-[#4a6fa5]">
                              {probability < 0.1 ? "<0.1" : probability > 99.9 ? ">99.9" : probability.toFixed(1)}%
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOutcome(outcome);
                                  setTradeSide("YES");
                                }}
                                className="px-3 py-1.5 text-xs font-medium bg-green-900/30 hover:bg-green-900/50 border border-green-500/30 rounded text-green-400 transition-all"
                              >
                                Buy Yes {yesCentsDisplay}¢
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOutcome(outcome);
                                  setTradeSide("NO");
                                }}
                                className="px-3 py-1.5 text-xs font-medium bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 rounded text-red-400 transition-all"
                              >
                                Buy No {noCentsDisplay}¢
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Simple Yes/No Prices for Binary Markets */}
              {!isMultiOutcome && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-gradient-to-br from-green-900/20 to-green-900/10 border border-green-500/30 rounded-lg p-4">
                    <div className="text-xs text-green-400/70 uppercase tracking-wide mb-1">Buy Yes</div>
                    <div className="text-2xl font-light text-green-400">{formatCents(yesPriceCents)}¢</div>
                    <div className="text-xs text-green-500/50 mt-1">${yesPrice.toFixed(4)} per share</div>
                  </div>
                  <div className="bg-gradient-to-br from-red-900/20 to-red-900/10 border border-red-500/30 rounded-lg p-4">
                    <div className="text-xs text-red-400/70 uppercase tracking-wide mb-1">Buy No</div>
                    <div className="text-2xl font-light text-red-400">{formatCents(noPriceCents)}¢</div>
                    <div className="text-xs text-red-500/50 mt-1">${noPrice.toFixed(4)} per share</div>
                  </div>
                </div>
              )}
            </div>

            {/* Price Chart */}
            <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl p-6 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-light tracking-wide text-gray-400 uppercase">
                  Price History
                </h3>
                <div className="flex gap-2">
                  {["1D", "1W", "1M", "ALL"].map((period) => (
                    <button
                      key={period}
                      className="px-3 py-1 text-xs font-light text-gray-500 hover:text-gray-300 hover:bg-gray-800/30 rounded transition-all"
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={priceHistory}>
                  <defs>
                    <linearGradient id="colorProbability" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4a6fa5" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4a6fa5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#3a3a3a" tick={{ fill: "#666", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#3a3a3a" tick={{ fill: "#666", fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: "#0d0d0d", border: "1px solid #3a3a3a", borderRadius: 8, fontSize: 11 }} labelStyle={{ color: "#999" }} formatter={(value: number) => [`${value.toFixed(1)}%`, "Probability"]} />
                  <Area type="monotone" dataKey="probability" stroke="#4a6fa5" strokeWidth={2} fillOpacity={1} fill="url(#colorProbability)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Activity Section with Tabs */}
            <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl shadow-xl shadow-black/20">
              {/* Tab Headers */}
              <div className="flex items-center border-b border-gray-800/50">
                {[
                  { id: "trades" as ActivityTab, label: "Recent Trades", icon: Activity },
                  { id: "holders" as ActivityTab, label: "Top Holders", icon: Wallet },
                  { id: "traders" as ActivityTab, label: "Top Traders", icon: Trophy },
                  { id: "orderbook" as ActivityTab, label: "Order Book", icon: BarChart3 },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveActivityTab(tab.id)}
                    className={`relative flex items-center gap-2 px-4 py-3 text-xs font-light tracking-wide transition-all ${
                      activeActivityTab === tab.id
                        ? "text-white"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    <span className="uppercase">{tab.label}</span>
                    {activeActivityTab === tab.id && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
                        <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] border-b-white" />
                        <div className="w-full h-[2px] bg-white" style={{ width: "calc(100% - 16px)" }} />
                      </div>
                    )}
                  </button>
                ))}
                {activeActivityTab === "orderbook" && orderBook.spread > 0 && (
                  <span className="ml-auto mr-4 text-xs text-gray-500">
                    Spread: <span className="text-gray-300">{(orderBook.spread * 100).toFixed(2)}¢</span>
                  </span>
                )}
              </div>

              {/* Tab Content */}
              <div className="min-h-[300px]">
                {/* Recent Trades Tab */}
                {activeActivityTab === "trades" && (
                  <div className="max-h-[350px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gradient-to-b from-[#111111] to-[#0d0d0d]">
                        <tr className="border-b border-gray-800/50">
                          <th className="text-left py-3 px-4 text-gray-500 font-light">Time</th>
                          <th className="text-left py-3 px-4 text-gray-500 font-light">Wallet</th>
                          <th className="text-left py-3 px-4 text-gray-500 font-light">Side</th>
                          <th className="text-right py-3 px-4 text-gray-500 font-light">Size</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentTrades.map((trade, index) => (
                          <tr key={trade.id || index} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                            <td className="py-2.5 px-4 text-gray-500 font-mono text-[11px]">{trade.timestamp.split(" ").pop() || trade.timestamp}</td>
                            <td className="py-2.5 px-4 text-gray-400 font-mono cursor-pointer hover:text-[#4a6fa5] transition-colors" onClick={() => onWalletClick?.(trade.wallet)}>{trade.wallet}</td>
                            <td className="py-2.5 px-4"><span className={`font-medium ${trade.side === "YES" ? "text-green-500" : "text-red-500"}`}>{trade.side}</span></td>
                            <td className="py-2.5 px-4 text-right text-gray-300">{trade.size}</td>
                          </tr>
                        ))}
                        {recentTrades.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-gray-500">No recent trades</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Top Holders Tab */}
                {activeActivityTab === "holders" && (
                  <div className="max-h-[350px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gradient-to-b from-[#111111] to-[#0d0d0d]">
                        <tr className="border-b border-gray-800/50">
                          <th className="text-left py-3 px-4 text-gray-500 font-light">#</th>
                          <th className="text-left py-3 px-4 text-gray-500 font-light">Holder</th>
                          <th className="text-left py-3 px-4 text-gray-500 font-light">Position</th>
                          <th className="text-right py-3 px-4 text-gray-500 font-light">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topHolders.map((holder, index) => (
                          <tr key={holder.wallet || index} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                            <td className="py-2.5 px-4 text-gray-600 font-light">{index + 1}</td>
                            <td className="py-2.5 px-4">
                              <div 
                                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => onWalletClick?.(holder.wallet)}
                              >
                                {holder.profileImage ? (
                                  <img src={holder.profileImage} alt="" className="w-5 h-5 rounded-full object-cover" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-700 to-gray-800" />
                                )}
                                <span className="text-gray-300 hover:text-[#4a6fa5] transition-colors">
                                  {holder.name || holder.displayWallet}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-4">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                holder.side === "YES" 
                                  ? "bg-green-500/20 text-green-400" 
                                  : "bg-red-500/20 text-red-400"
                              }`}>
                                {holder.side}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right text-gray-300 font-mono">
                              ${holder.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        ))}
                        {topHolders.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-gray-500">No holder data available</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Top Traders Tab */}
                {activeActivityTab === "traders" && (
                  <div className="max-h-[350px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gradient-to-b from-[#111111] to-[#0d0d0d]">
                        <tr className="border-b border-gray-800/50">
                          <th className="text-left py-3 px-4 text-gray-500 font-light">#</th>
                          <th className="text-left py-3 px-4 text-gray-500 font-light">Trader</th>
                          <th className="text-right py-3 px-4 text-gray-500 font-light">Volume</th>
                          <th className="text-right py-3 px-4 text-gray-500 font-light">Trades</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topTraders.map((trader, index) => (
                          <tr key={trader.wallet || index} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                            <td className="py-2.5 px-4 text-gray-600 font-light">
                              {index < 3 ? (
                                <span className={`text-sm ${
                                  index === 0 ? "text-yellow-500" : 
                                  index === 1 ? "text-gray-400" : 
                                  "text-amber-700"
                                }`}>
                                  {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                                </span>
                              ) : (
                                index + 1
                              )}
                            </td>
                            <td className="py-2.5 px-4">
                              <div 
                                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => onWalletClick?.(trader.wallet)}
                              >
                                {trader.profileImage ? (
                                  <img src={trader.profileImage} alt="" className="w-5 h-5 rounded-full object-cover" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-700 to-gray-800" />
                                )}
                                <span className="text-gray-300 hover:text-[#4a6fa5] transition-colors">
                                  {trader.name || trader.displayWallet}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-right text-gray-300 font-mono">
                              ${trader.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                            <td className="py-2.5 px-4 text-right text-gray-500">
                              {trader.tradeCount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        {topTraders.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-gray-500">No trader data available</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Order Book Tab */}
                {activeActivityTab === "orderbook" && (
                  <div className="grid grid-cols-2 gap-0">
                    {/* Bids (Buy Orders) - Green */}
                    <div>
                      <div className="px-4 py-2 bg-gradient-to-b from-[#111111] to-[#0d0d0d] border-b border-gray-800/30">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Price</span>
                          <span>Size</span>
                        </div>
                      </div>
                      <div className="max-h-[280px] overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {orderBook.bids.map((bid, index) => (
                          <div 
                            key={`bid-${index}`} 
                            className="flex justify-between px-4 py-1.5 text-xs hover:bg-green-900/10 transition-colors relative"
                          >
                            <div 
                              className="absolute inset-y-0 right-0 bg-green-500/10"
                              style={{ width: `${Math.min(100, (bid.size / Math.max(...orderBook.bids.map(b => b.size), 1)) * 100)}%` }}
                            />
                            <span className="text-green-400 relative z-10">{(bid.price * 100).toFixed(1)}¢</span>
                            <span className="text-gray-400 relative z-10">${bid.size.toFixed(0)}</span>
                          </div>
                        ))}
                        {orderBook.bids.length === 0 && (
                          <div className="px-4 py-4 text-center text-xs text-gray-500">No bids</div>
                        )}
                      </div>
                    </div>
                    {/* Asks (Sell Orders) - Red */}
                    <div>
                      <div className="px-4 py-2 bg-gradient-to-b from-[#111111] to-[#0d0d0d] border-b border-gray-800/30">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Price</span>
                          <span>Size</span>
                        </div>
                      </div>
                      <div className="max-h-[280px] overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {orderBook.asks.map((ask, index) => (
                          <div 
                            key={`ask-${index}`} 
                            className="flex justify-between px-4 py-1.5 text-xs hover:bg-red-900/10 transition-colors relative"
                          >
                            <div 
                              className="absolute inset-y-0 left-0 bg-red-500/10"
                              style={{ width: `${Math.min(100, (ask.size / Math.max(...orderBook.asks.map(a => a.size), 1)) * 100)}%` }}
                            />
                            <span className="text-red-400 relative z-10">{(ask.price * 100).toFixed(1)}¢</span>
                            <span className="text-gray-400 relative z-10">${ask.size.toFixed(0)}</span>
                          </div>
                        ))}
                        {orderBook.asks.length === 0 && (
                          <div className="px-4 py-4 text-center text-xs text-gray-500">No asks</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT SIDE - Trading Panel */}
          <div className="lg:sticky lg:top-8 h-fit">
            <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl shadow-xl shadow-black/20 overflow-hidden">
              <div className="p-6 border-b border-gray-800/50 bg-gradient-to-b from-[#111111] to-transparent">
                <h2 className="text-lg font-light tracking-wide text-gray-200">Place Order</h2>
                <p className="text-xs text-gray-500 mt-1">Buy shares to predict the outcome</p>
              </div>

              <div className="p-6 space-y-6">
                {/* Selected Outcome Indicator for Multi-Outcome */}
                {isMultiOutcome && selectedOutcome && (
                  <div className="bg-gradient-to-r from-[#4a6fa5]/20 to-[#4a6fa5]/10 border border-[#4a6fa5]/30 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Trading on</div>
                    <div className="text-sm font-medium text-gray-200">{selectedOutcome.outcome || selectedOutcome.question}</div>
                  </div>
                )}

                {/* Outcome Selection */}
                <div>
                  <label className="block text-xs text-gray-500 mb-3 font-light uppercase tracking-wide">Select Outcome</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { setTradeSide("YES"); setShareQuantity(0); setTradeAmount(""); }}
                      className={`relative py-4 px-4 text-sm font-normal tracking-wide rounded-lg transition-all ${
                        tradeSide === "YES"
                          ? "bg-gradient-to-br from-green-900/40 to-green-900/20 border-2 border-green-500/50 text-green-400 shadow-lg shadow-green-900/20"
                          : "bg-gradient-to-br from-[#111111] to-[#0a0a0a] border border-gray-800/30 text-gray-500 hover:border-gray-700/50 hover:text-gray-400"
                      }`}
                    >
                      <div className="text-lg font-medium">YES</div>
                      <div className={`text-xs mt-1 ${tradeSide === "YES" ? "text-green-500/70" : "text-gray-600"}`}>{formatCents(yesPriceCents)}¢ per share</div>
                      {tradeSide === "YES" && <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full"></div>}
                    </button>
                    <button
                      onClick={() => { setTradeSide("NO"); setShareQuantity(0); setTradeAmount(""); }}
                      className={`relative py-4 px-4 text-sm font-normal tracking-wide rounded-lg transition-all ${
                        tradeSide === "NO"
                          ? "bg-gradient-to-br from-red-900/40 to-red-900/20 border-2 border-red-500/50 text-red-400 shadow-lg shadow-red-900/20"
                          : "bg-gradient-to-br from-[#111111] to-[#0a0a0a] border border-gray-800/30 text-gray-500 hover:border-gray-700/50 hover:text-gray-400"
                      }`}
                    >
                      <div className="text-lg font-medium">NO</div>
                      <div className={`text-xs mt-1 ${tradeSide === "NO" ? "text-red-500/70" : "text-gray-600"}`}>{formatCents(noPriceCents)}¢ per share</div>
                      {tradeSide === "NO" && <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></div>}
                    </button>
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-xs text-gray-500 mb-3 font-light uppercase tracking-wide">Amount (USD)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">$</span>
                    <input
                      type="text"
                      value={tradeAmount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-gradient-to-br from-[#111111] to-[#0a0a0a] border border-gray-800/50 rounded-lg pl-8 pr-4 py-4 text-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-700/50 focus:ring-1 focus:ring-gray-700/30 font-light transition-all"
                    />
                  </div>
                  <div className="flex gap-2 mt-3">
                    {["10", "50", "100", "500"].map((amount) => (
                      <button key={amount} onClick={() => handleAmountChange(amount)} className="flex-1 py-2 text-xs font-light text-gray-500 bg-gradient-to-br from-[#111111] to-[#0a0a0a] border border-gray-800/30 rounded hover:border-gray-700/50 hover:text-gray-400 transition-all">${amount}</button>
                    ))}
                  </div>
                </div>

                {/* Shares Quantity */}
                <div>
                  <label className="block text-xs text-gray-500 mb-3 font-light uppercase tracking-wide">Number of Shares</label>
                  <div className="flex items-center gap-4">
                    <button onClick={() => handleSharesChange(-10)} className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-[#111111] to-[#0a0a0a] border border-gray-800/30 rounded-lg text-gray-500 hover:border-gray-700/50 hover:text-gray-300 transition-all"><Minus className="w-4 h-4" /></button>
                    <div className="flex-1 text-center">
                      <div className="text-3xl font-light text-gray-200">{shareQuantity}</div>
                      <div className="text-xs text-gray-600 mt-1">shares</div>
                    </div>
                    <button onClick={() => handleSharesChange(10)} className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-[#111111] to-[#0a0a0a] border border-gray-800/30 rounded-lg text-gray-500 hover:border-gray-700/50 hover:text-gray-300 transition-all"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* Order Summary */}
                <div className="bg-gradient-to-br from-[#111111] to-[#0a0a0a] rounded-lg p-4 border border-gray-800/30 space-y-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Order Summary</div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500 font-light">Price per share</span><span className="text-gray-300">${currentPrice.toFixed(4)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500 font-light">Shares</span><span className="text-gray-300">{shareQuantity}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500 font-light">Total Cost</span><span className="text-gray-300">${tradeAmount || "0.00"}</span></div>
                  <div className="border-t border-gray-800/50 my-2 pt-3">
                    <div className="flex justify-between text-sm"><span className="text-gray-500 font-light">Potential Payout</span><span className="text-gray-200 font-medium">${potentialPayout.toFixed(2)}</span></div>
                    <div className="flex justify-between text-sm mt-2"><span className="text-gray-500 font-light">Potential Profit</span><span className={`font-medium ${potentialProfit > 0 ? "text-green-500" : "text-gray-400"}`}>{potentialProfit > 0 ? "+" : ""}${potentialProfit.toFixed(2)} ({returnPercent}%)</span></div>
                  </div>
                </div>

                {/* Buy Button */}
                <button 
                  disabled={shareQuantity === 0}
                  className={`w-full py-4 text-sm font-medium tracking-wide rounded-lg transition-all ${
                    shareQuantity > 0
                      ? tradeSide === "YES"
                        ? "bg-gradient-to-br from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white shadow-lg shadow-green-900/30"
                        : "bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-lg shadow-red-900/30"
                      : "bg-gradient-to-br from-gray-800 to-gray-900 text-gray-600 cursor-not-allowed"
                  }`}
                >
                  {shareQuantity > 0 ? `Buy ${shareQuantity} ${tradeSide} Shares for $${tradeAmount}` : "Enter amount to buy shares"}
                </button>

                {/* Balance Info */}
                <div className="pt-4 border-t border-gray-800/50">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Available Balance</span>
                    <span className="text-gray-300 font-medium">
                      {isAuthenticated && user ? formatBalance(user.balance) : "$0.00"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
