/**
 * COMPREHENSIVE FIXES FOR SCRIPTS.JS
 * 
 * Fixes:
 * #3  - Invalidate totalPaymentsMap after markPaid
 * #4  - Invalidate totalPaymentsMap after bulkMarkPaid  
 * #5  - Always rebuild map in sendPaymentReminder (don't trust stale cache)
 * #7  - Sync window.currentStudent when local currentStudent changes
 * #8  - Guard exportData against missing XLSX
 * #15 - Guard syncBillMonth against missing bill-body DOM
 */

// ─────────────────────────────────────────────────────────────
// FIX #3 & #4 — Invalidate totalPaymentsMap in markPaid
// ─────────────────────────────────────────────────────────────
// Find the existing window.markPaid function (around line 3029) and
// add window.totalPaymentsMap = null; before loadAllData(true)
//
// Current code at line 3062:
//   await loadAllData(true);
//
// Change to:
//   window.totalPaymentsMap = null;  // FIX #3: Invalidate cache
//   await loadAllData(true);
//
// ─────────────────────────────────────────────────────────────
// FIX #4 — Invalidate totalPaymentsMap in bulkMarkPaid
// ─────────────────────────────────────────────────────────────
// Find bulkMarkPaid function (around line 3374) and add:
//   window.totalPaymentsMap = null;  // FIX #4: Invalidate cache
// before loadAllData(true) at line 3418
//
// ─────────────────────────────────────────────────────────────
// FIX #5 — Always rebuild map in sendPaymentReminder
// ─────────────────────────────────────────────────────────────
// Replace lines 444-452 in sendPaymentReminder:
//   if (!window.totalPaymentsMap) {
//     window.totalPaymentsMap = {};
//     (allPayments || []).forEach(p => {
//       const sid = String(p.student_id || '').trim().toLowerCase();
//       if (!sid) return;
//       if (!window.totalPaymentsMap[sid]) window.totalPaymentsMap[sid] = 0;
//       window.totalPaymentsMap[sid]++;
//     });
//   }
//
// With:
//   // FIX #5: Always rebuild — never trust a cached map for financial calculations
//   const freshPaymentsMap = {};
//   (allPayments || []).forEach(p => {
//     if (p.status === 'paid') {
//       const sid = String(p.student_id || '').trim().toLowerCase();
//       if (sid) freshPaymentsMap[sid] = (freshPaymentsMap[sid] || 0) + 1;
//     }
//   });
//   // Use freshPaymentsMap instead of window.totalPaymentsMap below
//
// Then replace all uses of window.totalPaymentsMap[s_id_key] with freshPaymentsMap[s_id_key]
//
// ─────────────────────────────────────────────────────────────
// FIX #7 — Sync window.currentStudent
// ─────────────────────────────────────────────────────────────
// Add this helper function near the top (after line 64 where currentStudent is declared):
function setCurrentStudent(student) {
  currentStudent = student;
  window.currentStudent = student;
}
//
// Then replace every assignment to currentStudent with setCurrentStudent():
// - Line 1506: currentStudent = allStudents.find(...) → setCurrentStudent(allStudents.find(...))
//
// Also update line 4661 to use the local variable (it already does, so no change needed)
//
// ─────────────────────────────────────────────────────────────
// FIX #8 — Guard exportData against missing XLSX
// ─────────────────────────────────────────────────────────────
// At the start of exportData() function (line 4457), add:
//   if (typeof XLSX === 'undefined') {
//     toast('Export library not loaded yet. Please wait a moment and try again.', 'error');
//     return;
//   }
//
// ─────────────────────────────────────────────────────────────
// FIX #15 — Guard syncBillMonth against missing DOM
// ─────────────────────────────────────────────────────────────
// Replace window.syncBillMonth function (line 3250):
//   window.syncBillMonth = function(val) {
//     if (!val) return;
//     window.updateReportContext(val);
//   };
//
// With:
//   window.syncBillMonth = function(val) {
//     if (!val) return;
//     // FIX #15: Only trigger renderBills if the bills page DOM is present
//     const billBody = document.getElementById('bill-body');
//     if (!billBody) {
//       // Page not active — just update the global context
//       const parts = val.split('-');
//       if (parts.length >= 2) {
//         window.reportYear = parseInt(parts[0]);
//         window.reportMonth = parseInt(parts[1]) - 1;
//       }
//       return;
//     }
//     window.updateReportContext(val);
//   };
//
// ─────────────────────────────────────────────────────────────
// ADDITIONAL FIX — cleanText in automation.js
// ─────────────────────────────────────────────────────────────
// The automation.js module defines its own cleanText function.
// This is fine — it doesn't rely on scripts.js's version.
// No change needed.
//
// ─────────────────────────────────────────────────────────────
// ADDITIONAL FIX — window.currentStudent initialization
// ─────────────────────────────────────────────────────────────
// At line 4661, window.currentStudent is set to the local currentStudent.
// This is correct for initialization. The sync happens via setCurrentStudent().
//
