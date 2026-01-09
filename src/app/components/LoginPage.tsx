import { useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import paragonLogo from "../../assets/paragon-logo.png";

interface LoginPageProps {
  onLogin: (user: { id: string; email?: string; walletAddress?: string; displayName: string; authMethod: "email" | "google" | "wallet"; balance: number }) => void;
  onClose?: () => void;
}

// Icons as simple SVGs to avoid heavy imports
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const MetaMaskIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 35 33">
    <path fill="#E17726" d="M32.96 1L19.5 11.04l2.49-5.88L32.96 1z"/>
    <path fill="#E27625" d="M2.04 1l13.34 10.14-2.37-5.98L2.04 1zM28.15 23.53l-3.58 5.48 7.66 2.11 2.2-7.46-6.28-.13zM.57 23.66l2.19 7.46 7.65-2.11-3.57-5.48-6.27.13z"/>
    <path fill="#E27625" d="M9.99 14.42l-2.14 3.24 7.62.34-.26-8.2-5.22 4.62zM25.01 14.42l-5.29-4.72-.17 8.3 7.61-.34-2.15-3.24zM10.41 29.01l4.59-2.24-3.96-3.09-.63 5.33zM20 26.77l4.59 2.24-.63-5.33-3.96 3.09z"/>
    <path fill="#D5BFB2" d="M24.59 29.01l-4.59-2.24.37 2.99-.04 1.26 4.26-2.01zM10.41 29.01l4.26 2.01-.03-1.26.36-2.99-4.59 2.24z"/>
    <path fill="#233447" d="M14.77 21.93l-3.83-1.13 2.7-1.24 1.13 2.37zM20.23 21.93l1.13-2.37 2.71 1.24-3.84 1.13z"/>
    <path fill="#CC6228" d="M10.41 29.01l.66-5.48-4.23.13 3.57 5.35zM23.93 23.53l.66 5.48 3.56-5.35-4.22-.13zM27.16 17.66l-7.61.34.71 3.93 1.13-2.37 2.71 1.24 3.06-3.14zM10.94 20.8l2.7-1.24 1.13 2.37.71-3.93-7.62-.34 3.08 3.14z"/>
    <path fill="#E27525" d="M7.86 17.66l3.2 6.24-.11-3.1-3.09-3.14zM24.1 20.8l-.11 3.1 3.17-6.24-3.06 3.14zM15.48 18l-.71 3.93.89 4.6.2-6.05-.38-2.48zM19.55 18l-.37 2.47.18 6.06.9-4.6-.71-3.93z"/>
    <path fill="#F5841F" d="M20.26 21.93l-.9 4.6.65.45 3.96-3.09.11-3.1-3.82 1.14zM10.94 20.8l.11 3.09 3.96 3.09.64-.45-.89-4.6-3.82-1.13z"/>
    <path fill="#C0AC9D" d="M20.3 31.02l.04-1.26-.34-.3h-5l-.33.3.03 1.26-4.26-2.01 1.49 1.22 3.02 2.09h5.1l3.03-2.09 1.48-1.22-4.26 2.01z"/>
    <path fill="#161616" d="M20 26.77l-.65-.45h-3.7l-.64.45-.36 2.99.33-.3h5l.34.3-.32-2.99z"/>
    <path fill="#763E1A" d="M33.52 11.54l1.14-5.48L32.96 1l-12.96 9.62 4.99 4.22 7.05 2.06 1.56-1.81-.68-.49 1.08-.98-.82-.64 1.08-.82-.71-.55zM.34 6.06l1.15 5.48-.74.55 1.09.82-.82.64 1.08.98-.68.49 1.55 1.81 7.05-2.06 5-4.22L2.04 1 .34 6.06z"/>
    <path fill="#F5841F" d="M32.04 17.42l-7.05-2.06 2.15 3.24-3.17 6.24 4.18-.05h6.28l-2.39-7.37zM10 15.36l-7.06 2.06-2.38 7.37h6.28l4.17.05-3.17-6.24 2.16-3.24zM19.55 18l.45-7.76 2.05-5.54H12.95l2.04 5.54.46 7.76.17 2.49.02 6.04h3.7l.02-6.04.19-2.49z"/>
  </svg>
);

const PhantomIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 128 128">
    <circle cx="64" cy="64" r="64" fill="#AB9FF2"/>
    <path fill="#fff" d="M110.6 64c0-3.3-2.7-6-6-6H93.2c-20.1 0-36.5-16.4-36.5-36.5V20c0-3.3-2.7-6-6-6s-6 2.7-6 6v1.5c0 26.8 21.7 48.5 48.5 48.5h11.4c3.3 0 6-2.7 6-6zM74.4 75c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm20 0c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5z"/>
  </svg>
);

export function LoginPage({ onLogin, onClose }: LoginPageProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Enter email and password");
      return;
    }
    if (password.length < 6) {
      setError("Password must be 6+ characters");
      return;
    }
    
    setLoading("email");
    setError("");
    
    // Simulate brief delay then login
    await new Promise(r => setTimeout(r, 500));
    
    const savedBalance = localStorage.getItem(`balance_${email}`);
    onLogin({
      id: `email_${email}`,
      email,
      displayName: email.split("@")[0],
      authMethod: "email",
      balance: savedBalance ? parseInt(savedBalance) : 0,
    });
    setLoading(null);
  };

  const handleGoogleAuth = async () => {
    setLoading("google");
    setError("");
    
    // Google OAuth Configuration
    const GOOGLE_CLIENT_ID = "777580466798-mq096ravd140p5agdkp1bauo6s3f5mmm.apps.googleusercontent.com";
    
    // Open Google OAuth popup
    const redirectUri = window.location.origin;
    const scope = "email profile";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}&prompt=select_account`;
    
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      authUrl,
      "Google Sign In",
      `width=${width},height=${height},left=${left},top=${top}`
    );
    
    // Listen for the OAuth callback
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === "GOOGLE_AUTH_SUCCESS") {
        const { access_token } = event.data;
        
        // Fetch user info from Google
        const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${access_token}` }
        });
        const userInfo = await response.json();
        
        onLogin({
          id: `google_${userInfo.id}`,
          email: userInfo.email,
          displayName: userInfo.name || userInfo.email.split("@")[0],
          authMethod: "google",
          balance: 0,
        });
        
        window.removeEventListener("message", handleMessage);
      }
    };
    
    window.addEventListener("message", handleMessage);
    
    // Check if popup was closed without completing auth
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        setLoading(null);
        window.removeEventListener("message", handleMessage);
      }
    }, 1000);
  };

  const handleMetaMask = async () => {
    setLoading("metamask");
    setError("");
    
    // Small delay to ensure extensions are fully loaded
    await new Promise(r => setTimeout(r, 100));
    
    try {
      // Check if MetaMask is installed - it injects window.ethereum
      const ethereum = (window as any).ethereum;
      
      if (!ethereum) {
        setError("MetaMask not installed. Opening download page...");
        setLoading(null);
        window.open("https://metamask.io/download/", "_blank");
        return;
      }
      
      // If multiple wallets are installed, MetaMask might be in a providers array
      let provider = ethereum;
      if (ethereum.providers?.length) {
        const mmProvider = ethereum.providers.find((p: any) => p.isMetaMask && !p.isPhantom);
        if (mmProvider) provider = mmProvider;
      }
      
      // Request accounts - this opens the MetaMask popup
      const accounts = await provider.request({ 
        method: "eth_requestAccounts" 
      });
      
      if (accounts && accounts.length > 0) {
        const address = accounts[0] as string;
        
        // Fetch ETH balance
        let balanceInEth = 0;
        try {
          const balanceHex = await provider.request({
            method: "eth_getBalance",
            params: [address, "latest"]
          });
          // Convert from wei (hex) to ETH
          const balanceWei = parseInt(balanceHex as string, 16);
          balanceInEth = balanceWei / 1e18;
        } catch (balanceErr) {
          console.error("Failed to fetch ETH balance:", balanceErr);
        }
        
        setLoading(null);
        onLogin({
          id: `wallet_${address}`,
          walletAddress: address,
          displayName: `${address.slice(0, 6)}...${address.slice(-4)}`,
          authMethod: "wallet",
          balance: balanceInEth,
        });
        return;
      } else {
        setError("No accounts returned. Please unlock MetaMask and try again.");
      }
    } catch (err: any) {
      console.error("MetaMask connection error:", err);
      if (err.code === 4001) {
        setError("You rejected the connection request.");
      } else if (err.code === -32002) {
        setError("Connection request already pending. Check MetaMask extension.");
      } else {
        setError(err.message || "Failed to connect to MetaMask");
      }
    }
    setLoading(null);
  };

  const handlePhantom = async () => {
    setLoading("phantom");
    setError("");
    
    // Get the Phantom provider - check multiple locations
    const win = window as any;
    const provider = win.phantom?.solana || win.solana;
    
    // Check if Phantom is actually available
    if (!provider || !provider.isPhantom) {
      setError("Phantom not found. Please make sure the extension is installed and enabled.");
      setLoading(null);
      return;
    }
    
    try {
      // Request connection - this opens the Phantom popup
      const response = await provider.connect();
      const publicKey = response.publicKey.toString();
      console.log("Connected to Phantom, public key:", publicKey);
      
      // Fetch SOL balance using Phantom's connection if available, or direct RPC
      let balanceInSol = 0;
      
      // Method 1: Try using Phantom's connection object (most reliable)
      try {
        // @solana/web3.js Connection through Phantom
        if (provider.connection) {
          const lamports = await provider.connection.getBalance(response.publicKey);
          balanceInSol = lamports / 1e9;
          console.log(`Got balance via Phantom connection: ${balanceInSol} SOL`);
        }
      } catch (e) {
        console.log("Phantom connection method failed, trying RPC:", e);
      }
      
      // Method 2: If Phantom connection failed, try direct RPC with CORS-friendly endpoints
      if (balanceInSol === 0) {
        const rpcEndpoints = [
          "https://api.mainnet-beta.solana.com",
          "https://solana-api.projectserum.com"
        ];
        
        for (const endpoint of rpcEndpoints) {
          try {
            console.log(`Trying RPC endpoint: ${endpoint}`);
            const rpcResponse = await fetch(endpoint, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "getBalance",
                params: [publicKey]
              })
            });
            const rpcData = await rpcResponse.json();
            console.log("RPC response:", rpcData);
            
            if (rpcData.result?.value !== undefined) {
              balanceInSol = rpcData.result.value / 1e9;
              console.log(`Balance: ${rpcData.result.value} lamports = ${balanceInSol} SOL`);
              break;
            }
          } catch (balanceErr) {
            console.error(`Failed to fetch from ${endpoint}:`, balanceErr);
          }
        }
      }
      
      console.log("Final SOL balance:", balanceInSol);
      
      setLoading(null);
      onLogin({
        id: `wallet_${publicKey}`,
        walletAddress: publicKey,
        displayName: `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`,
        authMethod: "wallet",
        balance: balanceInSol,
      });
      
    } catch (error: any) {
      console.error("Phantom error:", error);
      setLoading(null);
      
      if (error.code === 4001) {
        setError("Connection request was rejected.");
      } else {
        setError(error.message || "Could not connect to Phantom.");
      }
    }
  };

  // Wallet detection for MetaMask button label
  const hasMetaMask = typeof window !== "undefined" && !!(window as any).ethereum;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Back Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <img src={paragonLogo} alt="Paragon" className="w-12 h-12 mx-auto mb-3" />
          <h1 className="text-2xl font-light text-white tracking-tight">PARAGON</h1>
          <p className="text-gray-500 text-sm mt-1">
            {mode === "signin" ? "Sign in to continue" : "Create your account"}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Email Form */}
        <form onSubmit={handleEmailAuth} className="space-y-3 mb-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-3 bg-[#111] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 bg-[#111] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 text-sm"
          />
          <button
            type="submit"
            disabled={loading === "email"}
            className="w-full py-3 bg-[#4a6fa5] text-white rounded-lg font-medium text-sm hover:bg-[#5a7fb5] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading === "email" && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "signin" ? "Sign In" : "Sign Up"}
          </button>
        </form>

        {/* Google Button */}
        <button
          onClick={handleGoogleAuth}
          disabled={!!loading}
          className="w-full py-3 bg-[#111] border border-gray-800 rounded-lg text-white text-sm hover:border-gray-600 disabled:opacity-50 flex items-center justify-center gap-3 mb-6"
        >
          {loading === "google" ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </button>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-800"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 bg-[#0a0a0a] text-gray-500 text-xs">Sign in with wallet</span>
          </div>
        </div>

        {/* Wallet Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={handleMetaMask}
            disabled={!!loading}
            className="py-3 bg-[#111] border border-gray-800 rounded-lg text-white text-sm hover:border-gray-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading === "metamask" ? <Loader2 className="w-4 h-4 animate-spin" /> : <MetaMaskIcon />}
            <span className="text-xs">{hasMetaMask ? "MetaMask" : "Install"}</span>
          </button>
          <button
            onClick={handlePhantom}
            disabled={!!loading}
            className="py-3 bg-[#111] border border-gray-800 rounded-lg text-white text-sm hover:border-gray-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading === "phantom" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhantomIcon />}
            <span className="text-xs">Phantom</span>
          </button>
        </div>

        {/* Toggle */}
        <p className="text-center text-gray-500 text-xs">
          {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-[#4a6fa5] hover:underline"
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
