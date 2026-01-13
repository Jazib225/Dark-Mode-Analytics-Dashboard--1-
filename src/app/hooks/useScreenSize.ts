import { useState, useEffect, useCallback, useMemo } from "react";

// Screen size breakpoints matching Tailwind defaults
export type ScreenSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

export interface ScreenDimensions {
  width: number;
  height: number;
  screenSize: ScreenSize;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  aspectRatio: number;
  isLandscape: boolean;
  isPortrait: boolean;
  pixelDensity: number;
  isHiDPI: boolean;
}

export interface ResponsiveSizes {
  // Text sizes
  textXs: string;
  textSm: string;
  textBase: string;
  textLg: string;
  textXl: string;
  text2xl: string;
  text3xl: string;

  // Spacing
  spacingXs: string;
  spacingSm: string;
  spacingMd: string;
  spacingLg: string;
  spacingXl: string;

  // Component sizes
  iconSm: number;
  iconMd: number;
  iconLg: number;
  buttonHeight: string;
  inputHeight: string;
  cardPadding: string;

  // Grid columns
  gridCols: number;

  // Canvas/Chart sizes
  canvasScale: number;
  nodeWidth: number;
  nodeHeight: number;
}

// Breakpoint thresholds (matching Tailwind)
const BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

/**
 * Determines the current screen size category based on window width
 */
function getScreenSize(width: number): ScreenSize {
  if (width >= BREAKPOINTS["2xl"]) return "2xl";
  if (width >= BREAKPOINTS.xl) return "xl";
  if (width >= BREAKPOINTS.lg) return "lg";
  if (width >= BREAKPOINTS.md) return "md";
  if (width >= BREAKPOINTS.sm) return "sm";
  return "xs";
}

/**
 * Calculates responsive sizes based on screen dimensions
 * Uses AI-optimized scaling factors for different screen sizes
 */
function calculateResponsiveSizes(dimensions: ScreenDimensions): ResponsiveSizes {
  const { screenSize } = dimensions;

  // Screen-size specific configurations
  const configs: Record<ScreenSize, ResponsiveSizes> = {
    xs: {
      textXs: "text-[10px]",
      textSm: "text-[11px]",
      textBase: "text-xs",
      textLg: "text-sm",
      textXl: "text-base",
      text2xl: "text-lg",
      text3xl: "text-xl",
      spacingXs: "p-1",
      spacingSm: "p-1.5",
      spacingMd: "p-2",
      spacingLg: "p-3",
      spacingXl: "p-4",
      iconSm: 12,
      iconMd: 14,
      iconLg: 18,
      buttonHeight: "h-7",
      inputHeight: "h-8",
      cardPadding: "p-2",
      gridCols: 1,
      canvasScale: 0.6,
      nodeWidth: 120,
      nodeHeight: 60,
    },
    sm: {
      textXs: "text-[11px]",
      textSm: "text-xs",
      textBase: "text-sm",
      textLg: "text-base",
      textXl: "text-lg",
      text2xl: "text-xl",
      text3xl: "text-2xl",
      spacingXs: "p-1.5",
      spacingSm: "p-2",
      spacingMd: "p-2.5",
      spacingLg: "p-4",
      spacingXl: "p-5",
      iconSm: 14,
      iconMd: 16,
      iconLg: 20,
      buttonHeight: "h-8",
      inputHeight: "h-9",
      cardPadding: "p-2.5",
      gridCols: 1,
      canvasScale: 0.7,
      nodeWidth: 140,
      nodeHeight: 70,
    },
    md: {
      textXs: "text-xs",
      textSm: "text-sm",
      textBase: "text-sm",
      textLg: "text-base",
      textXl: "text-lg",
      text2xl: "text-xl",
      text3xl: "text-2xl",
      spacingXs: "p-2",
      spacingSm: "p-2.5",
      spacingMd: "p-3",
      spacingLg: "p-4",
      spacingXl: "p-6",
      iconSm: 14,
      iconMd: 18,
      iconLg: 22,
      buttonHeight: "h-9",
      inputHeight: "h-10",
      cardPadding: "p-3",
      gridCols: 2,
      canvasScale: 0.8,
      nodeWidth: 150,
      nodeHeight: 75,
    },
    lg: {
      textXs: "text-xs",
      textSm: "text-sm",
      textBase: "text-base",
      textLg: "text-lg",
      textXl: "text-xl",
      text2xl: "text-2xl",
      text3xl: "text-3xl",
      spacingXs: "p-2",
      spacingSm: "p-3",
      spacingMd: "p-4",
      spacingLg: "p-5",
      spacingXl: "p-6",
      iconSm: 16,
      iconMd: 20,
      iconLg: 24,
      buttonHeight: "h-10",
      inputHeight: "h-11",
      cardPadding: "p-4",
      gridCols: 2,
      canvasScale: 0.9,
      nodeWidth: 160,
      nodeHeight: 80,
    },
    xl: {
      textXs: "text-xs",
      textSm: "text-sm",
      textBase: "text-base",
      textLg: "text-lg",
      textXl: "text-xl",
      text2xl: "text-2xl",
      text3xl: "text-3xl",
      spacingXs: "p-2",
      spacingSm: "p-3",
      spacingMd: "p-4",
      spacingLg: "p-6",
      spacingXl: "p-8",
      iconSm: 16,
      iconMd: 20,
      iconLg: 24,
      buttonHeight: "h-10",
      inputHeight: "h-11",
      cardPadding: "p-4",
      gridCols: 3,
      canvasScale: 1,
      nodeWidth: 160,
      nodeHeight: 80,
    },
    "2xl": {
      textXs: "text-sm",
      textSm: "text-sm",
      textBase: "text-base",
      textLg: "text-lg",
      textXl: "text-xl",
      text2xl: "text-2xl",
      text3xl: "text-4xl",
      spacingXs: "p-2.5",
      spacingSm: "p-3",
      spacingMd: "p-5",
      spacingLg: "p-6",
      spacingXl: "p-8",
      iconSm: 18,
      iconMd: 22,
      iconLg: 28,
      buttonHeight: "h-11",
      inputHeight: "h-12",
      cardPadding: "p-5",
      gridCols: 3,
      canvasScale: 1.1,
      nodeWidth: 180,
      nodeHeight: 90,
    },
  };

  return configs[screenSize];
}

/**
 * Custom hook for responsive screen size detection
 * Automatically updates when window is resized
 */
export function useScreenSize(): ScreenDimensions & { sizes: ResponsiveSizes; isReady: boolean } {
  const [isReady, setIsReady] = useState(false);
  const [dimensions, setDimensions] = useState<ScreenDimensions>(() => {
    // SSR-safe initial values
    if (typeof window === "undefined") {
      return {
        width: 1920,
        height: 1080,
        screenSize: "xl" as ScreenSize,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isLargeDesktop: false,
        aspectRatio: 16 / 9,
        isLandscape: true,
        isPortrait: false,
        pixelDensity: 1,
        isHiDPI: false,
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const screenSize = getScreenSize(width);
    const pixelDensity = window.devicePixelRatio || 1;

    return {
      width,
      height,
      screenSize,
      isMobile: screenSize === "xs" || screenSize === "sm",
      isTablet: screenSize === "md",
      isDesktop: screenSize === "lg" || screenSize === "xl",
      isLargeDesktop: screenSize === "2xl",
      aspectRatio: width / height,
      isLandscape: width > height,
      isPortrait: height > width,
      pixelDensity,
      isHiDPI: pixelDensity > 1,
    };
  });

  const updateDimensions = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const screenSize = getScreenSize(width);
    const pixelDensity = window.devicePixelRatio || 1;

    setDimensions({
      width,
      height,
      screenSize,
      isMobile: screenSize === "xs" || screenSize === "sm",
      isTablet: screenSize === "md",
      isDesktop: screenSize === "lg" || screenSize === "xl",
      isLargeDesktop: screenSize === "2xl",
      aspectRatio: width / height,
      isLandscape: width > height,
      isPortrait: height > width,
      pixelDensity,
      isHiDPI: pixelDensity > 1,
    });
  }, []);

  useEffect(() => {
    // Initial measurement
    updateDimensions();
    setIsReady(true);

    // Debounced resize handler for performance
    let timeoutId: ReturnType<typeof setTimeout>;
    const debouncedUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateDimensions, 100);
    };

    window.addEventListener("resize", debouncedUpdate);
    window.addEventListener("orientationchange", updateDimensions);

    // Also listen for zoom changes via media query
    const mediaQuery = window.matchMedia("(resolution: 1dppx)");
    const handleMediaChange = () => updateDimensions();
    mediaQuery.addEventListener?.("change", handleMediaChange);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", debouncedUpdate);
      window.removeEventListener("orientationchange", updateDimensions);
      mediaQuery.removeEventListener?.("change", handleMediaChange);
    };
  }, [updateDimensions]);

  const sizes = useMemo(() => calculateResponsiveSizes(dimensions), [dimensions]);

  return { ...dimensions, sizes, isReady };
}

/**
 * Hook to get just the screen size category
 */
export function useBreakpoint(): ScreenSize {
  const { screenSize } = useScreenSize();
  return screenSize;
}

/**
 * Hook to check if screen matches a minimum breakpoint
 */
export function useMinBreakpoint(breakpoint: ScreenSize): boolean {
  const { width } = useScreenSize();
  return width >= BREAKPOINTS[breakpoint];
}

/**
 * Hook to check if screen is below a breakpoint
 */
export function useMaxBreakpoint(breakpoint: ScreenSize): boolean {
  const { width } = useScreenSize();
  return width < BREAKPOINTS[breakpoint];
}

/**
 * Utility to get responsive value based on screen size
 */
export function getResponsiveValue<T>(
  screenSize: ScreenSize,
  values: Partial<Record<ScreenSize, T>> & { default: T }
): T {
  // Check from current size down to find a matching value
  const sizes: ScreenSize[] = ["2xl", "xl", "lg", "md", "sm", "xs"];
  const currentIndex = sizes.indexOf(screenSize);

  for (let i = currentIndex; i < sizes.length; i++) {
    const size = sizes[i];
    if (values[size] !== undefined) {
      return values[size]!;
    }
  }

  return values.default;
}

/**
 * CSS custom properties that can be set on :root for responsive values
 */
export function getResponsiveCSSVars(dimensions: ScreenDimensions): Record<string, string> {
  const sizes = calculateResponsiveSizes(dimensions);

  return {
    "--screen-width": `${dimensions.width}px`,
    "--screen-height": `${dimensions.height}px`,
    "--icon-sm": `${sizes.iconSm}px`,
    "--icon-md": `${sizes.iconMd}px`,
    "--icon-lg": `${sizes.iconLg}px`,
    "--canvas-scale": `${sizes.canvasScale}`,
    "--node-width": `${sizes.nodeWidth}px`,
    "--node-height": `${sizes.nodeHeight}px`,
    "--grid-cols": `${sizes.gridCols}`,
  };
}

export { BREAKPOINTS };
