/**
 * Two Knights Security & Telemetry Engine
 * Extracts client-side device footprints, browser signatures, and geographical data.
 */
(function() {
    let cachedIP = '127.0.0.1';
    let cachedCountry = 'IN'; // Default fallback
    let isFetched = false;

    // Start fetching IP and geo data immediately on load with fallback through local proxy
    async function prefetchGeoData() {
        // Feature removed as /api/geo endpoint is deprecated
        isFetched = true;
    }

    prefetchGeoData();

    // Export public telemetry extractor
    window.extractDeviceTelemetry = function() {
        const userAgent = navigator.userAgent || '';
        
        // 1. Simple, reliable OS extraction
        let os = 'Unknown OS';
        if (/windows/i.test(userAgent)) os = 'Windows';
        else if (/macintosh|mac os x/i.test(userAgent)) os = 'macOS';
        else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';
        else if (/android/i.test(userAgent)) os = 'Android';
        else if (/linux/i.test(userAgent)) os = 'Linux';

        // 2. Browser extraction
        let browser = 'Unknown Browser';
        if (/edg/i.test(userAgent)) browser = 'Edge';
        else if (/chrome/i.test(userAgent) && !/chromium/i.test(userAgent)) browser = 'Chrome';
        else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari';
        else if (/firefox/i.test(userAgent)) browser = 'Firefox';

        return {
            ip: cachedIP,
            userAgent: userAgent,
            browser: browser,
            os: os,
            country: cachedCountry,
            timestamp: new Date().toISOString()
        };
    };
})();
