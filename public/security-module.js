// Two Knights Security Module
// ==========================================
// WARNING: The previous client-side brute force protection mechanism using localStorage 
// has been removed. Client-side security mechanisms that rely on localStorage can be 
// bypassed by an attacker simply by clearing their browser cache or using an incognito window.
//
// All rate-limiting and brute-force protection MUST be handled by the backend.
// Currently, this is enforced via Supabase Edge Functions and PostgreSQL rate_limits table.

(function() {
  'use strict';
  
  function initSecurity() {
    console.log('Two Knights Security Module Active (Server-Side Enforcement)');
  }

  // Export empty/stub functions to prevent breaking existing code that calls them
  window.SecurityModule = {
    trackFailedLogin: function() { return { locked: false, attemptsRemaining: 99 }; },
    isAccountLocked: function() { return false; },
    getLockRemainingTime: function() { return 0; },
    detectSuspiciousActivity: function() { return []; },
    getSecurityStatus: function() { return { totalFailedAttempts: 0, currentlyLocked: 0 }; },
    clearFailedAttempts: function() {},
    initSecurity: initSecurity
  };

  // Auto-initialize
  initSecurity();
})();
