/**
 * High-fidelity Skeleton Screen for Market Detail
 * 
 * This component provides immediate visual feedback when navigating to a market.
 * It mirrors the exact layout of the MarketDetail page using pulsating gray blocks.
 * 
 * Architecture based on Next.js loading.tsx pattern:
 * - Renders immediately (< 100ms) on navigation
 * - Satisfies user's psychological need for "loading" confirmation
 * - Prevents the "frozen" feeling of SPA navigation
 */

// Reusable skeleton pulse animation class
const pulseClass = "animate-pulse bg-gradient-to-r from-gray-800/50 via-gray-700/50 to-gray-800/50 rounded";

export function MarketDetailSkeleton() {
    return (
        <div className="max-w-[1800px] mx-auto space-y-6">
            {/* Back Button */}
            <div className={`${pulseClass} h-10 w-32`} />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr,400px] gap-6">
                {/* Left Column - Market Info */}
                <div className="space-y-6">
                    {/* Header Card */}
                    <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl p-6 shadow-xl">
                        <div className="flex items-start gap-4">
                            {/* Market Image */}
                            <div className={`${pulseClass} w-20 h-20 rounded-xl flex-shrink-0`} />

                            <div className="flex-1 space-y-3">
                                {/* Title */}
                                <div className={`${pulseClass} h-8 w-3/4`} />
                                {/* Subtitle */}
                                <div className={`${pulseClass} h-5 w-1/2`} />

                                {/* Stats Row */}
                                <div className="flex items-center gap-6 pt-2">
                                    <div className={`${pulseClass} h-10 w-24`} />
                                    <div className={`${pulseClass} h-10 w-24`} />
                                    <div className={`${pulseClass} h-10 w-24`} />
                                    <div className={`${pulseClass} h-10 w-24`} />
                                </div>
                            </div>

                            {/* Probability Display */}
                            <div className={`${pulseClass} h-24 w-32 rounded-xl`} />
                        </div>
                    </div>

                    {/* Price Chart Card */}
                    <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl p-6 shadow-xl">
                        {/* Chart Title */}
                        <div className="flex items-center justify-between mb-4">
                            <div className={`${pulseClass} h-6 w-32`} />
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className={`${pulseClass} h-8 w-12`} />
                                ))}
                            </div>
                        </div>

                        {/* Chart Area */}
                        <div className={`${pulseClass} h-[300px] w-full rounded-lg`} />

                        {/* Chart Legend */}
                        <div className="flex justify-center gap-6 mt-4">
                            <div className={`${pulseClass} h-5 w-20`} />
                            <div className={`${pulseClass} h-5 w-20`} />
                        </div>
                    </div>

                    {/* Activity Section */}
                    <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl p-6 shadow-xl">
                        {/* Tab Headers */}
                        <div className="flex gap-4 mb-4 border-b border-gray-800/50 pb-4">
                            {['Recent Trades', 'Top Holders', 'Top Traders'].map((tab, i) => (
                                <div key={`${tab}-${i}`} className={`${pulseClass} h-8 w-28`} />
                            ))}
                        </div>

                        {/* Table Skeleton */}
                        <div className="space-y-3">
                            {/* Table Header */}
                            <div className="flex gap-4 pb-2 border-b border-gray-800/30">
                                <div className={`${pulseClass} h-4 w-20`} />
                                <div className={`${pulseClass} h-4 w-32`} />
                                <div className={`${pulseClass} h-4 w-16`} />
                                <div className={`${pulseClass} h-4 w-20 ml-auto`} />
                            </div>

                            {/* Table Rows */}
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="flex gap-4 py-2">
                                    <div className={`${pulseClass} h-5 w-20`} />
                                    <div className={`${pulseClass} h-5 w-32`} />
                                    <div className={`${pulseClass} h-5 w-16`} />
                                    <div className={`${pulseClass} h-5 w-20 ml-auto`} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Description Card */}
                    <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl p-6 shadow-xl">
                        <div className={`${pulseClass} h-6 w-32 mb-4`} />
                        <div className="space-y-2">
                            <div className={`${pulseClass} h-4 w-full`} />
                            <div className={`${pulseClass} h-4 w-full`} />
                            <div className={`${pulseClass} h-4 w-3/4`} />
                        </div>
                    </div>
                </div>

                {/* Right Column - Trading Panel */}
                <div className="space-y-6">
                    {/* Trading Card */}
                    <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl p-6 shadow-xl sticky top-4">
                        {/* Yes/No Tabs */}
                        <div className="flex gap-2 mb-6">
                            <div className={`${pulseClass} h-12 flex-1`} />
                            <div className={`${pulseClass} h-12 flex-1`} />
                        </div>

                        {/* Price Display */}
                        <div className="space-y-4 mb-6">
                            <div className="flex justify-between">
                                <div className={`${pulseClass} h-5 w-20`} />
                                <div className={`${pulseClass} h-6 w-16`} />
                            </div>
                            <div className="flex justify-between">
                                <div className={`${pulseClass} h-5 w-24`} />
                                <div className={`${pulseClass} h-6 w-20`} />
                            </div>
                        </div>

                        {/* Amount Input */}
                        <div className={`${pulseClass} h-14 w-full mb-4`} />

                        {/* Quick Amounts */}
                        <div className="flex gap-2 mb-6">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className={`${pulseClass} h-8 flex-1`} />
                            ))}
                        </div>

                        {/* Summary */}
                        <div className="space-y-2 mb-6 p-4 bg-[#0a0a0a] rounded-lg">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="flex justify-between">
                                    <div className={`${pulseClass} h-4 w-24`} />
                                    <div className={`${pulseClass} h-4 w-16`} />
                                </div>
                            ))}
                        </div>

                        {/* Buy Button */}
                        <div className={`${pulseClass} h-14 w-full`} />
                    </div>

                    {/* Order Book Card */}
                    <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl p-6 shadow-xl">
                        <div className={`${pulseClass} h-6 w-24 mb-4`} />

                        {/* Bids/Asks Headers */}
                        <div className="grid grid-cols-2 gap-4 mb-3">
                            <div className={`${pulseClass} h-4 w-12`} />
                            <div className={`${pulseClass} h-4 w-12 ml-auto`} />
                        </div>

                        {/* Order Book Rows */}
                        <div className="space-y-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="grid grid-cols-2 gap-4">
                                    <div className={`${pulseClass} h-6 w-full`} />
                                    <div className={`${pulseClass} h-6 w-full`} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Simple inline skeleton for market cards
 */
export function MarketCardSkeleton() {
    return (
        <div className="bg-gradient-to-br from-[#0d0d0d] to-[#0b0b0b] border border-gray-800/50 rounded-xl p-4 shadow-xl">
            <div className="flex items-start gap-3">
                <div className={`${pulseClass} w-12 h-12 rounded-lg flex-shrink-0`} />
                <div className="flex-1 space-y-2">
                    <div className={`${pulseClass} h-5 w-3/4`} />
                    <div className={`${pulseClass} h-4 w-1/2`} />
                </div>
                <div className={`${pulseClass} h-8 w-16`} />
            </div>
            <div className="flex justify-between mt-4 pt-3 border-t border-gray-800/30">
                <div className={`${pulseClass} h-4 w-20`} />
                <div className={`${pulseClass} h-4 w-24`} />
            </div>
        </div>
    );
}

/**
 * Full page skeleton with multiple cards
 */
export function MarketsPageSkeleton() {
    return (
        <div className="max-w-[1800px] mx-auto space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div className={`${pulseClass} h-8 w-48`} />
                <div className="flex gap-3">
                    <div className={`${pulseClass} h-10 w-32`} />
                    <div className={`${pulseClass} h-10 w-32`} />
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex gap-3">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className={`${pulseClass} h-9 w-24`} />
                ))}
            </div>

            {/* Market Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                    <MarketCardSkeleton key={i} />
                ))}
            </div>
        </div>
    );
}

/**
 * Loading indicator with optional message
 */
export function LoadingIndicator({ message = "Loading..." }: { message?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="relative">
                <div className="w-12 h-12 rounded-full border-4 border-gray-800 border-t-[#4a6fa5] animate-spin" />
            </div>
            <span className="text-gray-400 text-sm font-light">{message}</span>
        </div>
    );
}

export default MarketDetailSkeleton;
