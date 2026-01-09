import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

// User types
export interface User {
  id: string;
  email?: string;
  walletAddress?: string;
  displayName?: string;
  authMethod: "email" | "google" | "wallet";
  balance: number; // USDC balance in cents (e.g., 332000 = $3,320.00)
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithWallet: () => Promise<void>;
  logout: () => void;
  refreshBalance: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Polygon USDC contract address
const USDC_CONTRACT = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"; // Polygon USDC

// Helper to get wallet balance from Polygon network
async function getWalletUSDCBalance(address: string): Promise<number> {
  try {
    // Try to get balance from Polymarket Data API first
    const response = await fetch(`https://data-api.polymarket.com/portfolios/${address}`);
    if (response.ok) {
      const data = await response.json();
      // Balance comes as string like "1234.56"
      const balance = parseFloat(data.available_balance || data.total_balance || "0");
      return Math.round(balance * 100); // Convert to cents
    }
    
    // Fallback: Try to read USDC balance from Polygon RPC
    const rpcUrl = "https://polygon-rpc.com";
    
    // USDC balanceOf function selector
    const balanceOfSelector = "0x70a08231";
    const paddedAddress = address.slice(2).padStart(64, "0");
    const data = balanceOfSelector + paddedAddress;
    
    const rpcResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [
          { to: USDC_CONTRACT, data },
          "latest"
        ]
      })
    });
    
    const rpcData = await rpcResponse.json();
    if (rpcData.result) {
      // USDC has 6 decimals, convert to cents (2 decimals)
      const balance = parseInt(rpcData.result, 16);
      return Math.round(balance / 10000); // 6 decimals to 2 decimals
    }
    
    return 0;
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    return 0;
  }
}

// Storage keys
const STORAGE_KEY = "paragon_auth_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const userData = JSON.parse(stored) as User;
          setUser(userData);
          
          // If wallet user, refresh balance
          if (userData.authMethod === "wallet" && userData.walletAddress) {
            const balance = await getWalletUSDCBalance(userData.walletAddress);
            setUser(prev => prev ? { ...prev, balance } : null);
          }
        }
      } catch (error) {
        console.error("Error loading user:", error);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadUser();
  }, []);

  // Save user to localStorage when it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  // Login with email
  const loginWithEmail = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // Simulate email login (in production, this would call your auth API)
      // For demo purposes, we create a user with 0 balance for new accounts
      
      // Check if this email was used before (simulated)
      const existingBalance = localStorage.getItem(`balance_${email}`);
      const balance = existingBalance ? parseInt(existingBalance) : 0;
      
      const newUser: User = {
        id: `email_${email}`,
        email,
        displayName: email.split("@")[0],
        authMethod: "email",
        balance,
      };
      
      setUser(newUser);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Login with Google
  const loginWithGoogle = useCallback(async () => {
    setIsLoading(true);
    try {
      // Open Google OAuth popup
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      // In production, you would use a proper OAuth flow
      // For demo, we simulate a Google login
      const googleEmail = await new Promise<string>((resolve, reject) => {
        // Create a modal to get user's email for demo purposes
        const modal = document.createElement("div");
        modal.innerHTML = `
          <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 24px; max-width: 400px; width: 90%;">
              <h3 style="color: white; margin-bottom: 16px; font-size: 18px;">Sign in with Google</h3>
              <p style="color: #888; margin-bottom: 16px; font-size: 14px;">Enter your Google email to continue (demo mode)</p>
              <input type="email" id="google-email-input" placeholder="your.email@gmail.com" style="width: 100%; padding: 12px; background: #0a0a0a; border: 1px solid #333; border-radius: 8px; color: white; margin-bottom: 16px; box-sizing: border-box;" />
              <div style="display: flex; gap: 12px;">
                <button id="google-cancel" style="flex: 1; padding: 10px; background: #333; border: none; border-radius: 8px; color: white; cursor: pointer;">Cancel</button>
                <button id="google-continue" style="flex: 1; padding: 10px; background: #4285f4; border: none; border-radius: 8px; color: white; cursor: pointer;">Continue</button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
        
        const input = document.getElementById("google-email-input") as HTMLInputElement;
        const cancelBtn = document.getElementById("google-cancel");
        const continueBtn = document.getElementById("google-continue");
        
        input?.focus();
        
        cancelBtn?.addEventListener("click", () => {
          document.body.removeChild(modal);
          reject(new Error("Cancelled"));
        });
        
        continueBtn?.addEventListener("click", () => {
          const email = input?.value;
          if (email && email.includes("@")) {
            document.body.removeChild(modal);
            resolve(email);
          }
        });
        
        input?.addEventListener("keypress", (e) => {
          if (e.key === "Enter") {
            const email = input?.value;
            if (email && email.includes("@")) {
              document.body.removeChild(modal);
              resolve(email);
            }
          }
        });
      });
      
      const existingBalance = localStorage.getItem(`balance_${googleEmail}`);
      const balance = existingBalance ? parseInt(existingBalance) : 0;
      
      const newUser: User = {
        id: `google_${googleEmail}`,
        email: googleEmail,
        displayName: googleEmail.split("@")[0],
        authMethod: "google",
        balance,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(googleEmail.split("@")[0])}&background=4285f4&color=fff`,
      };
      
      setUser(newUser);
    } catch (error) {
      console.log("Google login cancelled");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Login with wallet (MetaMask, etc.)
  const loginWithWallet = useCallback(async () => {
    setIsLoading(true);
    try {
      // Check if MetaMask or other wallet is available
      const ethereum = (window as any).ethereum;
      
      if (!ethereum) {
        throw new Error("No wallet detected. Please install MetaMask or another Web3 wallet.");
      }
      
      // Request account access
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found. Please connect your wallet.");
      }
      
      const walletAddress = accounts[0] as string;
      
      // Switch to Polygon network if needed
      try {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x89" }], // Polygon Mainnet
        });
      } catch (switchError: any) {
        // If Polygon is not added, add it
        if (switchError.code === 4902) {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x89",
              chainName: "Polygon Mainnet",
              nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
              rpcUrls: ["https://polygon-rpc.com"],
              blockExplorerUrls: ["https://polygonscan.com"],
            }],
          });
        }
      }
      
      // Get USDC balance
      const balance = await getWalletUSDCBalance(walletAddress);
      
      const newUser: User = {
        id: `wallet_${walletAddress}`,
        walletAddress,
        displayName: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
        authMethod: "wallet",
        balance,
      };
      
      setUser(newUser);
      
      // Listen for account changes
      ethereum.on("accountsChanged", async (newAccounts: string[]) => {
        if (newAccounts.length === 0) {
          setUser(null);
        } else {
          const newAddress = newAccounts[0];
          const newBalance = await getWalletUSDCBalance(newAddress);
          setUser(prev => prev ? {
            ...prev,
            walletAddress: newAddress,
            displayName: `${newAddress.slice(0, 6)}...${newAddress.slice(-4)}`,
            balance: newBalance,
          } : null);
        }
      });
      
    } catch (error: any) {
      console.error("Wallet login error:", error);
      alert(error.message || "Failed to connect wallet");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Logout
  const logout = useCallback(() => {
    // Save balance before logout for email/google users
    if (user && (user.authMethod === "email" || user.authMethod === "google") && user.email) {
      localStorage.setItem(`balance_${user.email}`, String(user.balance));
    }
    setUser(null);
  }, [user]);

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!user) return;
    
    if (user.authMethod === "wallet" && user.walletAddress) {
      const balance = await getWalletUSDCBalance(user.walletAddress);
      setUser(prev => prev ? { ...prev, balance } : null);
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginWithEmail,
        loginWithGoogle,
        loginWithWallet,
        logout,
        refreshBalance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
