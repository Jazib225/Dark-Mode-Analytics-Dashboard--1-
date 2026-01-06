import { safeGet } from "../utils/apiRequest";
const DATA_API_BASE_URL = "https://data-api.polymarket.com";
/**
 * DataClient handles all user portfolio and history data
 * ONLY for: user positions, user activity, user history, PnL/position snapshots, portfolio/holdings, account history-type data
 */
export class DataClient {
    constructor() {
        this.baseURL = DATA_API_BASE_URL;
    }
    /**
     * Get user portfolio overview
     */
    async getPortfolio(userAddress) {
        if (!userAddress)
            throw new Error("userAddress is required");
        const url = `${this.baseURL}/portfolios/${userAddress}`;
        const response = await safeGet(url);
        return response;
    }
    /**
     * Get user positions
     */
    async getPositions(userAddress) {
        if (!userAddress)
            throw new Error("userAddress is required");
        const url = `${this.baseURL}/portfolios/${userAddress}/positions`;
        const response = await safeGet(url);
        return response.positions || [];
    }
    /**
     * Get a specific position
     */
    async getPosition(userAddress, positionId) {
        if (!userAddress)
            throw new Error("userAddress is required");
        if (!positionId)
            throw new Error("positionId is required");
        const url = `${this.baseURL}/portfolios/${userAddress}/positions/${positionId}`;
        const response = await safeGet(url);
        return response;
    }
    /**
     * Get user activity/trades
     */
    async getActivity(userAddress, params) {
        if (!userAddress)
            throw new Error("userAddress is required");
        const searchParams = new URLSearchParams();
        if (params?.limit)
            searchParams.append("limit", String(params.limit));
        if (params?.offset)
            searchParams.append("offset", String(params.offset));
        if (params?.start_date)
            searchParams.append("start_date", params.start_date);
        if (params?.end_date)
            searchParams.append("end_date", params.end_date);
        if (params?.type)
            searchParams.append("type", params.type);
        const url = `${this.baseURL}/portfolios/${userAddress}/activity?${searchParams.toString()}`;
        const response = await safeGet(url);
        return response.activity || [];
    }
    /**
     * Get PnL history (snapshots over time)
     */
    async getPnLHistory(userAddress, params) {
        if (!userAddress)
            throw new Error("userAddress is required");
        const searchParams = new URLSearchParams();
        if (params?.start_date)
            searchParams.append("start_date", params.start_date);
        if (params?.end_date)
            searchParams.append("end_date", params.end_date);
        const url = `${this.baseURL}/portfolios/${userAddress}/pnl?${searchParams.toString()}`;
        const response = await safeGet(url);
        return response.snapshots || [];
    }
    /**
     * Get user trading history stats
     */
    async getUserHistory(userAddress) {
        if (!userAddress)
            throw new Error("userAddress is required");
        const url = `${this.baseURL}/users/${userAddress}/history`;
        const response = await safeGet(url);
        return response;
    }
    /**
     * Get recent trades (latest activity across all users, paginated)
     */
    async getRecentTrades(params) {
        const searchParams = new URLSearchParams();
        if (params?.limit)
            searchParams.append("limit", String(params.limit));
        if (params?.offset)
            searchParams.append("offset", String(params.offset));
        const url = `${this.baseURL}/activity?${searchParams.toString()}`;
        const response = await safeGet(url);
        return response.activity || [];
    }
    /**
     * Get top traders by PnL
     */
    async getTopTraders(params) {
        const searchParams = new URLSearchParams();
        if (params?.limit)
            searchParams.append("limit", String(params.limit));
        if (params?.timeframe)
            searchParams.append("timeframe", params.timeframe);
        const url = `${this.baseURL}/users/top?${searchParams.toString()}`;
        const response = await safeGet(url);
        return response.users || [];
    }
}
export const dataClient = new DataClient();
