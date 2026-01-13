import React, { createContext, useContext, useEffect, useState } from "react";
import {
  useScreenSize,
  ScreenDimensions,
  ResponsiveSizes,
  getResponsiveCSSVars
} from "../hooks/useScreenSize";

interface ScreenSizeContextValue extends ScreenDimensions {
  sizes: ResponsiveSizes;
  isReady: boolean;
}

const ScreenSizeContext = createContext<ScreenSizeContextValue | null>(null);

interface ScreenSizeProviderProps {
  children: React.ReactNode;
  showLoadingScreen?: boolean;
  loadingDelay?: number;
}

/**
 * Loading screen component shown while detecting screen size
 */
function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center z-[9999]">
      <div className="flex flex-col items-center gap-4">
        {/* Animated logo/spinner */}
        <div className="relative">
          <div className="w-16 h-16 border-4 border-gray-800 rounded-full" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-[#4a6fa5] rounded-full animate-spin" />
        </div>

        {/* Loading text */}
        <div className="text-gray-400 text-sm font-light tracking-wide">
          Optimizing for your screen...
        </div>

        {/* Progress dots animation */}
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-[#4a6fa5] rounded-full animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Provider component that wraps the app and provides screen size context
 * Optionally shows a loading screen while detecting screen size
 */
export function ScreenSizeProvider({
  children,
  showLoadingScreen = true,
  loadingDelay = 150
}: ScreenSizeProviderProps) {
  const screenData = useScreenSize();
  const [showLoading, setShowLoading] = useState(showLoadingScreen);

  // Apply CSS custom properties to document root
  useEffect(() => {
    if (screenData.isReady) {
      const cssVars = getResponsiveCSSVars(screenData);
      const root = document.documentElement;

      Object.entries(cssVars).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });

      // Also set data attributes for CSS selectors
      root.dataset.screenSize = screenData.screenSize;
      root.dataset.isMobile = String(screenData.isMobile);
      root.dataset.isTablet = String(screenData.isTablet);
      root.dataset.isDesktop = String(screenData.isDesktop);
      root.dataset.orientation = screenData.isLandscape ? "landscape" : "portrait";
    }
  }, [screenData]);

  // Hide loading screen after a brief delay once ready
  useEffect(() => {
    if (screenData.isReady && showLoading) {
      const timer = setTimeout(() => {
        setShowLoading(false);
      }, loadingDelay);
      return () => clearTimeout(timer);
    }
  }, [screenData.isReady, showLoading, loadingDelay]);

  return (
    <ScreenSizeContext.Provider value={screenData}>
      {showLoading && showLoadingScreen && <LoadingScreen />}
      <div
        className={`transition-opacity duration-300 ${showLoading ? 'opacity-0' : 'opacity-100'}`}
        style={{ minHeight: '100vh' }}
      >
        {children}
      </div>
    </ScreenSizeContext.Provider>
  );
}

/**
 * Hook to access screen size context
 * Must be used within a ScreenSizeProvider
 */
export function useScreenSizeContext(): ScreenSizeContextValue {
  const context = useContext(ScreenSizeContext);
  if (!context) {
    throw new Error("useScreenSizeContext must be used within a ScreenSizeProvider");
  }
  return context;
}

/**
 * HOC to inject screen size props into a component
 */
export function withScreenSize<P extends object>(
  Component: React.ComponentType<P & { screen: ScreenSizeContextValue }>
) {
  return function WrappedComponent(props: P) {
    const screen = useScreenSizeContext();
    return <Component {...props} screen={screen} />;
  };
}
