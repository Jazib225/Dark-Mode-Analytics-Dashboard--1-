import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

export interface User {
  id: string;
  email?: string;
  walletAddress?: string;
  displayName: string;
  authMethod: "email" | "google" | "wallet";
  balance: number;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => void;
  refreshBalance: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const STORAGE_KEY = "paragon_auth_user";

// Fetch ETH balance from MetaMask
async function fetchEthBalance(address: string): Promise<number> {
  try {
    const ethereum = (window as any).ethereum;
    if (ethereum) {
      const balanceHex = await ethereum.request({
        method: "eth_getBalance",
        params: [address, "latest"]
      });
      const balanceWei = parseInt(balanceHex, 16);
      return balanceWei / 1e18;
    }
  } catch (e) {
    console.error("ETH balance fetch error:", e);
  }
  return 0;
}

// Fetch SOL balance from Solana using @solana/web3.js
async function fetchSolBalance(address: string): Promise<number> {
  try {
    console.log(`[RefreshBalance] Fetching SOL balance for ${address}`);
    const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
    const publicKey = new PublicKey(address);
    const lamports = await connection.getBalance(publicKey);
    const balanceInSol = lamports / LAMPORTS_PER_SOL;
    console.log(`[RefreshBalance] Balance: ${lamports} lamports = ${balanceInSol} SOL`);
    return balanceInSol;
  } catch (e) {
    console.error("[RefreshBalance] Failed to fetch SOL balance:", e);
    return 0;
  }
}

// Determine wallet type and fetch appropriate balance
async function fetchWalletBalance(address: string): Promise<number> {
  if (address.startsWith("0x") && address.length === 42) {
    return fetchEthBalance(address);
  }
  // Otherwise assume Solana
  return fetchSolBalance(address);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const userData = JSON.parse(stored) as User;
        setUser(userData);
        if (userData.authMethod === "wallet" && userData.walletAddress) {
          fetchWalletBalance(userData.walletAddress).then(balance => {
            setUser(prev => prev ? { ...prev, balance } : null);
          });
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const login = useCallback((newUser: User) => {
    console.log("Login called with user:", newUser);
    setUser(newUser);
    // Only fetch balance if we don't already have one (balance === 0)
    // The LoginPage already fetches the balance, so we shouldn't overwrite it
    if (newUser.authMethod === "wallet" && newUser.walletAddress && newUser.balance === 0) {
      console.log("Balance is 0, fetching from blockchain...");
      fetchWalletBalance(newUser.walletAddress).then(balance => {
        console.log("Fetched balance:", balance);
        setUser(prev => prev ? { ...prev, balance } : null);
      });
    }
  }, []);

  const logout = useCallback(() => {
    if (user?.email) {
      localStorage.setItem(`balance_${user.email}`, String(user.balance));
    }
    setUser(null);
  }, [user]);

  const refreshBalance = useCallback(async () => {
    if (user?.authMethod === "wallet" && user.walletAddress) {
      const balance = await fetchWalletBalance(user.walletAddress);
      setUser(prev => prev ? { ...prev, balance } : null);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, refreshBalance }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
