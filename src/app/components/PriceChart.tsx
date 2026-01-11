import { useState, useEffect, useRef, useCallback } from "react";
import {
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart,
} from "recharts";
import { Loader2, RefreshCw, AlertCircle, TrendingUp } from "lucide-react";
import { getMarketPriceHistory } from "../services/polymarketApi";

// =============================================================================
// TYPES
// =============================================================================

interface PricePoint {
    time: string;
    timestamp: number;
    probability: number;
    price: number;
}

interface PriceChartProps {
    marketId: string;
    /** For multi-outcome markets: the specific outcome market ID to show price history for */
    selectedOutcomeMarketId?: string | null;
    /** For multi-outcome markets: the name of the selected outcome */
    selectedOutcomeName?: string | null;
    /** Initial interval to display */
    defaultInterval?: TimeInterval;
    /** Height of the chart in pixels */
    height?: number;
    /** Show YES/NO toggle (for binary markets) */
    showOutcomeToggle?: boolean;
    /** Whether this is a multi-outcome market */
    isMultiOutcome?: boolean;
    /** Callback when price data is loaded (useful for parent component) */
    onDataLoad?: (data: PricePoint[]) => void;
    /** Class name for container */
    className?: string;
}

type TimeInterval = "1H" | "6H" | "1D" | "1W" | "1M" | "ALL";
type Outcome = "yes" | "no";

// =============================================================================
// CONSTANTS
// =============================================================================

const TIME_INTERVALS: TimeInterval[] = ["1H", "6H", "1D", "1W", "1M", "ALL"];

// Polling intervals based on time range (faster for shorter ranges)
const POLLING_INTERVALS: Record<TimeInterval, number> = {
    "1H": 5000,    // 5 seconds
    "6H": 10000,   // 10 seconds
    "1D": 15000,   // 15 seconds
    "1W": 30000,   // 30 seconds
    "1M": 60000,   // 1 minute
    "ALL": 120000, // 2 minutes
};

// =============================================================================
// CHART COMPONENT
// =============================================================================

export function PriceChart({
    marketId,
    selectedOutcomeMarketId,
    selectedOutcomeName,
    defaultInterval = "1D",
    height = 280,
    showOutcomeToggle = true,
    isMultiOutcome = false,
    onDataLoad,
    className = "",
}: PriceChartProps) {
    const [priceData, setPriceData] = useState<PricePoint[]>([]);
    const [timeInterval, setTimeInterval] = useState<TimeInterval>(defaultInterval);
    const [outcome, setOutcome] = useState<Outcome>("yes");
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // For multi-outcome markets, use the selected outcome's market ID
    const effectiveMarketId = isMultiOutcome && selectedOutcomeMarketId
        ? selectedOutcomeMarketId
        : marketId;

    // Refs for polling control
    const pollingRef = useRef<ReturnType<typeof globalThis.setInterval> | null>(null);
    const mountedRef = useRef(true);
    const currentMarketIdRef = useRef(effectiveMarketId);

    // =============================================================================
    // DATA FETCHING
    // =============================================================================

    const fetchPriceData = useCallback(async (showLoading = true) => {
        if (!effectiveMarketId) return;

        // Don't show loading spinner for background refreshes
        if (showLoading) {
            setIsLoading(true);
        } else {
            setIsRefreshing(true);
        }
        setError(null);

        try {
            console.log(`[PriceChart] Fetching ${timeInterval} data for ${effectiveMarketId} (${outcome})${isMultiOutcome ? ' [multi-outcome]' : ''}`);
            const data = await getMarketPriceHistory(effectiveMarketId, timeInterval, outcome);

            // Only update if component is still mounted and market hasn't changed
            if (mountedRef.current && currentMarketIdRef.current === effectiveMarketId) {
                if (data && data.length > 0) {
                    setPriceData(data);
                    setLastUpdated(new Date());
                    onDataLoad?.(data);
                    console.log(`[PriceChart] Loaded ${data.length} points`);
                } else {
                    // No data - might be a new market or API issue
                    console.warn(`[PriceChart] No data returned for ${effectiveMarketId}`);
                    if (priceData.length === 0) {
                        setError("No price history available for this market");
                    }
                }
            }
        } catch (err) {
            console.error("[PriceChart] Error fetching data:", err);
            if (mountedRef.current && priceData.length === 0) {
                setError("Failed to load price history");
            }
        } finally {
            if (mountedRef.current) {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        }
    }, [effectiveMarketId, timeInterval, outcome, isMultiOutcome, onDataLoad, priceData.length]);

    // =============================================================================
    // EFFECTS
    // =============================================================================

    // Reset when effective market changes (either main market or selected outcome)
    useEffect(() => {
        if (currentMarketIdRef.current !== effectiveMarketId) {
            console.log(`[PriceChart] Market changed from ${currentMarketIdRef.current} to ${effectiveMarketId}`);
            currentMarketIdRef.current = effectiveMarketId;
            setPriceData([]);
            setError(null);
            setIsLoading(true);
        }
    }, [effectiveMarketId]);

    // Fetch data when market, interval, or outcome changes
    useEffect(() => {
        fetchPriceData(true);
    }, [effectiveMarketId, timeInterval, outcome]);

    // Set up polling for live updates
    useEffect(() => {
        // Clear existing polling
        if (pollingRef.current) {
            globalThis.clearInterval(pollingRef.current);
        }

        // Set up new polling based on interval
        const pollInterval = POLLING_INTERVALS[timeInterval];
        console.log(`[PriceChart] Setting up polling every ${pollInterval}ms`);

        pollingRef.current = globalThis.setInterval(() => {
            if (mountedRef.current && !document.hidden) {
                fetchPriceData(false); // Background refresh, no loading spinner
            }
        }, pollInterval);

        return () => {
            if (pollingRef.current) {
                globalThis.clearInterval(pollingRef.current);
            }
        };
    }, [timeInterval, fetchPriceData]);

    // Cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (pollingRef.current) {
                globalThis.clearInterval(pollingRef.current);
            }
        };
    }, []);

    // =============================================================================
    // HANDLERS
    // =============================================================================

    const handleRetry = () => {
        setError(null);
        fetchPriceData(true);
    };

    const handleIntervalChange = (newInterval: TimeInterval) => {
        if (newInterval !== timeInterval) {
            setTimeInterval(newInterval);
            setPriceData([]); // Clear data to show loading state
        }
    };

    // =============================================================================
    // COMPUTED VALUES
    // =============================================================================

    // Calculate domain for Y axis (with some padding)
    const yDomain = (() => {
        if (priceData.length === 0) return [0, 100];
        const values = priceData.map(d => d.probability);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const padding = (max - min) * 0.1 || 5;
        return [Math.max(0, min - padding), Math.min(100, max + padding)];
    })();

    // Get current price for display
    const currentPrice = priceData.length > 0 ? priceData[priceData.length - 1].probability : null;
    const priceChange = priceData.length > 1
        ? priceData[priceData.length - 1].probability - priceData[0].probability
        : 0;

    // =============================================================================
    // RENDER
    // =============================================================================

    return (
        <div className={`bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl p-6 shadow-xl shadow-black/20 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <h3 className="text-sm font-light tracking-wide text-gray-400 uppercase">
                            Price History
                        </h3>
                        {/* Show selected outcome name for multi-outcome markets */}
                        {isMultiOutcome && selectedOutcomeName && (
                            <span className="text-xs text-[#4a6fa5] mt-0.5 truncate max-w-[200px]">
                                {selectedOutcomeName}
                            </span>
                        )}
                    </div>

                    {/* Current price and change */}
                    {currentPrice !== null && (
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-medium text-gray-100">
                                {currentPrice.toFixed(1)}%
                            </span>
                            {priceChange !== 0 && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${priceChange > 0
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-red-500/20 text-red-400"
                                    }`}>
                                    {priceChange > 0 ? "+" : ""}{priceChange.toFixed(1)}%
                                </span>
                            )}
                        </div>
                    )}

                    {/* Refresh indicator */}
                    {isRefreshing && (
                        <RefreshCw className="w-3 h-3 text-gray-500 animate-spin" />
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {/* Outcome toggle - only show for binary markets */}
                    {showOutcomeToggle && !isMultiOutcome && (
                        <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg p-0.5">
                            <button
                                onClick={() => setOutcome("yes")}
                                className={`px-2 py-1 text-[10px] font-medium rounded transition-all ${outcome === "yes"
                                    ? "bg-green-500/20 text-green-400"
                                    : "text-gray-500 hover:text-gray-300"
                                    }`}
                            >
                                YES
                            </button>
                            <button
                                onClick={() => setOutcome("no")}
                                className={`px-2 py-1 text-[10px] font-medium rounded transition-all ${outcome === "no"
                                    ? "bg-red-500/20 text-red-400"
                                    : "text-gray-500 hover:text-gray-300"
                                    }`}
                            >
                                NO
                            </button>
                        </div>
                    )}

                    {/* Time interval selector */}
                    <div className="flex gap-1">
                        {TIME_INTERVALS.map((ti) => (
                            <button
                                key={ti}
                                onClick={() => handleIntervalChange(ti)}
                                className={`px-2 py-1 text-[10px] font-medium rounded transition-all ${timeInterval === ti
                                    ? "bg-[#4a6fa5]/20 text-[#4a6fa5]"
                                    : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/30"
                                    }`}
                            >
                                {ti}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Chart Container */}
            <div style={{ height }}>
                {/* Multi-outcome with no selection state */}
                {isMultiOutcome && !selectedOutcomeMarketId && !isLoading && priceData.length === 0 && (
                    <div className="h-full flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div className="w-12 h-12 rounded-full bg-[#4a6fa5]/10 flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-[#4a6fa5]" />
                            </div>
                            <span className="text-sm text-gray-400">Select an outcome above to view its price chart</span>
                        </div>
                    </div>
                )}

                {/* Loading state */}
                {isLoading && priceData.length === 0 && (isMultiOutcome ? selectedOutcomeMarketId : true) && (
                    <div className="h-full flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
                            <span className="text-sm text-gray-500">Loading price history...</span>
                        </div>
                    </div>
                )}

                {/* Error state */}
                {error && priceData.length === 0 && !isLoading && (
                    <div className="h-full flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3 text-center">
                            <AlertCircle className="w-8 h-8 text-gray-500" />
                            <span className="text-sm text-gray-500">{error}</span>
                            <button
                                onClick={handleRetry}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 rounded-lg transition-colors"
                            >
                                <RefreshCw className="w-3 h-3" />
                                Retry
                            </button>
                        </div>
                    </div>
                )}

                {/* Chart */}
                {priceData.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={priceData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                            <defs>
                                <linearGradient id={`colorPrice-${outcome}-${isMultiOutcome ? 'multi' : 'binary'}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop
                                        offset="5%"
                                        stopColor={isMultiOutcome ? "#4a6fa5" : (outcome === "yes" ? "#22c55e" : "#ef4444")}
                                        stopOpacity={0.3}
                                    />
                                    <stop
                                        offset="95%"
                                        stopColor={isMultiOutcome ? "#4a6fa5" : (outcome === "yes" ? "#22c55e" : "#ef4444")}
                                        stopOpacity={0}
                                    />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="time"
                                stroke="#3a3a3a"
                                tick={{ fill: "#666", fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                interval="preserveStartEnd"
                                minTickGap={50}
                            />
                            <YAxis
                                stroke="#3a3a3a"
                                tick={{ fill: "#666", fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                domain={yDomain}
                                tickFormatter={(value) => `${Math.round(value)}%`}
                                width={40}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "#0d0d0d",
                                    border: "1px solid #3a3a3a",
                                    borderRadius: 8,
                                    fontSize: 11,
                                    padding: "8px 12px",
                                }}
                                labelStyle={{ color: "#999", marginBottom: 4 }}
                                formatter={(value: number) => [
                                    `${value.toFixed(2)}%`,
                                    isMultiOutcome
                                        ? (selectedOutcomeName ? `${selectedOutcomeName} (${outcome.toUpperCase()})` : "YES Price")
                                        : (outcome === "yes" ? "YES Price" : "NO Price")
                                ]}
                                labelFormatter={(label) => label}
                            />
                            <Area
                                type="monotone"
                                dataKey="probability"
                                stroke={isMultiOutcome ? "#4a6fa5" : (outcome === "yes" ? "#22c55e" : "#ef4444")}
                                strokeWidth={2}
                                fillOpacity={1}
                                fill={`url(#colorPrice-${outcome}-${isMultiOutcome ? 'multi' : 'binary'})`}
                                isAnimationActive={false} // Disable animation for faster updates
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Footer - Last updated */}
            {lastUpdated && priceData.length > 0 && (
                <div className="mt-2 text-right">
                    <span className="text-[10px] text-gray-600">
                        Last updated: {lastUpdated.toLocaleTimeString()}
                    </span>
                </div>
            )}
        </div>
    );
}

export default PriceChart;
