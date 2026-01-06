import { safeGet } from "../utils/apiRequest";

const DATA_API_BASE_URL = "https://data-api.polymarket.com";

/**
 * Types for Data API responses
 */
export interface Position {
  id: string;
  user: string;
  asset_id: string;
  market_id: string;
  quantity: string;
  entry_price: string;
  current_price: string;
  unrealized_pnl: string;
  unrealized_pnl_percent: string;
  side: "LONG" | "SHORT";
  opened_at: string;
}

export interface Portfolio {
  address: string;
  total_balance: string;
  available_balance: string;
  positions_value: string;
  total_pnl: string;
  total_pnl_percent: string;
  positions: Position[];
  updated_at: string;
}

export interface Activity {
  id: string;
  user: string;
  type: "BUY" | "SELL" | "DEPOSIT" | "WITHDRAW";
  asset_id?: string;
  market_id?: string;
  quantity?: string;
  price?: string;
  pnl?: string;
  timestamp: string;
}

export interface PnLSnapshot {
  date: string;
  pnl: string;
  balance: string;
  positions_count: number;
}

export interface UserHistory {
  address: string;
  total_trades: number;
  win_rate: string;
  avg_pnl: string;
  total_pnl: string;
  positions_opened: number;
  positions_closed: number;
  first_trade: string;
  last_trade: string;
}

export interface ActivityParams {
  limit?: number;
  offset?: number;
  start_date?: string;
  end_date?: string;
  type?: "BUY" | "SELL" | "DEPOSIT" | "WITHDRAW";
}

/**
 * DataClient handles all user portfolio and history data
 * ONLY for: user positions, user activity, user history, PnL/position snapshots, portfolio/holdings, account history-type data
 */
export class DataClient {
  private baseURL = DATA_API_BASE_URL;

  /**
   * Get user portfolio overview
   */
  async getPortfolio(userAddress: string): Promise<Portfolio> {
    if (!userAddress) throw new Error("userAddress is required");

    const url = `${this.baseURL}/portfolios/${userAddress}`;
    const response = await safeGet<Portfolio>(url);

    return response;
  }

  /**
   * Get user positions
   */
  async getPositions(userAddress: string): Promise<Position[]> {
    if (!userAddress) throw new Error("userAddress is required");

    const url = `${this.baseURL}/portfolios/${userAddress}/positions`;
    const response = await safeGet<{ positions: Position[] }>(url);

    return response.positions || [];
  }

  /**
   * Get a specific position
   */
  async getPosition(userAddress: string, positionId: string): Promise<Position> {
    if (!userAddress) throw new Error("userAddress is required");
    if (!positionId) throw new Error("positionId is required");

    const url = `${this.baseURL}/portfolios/${userAddress}/positions/${positionId}`;
    const response = await safeGet<Position>(url);

    return response;
  }

  /**
   * Get user activity/trades
   */
  async getActivity(
    userAddress: string,
    params?: ActivityParams
  ): Promise<Activity[]> {
    if (!userAddress) throw new Error("userAddress is required");

    const searchParams = new URLSearchParams();

    if (params?.limit) searchParams.append("limit", String(params.limit));
    if (params?.offset) searchParams.append("offset", String(params.offset));
    if (params?.start_date) searchParams.append("start_date", params.start_date);
    if (params?.end_date) searchParams.append("end_date", params.end_date);
    if (params?.type) searchParams.append("type", params.type);

    const url = `${this.baseURL}/portfolios/${userAddress}/activity?${searchParams.toString()}`;
    const response = await safeGet<{ activity: Activity[] }>(url);

    return response.activity || [];
  }

  /**
   * Get PnL history (snapshots over time)
   */
  async getPnLHistory(
    userAddress: string,
    params?: { start_date?: string; end_date?: string }
  ): Promise<PnLSnapshot[]> {
    if (!userAddress) throw new Error("userAddress is required");

    const searchParams = new URLSearchParams();

    if (params?.start_date) searchParams.append("start_date", params.start_date);
    if (params?.end_date) searchParams.append("end_date", params.end_date);

    const url = `${this.baseURL}/portfolios/${userAddress}/pnl?${searchParams.toString()}`;
    const response = await safeGet<{ snapshots: PnLSnapshot[] }>(url);

    return response.snapshots || [];
  }

  /**
   * Get user trading history stats
   */
  async getUserHistory(userAddress: string): Promise<UserHistory> {
    if (!userAddress) throw new Error("userAddress is required");

    const url = `${this.baseURL}/users/${userAddress}/history`;
    const response = await safeGet<UserHistory>(url);

    return response;
  }

  /**
   * Get recent trades (latest activity across all users, paginated)
   */
  async getRecentTrades(params?: {
    limit?: number;
    offset?: number;
  }): Promise<Activity[]> {
    const searchParams = new URLSearchParams();

    if (params?.limit) searchParams.append("limit", String(params.limit));
    if (params?.offset) searchParams.append("offset", String(params.offset));

    const url = `${this.baseURL}/activity?${searchParams.toString()}`;
    const response = await safeGet<{ activity: Activity[] }>(url);

    return response.activity || [];
  }

  /**
   * Get top traders by PnL
   */
  async getTopTraders(params?: {
    limit?: number;
    timeframe?: "24h" | "7d" | "30d" | "all";
  }): Promise<UserHistory[]> {
    const searchParams = new URLSearchParams();

    if (params?.limit) searchParams.append("limit", String(params.limit));
    if (params?.timeframe) searchParams.append("timeframe", params.timeframe);

    const url = `${this.baseURL}/users/top?${searchParams.toString()}`;
    const response = await safeGet<{ users: UserHistory[] }>(url);

    return response.users || [];
  }
}

export const dataClient = new DataClient();
