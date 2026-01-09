import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

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

async function fetchWalletBalance(address: string): Promise<number> {
  try {
    const response = await fetch(`https://data-api.polymarket.com/portfolios/${address}`);
    if (response.ok) {
      const data = await response.json();
      return Math.round(parseFloat(data.available_balance || data.total_balance || "0") * 100);
    }
  } catch (e) {
    console.error("Balance fetch error:", e);
  }
  return 0;
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
    setUser(newUser);
    if (newUser.authMethod === "wallet" && newUser.walletAddress) {
      fetchWalletBalance(newUser.walletAddress).then(balance => {
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
