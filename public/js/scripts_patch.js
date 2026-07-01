/**
 * Two Knights SCRIPTS PATCH v2.1
 * 
 * Include this AFTER scripts.js in index.html.
 * Fixes: master-only nav visibility, toggleAllStud scope, notification badge.
 */

(function () {
  'use strict';

  /* ── FIX 1: master-only NAV VISIBILITY ──────────────────────────────
   * The original scripts.js applied body.admin-mode for master users,
   * but the CSS rule `body.admin-mode .master-only { display:none }`
   * then hid the Credentials nav item.  We force it visible after login
   * by re-checking every time finishLogin fires (monkey-patched below).
   */
  const _origFinishLogin = window.finishLogin;
  if (typeof _origFinishLogin === 'function') {
    window.finishLogin = function (displayName, userRole, studentId) {
      _origFinishLogin(displayName, userRole, studentId);
      if (userRole === 'master') {
        document.querySelectorAll('.master-only').forEach(el => {
          el.style.removeProperty('display');
          if (el.classList.contains('nav-item')) el.style.display = 'flex';
          else el.style.display = '';
        });
      }
    };
  }

  /* ── FIX 2: toggleAllStud SCOPE ─────────────────────────────────────
   * The HTML calls onclick="toggleAllStud(this)" but the function is
   * wrapped in an IIFE and not in global scope in some builds.
   * Re-expose here as a safe fallback.
   */
  if (typeof window.toggleAllStud !== 'function') {
    window.toggleAllStud = function (ctrl) {
      document.querySelectorAll('.stud-check').forEach(ck => {
        if (!ck.disabled) ck.checked = ctrl.checked;
      });
    };
  }

  /* ── FIX 3: previewFile SCOPE ──────────────────────────────────────
   * Same issue — expose as global fallback.
   */
  if (typeof window.previewFile !== 'function') {
    window.previewFile = function (inp, previewId) {
      const file = inp.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        const img = document.getElementById(previewId);
        if (img) { img.src = e.target.result; img.style.display = 'block'; }
      };
      reader.readAsDataURL(file);
    };
  }

  /* ── FIX 4: onAwardStudentChange SCOPE ─────────────────────────────
   * The <select id="award-student"> uses onchange="onAwardStudentChange()"
   * but the function isn't defined globally in scripts.js.
   */
  if (typeof window.onAwardStudentChange !== 'function') {
    window.onAwardStudentChange = function () {
      const sel = document.getElementById('award-student');
      const sid = document.getElementById('award-sid');
      if (sel && sid) sid.value = sel.value;
    };
  }

  /* ── FIX 5: openPay PARAMS ─────────────────────────────────────────
   * The event card calls openPay('id','title','prize') but prize can be
   * a string like "₹2000" — strip non-numeric chars before using as fee.
   */
  const _origOpenPay = window.openPay;
  if (typeof _origOpenPay === 'function') {
    window.openPay = function (id, name, fee) {
      const numericFee = typeof fee === 'string'
        ? parseInt(fee.replace(/[^\d]/g, ''), 10) || 500
        : (fee || 500);
      _origOpenPay(id, name, numericFee);
    };
  }

  /* ── FIX 6: NOTIFICATION BADGE ON LOAD ─────────────────────────────
   * updateNotificationBadge is called before allMessages is populated
   * on first load. Guard against that race.
   */
  const _origUpdateBadge = window.updateNotificationBadge;
  if (typeof _origUpdateBadge === 'function') {
    window.updateNotificationBadge = function () {
      try { _origUpdateBadge(); } catch (e) { /* silently ignore on early call */ }
    };
  }

  /* ── FIX 7: HERO IMAGE ANIMATION CONFLICT ───────────────────────────
   * styles.css defines .hero-img:hover with transform:scale(1.02),
   * but the second .card rule also tries translateY. Remove conflicting
   * transition from the hero since it's not a card.
   */
  document.querySelectorAll('.hero-img').forEach(img => {
    img.style.transition = 'transform 0.4s cubic-bezier(0.19,1,0.22,1), box-shadow 0.4s ease';
  });

  /* ── FIX 8: capitalizeFirst SCOPE ──────────────────────────────────
   * getStudentLevel uses capitalizeFirst() but it might be undefined
   * in cached versions of scripts.js.
   */
if (typeof window.capitalizeFirst !== 'function') {
     window.capitalizeFirst = function (str) {
       if (!str || typeof str !== 'string') return '';
       return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
     };
   }

  /* ── FIX 9: MESSAGE FUNCTIONS EXPOSURE ───────────────────────────────
   * deleteMsg, markMsgRead, replyToMessage, sendMsg, sendFeedback are
   * defined inside scripts.js IIFE but called via inline onclick handlers.
   * Expose them as no-ops if scripts.js hasn't loaded them yet.
   */
   window.deleteMsg = window.deleteMsg || async function(id, btnEl) {
     console.warn('[Patch] deleteMsg called before scripts.js loaded');
     if (typeof window.apiCall === 'function') {
       try {
         const res = await window.apiCall(`${API_BASE}/messages?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
         if (res && res.ok) {
           if (window.toast) window.toast('Message deleted', 'success');
           if (window.loadAllData) window.loadAllData(true);
         } else {
           const err = await res.json().catch(() => ({}));
           throw new Error(err.error || 'Delete failed');
         }
       } catch (e) {
         if (window.toast) window.toast('Failed to delete: ' + (e.message || 'connection error'), 'error');
       }
     }
   };

   window.markMsgRead = window.markMsgRead || async function(id) {
     if (typeof window.apiCall !== 'function') return;
     try {
       const res = await window.apiCall(`${API_BASE}/messages?id=${encodeURIComponent(id)}`, { 
         method: 'PUT', 
         body: JSON.stringify({ is_read: true }) 
       });
       if (res && res.ok) {
         if (window.loadAllData) window.loadAllData(true);
       }
     } catch (e) {
       if (window.toast) window.toast('Failed to mark as read', 'error');
     }
   };

   window.replyToMessage = window.replyToMessage || function(encodedId) {
     console.warn('[Patch] replyToMessage called before scripts.js loaded');
   };

   window.sendMsg = window.sendMsg || async function() {
     console.warn('[Patch] sendMsg called before scripts.js loaded');
   };

   window.sendFeedback = window.sendFeedback || async function() {
     console.warn('[Patch] sendFeedback called before scripts.js loaded');
   };

   console.log('[Two Knights Patch v2.1] Applied successfully.');
})();
