// Two Knights Security Module - Brute Force Protection
(function() {
  'use strict';
  
  var SECURITY_CONFIG = {
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION_MINUTES: 30,
    WINDOW_MINUTES: 15
  };

  var failedLoginAttempts = {};
  var lockedAccounts = {};

  function initSecurity() {
    console.log('Two Knights Security Module Active');
    loadSecurityState();
  }

  function trackFailedLogin(username, ip) {
    var now = Date.now();
    var key = username.toLowerCase();
    
    if (!failedLoginAttempts[key]) {
      failedLoginAttempts[key] = { attempts: [], ip: ip };
    }
    
    failedLoginAttempts[key].attempts.push(now);
    failedLoginAttempts[key].ip = ip;
    
    var windowStart = now - (SECURITY_CONFIG.WINDOW_MINUTES * 60 * 1000);
    failedLoginAttempts[key].attempts = failedLoginAttempts[key].attempts.filter(function(t) { return t > windowStart; });
    
    var attemptCount = failedLoginAttempts[key].attempts.length;
    
    if (attemptCount >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS) {
      lockAccount(username, ip);
      return { locked: true, reason: 'Too many failed attempts' };
    }
    
    return { locked: false, attemptsRemaining: SECURITY_CONFIG.MAX_FAILED_ATTEMPTS - attemptCount };
  }

  function lockAccount(username, ip) {
    var key = username.toLowerCase();
    var lockExpiry = Date.now() + (SECURITY_CONFIG.LOCKOUT_DURATION_MINUTES * 60 * 1000);
    
    lockedAccounts[key] = {
      lockedAt: Date.now(),
      expiresAt: lockExpiry,
      ip: ip,
      reason: 'Brute force protection'
    };
    
    saveSecurityState();
  }

  function unlockAccount(username) {
    var key = username.toLowerCase();
    if (lockedAccounts[key]) {
      delete lockedAccounts[key];
    }
  }

  function isAccountLocked(username) {
    var key = username.toLowerCase();
    var lock = lockedAccounts[key];
    
    if (!lock) return false;
    
    if (Date.now() > lock.expiresAt) {
      unlockAccount(username);
      return false;
    }
    
    return true;
  }

  function getLockRemainingTime(username) {
    var key = username.toLowerCase();
    var lock = lockedAccounts[key];
    if (!lock) return 0;
    
    var remaining = lock.expiresAt - Date.now();
    return Math.max(0, Math.ceil(remaining / 60000));
  }

  function detectSuspiciousActivity(username, password, ip) {
    var warnings = [];
    
    // Simple pattern checks
    if (password && password.length > 3) {
      if (password.indexOf('admin') === 0 || password.indexOf('root') === 0) {
        warnings.push('Suspicious password pattern');
      }
    }
    
    // Check for SQL injection
    if (username && (username.indexOf("'") > -1 || username.indexOf('union') > -1)) {
      warnings.push('Potential injection');
    }
    
    return warnings;
  }

  function getSecurityStatus() {
    var totalAttempts = 0;
    for (var key in failedLoginAttempts) {
      totalAttempts += failedLoginAttempts[key].attempts.length;
    }
    return {
      totalFailedAttempts: totalAttempts,
      currentlyLocked: Object.keys(lockedAccounts).length
    };
  }

  function clearFailedAttempts(username) {
    var key = username.toLowerCase();
    if (failedLoginAttempts[key]) {
      delete failedLoginAttempts[key];
    }
    saveSecurityState();
  }

  function saveSecurityState() {
    try {
      localStorage.setItem('twoknights_security', JSON.stringify({
        failedAttempts: failedLoginAttempts,
        locked: lockedAccounts
      }));
    } catch (e) {}
  }

  function loadSecurityState() {
    try {
      var saved = localStorage.getItem('twoknights_security');
      if (saved) {
        var data = JSON.parse(saved);
        failedLoginAttempts = data.failedAttempts || {};
        lockedAccounts = data.locked || {};
        
        for (var username in lockedAccounts) {
          if (Date.now() > lockedAccounts[username].expiresAt) {
            delete lockedAccounts[username];
          }
        }
      }
    } catch (e) {}
  }

  // Export to global scope
  window.SecurityModule = {
    trackFailedLogin: trackFailedLogin,
    isAccountLocked: isAccountLocked,
    getLockRemainingTime: getLockRemainingTime,
    detectSuspiciousActivity: detectSuspiciousActivity,
    getSecurityStatus: getSecurityStatus,
    clearFailedAttempts: clearFailedAttempts,
    initSecurity: initSecurity
  };

  // Auto-initialize
  initSecurity();
})();
