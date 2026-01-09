import React, { useState } from "react";
import { X, Mail, Wallet, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = "select" | "email" | "signup";

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { loginWithEmail, loginWithGoogle, loginWithWallet, isLoading } = useAuth();
  const [mode, setMode] = useState<AuthMode>("select");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  if (!isOpen) return null;

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }
    
    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    
    try {
      setIsConnecting(true);
      await loginWithEmail(email, password);
      onClose();
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    try {
      setIsConnecting(true);
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      if (err.message !== "Cancelled") {
        setError(err.message || "Google login failed");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleWalletLogin = async () => {
    setError("");
    try {
      setIsConnecting(true);
      await loginWithWallet();
      onClose();
    } catch (err: any) {
      setError(err.message || "Wallet connection failed");
    } finally {
      setIsConnecting(false);
    }
  };

  const resetModal = () => {
    setMode("select");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setShowPassword(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gradient-to-br from-[#141414] to-[#0a0a0a] border border-gray-800/50 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-800/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4a6fa5] to-[#3a5f95] flex items-center justify-center">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <div>
              <h2 className="text-xl font-light text-gray-100 tracking-tight">
                {mode === "select" && "Welcome to Paragon"}
                {mode === "email" && "Sign In"}
                {mode === "signup" && "Create Account"}
              </h2>
              <p className="text-sm text-gray-500 font-light">
                {mode === "select" && "Connect to access your portfolio"}
                {mode === "email" && "Enter your credentials"}
                {mode === "signup" && "Create a new account"}
              </p>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-8">
          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          {mode === "select" && (
            <div className="space-y-3">
              {/* Wallet Connection */}
              <button
                onClick={handleWalletLogin}
                disabled={isConnecting}
                className="w-full p-4 bg-gradient-to-r from-[#1a1a1a] to-[#0f0f0f] border border-gray-700/50 rounded-xl hover:border-[#4a6fa5]/50 hover:bg-gradient-to-r hover:from-[#1f1f1f] hover:to-[#141414] transition-all duration-200 group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/20 flex items-center justify-center group-hover:border-orange-500/40 transition-colors">
                    <Wallet className="w-6 h-6 text-orange-400" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-gray-100 font-medium text-[15px]">Connect Wallet</div>
                    <div className="text-gray-500 text-xs font-light">MetaMask, WalletConnect, Coinbase</div>
                  </div>
                  {isConnecting && <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />}
                </div>
              </button>
              
              {/* Google Login */}
              <button
                onClick={handleGoogleLogin}
                disabled={isConnecting}
                className="w-full p-4 bg-gradient-to-r from-[#1a1a1a] to-[#0f0f0f] border border-gray-700/50 rounded-xl hover:border-[#4a6fa5]/50 hover:bg-gradient-to-r hover:from-[#1f1f1f] hover:to-[#141414] transition-all duration-200 group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-gray-700/50 flex items-center justify-center group-hover:border-gray-600/50 transition-colors">
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-gray-100 font-medium text-[15px]">Continue with Google</div>
                    <div className="text-gray-500 text-xs font-light">Use your Google account</div>
                  </div>
                  {isConnecting && <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />}
                </div>
              </button>
              
              {/* Email Login */}
              <button
                onClick={() => setMode("email")}
                disabled={isConnecting}
                className="w-full p-4 bg-gradient-to-r from-[#1a1a1a] to-[#0f0f0f] border border-gray-700/50 rounded-xl hover:border-[#4a6fa5]/50 hover:bg-gradient-to-r hover:from-[#1f1f1f] hover:to-[#141414] transition-all duration-200 group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#4a6fa5]/20 to-[#4a6fa5]/10 border border-[#4a6fa5]/20 flex items-center justify-center group-hover:border-[#4a6fa5]/40 transition-colors">
                    <Mail className="w-6 h-6 text-[#4a6fa5]" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-gray-100 font-medium text-[15px]">Sign in with Email</div>
                    <div className="text-gray-500 text-xs font-light">Use email and password</div>
                  </div>
                </div>
              </button>
              
              <p className="text-center text-gray-500 text-xs pt-4">
                Don't have an account?{" "}
                <button 
                  onClick={() => setMode("signup")}
                  className="text-[#4a6fa5] hover:text-[#5a7fb5] transition-colors"
                >
                  Sign up
                </button>
              </p>
            </div>
          )}
          
          {(mode === "email" || mode === "signup") && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2 font-light">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-gray-800 rounded-lg text-gray-100 placeholder-gray-600 focus:outline-none focus:border-[#4a6fa5]/50 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2 font-light">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-gray-800 rounded-lg text-gray-100 placeholder-gray-600 focus:outline-none focus:border-[#4a6fa5]/50 transition-colors pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              {mode === "signup" && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2 font-light">Confirm Password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-gray-800 rounded-lg text-gray-100 placeholder-gray-600 focus:outline-none focus:border-[#4a6fa5]/50 transition-colors"
                  />
                </div>
              )}
              
              <button
                type="submit"
                disabled={isConnecting}
                className="w-full py-3 bg-gradient-to-r from-[#4a6fa5] to-[#3a5f95] text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{mode === "signup" ? "Creating Account..." : "Signing In..."}</span>
                  </>
                ) : (
                  <span>{mode === "signup" ? "Create Account" : "Sign In"}</span>
                )}
              </button>
              
              <div className="flex items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setMode("select")}
                  className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
                >
                  ← Back to options
                </button>
                <div className="flex-1" />
                {mode === "email" ? (
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="text-[#4a6fa5] hover:text-[#5a7fb5] text-sm transition-colors"
                  >
                    Create account
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMode("email")}
                    className="text-[#4a6fa5] hover:text-[#5a7fb5] text-sm transition-colors"
                  >
                    Already have account
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-8 pb-8">
          <p className="text-center text-gray-600 text-xs">
            By continuing, you agree to Paragon's Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
