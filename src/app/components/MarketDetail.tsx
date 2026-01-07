import { ArrowLeft, Bookmark, TrendingUp, TrendingDown, DollarSign, Users, Activity, Minus, Plus, Loader2 } from "lucide-react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { useState, useEffect } from "react";
import { getMarketDetails, getMarketPriceHistory, getMarketTrades, getEventWithMarkets, getClobPrices } from "../services/polymarketApi";

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

export function MarketDetail({
  market,
  isBookmarked,
  toggleBookmark,
  onBack,
  onWalletClick,
}: MarketDetailProps) {
  const [tradeAmount, setTradeAmount] = useState("");
  const [tradeSide, setTradeSide] = useState<"YES" | "NO">("YES");
  const [shareQuantity, setShareQuantity] = useState(0);
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeMarket | null>(null);
  
  // Real data states
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch real market data on mount
  useEffect(() => {
    const fetchMarketData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch market details first
        const details = await getMarketDetails(market.id);
        if (details) {
          setMarketData(details);
        }
        
        // Fetch event data (for multi-outcome markets like Fed decisions)
        const event = await getEventWithMarkets(market.id);
        if (event) {
          setEventData(event);
          // If it's a multi-outcome market, select the target market by default
          if (event.isMultiOutcome && event.targetMarket) {
            setSelectedOutcome(event.targetMarket);
          }
          console.log("Event data:", event);
        }
        
        // Fetch price history
        const history = await getMarketPriceHistory(market.id, "1d");
        if (history && history.length > 0) {
          setPriceHistory(history);
        } else {
          // Generate placeholder data if no history available
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
        
        // Fetch recent trades
        const trades = await getMarketTrades(market.id, 10);
        if (trades && trades.length > 0) {
          setRecentTrades(trades);
        } else {
          // Show placeholder if no trades
          setRecentTrades([
            { id: "1", timestamp: new Date().toLocaleString(), wallet: "0x742d...3a1f", side: "YES", size: "$12,500", price: 0.67 },
            { id: "2", timestamp: new Date().toLocaleString(), wallet: "0x8f3c...9b2d", side: "NO", size: "$8,200", price: 0.33 },
            { id: "3", timestamp: new Date().toLocaleString(), wallet: "0x4a9b...7e5c", side: "YES", size: "$15,700", price: 0.65 },
          ]);
        }
      } catch (err) {
        console.error("Error fetching market data:", err);
        setError("Failed to load market data");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMarketData();
  }, [market.id]);

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
  const uniqueTraders = marketData?.uniqueTraders ?? 0;
  
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
                <h1 className="text-xl font-light tracking-tight text-gray-100 leading-relaxed pr-4">
                  {marketData?.name || market.name}
                </h1>
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
                              {probability < 1 ? "<1" : probability.toFixed(0)}%
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
                                Buy Yes {outcome.yesPriceCents}¢
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOutcome(outcome);
                                  setTradeSide("NO");
                                }}
                                className="px-3 py-1.5 text-xs font-medium bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 rounded text-red-400 transition-all"
                              >
                                Buy No {outcome.noPriceCents}¢
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
                    <div className="text-2xl font-light text-green-400">{yesPriceCents}¢</div>
                    <div className="text-xs text-green-500/50 mt-1">${yesPrice.toFixed(2)} per share</div>
                  </div>
                  <div className="bg-gradient-to-br from-red-900/20 to-red-900/10 border border-red-500/30 rounded-lg p-4">
                    <div className="text-xs text-red-400/70 uppercase tracking-wide mb-1">Buy No</div>
                    <div className="text-2xl font-light text-red-400">{noPriceCents}¢</div>
                    <div className="text-xs text-red-500/50 mt-1">${noPrice.toFixed(2)} per share</div>
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

            {/* Recent Activity */}
            <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl shadow-xl shadow-black/20">
              <div className="p-4 border-b border-gray-800/50">
                <h3 className="text-sm font-light tracking-wide text-gray-400 uppercase">Recent Trades</h3>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
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
                        <td className="py-2.5 px-4 text-gray-500 font-mono text-[10px]">{trade.timestamp.split(" ").pop() || trade.timestamp}</td>
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
                      <div className={`text-xs mt-1 ${tradeSide === "YES" ? "text-green-500/70" : "text-gray-600"}`}>{yesPriceCents}¢ per share</div>
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
                      <div className={`text-xs mt-1 ${tradeSide === "NO" ? "text-red-500/70" : "text-gray-600"}`}>{noPriceCents}¢ per share</div>
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
                  <div className="flex justify-between text-sm"><span className="text-gray-500 font-light">Price per share</span><span className="text-gray-300">${currentPrice.toFixed(2)}</span></div>
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
                  <div className="flex justify-between text-xs text-gray-500"><span>Available Balance</span><span className="text-gray-300 font-medium">$3,320.00</span></div>
                </div>
              </div>
            </div>

            {/* How It Works */}
            <div className="mt-6 bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl p-5 shadow-xl shadow-black/20">
              <h4 className="text-xs font-light tracking-wide text-gray-500 uppercase mb-4">How It Works</h4>
              <div className="space-y-3 text-xs text-gray-500">
                <div className="flex gap-3"><div className="w-5 h-5 bg-gradient-to-br from-[#4a6fa5] to-[#3a5f95] rounded-full flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0">1</div><p>Buy <span className="text-green-500">YES</span> or <span className="text-red-500">NO</span> shares based on your prediction</p></div>
                <div className="flex gap-3"><div className="w-5 h-5 bg-gradient-to-br from-[#4a6fa5] to-[#3a5f95] rounded-full flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0">2</div><p>Each share pays <span className="text-gray-300">$1.00</span> if your outcome is correct</p></div>
                <div className="flex gap-3"><div className="w-5 h-5 bg-gradient-to-br from-[#4a6fa5] to-[#3a5f95] rounded-full flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0">3</div><p>Sell anytime before resolution to lock in profits or cut losses</p></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
