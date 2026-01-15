import paragonLogo from '../../assets/paragon-logo.png';

/**
 * MobileBlockScreen - Prevents usage on mobile devices
 * Shows a full-screen overlay with instructions to use on PC
 * 
 * Detection: Uses viewport width (< 768px)
 * Easy to toggle: Just remove this component from App.tsx to disable
 */
export function MobileBlockScreen() {
    return (
        <div className="mobile-block-screen">
            {/* Logo */}
            <img
                src={paragonLogo}
                alt="Paragon"
                className="mobile-block-logo"
            />

            {/* Message */}
            <h1 className="mobile-block-title">
                Use on PC for best experience
            </h1>

            {/* Subtle hint */}
            <p className="mobile-block-subtitle">
                Paragon is optimized for desktop browsers
            </p>
        </div>
    );
}

/**
 * Hook to detect if user is on mobile
 * Uses CSS media query for consistent behavior with styles
 */
export function useIsMobile(): boolean {
    if (typeof window === 'undefined') return false;

    // Check viewport width
    const isMobileViewport = window.innerWidth < 768;

    // Also check user agent for mobile devices
    const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );

    return isMobileViewport || isMobileUserAgent;
}
