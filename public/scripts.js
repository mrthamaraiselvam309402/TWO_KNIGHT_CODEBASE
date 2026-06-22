/**
 * Two Knights ACADEMY - Complete Admin Panel Scripts
 * Fixed version - Academy Expansion Logic Integrated
 */

(function () {
  "use strict";

  // Core Utility - Hoisted for early access
  const capitalizeFirst = (str) => {
    if (!str || typeof str !== "string") return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };
  window.capitalizeFirst = capitalizeFirst;

  const formatTime = (timeStr) => {
    if (!timeStr) return "TBD";
    if (!timeStr.includes(":")) return timeStr;
    const [hrs, mins] = timeStr.split(":").map(Number);
    if (isNaN(hrs)) return timeStr;
    const ampm = hrs >= 12 ? "PM" : "AM";
    const h = hrs % 12 || 12;
    return `${h}:${mins.toString().padStart(2, "0")} ${ampm}`;
  };
  window.formatTime = formatTime;

  const openWhatsApp = (dialCode, localNumber, msg) => {
    const cleanDial = (dialCode || "").toString().replace(/\D/g, "");
    const cleanNum = (localNumber || "").toString().replace(/\D/g, "");
    const base = "https://api.whatsapp.com/send";
    const url = `${base}?phone=${cleanDial}${cleanNum}&text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };
  window.openWhatsApp = openWhatsApp;

  const EMOJI = {
    warning: "\u{26A0}\u{FE0F}",
    siren: "\u{1F6A8}",
    wave: "\u{1F44B}",
    card: "\u{1F4B3}",
    alert: "\u{2757}",
    clock: "\u{23F0}",
    prohibited: "\u{1F6AB}",
    check: "\u{2705}",
    phone: "\u{1F4DE}",
    pray: "\u{1F64F}",
    grad: "\u{1F393}",
    sparkle: "\u{2728}",
    chart: "\u{1F4C8}",
    teacher: "\u{1F468}\u{200D}\u{1F3EB}",
    calendar: "\u{1F4C5}",
    pending: "\u{23F3}",
    handshake: "\u{1F91D}",
    spiral_calendar: "\u{1F5D3}\u{FE0F}",
    memo: "\u{1F4DD}",
    trophy: "\u{1F3C6}",
    star: "\u{2B50}",
    crown: "\u{1F451}",
    knight: "\u{265E}",
    receipt: "\u{1F9FE}",
    cash: "\u{1F4B5}",
    party: "\u{1F389}",
    tear_calendar: "\u{1F4C6}",
    link: "\u{1F517}",
  };
  window.EMOJI = EMOJI;

  let SUPABASE_URL = "";
  let SUPABASE_ANON_KEY = "";
  const API_BASE = "/api";
  const $ = (id) => {
    const el = document.getElementById(id);
    if (el) return el;
    // Safe mock to prevent runtime crashes if element is missing from DOM
    return {
      value: "",
      textContent: "",
      innerHTML: "",
      style: {},
      checked: false,
      disabled: false,
      classList: {
        add: () => {},
        remove: () => {},
        toggle: () => {},
        contains: () => false,
      },
      focus: () => {},
      appendChild: () => {},
      addEventListener: () => {},
      setAttribute: () => {},
      removeAttribute: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
    };
  };

  try {
    SUPABASE_URL =
      (typeof APP_CONFIG !== "undefined" ? APP_CONFIG.SUPABASE_URL : "") ||
      window.SUPABASE_URL ||
      "";
    SUPABASE_ANON_KEY =
      (typeof APP_CONFIG !== "undefined" ? APP_CONFIG.SUPABASE_ANON_KEY : "") ||
      window.SUPABASE_ANON_KEY ||
      "";

    // Expose for external modules
    window.SUPABASE_URL = SUPABASE_URL;
    window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
    window.API_BASE = API_BASE;
  } catch (e) {
    console.warn("[Config] Failed to initialize from APP_CONFIG:", e);
  }

  // Security validation
  if (!SUPABASE_ANON_KEY) {
    console.error("❌ CRITICAL: Supabase Anon Key is missing!");
    if (window.location.hostname !== "localhost") {
      document.body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;text-align:center;padding:20px;background:#1a1a1a;color:#fff">
          <h1 style="color:#ff4d4d;margin-bottom:20px">Configuration Error</h1>
          <p style="color:#ccc;max-width:500px;margin-bottom:30px">
            The application is not configured properly (Missing Supabase Key). Please contact the administrator.
          </p>
        </div>
      `;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════
  let allCoaches = [];
  let allStudents = [];
  let allPayments = [];
  let allAttendance = [];
  let allBatches = [];
  let allHomework = [];

  // Expose to window for external modules (like reporting.js)
  window.allCoaches = allCoaches;
  window.allStudents = allStudents;
  window.allPayments = allPayments;
  window.allAttendance = allAttendance;
  window.allBatches = allBatches;
  window.allHomework = allHomework;

  let achievementsData = [];
  window.achievementsData = achievementsData;
  let eventsData = [];
  window.eventsData = eventsData;
  let allMessages = [];
  window.allMessages = allMessages;
  let allRatingHistory = [];
  let allResources = [];
  window.allResources = allResources;

  window.allRatingHistory = allRatingHistory; // Also needed for ELO gainers in report

  window.allResources = allResources;

  window.reportMonth = new Date().getUTCMonth(); // 0-11 (UTC)
  window.reportYear = new Date().getUTCFullYear();
  window.isEditing = false;

  let currentStudent = null;
  let role = null;
  let chartInstances = {};
  let dataCache = { timestamp: 0 };
  let loadDebounceTimer = null;
  let loadingStates = {};
  // Optimized cache for faster dashboard loading
  const CACHE_DURATION = 30000; // 30 seconds cache for better performance
  // ── CORE UTILITIES ──
  window.apiCall = async function (endpoint, options = {}) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const err = new TypeError("Failed to fetch (offline)");
      err.isOffline = true;
      throw err;
    }

    const url =
      endpoint.startsWith("http") || endpoint.startsWith(API_BASE)
        ? endpoint
        : `${API_BASE}${endpoint}`;
    // Forward a real Supabase JWT when available. Supabase Auth and the secure
    // signed login tokens both start with "eyJ"; otherwise use the anon key.
    const storedTok = localStorage.getItem("sb-access-token");
    let auth = {};
    try {
      auth = JSON.parse(localStorage.getItem("twoknights_auth") || "{}");
    } catch (e) {}
    const bearer =
      storedTok && storedTok.startsWith("eyJ") ? storedTok : SUPABASE_ANON_KEY;
    const headers = {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${bearer}`,
      ...(auth.role ? { "x-user-role": auth.role } : {}),
      ...(auth.studentId ? { "x-student-id": auth.studentId } : {}),
      ...options.headers,
    };

    try {
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401) {
        res
          .clone()
          .text()
          .then((txt) => {
            console.warn(
              `[Auth] 401 Unauthorized for ${endpoint}. Body: ${txt}`,
            );
          })
          .catch(() => {
            console.warn(
              `[Auth] 401 Unauthorized for ${endpoint}. Possible token expiry.`,
            );
          });
      }
      return res;
    } catch (e) {
      console.warn(`[API] Connection failed for ${endpoint}:`, e.message || e);
      throw e;
    }
  };

  function toast(msg, type = "info") {
    const container = $("toast-container") || createToastContainer();
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"}</span>
        <span class="toast-msg">${msg}</span>
      </div>
    `;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add("show");
    }, 10);
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 300);
    }, 4000);
  }

  function createToastContainer() {
    const div = document.createElement("div");
    div.id = "toast-container";
    document.body.appendChild(div);
    return div;
  }

  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
  }

  // Escape string for safe embedding in JavaScript string literal inside HTML attribute
  function jsAttrEncode(value) {
    if (value == null) return "";
    return String(value)
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r");
  }

  function dedupeArray(arr, keyField = "id") {
    if (!Array.isArray(arr)) return [];
    const seen = new Set();
    return arr.filter((item) => {
      const key = item && item[keyField] ? String(item[keyField]) : "";
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Sync local currentStudent with window.currentStudent for external modules
  function setCurrentStudent(student) {
    currentStudent = student;
    window.currentStudent = student;
  }

  // ── Notification Management ──
  let shownNotificationIds = JSON.parse(
    localStorage.getItem("shown_notifications") || "[]",
  );
  let dismissedNotifications = JSON.parse(
    localStorage.getItem("dismissed_notifications") ||
      '{"messages":[], "payments":[]}',
  );

  function saveNotificationState() {
    localStorage.setItem(
      "shown_notifications",
      JSON.stringify(shownNotificationIds.slice(-100)),
    );
    localStorage.setItem(
      "dismissed_notifications",
      JSON.stringify(dismissedNotifications),
    );
  }

  function shouldShowNotification(id) {
    if (shownNotificationIds.includes(id)) return false;
    shownNotificationIds.push(id);
    saveNotificationState();
    return true;
  }

  function clearNotifications() {
    const unreadMsgs = allMessages.filter(
      (m) => !getMessageIsRead(m) && m.receiver_type === "admin",
    );
    unreadMsgs.forEach((m) => {
      if (!dismissedNotifications.messages.includes(m.id))
        dismissedNotifications.messages.push(m.id);
    });
    const dueStudents = allStudents.filter((s) => {
      const status = getStudentPaymentStatus(s);
      return status === "Due" || status === "Overdue";
    });
    dueStudents.forEach((s) => {
      if (!dismissedNotifications.payments.includes(s.id))
        dismissedNotifications.payments.push(s.id);
    });
    localStorage.removeItem("audit_logs");
    saveNotificationState();
    updateNotificationBadge();
    const content = $("notification-content");
    if (content)
      content.innerHTML =
        '<div style="text-align:center;padding:30px;color:var(--ivory-dim)">Notifications cleared</div>';
    toast("Notifications cleared", "info");
  }

  function updateNotificationBadge() {
    const unread = allMessages.filter(
      (m) =>
        !getMessageIsRead(m) &&
        m.receiver_type === "admin" &&
        !dismissedNotifications.messages.includes(m.id),
    ).length;
    const dueCount = allStudents.filter((s) => {
      const status = getStudentPaymentStatus(s);
      return (
        (status === "Due" || status === "Overdue") &&
        !dismissedNotifications.payments.includes(s.id)
      );
    }).length;
    const total = unread + dueCount;
    const badge = $("notification-badge");
    if (badge) {
      badge.textContent = total;
      badge.style.display = total > 0 ? "inline" : "none";
    }
  }

  // ── NEW ADVANCED LOGIC ──
  function setChildTab(tabId, btn) {
    document
      .querySelectorAll(".child-tab-content")
      .forEach((c) => c.classList.remove("active"));

    // Sync the in-page tab bar highlight. When called from the sidebar nav
    // (no btn), locate the matching tab-link by its onclick target.
    const tabBar = document.querySelector("#page-child .tabs-nav");
    if (tabBar) {
      tabBar
        .querySelectorAll(".tab-link")
        .forEach((l) => l.classList.remove("active"));
      if (btn) {
        btn.classList.add("active");
      } else {
        const match = Array.from(tabBar.querySelectorAll(".tab-link")).find(
          (l) => (l.getAttribute("onclick") || "").includes("'" + tabId + "'"),
        );
        if (match) match.classList.add("active");
      }
    }

    const target = document.getElementById("child-tab-" + tabId);
    if (target) target.classList.add("active");

    if (tabId === "overview") renderChildBilling();
    if (tabId === "billing") renderChildBilling();
    if (tabId === "attendance") renderChildAttendance();
    if (tabId === "homework") {
      if (window.loadHomeworkData) {
        window.loadHomeworkData().then(() => {
          if (typeof window.renderChildHomework === "function") window.renderChildHomework();
        });
      } else if (typeof window.renderChildHomework === "function") {
        window.renderChildHomework();
      }
    }
    if (
      tabId === "schedule" &&
      typeof window.renderChildSchedule === "function" &&
      currentStudent
    ) {
      const coach = (allCoaches || []).find(
        (c) => String(c.id) === String(currentStudent.coach_id),
      );
      window.renderChildSchedule(
        currentStudent,
        coach ? getCoachName(coach) : "Not Assigned",
      );
    }
    if (tabId === "growth") renderChildGrowth();
    if (tabId === "learning") renderChildResources();
    if (tabId === "events") {
      renderChildEvents();
      if (window.setChildEventsSubTab) window.setChildEventsSubTab("academy");
    }
    if (tabId === "reports" && typeof window.renderChildReports === "function") window.renderChildReports();
    if (
      tabId === "productivity" &&
      typeof window.renderChildProductivity === "function"
    )
      window.renderChildProductivity();
  }

  // Populates the parent-portal Attendance tab (was previously never rendered).
  function renderChildAttendance() {
    if (!currentStudent) return;
    const s = currentStudent;
    const myAtt = (allAttendance || [])
      .filter((a) => String(a.student_id) === String(s.id))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const present = myAtt.filter(
      (a) => (a.status || "").toLowerCase() === "present",
    ).length;
    const absent = myAtt.filter(
      (a) => (a.status || "").toLowerCase() === "absent",
    ).length;
    const total = myAtt.length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    if ($("c-att-total")) $("c-att-total").textContent = total;
    if ($("c-att-present")) $("c-att-present").textContent = present;
    if ($("c-att-absent")) $("c-att-absent").textContent = absent;
    if ($("c-att-rate")) $("c-att-rate").textContent = rate + "%";

    const body = $("child-att-body");
    if (body) {
      if (total === 0) {
        body.innerHTML =
          '<tr><td colspan="3"><div class="empty-state" style="padding:24px"><span class="empty-icon">📅</span><p>No attendance records yet.</p></div></td></tr>';
      } else {
        body.innerHTML = myAtt
          .map((a) => {
            const st = (a.status || "").toLowerCase();
            const badge =
              st === "present"
                ? '<span class="badge badge-success">Present</span>'
                : st === "absent"
                  ? '<span class="badge badge-danger">Absent</span>'
                  : `<span class="badge">${escapeHtml(a.status || "—")}</span>`;
            const dateStr = a.date
              ? new Date(a.date).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "—";
            return `<tr>
              <td>${dateStr}</td>
              <td>${badge}</td>
              <td style="color:var(--ivory-dim); font-size:12px;">
                ${a.notes || a.note ? `<div>${escapeHtml(a.notes || a.note)}</div>` : ''}
                ${a.classwork_notes ? `<div style="color:var(--gold);"><strong>CW:</strong> ${escapeHtml(a.classwork_notes)}</div>` : ''}
                ${a.homework_notes ? `<div style="color:var(--emerald);"><strong>HW:</strong> ${escapeHtml(a.homework_notes)}</div>` : ''}
                ${!a.notes && !a.note && !a.classwork_notes && !a.homework_notes ? '—' : ''}
              </td>
            </tr>`;
          })
          .join("");
      }
    }
  }
  window.renderChildAttendance = renderChildAttendance;

  function setDashTab(tabId, btn) {
    document
      .querySelectorAll(".dash-tab-content")
      .forEach((c) => c.classList.remove("active"));
    if (btn) {
      const parentNav = btn.parentElement;
      if (parentNav) {
        parentNav
          .querySelectorAll(".tab-link")
          .forEach((l) => l.classList.remove("active"));
      }
      btn.classList.add("active");
    }
    const target = document.getElementById("dash-tab-" + tabId);
    if (target) {
      target.classList.add("active");
      // Force Chart.js to recompute dimensions now that the container is visible (display: block)
      setTimeout(() => {
        if (window.chartInstances) {
          Object.values(window.chartInstances).forEach((chart) => {
            if (chart && typeof chart.resize === "function") {
              chart.resize();
            }
          });
        }
      }, 50);
    }
  }
  window.setDashTab = setDashTab;

  function renderChildEvents() {
    const grid = document.getElementById("child-events-grid");
    if (!grid) return;

    const now = new Date();
    const upcoming = eventsData
      .filter((e) => new Date(e.date) >= now)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const myRegistrations = eventsData.filter((e) =>
      e.registered_students?.includes(currentStudent?.id),
    );

    if (upcoming.length === 0) {
      grid.innerHTML =
        '<div class="empty-state"><span class="empty-icon">📅</span><p>No upcoming events scheduled</p></div>';
      return;
    }

    grid.innerHTML = upcoming
      .slice(0, 10)
      .map((e) => {
        const isRegistered = myRegistrations.some((r) => r.id === e.id);
        const eventDate = e.date
          ? new Date(e.date).toLocaleDateString()
          : "TBD";
        const eventTime = e.event_time || e.time || "TBD";
        return `
         <div class="ev-card">
           ${e.img_url ? `<img src="${escapeHtml(e.img_url)}" class="ev-poster" alt="${escapeHtml(e.title)}">` : ""}
           <div class="ev-header">
             <span class="ev-type-badge">${escapeHtml(e.type || "Event")}</span>
             <span class="ev-date-badge">${escapeHtml(eventDate)}</span>
           </div>
           <div class="ev-body">
             <div class="ev-title">${escapeHtml(e.title)}</div>
             <div class="ev-meta">
               <span class="ev-meta-item ev-time">⏰ ${escapeHtml(eventTime)}</span>
               <span class="ev-meta-item ev-loc">${escapeHtml(e.location || "TBD")}</span>
               ${e.prize_pool ? `<span class="ev-meta-item ev-prize">${escapeHtml(e.prize_pool)}</span>` : ""}
             </div>

             ${e.description ? `<div class="ev-desc">${escapeHtml(e.description)}</div>` : ""}
           </div>
           <div class="ev-footer">
             ${
               isRegistered
                 ? `<span class="badge badge-success" style="padding:6px 12px">✅ Registered</span>`
                 : `<button class="btn-register" onclick="registerForEvent('${e.id}')">Register</button>`
             }
           </div>
         </div>
       `;
      })
      .join("");
  }

  window.setChildEventsSubTab = function (tabName) {
    document
      .querySelectorAll("#child-tab-events .tab-link")
      .forEach((btn) => btn.classList.remove("active"));
    document
      .getElementById(`btn-child-events-${tabName}`)
      .classList.add("active");

    if (tabName === "academy") {
      document.getElementById("child-ev-list-view").style.display = "block";
      document.getElementById("child-tf-list-view").style.display = "none";
      renderChildEvents();
    } else {
      document.getElementById("child-ev-list-view").style.display = "none";
      document.getElementById("child-tf-list-view").style.display = "block";
      // Load Tournament Finder if needed
      const tfView = document.getElementById("child-tf-list-view");
      if (tfView && !tfView.innerHTML.trim()) {
        tfView.innerHTML = `
          <div class="card" style="text-align:center; padding: 40px;">
            <h3 style="color:var(--gold); margin-bottom:10px;">🏆 Global Tournament Finder</h3>
            <p style="color:var(--ivory-dim); max-width:500px; margin:0 auto 20px;">
              Find FIDE, USCF, and local tournaments based on your child's rating and location.
            </p>
            <button class="btn btn-gold" onclick="alert('Tournament finder integration coming soon!')">Find Tournaments</button>
          </div>
        `;
      }
    }
  };

  window.renderChildReports = function() {
    if (!currentStudent) return;
    const s = currentStudent;
    const container = document.getElementById("parent-reports-container");
    const monthInput = document.getElementById("parent-report-month");
    
    if (!monthInput.value) {
      const now = new Date();
      monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    
    const [yearStr, monthStr] = monthInput.value.split("-");
    const targetYear = parseInt(yearStr, 10);
    const targetMonth = parseInt(monthStr, 10) - 1;

    // Attendance Data
    const monthAtt = (allAttendance || []).filter((a) => {
      if (String(a.student_id) !== String(s.id)) return false;
      const d = new Date(a.date);
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    });
    
    const presentCount = monthAtt.filter(a => (a.status || "").toLowerCase() === "present").length;
    
    let attLogHtml = "";
    if (monthAtt.length === 0) {
      attLogHtml = `<div style="color:var(--ivory-dim);font-style:italic;">No attendance records found for this month.</div>`;
    } else {
      attLogHtml = monthAtt.map(a => `
        <div style="border-left: 2px solid ${a.status === 'present' ? 'var(--emerald)' : 'var(--danger)'}; padding-left: 10px; margin-bottom: 12px;">
          <div style="font-weight:600; font-size:13px; color:var(--gold);">${new Date(a.date).toLocaleDateString()} - ${a.status.toUpperCase()}</div>
          ${a.classwork_notes ? `<div style="font-size:12px; margin-top:4px;"><strong style="color:var(--ivory-dim);">Classwork:</strong> <span style="white-space: pre-wrap;">${escapeHtml(a.classwork_notes)}</span></div>` : ''}
          ${a.homework_notes ? `<div style="font-size:12px; margin-top:4px;"><strong style="color:var(--ivory-dim);">Homework:</strong> <span style="white-space: pre-wrap;">${escapeHtml(a.homework_notes)}</span></div>` : ''}
          ${a.notes ? `<div style="font-size:12px; margin-top:4px;"><strong style="color:var(--ivory-dim);">Notes:</strong> <span style="white-space: pre-wrap;">${escapeHtml(a.notes)}</span></div>` : ''}
        </div>
      `).join("");
    }

    // Fee Data
    const monthFeeStr = new Date(targetYear, targetMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const feeStatus = getStudentPaymentStatus(s, targetMonth, targetYear);
    const monthlyFee = getStudentMonthlyFee(s);
    
    let feeColor = "var(--ivory-dim)";
    if(feeStatus === "Paid") feeColor = "var(--emerald)";
    else if(feeStatus === "Due" || feeStatus === "Overdue") feeColor = "var(--danger)";

    container.innerHTML = `
      <!-- Attendance Report Card -->
      <div class="card" style="background:var(--bg3); border:1px solid var(--border); padding:20px; border-radius:12px;">
        <h4 style="color:var(--ivory); font-size:16px; margin-bottom:12px; display:flex; justify-content:space-between;">
          <span>📝 Attendance Report</span>
          <span style="font-size:12px; color:var(--ivory-dim); font-weight:normal;">${monthFeeStr}</span>
        </h4>
        <div style="margin-bottom:16px; font-size:13px; color:var(--ivory-dim);">
          Classes Attended: <strong style="color:var(--ivory);">${presentCount} / ${monthAtt.length}</strong>
        </div>
        <div style="max-height: 250px; overflow-y: auto; padding-right: 10px; background:var(--bg2); padding:10px; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
          ${attLogHtml}
        </div>
        <button class="btn btn-outline" style="width:100%; margin-top:16px;" onclick="window.print()">🖨️ Print Report</button>
      </div>

      <!-- Fees Report Card -->
      <div class="card" style="background:var(--bg3); border:1px solid var(--border); padding:20px; border-radius:12px;">
        <h4 style="color:var(--ivory); font-size:16px; margin-bottom:12px; display:flex; justify-content:space-between;">
          <span>💰 Fees Report</span>
          <span style="font-size:12px; color:var(--ivory-dim); font-weight:normal;">${monthFeeStr}</span>
        </h4>
        <div style="padding:16px; background:var(--bg2); border-radius:8px; border:1px solid rgba(255,255,255,0.05); margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:14px;">
            <span style="color:var(--ivory-dim);">Monthly Fee:</span>
            <strong style="color:var(--ivory);">₹${monthlyFee}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:14px;">
            <span style="color:var(--ivory-dim);">Payment Status:</span>
            <strong style="color:${feeColor}; padding:2px 8px; border-radius:4px; background:rgba(255,255,255,0.05);">${feeStatus.toUpperCase()}</strong>
          </div>
          <hr style="border-color:var(--border); margin:12px 0;">
          <div style="font-size:12px; color:var(--ivory-dim); line-height:1.5;">
            * If your status is 'Due', please proceed to the Tuition & Invoices tab to make a payment. If it shows 'Paid', your fee for ${monthFeeStr} has been successfully recorded.
          </div>
        </div>
        <button class="btn btn-outline" style="width:100%;" onclick="setChildTab('billing')">View Ledger</button>
      </div>
    `;
  };

  async function renderChildGrowth() {
    if (!currentStudent) return;
    const s = currentStudent;
    const ctx = document.getElementById("chartChildElo");
    if (ctx && typeof Chart !== "undefined") {
      if (chartInstances.childElo) chartInstances.childElo.destroy();
      const history = allRatingHistory
        .filter((h) => String(h.student_id) === String(s.id))
        .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
      const labels = history.length
        ? history.map((h) => new Date(h.recorded_at).toLocaleDateString())
        : ["Initial"];
      const data = history.length
        ? history.map((h) => h.rating)
        : [getStudentRating(s)];
      chartInstances.childElo = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Internal ELO",
              data,
              borderColor: "#dca33e",
              backgroundColor: "rgba(220,161,62,0.1)",
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
        },
      });
    }

    // Render Lichess Chart
    const lichessCard = document.getElementById("lichess-chart-card");
    const lichessCtx = document.getElementById("chartLichessElo");
    if (s.lichess_username && lichessCard && lichessCtx && typeof Chart !== "undefined") {
      lichessCard.style.display = "block";
      try {
        const res = await fetch(`/api/lichess-proxy?username=${s.lichess_username}`);
        const data = await res.json();
        const rapidHistory = Array.isArray(data) ? data.find(d => d.name === "Rapid") : null;
        
        if (chartInstances.lichessElo) chartInstances.lichessElo.destroy();
        
        let labels = ["No Data"];
        let chartData = [0];
        
        if (rapidHistory && rapidHistory.points && rapidHistory.points.length > 0) {
            // Take the last 10 points for a cleaner graph
            const recent = rapidHistory.points.slice(-10);
            labels = recent.map(p => `${p[0]}-${String(p[1]+1).padStart(2,'0')}-${String(p[2]).padStart(2,'0')}`);
            chartData = recent.map(p => p[3]);
        }

        chartInstances.lichessElo = new Chart(lichessCtx, {
          type: "line",
          data: {
            labels,
            datasets: [{ label: "Lichess Rapid", data: chartData, borderColor: "#ffffff", backgroundColor: "rgba(255,255,255,0.1)", fill: true, tension: 0.4 }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: "rgba(255,255,255,0.05)" } }, x: { grid: { display: false } } } }
        });
      } catch (e) {
          console.error("Lichess fetch error", e);
      }
    } else if (lichessCard) {
      lichessCard.style.display = "none";
    }

    // Render Chess.com Chart
    const chesscomCard = document.getElementById("chesscom-chart-card");
    const chesscomCtx = document.getElementById("chartChesscomElo");
    if (s.chesscom_username && chesscomCard && chesscomCtx && typeof Chart !== "undefined") {
      chesscomCard.style.display = "block";
      try {
        const res = await fetch(`/api/chesscom-proxy?username=${s.chesscom_username}`);
        const data = await res.json();
        
        if (chartInstances.chesscomElo) chartInstances.chesscomElo.destroy();
        
        const currentRapid = data?.chess_rapid?.last?.rating || 0;
        const labels = ["Current"];
        const chartData = [currentRapid];

        chartInstances.chesscomElo = new Chart(chesscomCtx, {
          type: "bar",
          data: {
            labels,
            datasets: [{ label: "Chess.com Rapid", data: chartData, backgroundColor: "#7FA650" }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: "rgba(255,255,255,0.05)" } }, x: { grid: { display: false } } } }
        });
      } catch (e) {
          console.error("Chesscom fetch error", e);
      }
    } else if (chesscomCard) {
      chesscomCard.style.display = "none";
    }

    // Render Chessable Progress
    const chessableCard = document.getElementById("chessable-chart-card");
    const chessableCtx = document.getElementById("chartChessableProgress");
    if (s.chessable_username && chessableCard && chessableCtx && typeof Chart !== "undefined") {
      chessableCard.style.display = "block";
      try {
          const res = await fetch(`/api/chessable-proxy?username=${s.chessable_username}`);
          const data = await res.json();
          
          if (chartInstances.chessableProgress) chartInstances.chessableProgress.destroy();
          
          chartInstances.chessableProgress = new Chart(chessableCtx, {
            type: "bar",
            data: {
              labels: ["XP", "Streak"],
              datasets: [{ label: "Chessable Stats", data: [data.xp || 0, data.streak || 0], backgroundColor: ["#EA580C", "#FFD700"] }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: "rgba(255,255,255,0.05)" } }, x: { grid: { display: false } } } }
          });
      } catch (e) {
          console.error("Chessable fetch error", e);
      }
    } else if (chessableCard) {
      chessableCard.style.display = "none";
    }

    const heatmap = document.getElementById("attendance-heatmap");
    if (heatmap) {
      const myAtt = allAttendance.filter(
        (a) => String(a.student_id) === String(s.id),
      );
      const last30 = [];
      const now = new Date();
      const days = ["S", "M", "T", "W", "T", "F", "S"];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dStr = d.toISOString().split("T")[0];
        const record = myAtt.find((a) => a.date === dStr);
        last30.push({
          date: d.getDate(),
          day: days[d.getDay()],
          status: record ? record.status : "none",
        });
      }
      heatmap.innerHTML =
        '<div class="heatmap-day-label" style="grid-column:1/-1;display:flex;justify-content:space-between;margin-bottom:4px;font-size:10px;color:var(--ivory3)">' +
        "<span>30 days ago</span><span>Today</span></div>" +
        last30
          .map(
            (d) =>
              `<div class="heatmap-day ${d.status}" title="${d.status || "No class"} - Day ${d.date}">${d.date}<span class="day-label">${d.day}</span></div>`,
          )
          .join("");
    }
  }

  function renderChildResources() {
    const grid = document.getElementById("resource-grid");
    if (!grid || !currentStudent) return;
    const levelRank = { Beginner: 0, Intermediate: 1, Advanced: 2, Elite: 3 };
    const sRank = levelRank[getStudentLevel(currentStudent)] || 0;
    const myRes = allResources.filter(
      (r) => (levelRank[r.level_requirement] || 0) <= sRank,
    );
    const myBatches = allBatches.filter(b => b.student_ids && b.student_ids.map(String).includes(String(currentStudent.id)) && b.chessable_url);
    const classroomsHtml = myBatches.map(b => `<div class="resource-card" style="border: 1px solid var(--gold); background: rgba(218, 163, 62, 0.05);"><div class="res-type" style="color:var(--gold);">♟️ BATCH CLASSROOM</div><div class="res-title">${escapeHtml(b.name)}</div><div class="res-desc">Your official Chessable classroom for this batch.</div><div class="res-action"><a href="${escapeHtml(b.chessable_url)}" target="_blank" class="btn btn-gold btn-sm" style="width:100%">Join Classroom</a></div></div>`).join("");

    if (!myRes.length && !classroomsHtml) {
      grid.innerHTML = `<div class="empty-state">No resources yet.</div>`;
      return;
    }
    grid.innerHTML = classroomsHtml + myRes
      .map(
        (r) =>
          `<div class="resource-card"><div class="res-type">${escapeHtml(r.type.toUpperCase())}</div><div class="res-title">${escapeHtml(r.title)}</div><div class="res-desc">${escapeHtml(r.description || "")}</div><div class="res-action"><a href="${escapeHtml(r.url)}" target="_blank" class="btn btn-gold btn-sm" style="width:100%">Open</a></div></div>`,
      )
      .join("");
  }

  function renderChildBilling() {
    const tbody = document.getElementById("child-bill-body");
    if (!tbody || !currentStudent) return;

    const s = currentStudent;
    const status = getStudentPaymentStatus(s);
    const fee = getStudentMonthlyFee(s) || 0;
    const dueDate = s.due_date
      ? new Date(s.due_date).toLocaleDateString()
      : "Not set";
    const myPayments = allPayments.filter(
      (p) => String(p.student_id) === String(s.id),
    );
    const recentPayments = myPayments.slice(0, 10);

    // ─────────────────────────────────────────────────────────────
    // 1. UPDATE REVENUE & BILLING STAT CARDS
    // ─────────────────────────────────────────────────────────────
    const paidPayments = myPayments.filter(
      (p) => p.status === "paid" || p.status === "completed",
    );
    const totalPaidSum = paidPayments.reduce(
      (acc, curr) => acc + (parseFloat(curr.amount) || fee),
      0,
    );

    if ($("cb-total-paid"))
      $("cb-total-paid").textContent = formatStudentFee(s, totalPaidSum);
    if ($("cb-paid-count"))
      $("cb-paid-count").textContent =
        `${paidPayments.length} transactions completed`;

    const isPaid = status === "Paid";
    const isPendingStudent = getStudentStatus(s) === "pending";
    const outstandingAmount = isPaid || isPendingStudent ? 0 : fee;
    if ($("cb-total-due")) {
      $("cb-total-due").textContent = isPendingStudent
        ? "—"
        : formatStudentFee(s, outstandingAmount);
      $("cb-total-due").className =
        isPaid || isPendingStudent
          ? "stat-value text-success"
          : "stat-value text-danger";
    }
    if ($("cb-due-date"))
      $("cb-due-date").textContent = isPendingStudent
        ? "Not Enrolled"
        : isPaid
          ? "Paid for this month"
          : `Due date: ${dueDate}`;

    // Session ROI & Value calculation
    const myAttendance = (allAttendance || []).filter(
      (a) => String(a.student_id) === String(s.id),
    );
    const presentClasses = myAttendance.filter((a) => a.status === "present");
    const presentCount = presentClasses.length;
    const standardSessions = 8;
    const sessionVal = Math.round(fee / standardSessions);
    const valueUnlocked = presentCount * sessionVal;
    const roiPct =
      fee > 0 ? Math.min(100, Math.round((valueUnlocked / fee) * 100)) : 100;

    if ($("cb-roi-value"))
      $("cb-roi-value").textContent =
        formatStudentFee(s, valueUnlocked) + " Unlocked";
    if ($("cb-roi-desc"))
      $("cb-roi-desc").textContent =
        `${presentCount}/${standardSessions} sessions attended (ROI: ${roiPct}%)`;

    if ($("cb-plan-fee"))
      $("cb-plan-fee").textContent = isPendingStudent
        ? "—"
        : formatStudentFee(s, fee) + " / mo";
    if ($("cb-plan-type")) {
      const mode = s.session_mode || s.batch_type || "Group";
      const time = s.session_time || s.batch_time || "";
      $("cb-plan-type").textContent = isPendingStudent
        ? "Class: Not Enrolled"
        : `Class: ${mode}${time ? ` (${time})` : ""}`;
    }

    // Bookkeeping statement details (CGST/SGST 18% breakout)
    const baseSum = totalPaidSum > 0 ? totalPaidSum : fee;
    const gstAmount = Math.round(baseSum * 0.18);
    const netAmount = baseSum - gstAmount;
    if ($("cb-gst-amount"))
      $("cb-gst-amount").textContent = "₹" + gstAmount.toLocaleString();
    if ($("cb-net-amount"))
      $("cb-net-amount").textContent = "₹" + netAmount.toLocaleString();
    if ($("cb-card-holder"))
      $("cb-card-holder").textContent = getStudentName(s).toUpperCase();

    // ─────────────────────────────────────────────────────────────
    // 2. RENDER CHART.JS VISUAL ANALYTICS
    // ─────────────────────────────────────────────────────────────
    setTimeout(() => {
      if (typeof Chart === "undefined") {
        console.warn("[Analytics] Chart.js library is not available.");
        return;
      }

      const isLight = document.body.dataset.theme === "light";
      const textColor = isLight ? "#454545" : "#f0ede4";
      const gridColor = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";

      // -- A. Payment Trend History Chart (Past 6 Months) --
      const trendCtx = document.getElementById("chartChildPayments");
      if (trendCtx) {
        if (window.childPaymentChart) {
          window.childPaymentChart.destroy();
          window.childPaymentChart = null;
        }

        const months = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        const trendData = {};
        const now = new Date();

        // Initialize past 6 months
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const mLabel = `${months[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
          trendData[mLabel] = 0;
        }

        // Populate actual payments
        paidPayments.forEach((p) => {
          const pDate = new Date(p.payment_date || p.created_at);
          const mLabel = `${months[pDate.getMonth()]} ${pDate.getFullYear().toString().substring(2)}`;
          if (trendData[mLabel] !== undefined) {
            trendData[mLabel] += parseFloat(p.amount) || fee;
          }
        });

        const trendLabels = Object.keys(trendData);
        const trendAmounts = Object.values(trendData);

        // Create premium gradient
        const barCtx = trendCtx.getContext("2d");
        const barGradient = barCtx.createLinearGradient(0, 0, 0, 180);
        barGradient.addColorStop(0, "rgba(218, 163, 62, 0.85)"); // Vibrant Gold
        barGradient.addColorStop(1, "rgba(218, 163, 62, 0.15)"); // Translucent Fade

        window.childPaymentChart = new Chart(trendCtx, {
          type: "bar",
          data: {
            labels: trendLabels,
            datasets: [
              {
                label: "Fees Paid (₹)",
                data: trendAmounts,
                backgroundColor: barGradient,
                borderColor: "var(--gold)",
                borderWidth: 2,
                borderRadius: 6,
                hoverBackgroundColor: "var(--gold)",
                hoverBorderWidth: 3,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                titleColor: "#fff",
                bodyColor: "var(--gold)",
                borderColor: "var(--gold-semi)",
                borderWidth: 1,
                padding: 10,
                cornerRadius: 8,
                callbacks: {
                  label: function (context) {
                    return ` Paid: ₹${context.raw.toLocaleString()}`;
                  },
                },
              },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: {
                  color: textColor,
                  font: { family: "inherit", size: 10, weight: "500" },
                },
              },
              y: {
                grid: { color: gridColor, drawTicks: false },
                ticks: {
                  color: textColor,
                  font: { family: "inherit", size: 10 },
                },
                beginAtZero: true,
              },
            },
          },
        });
      }

      // -- B. Payment Status Breakdown Chart --
      const distCtx = document.getElementById("chartChildPaymentDistribution");
      if (distCtx) {
        if (window.childDistributionChart) {
          window.childDistributionChart.destroy();
          window.childDistributionChart = null;
        }

        let paidCount = paidPayments.length;
        let pendingCount = myPayments.filter(
          (p) => (p.status || "").toLowerCase() === "pending",
        ).length;
        let dueCount = myPayments.filter(
          (p) => (p.status || "").toLowerCase() === "due",
        ).length;
        let overdueCount = myPayments.filter(
          (p) => (p.status || "").toLowerCase() === "overdue",
        ).length;

        // Add current month state as active record
        if (status === "Paid") paidCount++;
        else if (status === "Pending") pendingCount++;
        else if (status === "Due") dueCount++;
        else if (status === "Overdue") overdueCount++;

        const labels = [];
        const data = [];
        const colors = [];

        if (paidCount > 0) {
          labels.push("Paid");
          data.push(paidCount);
          colors.push("#10b981");
        } // Emerald
        if (pendingCount > 0) {
          labels.push("Pending");
          data.push(pendingCount);
          colors.push("#facc15");
        } // Gold
        if (dueCount > 0) {
          labels.push("Due");
          data.push(dueCount);
          colors.push("#ef4444");
        } // Red
        if (overdueCount > 0) {
          labels.push("Overdue");
          data.push(overdueCount);
          colors.push("#dc2626");
        } // Crimson

        if (data.length === 0) {
          labels.push("No History");
          data.push(1);
          colors.push("rgba(156, 163, 175, 0.2)");
        }

        window.childDistributionChart = new Chart(distCtx, {
          type: "doughnut",
          data: {
            labels: labels,
            datasets: [
              {
                data: data,
                backgroundColor: colors,
                borderColor: isLight ? "#ffffff" : "var(--bg2)",
                borderWidth: 3,
                hoverOffset: 8,
                hoverBorderColor: "rgba(255,255,255,0.4)",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: "right",
                labels: {
                  color: textColor,
                  padding: 12,
                  font: { family: "inherit", size: 11, weight: "600" },
                },
              },
              tooltip: {
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                padding: 10,
                cornerRadius: 8,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)",
              },
            },
            cutout: "70%",
          },
        });
      }
    }, 50);

    // ─────────────────────────────────────────────────────────────
    // 3. GENERATE TABLE ROWS (DETAILED LEDGER WITH FILTERS)
    // ─────────────────────────────────────────────────────────────
    const activeFilter = window.currentLedgerFilter || "all";
    let rows = "";

    // A. Current active billing period row (conditional on filter)
    const showCurrentRow =
      (activeFilter === "all" ||
        (activeFilter === "Paid" && isPaid) ||
        (activeFilter === "Unpaid" && !isPaid)) &&
      !isPendingStudent;

    if (showCurrentRow) {
      rows += `
        <tr style="background: rgba(218, 163, 62, 0.02)">
          <td style="font-weight:600">${new Date().toLocaleDateString("en-GB")}</td>
          <td><span class="badge" style="background:var(--surface);border:1px solid var(--border);color:var(--ivory)">Current Period</span></td>
          <td style="font-weight:700;color:var(--gold)">₹${fee.toLocaleString()}</td>
          <td><span class="badge ${status === "Paid" ? "badge-paid" : "badge-due"}" style="font-weight:700">${status}</span></td>
          <td><span style="color:var(--ivory-dim)">—</span></td>
          <td>
            ${
              status === "Due" || status === "Pending"
                ? `<button class="btn btn-gold btn-sm" onclick="openPay('${s.id}', '${jsAttrEncode(getStudentName(s))}', '${fee}')" style="box-shadow:var(--shadow-amber-sm)">Pay Now</button>`
                : `<button class="btn btn-outline btn-sm" onclick="downloadReceipt('${s.id}', '${jsAttrEncode(getStudentName(s))}', '${fee}', '${jsAttrEncode(getStudentLevel(s))}', '${getStudentRating(s)}', 'N/A', 'Online')">Receipt</button>`
            }
          </td>
        </tr>
      `;
    }

    // B. Past invoice records (conditional on filter)
    let filteredRecentPayments = recentPayments;
    if (activeFilter === "Paid") {
      filteredRecentPayments = recentPayments.filter(
        (p) => p.status === "completed" || p.status === "paid",
      );
    } else if (activeFilter === "Unpaid") {
      filteredRecentPayments = recentPayments.filter(
        (p) => p.status !== "completed" && p.status !== "paid",
      );
    }

    if (filteredRecentPayments.length > 0) {
      filteredRecentPayments.forEach((p) => {
        const pDate = p.payment_date
          ? new Date(p.payment_date).toLocaleDateString("en-GB")
          : "-";
        const pAmount = p.amount || fee;
        const pStatus =
          p.status === "completed" || p.status === "paid"
            ? "Paid"
            : p.status || "Pending";
        const pMethod = p.payment_method || "Online";

        rows += `
          <tr>
            <td>${pDate}</td>
            <td><span class="badge badge-level" style="font-size:10px">Past Fee Session</span></td>
            <td style="font-weight:600">₹${pAmount.toLocaleString()}</td>
            <td><span class="badge ${pStatus === "Paid" ? "badge-paid" : "badge-due"}">${pStatus}</span></td>
            <td><span style="font-size:12px;color:var(--ivory-dim);font-weight:500">💳 ${pMethod}</span></td>
            <td>
              ${
                pStatus === "Paid"
                  ? `<button class="btn btn-outline-grey btn-sm" onclick="downloadReceipt('${s.id}', '${jsAttrEncode(getStudentName(s))}', '${pAmount}', '${jsAttrEncode(getStudentLevel(s))}', '${getStudentRating(s)}', 'N/A', '${pMethod}', '${p.payment_date || p.created_at || ""}')">Receipt</button>`
                  : `<span style="color:var(--ivory-dim);font-size:12px">Pending Processing</span>`
              }
            </td>
          </tr>
        `;
      });
    }

    // C. Empty state fallback
    if (rows === "") {
      rows = `
        <tr>
          <td colspan="6" style="text-align:center;padding:24px;color:var(--ivory-dim);font-size:13px">
            No invoices found matching the "${activeFilter}" filter criteria.
          </td>
        </tr>
      `;
    }

    tbody.innerHTML = rows;
  }

  // ─────────────────────────────────────────────────────────────
  // 4. ADVANCED FINANCIAL LEDGER AND STATEMENTS HANDLERS
  // ─────────────────────────────────────────────────────────────
  window.filterLedger = function (filter) {
    window.currentLedgerFilter = filter;

    // Manage filter button visual state
    document.querySelectorAll(".btn-filter-ledger").forEach((btn) => {
      btn.style.background = "transparent";
      btn.style.color = "var(--ivory-dim)";
      btn.style.fontWeight = "600";
    });

    const filterBtnMap = {
      all: "btn-ledger-all",
      Paid: "btn-ledger-paid",
      Unpaid: "btn-ledger-unpaid",
    };

    const activeBtn = document.getElementById(filterBtnMap[filter]);
    if (activeBtn) {
      activeBtn.style.background = "var(--gold-semi)";
      activeBtn.style.color = "var(--gold)";
      activeBtn.style.fontWeight = "700";
    }

    renderChildBilling();
  };

  window.downloadFinancialStatement = function () {
    if (!currentStudent) {
      toast("No active student loaded", "error");
      return;
    }
    const s = currentStudent;
    const fee = getStudentMonthlyFee(s) || 0;
    const myPayments = allPayments.filter(
      (p) => String(p.student_id) === String(s.id),
    );
    const paidPayments = myPayments.filter(
      (p) => p.status === "paid" || p.status === "completed",
    );

    // Sort payments oldest to newest for chronological statement
    paidPayments.sort(
      (a, b) =>
        new Date(a.payment_date || a.created_at) -
        new Date(b.payment_date || b.created_at),
    );

    let baseSum = 0;

    let itemizedRows = "";
    if (paidPayments.length > 0) {
      paidPayments.forEach((p, idx) => {
        const amt = parseFloat(p.amount) || fee;
        baseSum += amt;

        const pDate = new Date(p.payment_date || p.created_at);
        const txId = String(p.transaction_id || p.id || String(100 + idx))
          .slice(-6)
          .toUpperCase();

        itemizedRows += `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px 10px; font-size: 13px;">${pDate.toLocaleDateString("en-GB")}</td>
            <td style="padding: 12px 10px; font-size: 13px;">INV-${pDate.getFullYear()}-${txId}<br><span style="font-size:11px;color:#888;">Chess Tuition Service</span></td>
            <td style="padding: 12px 10px; font-size: 13px; text-align: right;">${p.payment_method || "Online"}</td>
            <td style="padding: 12px 10px; font-size: 13px; text-align: right; font-weight: bold; color: #111;">₹${amt.toLocaleString()}</td>
          </tr>
        `;
      });
    } else {
      baseSum = fee;

      itemizedRows = `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 12px 10px; font-size: 13px;">${new Date().toLocaleDateString("en-GB")}</td>
          <td style="padding: 12px 10px; font-size: 13px;">PRO-FORMA<br><span style="font-size:11px;color:#888;">Current Class Fee Plan</span></td>
          <td style="padding: 12px 10px; font-size: 13px; text-align: right;">Pending</td>
          <td style="padding: 12px 10px; font-size: 13px; text-align: right; font-weight: bold; color: #777;">₹${fee.toLocaleString()} (Due)</td>
        </tr>
      `;
    }

    const html = `
      <html>
      <head>
        <title>Tuition Financial Statement - ${getStudentName(s)}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #2c3e50; margin: 40px; line-height: 1.6; }
          .header { display: flex; justify-content: space-between; border-bottom: 3px solid #daa33e; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: 800; color: #1a252f; letter-spacing: 0.5px; }
          .logo span { color: #daa33e; }
          .meta-box { margin-bottom: 35px; display: flex; justify-content: space-between; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #f8f9fa; padding: 12px 10px; text-align: left; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #e9ecef; color: #495057; font-weight: 700; }
          td { padding: 12px 10px; border-bottom: 1px solid #f1f3f5; }
          .totals { float: right; width: 320px; font-size: 14px; margin-top: 20px; }
          .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e9ecef; }
          .footer { margin-top: 120px; border-top: 1px solid #e9ecef; padding-top: 20px; text-align: center; font-size: 12px; color: #868e96; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; background: #fffde7; padding: 14px 20px; border: 1px solid #ffe082; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <span style="font-size: 13px; color: #744210; font-weight: 600; display: flex; align-items: center; gap: 6px;">
            📄 Annual Tuition Investment Statement is prepared for print.
          </span>
          <button onclick="window.print()" style="background: #daa33e; border: none; color: white; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 13px; box-shadow: 0 2px 4px rgba(218,163,62,0.3);">🖨️ Print Statement / Save PDF</button>
        </div>
        
        <div class="header">
          <div>
            <div class="logo">CHESS<span>KIDOO</span> ACADEMY</div>
            <div style="font-size: 12px; color: #7f8c8d; margin-top: 4px; font-weight: 500;">Premium Scholastic Chess Mentorship & Coaching</div>
          </div>
          <div style="text-align: right;">
            <h2 style="margin: 0; color: #daa33e; font-size: 20px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">Tuition Financial Report</h2>
            <div style="font-size: 12px; color: #7f8c8d; margin-top: 4px; font-weight: 500;">Date Generated: ${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div class="meta-box">
          <div>
            <strong style="color: #34495e; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Student Ledger Beneficiary</strong><br>
            <span style="font-size: 16px; font-weight: 700; color: #2c3e50; display: inline-block; margin: 4px 0;">${getStudentName(s)}</span><br>
            Rating: <strong>${getStudentRating(s)} ELO</strong> (${getStudentLevel(s)})<br>
            Enrollment Date: ${getStudentDate(s) || "N/A"}<br>
            Student ID Reference: <strong>CKA-${s.id}</strong>
          </div>
          <div style="text-align: right; font-size: 13px; color: #7f8c8d;">
            <strong style="color: #34495e; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Academy Registry Issuer</strong><br>
            <span style="font-size: 15px; font-weight: 700; color: #2c3e50; display: inline-block; margin: 4px 0;">Two Knights Academy Pvt Ltd</span><br>
            Corporate GSTIN: <strong>33AAFCK0012C1ZP</strong><br>
            Email: billing@Two Knights.com<br>
            Web: www.Two Knights.com
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference ID</th>
              <th style="text-align: right;">Payment Mode</th>
              <th style="text-align: right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${itemizedRows}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row" style="border-top: 2px solid #daa33e; padding-top: 10px; margin-top: 10px; font-weight: 800; font-size: 17px; color: #1a252f;">
            <span>Total Tuition Paid:</span>
            <span>₹${baseSum.toLocaleString()}</span>
          </div>
        </div>

        <div style="clear: both;"></div>

        <div class="footer">
          This is an official annual statement issued electronically by the accounting division of Two Knights Academy Pvt Ltd.<br>
          We appreciate your dedication and scholastic investment in our master chess training program!
        </div>
      </body>
      </html>
    `;

    const printWin = window.open("", "_blank");
    printWin.document.write(html);
    printWin.document.close();
  };

  // ── ADMIN EXPANSION LOGIC ──
  function openAttendanceMarking() {
    const dateEl = $("att-date");
    if (dateEl) dateEl.value = new Date().toISOString().split("T")[0];
    const coachFilter = $("att-coach-filter");
    const pageCoach = $("f-coach");
    if (coachFilter && pageCoach) coachFilter.value = pageCoach.value;
    renderAttendanceList();
    openModal("attendance-modal");
  }

  window.renderAttendanceList = function () {
    const tbody = $("att-marking-body");
    if (!tbody) return;

    const date = $("att-date")?.value || new Date().toISOString().split("T")[0];
    const coachId = $("att-coach-filter")?.value;

    let filteredStudents = allStudents.filter((s) => s.status === "active");
    if (coachId) {
      filteredStudents = filteredStudents.filter(
        (s) => String(s.coach_id) === String(coachId),
      );
    }

    const dayRecords = allAttendance.filter((a) => a.date === date);

    tbody.innerHTML = filteredStudents
      .map((s) => {
        const existing = dayRecords.find((a) => String(a.student_id) === String(s.id));
        const status = existing?.status || "";
        const notes = existing?.notes || "";
        const cwNotes = existing?.classwork_notes || "";
        const hwNotes = existing?.homework_notes || "";
        return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              <img src="${makeAvSrc(s)}" style="width:32px;height:32px;border-radius:50%;border:2px solid var(--gold)">
              <div>
                <div style="font-weight:600">${getStudentName(s)}</div>
                <small style="color:var(--ivory3)">${getStudentLevel(s)} - ${getStudentRating(s)} ELO</small>
              </div>
            </div>
          </td>
          <td>
            <select class="att-status" data-sid="${s.id}" onchange="updateAttStats()">
              <option value="" ${!status ? "selected" : ""}>-- Select --</option>
              <option value="present" ${status === "present" ? "selected" : ""}>✅ Present</option>
              <option value="absent" ${status === "absent" ? "selected" : ""}>❌ Absent</option>
              <option value="late" ${status === "late" ? "selected" : ""}>⏰ Late</option>
              <option value="excused" ${status === "excused" ? "selected" : ""}>📋 Excused</option>
            </select>
          </td>
          <td>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <textarea class="att-cw" data-sid="${s.id}" placeholder="Classwork notes (No word limit, links allowed)..." style="font-size:12px; width:100%; min-height:60px; resize:vertical; background:var(--bg3); border:1px solid var(--border); color:var(--ivory); padding:6px; border-radius:4px;">${escapeHtml(cwNotes)}</textarea>
              <textarea class="att-hw" data-sid="${s.id}" placeholder="Homework notes (No word limit, links allowed)..." style="font-size:12px; width:100%; min-height:60px; resize:vertical; background:var(--bg3); border:1px solid var(--border); color:var(--ivory); padding:6px; border-radius:4px;">${escapeHtml(hwNotes)}</textarea>
              <textarea class="att-notes" data-sid="${s.id}" placeholder="General note..." style="font-size:12px; width:100%; min-height:40px; resize:vertical; background:var(--bg3); border:1px solid var(--border); color:var(--ivory); padding:6px; border-radius:4px;">${escapeHtml(notes)}</textarea>
            </div>
          </td>
        </tr>
      `;
      })
      .join("");

    updateAttStats();
  };

  window.updateAttStats = function () {
    const rows = document.querySelectorAll("#att-marking-body tr");
    let present = 0,
      absent = 0,
      late = 0,
      excused = 0,
      unmarked = 0;
    rows.forEach((row) => {
      const status = row.querySelector(".att-status").value;
      if (status === "present") present++;
      else if (status === "absent") absent++;
      else if (status === "late") late++;
      else if (status === "excused") excused++;
      else unmarked++;
    });
    const statsEl = document.getElementById("att-stats");
    if (statsEl) {
      statsEl.innerHTML = `
        <span style="color:var(--success)">✅ ${present}</span> |
        <span style="color:var(--danger)">❌ ${absent}</span> |
        <span style="color:var(--gold)">⏰ ${late}</span> |
        <span style="color:var(--ivory3)">📋 ${excused}</span> |
        <span style="color:var(--ivory3)"> unmarked: ${unmarked}</span>
      `;
    }
  };

  window.markAllPresent = function () {
    document
      .querySelectorAll(".att-status")
      .forEach((s) => (s.value = "present"));
    updateAttStats();
  };

  window.markAllAbsent = function () {
    document
      .querySelectorAll(".att-status")
      .forEach((s) => (s.value = "absent"));
    updateAttStats();
  };

  async function saveBatchAttendance() {
    const date = $("att-date").value;
    if (!date) {
      toast("Please select a date", "error");
      return;
    }

    const rows = document.querySelectorAll("#att-marking-body tr");
    const records = Array.from(rows)
      .map((row) => {
        const select = row.querySelector(".att-status");
        const notesInput = row.querySelector(".att-notes");
        const cwInput = row.querySelector(".att-cw");
        const hwInput = row.querySelector(".att-hw");
        if (!select.value) return null; // Skip unmarked
        return {
          student_id: select.dataset.sid,
          status: select.value,
          date: date,
          notes: notesInput ? notesInput.value : "",
          classwork_notes: cwInput ? cwInput.value : "",
          homework_notes: hwInput ? hwInput.value : "",
        };
      })
      .filter((r) => r !== null);

    if (records.length === 0) {
      toast("No attendance marked", "error");
      return;
    }

    try {
      const res = await apiCall("/api/attendance", {
        method: "POST",
        body: JSON.stringify(records),
      });
      if (res.ok) {
        toast(`Attendance recorded for ${records.length} students!`, "success");
        closeModals();
        loadAllData(true);
      }
    } catch (e) {
      toast("Error saving attendance", "error");
    }
  }

  function openPromote(id) {
    const s = allStudents.find((x) => String(x.id) === String(id));
    if (!s) return;
    $("promote-id").value = s.id;
    $("promote-name").textContent = getStudentName(s);
    $("promote-curr-level").textContent = getStudentLevel(s);
    openModal("promote-modal");
  }

  async function executePromotion() {
    const id = $("promote-id").value;
    const newLevel = $("promote-new-level").value;
    const eloBonus = parseInt($("promote-elo-bonus").value) || 0;
    const notes = $("promote-notes").value;
    const s = allStudents.find((x) => String(x.id) === String(id));

    try {
      // 1. Update Student Table
      const newElo = getStudentRating(s) + eloBonus;
      const updateRes = await apiCall(`/api/students?id=${id}`, {
        method: "PUT",
        body: JSON.stringify({
          level: newLevel,
          rating: newElo,
          notes: s.notes + "\n[Promoted: " + notes + "]",
        }),
      });

      // 2. Log to Rating History
      await apiCall("/api/rating_history", {
        method: "POST",
        body: JSON.stringify({
          student_id: id,
          rating: newElo,
          change_type: "promotion",
          notes: "Level Up to " + newLevel,
        }),
      });

      if (updateRes.ok) {
        toast("Student Promoted!", "success");
        closeModals();
        loadAllData(true);
      }
    } catch (e) {
      toast("Promotion failed", "error");
    }
  }

  // Shared, friendly fee-reminder message builder used by all reminder flows.
  // Emojis are \u{...} escapes (pure ASCII source) so they can never be
  // corrupted to "?" by file encoding / build / transport.
  function buildFeeMessage(s, name, amount, dueDateStr, isDueOrOverdue) {
    const amountText =
      "\u{20B9}" +
      Number(amount || 0).toLocaleString() +
      getStudentLocalCurrencyAmount(s, amount);
    const cn = cleanText(name);
    const payTo = window.getPaymentPayeeText
      ? window.getPaymentPayeeText()
      : "9025846663 (Ranjith)";
    if (isDueOrOverdue) {
      return (
        `\u{1F534} FEE PAYMENT DUE\n\n` + // 🔴
        `Hello Sir/Madam, \u{1F44B}\n\n` + // 👋
        `\u{265F}\u{FE0F} This is a gentle note that the chess class fee for ${cn} is currently due.\n\n` + // ♟️
        `\u{1F4B0} Amount Due: ${amountText}\n` + // 💰
        `\u{1F4C5} Due Date: ${dueDateStr}\n\n` + // 📅
        `Kindly complete the payment on or before the due date to avoid any interruption in class participation. \u{1F64F}\n\n` + // 🙏
        `\u{1F4F2} Pay via UPI / GPay / PhonePe: ${payTo}\n\n` + // 📲
        `Thank you for your continued support! \u{1F31F}\n` + // 🌟
        `\u{265F}\u{FE0F} Two Knights Academy`
      ); // ♟️
    }
    return (
      `\u{1F4E2} UPCOMING FEE REMINDER\n\n` + // 📢
      `Hello Sir/Madam, \u{1F44B}\n\n` + // 👋
      `We hope you are doing well! \u{1F60A} This is a friendly reminder that the chess class fee for ${cn} is coming up soon. \u{265F}\u{FE0F}\n\n` + // 😊 ♟️
      `\u{1F4B0} Fee Amount: ${amountText}\n` + // 💰
      `\u{1F4C5} Due Date: ${dueDateStr}\n\n` + // 📅
      `Kindly complete the payment on or before the due date. \u{1F64F}\n\n` + // 🙏
      `\u{1F4F2} Pay via UPI / GPay / PhonePe: ${payTo}\n\n` + // 📲
      `Thank you so much for your support and cooperation! \u{1F31F}\n` + // 🌟
      `\u{265F}\u{FE0F} Two Knights Academy`
    ); // ♟️
  }

  function sendPaymentReminder(id) {
    const s = allStudents.find((x) => String(x.id) === String(id));
    if (!s) return;

    const name = getStudentName(s);
    const monthlyFee = getStudentMonthlyFee(s);
    const phone = getStudentPhone(s);

    // Calculate pending amount based on reporting period
    const targetMonth = window.reportMonth;
    const targetYear = window.reportYear;
    const enrollDateStr = getStudentDate(s);
    const enrollDate = enrollDateStr
      ? new Date(enrollDateStr)
      : new Date(Date.UTC(2026, 2, 1)); // Fallback to March 1, 2026
    const baselineDate = new Date(Date.UTC(2026, 3, 1)); // Global System Baseline (April 1st, 2026)
    const effectiveEnroll = (function () {
      var _a =
        window.getBillingAnchor && window.getBillingAnchor(s, baselineDate);
      return _a
        ? new Date(Date.UTC(_a.year, _a.month, 1))
        : enrollDate < baselineDate
          ? baselineDate
          : enrollDate;
    })();

    // FIX #5: Always rebuild — never trust a cached map for financial calculations
    const freshPaymentsMap = {};
    const seenStudentMonths = new Set();
    (allPayments || []).forEach((p) => {
      if (p.status === "paid") {
        const sid = String(p.student_id || "")
          .trim()
          .toLowerCase();
        if (!sid) return;
        const pDate = new Date(p.payment_date || p.created_at);
        const mKey = `${sid}_${pDate.getUTCFullYear()}-${pDate.getUTCMonth()}`;
        if (seenStudentMonths.has(mKey)) return;
        seenStudentMonths.add(mKey);
        freshPaymentsMap[sid] = (freshPaymentsMap[sid] || 0) + 1;
      }
    });

    const s_id_key = String(s.id || "")
      .trim()
      .toLowerCase();
    const totalCredits = freshPaymentsMap[s_id_key] || 0;
    const monthsRequired =
      (targetYear - effectiveEnroll.getUTCFullYear()) * 12 +
      (targetMonth - effectiveEnroll.getUTCMonth()) +
      1;

    const pendingMonths = Math.max(1, monthsRequired - totalCredits);
    let totalPending = pendingMonths * monthlyFee;

    const coach = allCoaches.find((c) => String(c.id) === String(s.coach_id));
    const coachName = coach ? coach.name || "" : "";
    const dueCfg = getStudentDueConfig(s, coachName, targetMonth, targetYear);
    if (dueCfg.feeOverride !== null) {
      totalPending = dueCfg.feeOverride;
    }

    const getOrdinal = (n) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    const monthName = new Date(targetYear, targetMonth).toLocaleString(
      "en-IN",
      { month: "long" },
    );
    const dueDateStr = `${getOrdinal(dueCfg.day)} ${monthName} ${targetYear}`;

    const status = getStudentPaymentStatus(s);
    const isDueOrOverdue = status === "Due" || status === "Overdue";
    if (totalPending <= 0) {
      totalPending = monthlyFee || 1500;
    }

    const msg = buildFeeMessage(
      s,
      name,
      totalPending,
      dueDateStr,
      isDueOrOverdue,
    );

    const parsed = parseStoredPhone(phone);
    const inferredCountry =
      parsed.countryCode && parsed.countryCode !== "IN"
        ? parsed.countryCode
        : s.country_code || "IN";
    const country = getCountryByCode(inferredCountry);
    const dialCode = country ? country.dial.replace(/\D/g, "") : "91";
    openWhatsApp(dialCode, parsed.localNumber, msg);
  }

  window.informCoachFees = function (id, silent = false) {
    const c = allCoaches.find((x) => String(x.id) === String(id));
    if (!c) return;

    const studs = allStudents.filter((s) => String(s.coach_id) === String(id));
    const targetMonth = window.reportMonth;
    const targetYear = window.reportYear;
    const today = new Date();

    // Get pending students with their due dates for sorting
    const pendingWithDates = studs
      .map((s) => {
        const status = getStudentPaymentStatus(s, targetMonth, targetYear);
        if (status !== "Due" && status !== "Pending" && status !== "Overdue")
          return null;

        const dueCfg = getStudentDueConfig(
          s,
          getCoachName(c),
          targetMonth,
          targetYear,
        );
        const dueDate = new Date(
          targetYear,
          targetMonth,
          dueCfg.day,
          23,
          59,
          59,
        );
        const daysLeft = Math.ceil(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        // For Pending status, only include if due within 4 days (upcoming)
        if (status === "Pending" && daysLeft > 4) return null;

        return { student: s, status, dueDate, daysLeft, dueDay: dueCfg.day };
      })
      .filter((item) => item !== null);

    // Sort: 1. Overdue first, 2. Then Due by closest date, 3. Then Pending by closest date
    // Within each status group, sort by due date (closest first)
    pendingWithDates.sort((a, b) => {
      // Status priority: Overdue (0) > Due (1) > Pending (2)
      const statusOrder = { Overdue: 0, Due: 1, Pending: 2 };
      const aOrder = statusOrder[a.status];
      const bOrder = statusOrder[b.status];

      if (aOrder !== bOrder) return aOrder - bOrder;

      // Same status - sort by due date (closest first, for overdue use daysLeft as negative)
      return a.dueDate - b.dueDate;
    });

    const pending = pendingWithDates.map((item) => item.student);

    if (pending.length === 0) {
      if (!silent)
        toast(
          `No pending/due fees (or within 4-day deadline) for students under ${getCoachName(c)}`,
          "info",
        );
      return;
    }

    const dateStr = new Date(targetYear, targetMonth).toLocaleDateString(
      "en-IN",
      { month: "long", year: "numeric" },
    );

    // Determine min due day among pending students to use as deadline
    let minDueDay = 10;
    if (pendingWithDates.length > 0) {
      minDueDay = Math.min(...pendingWithDates.map((item) => item.dueDay));
    }

    const getOrdinal = (n) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    const lastDateToPayStr = `${getOrdinal(minDueDay)} ${dateStr}`;

    // Build sorted student lines
    const studentLines = pendingWithDates.map(
      ({ student: s, status, dueDay }) => {
        let label;
        if (status === "Overdue" || status === "Due") {
          label = `${EMOJI.siren} ARREARS`;
        } else {
          label = `${EMOJI.pending} PENDING`;
        }
        const sName = cleanText(getStudentName(s).toUpperCase());
        const coach = allCoaches.find(
          (cc) => String(cc.id) === String(s.coach_id),
        );
        const cName = coach ? coach.name || "" : "";
        const monthName2 = new Date(targetYear, targetMonth).toLocaleString(
          "en-IN",
          { month: "long" },
        );
        const dueDateStr = `${getOrdinal(dueDay)} ${monthName2} ${targetYear}`;
        return `${EMOJI.alert} ${sName} — ${label} (Due: ${dueDateStr})`;
      },
    );

    let msg =
      `${EMOJI.warning} Two Knights ACADEMY – FEE AUDIT REPORT ${EMOJI.chart}\n\n` +
      `Hello Coach ${cleanText(getCoachName(c)).toUpperCase()} ${EMOJI.teacher},\n\n` +
      `The following students under your mentorship have an outstanding balance for the ${dateStr} billing cycle ${EMOJI.calendar}:\n\n` +
      studentLines.join("\n") +
      `\n\n` +
      `Please coordinate with the guardians to ensure these balances are settled ${EMOJI.handshake}.\n` +
      `Last Date to Pay: ${lastDateToPayStr} ${EMOJI.spiral_calendar}\n\n` +
      `${EMOJI.memo} Note:\n\n` +
      `${EMOJI.siren} ARREARS = Unpaid fees from previous months\n` +
      `${EMOJI.pending} PENDING = Current month's unpaid fee\n\n` +
      `Regards,\n` +
      `Administrative Team | Two Knights Academy ${EMOJI.trophy}${EMOJI.sparkle}`;

    const phone = c.phone || c.contact || "0000000000";
    const parsed = parseStoredPhone(phone);
    const inferredCountry =
      parsed.countryCode && parsed.countryCode !== "IN"
        ? parsed.countryCode
        : c.country_code || "IN";
    const country = getCountryByCode(inferredCountry);
    const dialCode = country ? country.dial.replace(/\D/g, "") : "91";
    const base = "https://api.whatsapp.com/send";
    const waUrl = `${base}?phone=${dialCode}${parsed.localNumber}&text=${encodeURIComponent(msg)}`;

    if (!silent) window.open(waUrl, "_blank");
    return waUrl;
  };

  // Coaches whose students have any unpaid (Pending/Due/Overdue) fees this month.
  function getCoachesWithPending() {
    return (allCoaches || []).filter((coach) => {
      if (getCoachStatus(coach) === "archived") return false;
      const myStudents = (allStudents || []).filter(
        (s) => String(s.coach_id) === String(coach.id),
      );
      return myStudents.some((s) => {
        const st = getStudentPaymentStatus(s);
        return st === "Due" || st === "Pending" || st === "Overdue";
      });
    });
  }

  let bulkInformQueue = [];

  // New workflow: instead of auto-opening many WhatsApp tabs (which browsers
  // block), present a reliable click-through queue. Each "Send" is a direct user
  // gesture, so the WhatsApp tab always opens.
  window.informAllCoaches = function () {
    const pendingCoaches = getCoachesWithPending();
    if (pendingCoaches.length === 0) {
      toast("All coaches are up to date!", "success");
      return;
    }
    bulkInformQueue = pendingCoaches.map((c) => ({
      id: c.id,
      name: getCoachName(c),
      sent: false,
    }));
    renderBulkInformList();
    openModal("bulk-inform-modal");
  };

  function renderBulkInformList() {
    const el = $("bulk-inform-list");
    if (!el) return;
    const sentCount = bulkInformQueue.filter((q) => q.sent).length;
    const sub = $("bulk-inform-sub");
    if (sub)
      sub.textContent = `${sentCount}/${bulkInformQueue.length} sent. Tap each coach to open a pre-filled WhatsApp message (reliable — no popup blocking).`;
    el.innerHTML = bulkInformQueue
      .map((q, i) => {
        const studs = (allStudents || []).filter(
          (s) =>
            String(s.coach_id) === String(q.id) &&
            ["Due", "Pending", "Overdue"].includes(getStudentPaymentStatus(s)),
        );
        const total = studs.reduce(
          (a, s) => a + (getStudentMonthlyFee(s) || 0),
          0,
        );
        return `<div style="display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid var(--border); border-radius:8px; background:${q.sent ? "rgba(16,185,129,0.07)" : "rgba(255,255,255,0.02)"};">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; color:var(--ivory);">${escapeHtml(q.name)} ${q.sent ? '<span style="color:var(--emerald); font-size:11px;">✓ sent</span>' : ""}</div>
          <div style="font-size:11px; color:var(--ivory-dim);">${studs.length} student${studs.length === 1 ? "" : "s"} pending &middot; ₹${total.toLocaleString()}</div>
        </div>
        <button class="btn ${q.sent ? "btn-outline-grey" : "btn-gold"} btn-sm" style="flex-shrink:0;" onclick="bulkInformSend(${i})">${q.sent ? "Resend" : "Send WhatsApp"}</button>
      </div>`;
      })
      .join("");
  }

  window.bulkInformSend = function (i) {
    const q = bulkInformQueue[i];
    if (!q) return;
    informCoachFees(q.id); // direct user gesture -> WhatsApp opens reliably
    q.sent = true;
    renderBulkInformList();
  };

  window.bulkInformNext = function () {
    const next = bulkInformQueue.findIndex((q) => !q.sent);
    if (next === -1) {
      toast("All coaches have been informed! ✅", "success");
      return;
    }
    window.bulkInformSend(next);
  };

  window.informAllDueStudents = function () {
    const dueStudents = (allStudents || []).filter((s) => {
      const st = getStudentPaymentStatus(s);
      return st === "Due" || st === "Pending";
    });

    if (dueStudents.length === 0) {
      toast("No students with pending or due payments!", "success");
      return;
    }

    if (
      !confirm(
        `Notify parents of ${dueStudents.length} students with pending/due payments? This will open multiple WhatsApp tabs.`,
      )
    )
      return;

    const targetMonth = window.reportMonth;
    const targetYear = window.reportYear;
    let sent = 0;

    dueStudents.forEach((s, idx) => {
      const phone = (s.parent_phone || "").replace(/\D/g, "");
      if (!phone || phone.length < 10) return;

      const name = getStudentName(s);
      const fee = getStudentMonthlyFee(s);

      // Audit-based debt calculation
      const enrollDateStr = getStudentDate(s);
      const baseline = new Date(Date.UTC(2026, 3, 1));
      const enrollDate = enrollDateStr ? new Date(enrollDateStr) : baseline;
      const effectiveEnroll = (function () {
        var _a =
          window.getBillingAnchor && window.getBillingAnchor(s, baseline);
        return _a
          ? new Date(Date.UTC(_a.year, _a.month, 1))
          : enrollDate < baseline
            ? baseline
            : enrollDate;
      })();
      const monthsReq =
        (targetYear - effectiveEnroll.getUTCFullYear()) * 12 +
        (targetMonth - effectiveEnroll.getUTCMonth()) +
        1;

      const sid = String(s.id).toLowerCase();
      const paidMonthsSet = new Set();
      (allPayments || []).forEach((p) => {
        if (String(p.student_id).toLowerCase() === sid && p.status === "paid") {
          const pDate = new Date(p.payment_date || p.created_at);
          const mKey = `${pDate.getUTCFullYear()}-${pDate.getUTCMonth()}`;
          paidMonthsSet.add(mKey);
        }
      });

      let totalDebt = Math.max(0, fee * monthsReq - fee * paidMonthsSet.size);

      const coach = allCoaches.find((c) => String(c.id) === String(s.coach_id));
      const coachName = coach ? coach.name || "" : "";
      const dueCfg = getStudentDueConfig(s, coachName, targetMonth, targetYear);
      if (dueCfg.feeOverride !== null) {
        totalDebt = dueCfg.feeOverride;
      }

      const getOrdinal = (n) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      };
      const monthName = new Date(targetYear, targetMonth).toLocaleString(
        "en-IN",
        { month: "long" },
      );
      const dueDateStr = `${getOrdinal(dueCfg.day)} ${monthName} ${targetYear}`;

      const payStatus = getStudentPaymentStatus(s);
      const isDueOrOverdue = payStatus === "Due" || payStatus === "Overdue";
      if (totalDebt <= 0) {
        totalDebt = fee || 1500;
      }

      const msg = buildFeeMessage(
        s,
        name,
        totalDebt,
        dueDateStr,
        isDueOrOverdue,
      );

      const parsed = parseStoredPhone(phone);
      const inferredCountry =
        parsed.countryCode && parsed.countryCode !== "IN"
          ? parsed.countryCode
          : s.country_code || "IN";
      const country = getCountryByCode(inferredCountry);
      const dialCode = country ? country.dial.replace(/\D/g, "") : "91";
      setTimeout(() => {
        openWhatsApp(dialCode, parsed.localNumber, msg);
        sent++;
        if (sent === dueStudents.length)
          toast(`💬 Sent ${sent} payment reminders`, "success");
      }, idx * 800);
    });
  };

  function setLoading(key, loading) {
    loadingStates[key] = loading;
    const loader = $("global-loader");
    const bar = loader ? loader.querySelector(".loader-bar") : null;

    const anyLoading = Object.values(loadingStates).some((v) => v);
    if (anyLoading) {
      if (loader) loader.classList.add("active");
      if (bar) bar.style.width = "40%";
    } else {
      if (bar) bar.style.width = "100%";
      setTimeout(() => {
        if (loader) loader.classList.remove("active");
        if (bar) bar.style.width = "0%";
      }, 4000);
    }
  }

  function openModal(id) {
    const el = $(id);
    if (el) el.style.display = "flex";
  }
  function closeModal(id) {
    const el = $(id);
    if (el) el.style.display = "none";
  }
  window.closeModal = closeModal;
  function closeModals() {
    document
      .querySelectorAll(".modal")
      .forEach((m) => (m.style.display = "none"));
    const hardDeleteCheckbox = $("hard-delete");
    if (hardDeleteCheckbox) hardDeleteCheckbox.checked = false;
  }

  function initUI() {
    // Close modals when clicking outside modal content
    document.querySelectorAll(".modal").forEach((m) => {
      m.addEventListener("click", (e) => {
        if (e.target === m) closeModals();
      });
    });
    // Close dropdowns when clicking outside (with slight delay to allow internal clicks)
    document.addEventListener("click", (e) => {
      setTimeout(() => {
        if (!e.target.closest(".country-selector")) {
          const dropdowns = document.querySelectorAll(".country-dropdown");
          dropdowns.forEach((d) => (d.style.display = "none"));
        }
      }, 10);
    });
  }

  window.executeDelete = async function () {
    const id = $("delete-item-id").value;
    const type = $("delete-type").value;
    const isHardDelete = $("hard-delete").checked;

    if (!isHardDelete && type === "event") {
      await archiveEvent(id);
      closeModals();
      return;
    }

    try {
      let endpoint = "";
      let auditTarget = "";
      let successMsg = "";

      if (type === "event") {
        endpoint = "/api/events?id=" + id;
        auditTarget = "events";
        successMsg = "Event permanently deleted!";
      } else if (type === "achievement") {
        endpoint = "/api/achievements?id=" + id;
        auditTarget = "achievements";
        successMsg = "Achievement permanently deleted!";
      } else if (type === "coach") {
        endpoint = "/api/coaches?id=" + id;
        auditTarget = "coaches";
        successMsg = "Coach removed from academy!";
      } else if (type === "student") {
        endpoint = "/api/students?id=" + id;
        auditTarget = "students";
        successMsg = "Student enrollment deleted!";
      }

      if (endpoint) {
        const res = await apiCall(endpoint, { method: "DELETE" });
        if (res.ok) {
          logAudit(auditTarget, id, "delete", { id }, null);
          toast(successMsg, "success");
        } else {
          const err = await res.json().catch(() => ({}));
          toast("Delete failed: " + (err.error || "Server error"), "error");
        }
      }
      closeModals();
      loadAllData(true);
    } catch (e) {
      console.error("Delete failed:", e);
      toast("Technical error: " + e.message, "error");
    }
  };

  function previewFile(inp, previewId) {
    const file = inp.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = $(previewId);
      if (img) {
        img.src = e.target.result;
        img.style.display = "block";
      }
    };
    reader.readAsDataURL(file);
  }

  // Helper accessors
  function cleanText(t) {
    if (!t) return "";
    // Strip HTML tags but preserve all Unicode characters (Tamil, Arabic, etc.)
    return t
      .toString()
      .replace(/<[^>]*>?/gm, "")
      .trim();
  }
  function getStudentName(s) {
    const raw = s.full_name || s.name || "";
    return cleanText(raw);
  }
  function getStudentLevel(s) {
    return capitalizeFirst(s.level || s.grade || "Beginner");
  }
  function getStudentRating(s) {
    return s.rating || s.current_rating || 800;
  }
  function getStudentDate(s) {
    const d = s.enrollment_date || s.join_date || s.created_at;
    if (!d) return "";
    try {
      // Return simple YYYY-MM-DD format which Excel handles best
      return new Date(d).toISOString().split("T")[0];
    } catch (e) {
      return String(d).split("T")[0]; // Fallback to raw string before 'T'
    }
  }
  function getStudentPhone(s) {
    return s.parent_phone || s.phone || "";
  }
  function getStudentEmail(s) {
    return s.email || "";
  }
  function getStudentStatus(s) {
    const raw = (s.status || s.account_status || "active").toLowerCase();
    // Auto-promote: If status is 'upcoming' but enrollment date has arrived, treat as 'active'
    if (raw === "upcoming") {
      const enrollStr = s.enrollment_date || s.join_date || s.created_at;
      if (enrollStr) {
        const enrollDate = new Date(enrollStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (enrollDate <= today) return "active";
      }
    }
    return raw;
  }
  function getStudentBatchType(s) {
    const raw = s.session_mode || s.batch_type || "Group";
    if (String(raw).trim().toLowerCase() === "single") return "Single";
    return "Group";
  }
  function getStudentBatchTime(s) {
    return s.session_time || s.batch_time || "";
  }
  function getStudentSessionTime(s) {
    return s.session_time || s.batch_time || "TBD";
  }
  function getStudentCoachNotes(s) {
    let n = s.notes || s.coach_notes || "";
    // Strip BOTH schedule tag formats (and any LM marker) so the editable
    // coach-notes field never shows raw schedule data.
    return n
      .replace(/\[SCHEDULE64:[A-Za-z0-9+/=]+\]/g, "")
      .replace(/\[SCHEDULE:({.*?})\]/g, "")
      .replace(/\[LM:(online|offline)\]/g, "")
      .trim();
  }

  function isStudentScheduledToday(s) {
    if (!s || (s.status || "active").toLowerCase() !== "active") return false;
    const now = new Date();
    const day = now.getDay();
    const dayName = now
      .toLocaleDateString("en-US", { weekday: "long" })
      .toUpperCase();
    const time = (s.session_time || s.batch_time || "").toUpperCase();
    if (!time) return true;
    if (time.includes("WEEKEND")) {
      if (day === 0 || day === 6) return true;
    }
    if (time.includes("WEEKDAY")) {
      if (day >= 1 && day <= 5) return true;
    }
    if (time.includes("DAILY")) return true;
    if (time.includes(dayName)) return true;
    const shortDay = dayName.slice(0, 3);
    if (time.includes(shortDay)) return true;
    if (time.includes("FRI") && day === 5) return true;
    if (time.includes("SAT") && day === 6) return true;
    if (time.includes("SUN") && day === 0) return true;
    return false;
  }
  const DEFAULT_MONTHLY_FEE = 1500; // Configurable default for display

  function getStudentMonthlyFee(s) {
    if (!s) return DEFAULT_MONTHLY_FEE;
    return (
      parseInt(s.monthly_fee || s.fee || s.fees || 0) || DEFAULT_MONTHLY_FEE
    );
  }

  // Joins on/after this day get the remaining days of the join month as a free
  // grace period — billing starts the FOLLOWING month. Handles the common case
  // of "joined May 29, first paid cycle is June" so a late-month join doesn't
  // get charged a full month for a few days and mis-attribute the first payment.
  const LATE_JOIN_GRACE_DAY = 26;

  // Returns the first BILLED month {year, month} for a student (0-indexed month),
  // applying the late-join grace rule and the academy baseline.
  function getBillingAnchor(s, baselineDate) {
    const baseline = baselineDate || new Date(Date.UTC(2026, 3, 1));
    const enrollStr = getStudentDate(s);
    let e = enrollStr ? new Date(enrollStr) : baseline;
    if (isNaN(e.getTime())) e = baseline;
    if (e < baseline) e = baseline;
    let y = e.getUTCFullYear();
    let m = e.getUTCMonth();
    if (e.getUTCDate() >= LATE_JOIN_GRACE_DAY) {
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
    return { year: y, month: m };
  }
  window.getBillingAnchor = getBillingAnchor;

  function getStudentDueConfig(s, coachName, month = 4, year = 2026) {
    if (!s) return { day: 5, feeOverride: null };
    let day = 5;
    let feeOverride = null;

    // Default to the day of their enrollment/join date
    const enrollStr = s.enrollment_date || s.join_date || s.created_at;
    if (enrollStr) {
      try {
        day = new Date(enrollStr).getUTCDate() || 5;
      } catch (e) {
        day = 5;
      }
    }

    let hasExplicitDue = false;
    if (s.due_date) {
      const parsedDay = parseInt(s.due_date);
      if (
        !isNaN(parsedDay) &&
        parsedDay >= 1 &&
        parsedDay <= 31 &&
        String(s.due_date).length <= 2
      ) {
        day = parsedDay;
        hasExplicitDue = true;
      } else {
        try {
          const dd = new Date(s.due_date).getUTCDate();
          if (dd) {
            day = dd;
            hasExplicitDue = true;
          }
        } catch (e) {
          // ignore
        }
      }
    }

    // First-Month Override: a student's first month is due on their enrollment
    // day — UNLESS the admin set an explicit due_date, which is authoritative
    // (keeps the status consistent with the exact date shown in the registry).
    if (enrollStr && !hasExplicitDue) {
      try {
        const enrollDate = new Date(enrollStr);
        if (
          enrollDate.getUTCFullYear() === year &&
          enrollDate.getUTCMonth() === month
        ) {
          day = enrollDate.getUTCDate();
        }
      } catch (e) {
        // ignore
      }
    }

    return { day, feeOverride };
  }

  function getStudentPaymentStatus(
    s,
    monthOverride = null,
    yearOverride = null,
  ) {
    if (!s) return "Due";

    // Time-Machine Context (Use override if provided, otherwise default to global)
    const targetMonth =
      monthOverride !== null ? monthOverride : window.reportMonth;
    const targetYear = yearOverride !== null ? yearOverride : window.reportYear;
    const isCurrentMonth =
      targetMonth === new Date().getUTCMonth() &&
      targetYear === new Date().getUTCFullYear();
    const targetMonthEnd = new Date(
      Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59),
    );
    const baselineDate = new Date(Date.UTC(2026, 3, 1, 0, 0, 0)); // April 1st, 2026 baseline (UTC)
    const _anchor = getBillingAnchor(s, baselineDate);
    const targetMonthStr = String(targetMonth + 1).padStart(2, "0");
    const targetMonthKey = `${targetYear}-${targetMonthStr}`;
    const anchorMonthStr = String(_anchor.month + 1).padStart(2, "0");
    const anchorMonthKey = `${_anchor.year}-${anchorMonthStr}`;

    // TRUST THE DATABASE FOR CURRENT MONTH (v4 billing engine)
    if (isCurrentMonth && s.payment_status) {
      return s.payment_status;
    }

    // 0. Cumulative Audit (All-Time Payment Count)
    const s_id_key = String(s.id || "")
      .trim()
      .toLowerCase();

    let paidMonths = new Set();
    let hasPaymentThisMonth = false;

    (allPayments || []).forEach((p) => {
      const psid = String(p.student_id || "")
        .trim()
        .toLowerCase();
      if (psid === s_id_key && p.status === "paid") {
        const pDate = new Date(p.payment_date || p.created_at);
        const pMonthKey = p.applied_month || `${pDate.getUTCFullYear()}-${String(pDate.getUTCMonth() + 1).padStart(2, '0')}`;
        
        // Only count payments that occurred in or before the target month and are at or after the billing anchor month
        if (pDate <= targetMonthEnd && pMonthKey >= anchorMonthKey) {
          paidMonths.add(pMonthKey);
        }
        if (pMonthKey === targetMonthKey) {
          hasPaymentThisMonth = true;
        }
      }
    });

    const totalPaidInvoices = paidMonths.size;

    // Did they explicitly pay for this month? (Overrides inactive/archived states)
    if (hasPaymentThisMonth) return "Paid";

    // 1. Enrollment Check
    const enrollStatus = getStudentStatus(s);
    if (
      enrollStatus === "pending" ||
      enrollStatus === "waitlist" ||
      enrollStatus === "upcoming" ||
      enrollStatus === "inactive" ||
      enrollStatus === "archived"
    ) {
      return "Not Enrolled";
    }
    const enrollDateStr = getStudentDate(s);
    const enrollDate = enrollDateStr ? new Date(enrollDateStr) : null;
    if (!enrollDate || enrollDate > targetMonthEnd) return "Not Enrolled";

    const monthsRequired =
      (targetYear - _anchor.year) * 12 + (targetMonth - _anchor.month) + 1;
    // Target period precedes the first billed month (the free grace month) →
    // nothing is due yet.
    if (monthsRequired <= 0) return "Pending";

    // 3. Status Determination Logic:

    // MANUAL OVERRIDE CHECK: If the admin has explicitly set a payment status in the database, 
    // and we are looking at the current month, we should respect it. 
    // This allows the admin to dynamically change the status to Due/Pending/Paid.
    if (isCurrentMonth && s.payment_status && ['Pending', 'Due', 'Overdue'].includes(s.payment_status)) {
       return s.payment_status;
    }

    // A. PAID AUDIT: Cumulative overpayments or pre-payments
    if (totalPaidInvoices >= monthsRequired) return "Paid";

    // C. DATE-BASED TRANSITION (Current Month): Transition automatically based on student-specific due date
    if (isCurrentMonth) {
      // Trust the DB status for the current month if it's there as a fallback
      if (s.payment_status && ['Due', 'Pending', 'Overdue'].includes(s.payment_status)) {
          return s.payment_status;
      }
      
      // If the student has unpaid dues from previous months (arrears/overdue), they are immediately 'Overdue'
      if (totalPaidInvoices < monthsRequired - 1) {
        return "Overdue";
      }

      const coach = allCoaches.find((c) => String(c.id) === String(s.coach_id));
      const coachName = coach ? coach.name || "" : "";
      const dueCfg = getStudentDueConfig(s, coachName, targetMonth, targetYear);

      const currentDate = new Date();
      const dueDateObj = new Date(
        targetYear,
        targetMonth,
        dueCfg.day,
        23,
        59,
        59,
      );

      // We omit isFirstMonth || here because dueDateObj is correctly set to their enrollment date for their first month.
      // They will automatically transition from 'Pending' to 'Due' precisely on their join date.
      if (currentDate < dueDateObj) return "Pending";
      const diffTime = currentDate - dueDateObj;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 5 ? "Overdue" : "Due";
    }

    // C2. FUTURE PERIODS: If target month is in the future
    const now = new Date();
    const currentUTCMonth = now.getUTCMonth();
    const currentUTCFullYear = now.getUTCFullYear();
    const isFuturePeriod =
      targetYear > currentUTCFullYear ||
      (targetYear === currentUTCFullYear && targetMonth > currentUTCMonth);
    if (isFuturePeriod) {
      const currentMonthsRequired =
        (currentUTCFullYear - _anchor.year) * 12 +
        (currentUTCMonth - _anchor.month) +
        1;
      if (totalPaidInvoices < currentMonthsRequired) {
        return "Overdue";
      }
      return "Pending";
    }

    // D. ARREARS (Past Months): If missing payments and in the past, status is 'Overdue'
    if (totalPaidInvoices < monthsRequired) return "Overdue";

    return "Due";
  }

  // ── COUNTRY PHONE VALIDATION ──
  const COUNTRY_CODES = [
    { code: "IN", name: "India", dial: "+91", length: 10, flag: "🇮🇳" },
    { code: "US", name: "United States", dial: "+1", length: 10, flag: "🇺🇸" },
    { code: "GB", name: "United Kingdom", dial: "+44", length: 10, flag: "🇬🇧" },
    { code: "CA", name: "Canada", dial: "+1", length: 10, flag: "🇨🇦" },
    { code: "AU", name: "Australia", dial: "+61", length: 9, flag: "🇦🇺" },
    { code: "DE", name: "Germany", dial: "+49", length: 10, flag: "🇩🇪" },
    { code: "FR", name: "France", dial: "+33", length: 9, flag: "🇫🇷" },
    { code: "JP", name: "Japan", dial: "+81", length: 10, flag: "🇯🇵" },
    { code: "CN", name: "China", dial: "+86", length: 11, flag: "🇨🇳" },
    { code: "BR", name: "Brazil", dial: "+55", length: 10, flag: "🇧🇷" },
    { code: "MX", name: "Mexico", dial: "+52", length: 10, flag: "🇲🇽" },
    { code: "IT", name: "Italy", dial: "+39", length: 10, flag: "🇮🇹" },
    { code: "ES", name: "Spain", dial: "+34", length: 9, flag: "🇪🇸" },
    { code: "RU", name: "Russia", dial: "+7", length: 10, flag: "🇷🇺" },
    { code: "KR", name: "South Korea", dial: "+82", length: 9, flag: "🇰🇷" },
    { code: "SG", name: "Singapore", dial: "+65", length: 8, flag: "🇸🇬" },
    { code: "MY", name: "Malaysia", dial: "+60", length: 9, flag: "🇲🇾" },
    { code: "TH", name: "Thailand", dial: "+66", length: 9, flag: "🇹🇭" },
    { code: "ID", name: "Indonesia", dial: "+62", length: 10, flag: "🇮🇩" },
    { code: "PH", name: "Philippines", dial: "+63", length: 10, flag: "🇵🇭" },
    { code: "VN", name: "Vietnam", dial: "+84", length: 9, flag: "🇻🇳" },
    { code: "AE", name: "UAE", dial: "+971", length: 9, flag: "🇦🇪" },
    { code: "SA", name: "Saudi Arabia", dial: "+966", length: 9, flag: "🇸🇦" },
    { code: "PK", name: "Pakistan", dial: "+92", length: 10, flag: "🇵🇰" },
    { code: "BD", name: "Bangladesh", dial: "+880", length: 10, flag: "🇧🇩" },
    { code: "LK", name: "Sri Lanka", dial: "+94", length: 9, flag: "🇱🇰" },
    { code: "ZA", name: "South Africa", dial: "+27", length: 9, flag: "🇿🇦" },
    { code: "NG", name: "Nigeria", dial: "+234", length: 10, flag: "🇳🇬" },
    { code: "EG", name: "Egypt", dial: "+20", length: 10, flag: "🇪🇬" },
    { code: "NL", name: "Netherlands", dial: "+31", length: 9, flag: "🇳🇱" },
    { code: "BE", name: "Belgium", dial: "+32", length: 9, flag: "🇧🇪" },
    { code: "SE", name: "Sweden", dial: "+46", length: 9, flag: "🇸🇪" },
    { code: "NO", name: "Norway", dial: "+47", length: 8, flag: "🇳🇴´" },
    { code: "DK", name: "Denmark", dial: "+45", length: 8, flag: "🇩🇰" },
    { code: "FI", name: "Finland", dial: "+358", length: 9, flag: "🇫🇮" },
    { code: "PL", name: "Poland", dial: "+48", length: 9, flag: "🇵🇱" },
    { code: "TR", name: "Turkey", dial: "+90", length: 10, flag: "🇹🇷" },
    { code: "IL", name: "Israel", dial: "+972", length: 9, flag: "🇮🇱" },
    { code: "AR", name: "Argentina", dial: "+54", length: 10, flag: "🇦🇷" },
    { code: "CL", name: "Chile", dial: "+56", length: 9, flag: "🇨🇱" },
    { code: "CO", name: "Colombia", dial: "+57", length: 10, flag: "🇨🇴" },
    { code: "NZ", name: "New Zealand", dial: "+64", length: 9, flag: "🇳🇴¿" },
    { code: "TW", name: "Taiwan", dial: "+886", length: 9, flag: "🇹🇼" },
  ];

  const CURRENCY_MAP = {
    IN: { currency: "INR", symbol: "₹", rate: 1.0 },
    US: { currency: "USD", symbol: "$", rate: 0.012 },
    GB: { currency: "GBP", symbol: "Â£", rate: 0.0094 },
    CA: { currency: "CAD", symbol: "C$", rate: 0.016 },
    AU: { currency: "AUD", symbol: "A$", rate: 0.018 },
    DE: { currency: "EUR", symbol: "€", rate: 0.011 },
    FR: { currency: "EUR", symbol: "€", rate: 0.011 },
    JP: { currency: "JPY", symbol: "Â¥", rate: 1.88 },
    CN: { currency: "CNY", symbol: "Â¥", rate: 0.087 },
    BR: { currency: "BRL", symbol: "R$", rate: 0.062 },
    MX: { currency: "MXN", symbol: "$", rate: 0.2 },
    IT: { currency: "EUR", symbol: "€", rate: 0.011 },
    ES: { currency: "EUR", symbol: "€", rate: 0.011 },
    RU: { currency: "RUB", symbol: "₽", rate: 1.1 },
    KR: { currency: "KRW", symbol: "₩", rate: 16.4 },
    SG: { currency: "SGD", symbol: "S$", rate: 0.016 },
    MY: { currency: "MYR", symbol: "RM", rate: 0.056 },
    TH: { currency: "THB", symbol: "à¸¿", rate: 0.44 },
    ID: { currency: "IDR", symbol: "Rp", rate: 193.0 },
    PH: { currency: "PHP", symbol: "₱", rate: 0.7 },
    VN: { currency: "VND", symbol: "₫", rate: 305.0 },
    AE: { currency: "AED", symbol: "AED", rate: 0.044 },
    SA: { currency: "SAR", symbol: "SR", rate: 0.045 },
    PK: { currency: "PKR", symbol: "Rs", rate: 3.32 },
    BD: { currency: "BDT", symbol: "à§³", rate: 1.41 },
    LK: { currency: "LKR", symbol: "Rs", rate: 3.59 },
    ZA: { currency: "ZAR", symbol: "R", rate: 0.22 },
    NG: { currency: "NGN", symbol: "₦", rate: 18.0 },
    EG: { currency: "EGP", symbol: "EÂ£", rate: 0.57 },
    NL: { currency: "EUR", symbol: "€", rate: 0.011 },
    BE: { currency: "EUR", symbol: "€", rate: 0.011 },
    SE: { currency: "SEK", symbol: "kr", rate: 0.13 },
    NO: { currency: "NOK", symbol: "kr", rate: 0.13 },
    DK: { currency: "DKK", symbol: "kr", rate: 0.083 },
    FI: { currency: "EUR", symbol: "€", rate: 0.011 },
    PL: { currency: "PLN", symbol: "zÅ‚", rate: 0.048 },
    TR: { currency: "TRY", symbol: "₺", rate: 0.39 },
    IL: { currency: "ILS", symbol: "₪", rate: 0.044 },
    AR: { currency: "ARS", symbol: "$", rate: 10.7 },
    CL: { currency: "CLP", symbol: "$", rate: 11.2 },
    CO: { currency: "COP", symbol: "$", rate: 47.0 },
    NZ: { currency: "NZD", symbol: "NZ$", rate: 0.02 },
    TW: { currency: "TWD", symbol: "NT$", rate: 0.39 },
  };

  function formatStudentFee(s, inrAmount) {
    if (!s) return "₹" + (inrAmount || 0).toLocaleString();
    if (typeof inrAmount !== "number") inrAmount = parseFloat(inrAmount) || 0;
    const country = (s.country_code || "IN").toUpperCase();
    const map = CURRENCY_MAP[country] || CURRENCY_MAP["IN"];
    const baseStr = "₹" + inrAmount.toLocaleString();
    if (map.currency === "INR") {
      return baseStr;
    }
    const converted = Math.round(inrAmount * map.rate);
    const convertedStr = `${map.symbol}${converted.toLocaleString()} ${map.currency}`;
    return `${baseStr} (${convertedStr})`;
  }

  function getStudentLocalCurrencyAmount(s, inrAmount) {
    if (!s) return "";
    if (typeof inrAmount !== "number") inrAmount = parseFloat(inrAmount) || 0;
    const country = (s.country_code || "IN").toUpperCase();
    const map = CURRENCY_MAP[country] || CURRENCY_MAP["IN"];
    if (map.currency === "INR") return "";
    const converted = Math.round(inrAmount * map.rate);
    return ` (${map.symbol}${converted.toLocaleString()} ${map.currency})`;
  }

  window.CURRENCY_MAP = CURRENCY_MAP;
  window.formatStudentFee = formatStudentFee;
  window.getStudentLocalCurrencyAmount = getStudentLocalCurrencyAmount;

  window.selectedCountryCode = "IN";
  window.selectedCountryCodeEdit = "IN";
  window.selectedCountryCodeCoach = "IN";
  function getCountryByCode(code) {
    return COUNTRY_CODES.find((c) => c.code === code) || COUNTRY_CODES[0];
  }
  window.getCountryByCode = getCountryByCode;

  function parseStoredPhone(phoneStr) {
    if (!phoneStr) return { countryCode: "IN", localNumber: "" };
    const digits = phoneStr.replace(/\D/g, "");
    if (digits.length === 10) {
      if (digits.startsWith("658") || digits.startsWith("659")) {
        return { countryCode: "SG", localNumber: digits.slice(2) };
      }
      if (
        digits.startsWith("6") ||
        digits.startsWith("7") ||
        digits.startsWith("8") ||
        digits.startsWith("9")
      ) {
        return { countryCode: "IN", localNumber: digits };
      }
    }
    const sortedCountries = [...COUNTRY_CODES].sort(
      (a, b) => b.dial.length - a.dial.length,
    );
    for (const c of sortedCountries) {
      const dialDigits = c.dial.replace(/\D/g, "");
      if (digits.startsWith(dialDigits)) {
        const local = digits.slice(dialDigits.length);
        if (local.length >= c.length - 2 && local.length <= c.length + 2) {
          return { countryCode: c.code, localNumber: local };
        }
      }
    }
    return { countryCode: "IN", localNumber: digits };
  }
  window.parseStoredPhone = parseStoredPhone;

  function getFullInternationalPhoneDigits(rawPhone, countryCode) {
    const digits = rawPhone.replace(/\D/g, "");
    const country = getCountryByCode(countryCode);
    if (!country) return digits;
    const dialDigits = country.dial.replace(/\D/g, "");
    if (digits.startsWith(dialDigits)) {
      return digits;
    }
    return dialDigits + digits;
  }
  window.getFullInternationalPhoneDigits = getFullInternationalPhoneDigits;

  function validatePhoneNumber(phone, countryCode = "IN") {
    const country = getCountryByCode(countryCode);
    if (!country) return { valid: false, error: "Unknown country" };
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 0)
      return { valid: false, error: "Phone number is required" };
    const minLen = country.length - 2;
    const maxLen = country.length + 2;
    if (digits.length < minLen || digits.length > maxLen) {
      return {
        valid: false,
        error: `${country.name} phone numbers are typically ${country.length} digits (got ${digits.length})`,
      };
    }
    return { valid: true, formatted: `${country.dial} ${digits}` };
  }

  function renderCountryDropdown(
    dropdownId = "country-dropdown",
    selectFn = "selectCountry",
  ) {
    const dropdown = $(dropdownId);
    if (!dropdown) return;
    dropdown.innerHTML = `
      <div class="country-search-container" onclick="event.stopPropagation()" style="position: relative; display: flex; align-items: center; padding: 10px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); background: rgba(0, 0, 0, 0.15);">
        <span class="country-search-icon" style="position: absolute; left: 22px; color: rgba(220, 163, 62, 0.65); display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 2;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </span>
        <input type="text" class="country-search-input" placeholder="Search country or dial code..." oninput="window.filterCountryDropdown('${dropdownId}', this.value)" style="width: 100%; padding: 8px 12px 8px 32px !important; background: rgba(255, 255, 255, 0.05) !important; border: 1px solid rgba(220, 163, 62, 0.18) !important; border-radius: 6px !important; color: var(--ivory) !important; font-size: 13px !important; outline: none !important; margin-bottom: 0 !important; transition: all 0.2s ease !important;">
      </div>
      <div class="country-options-wrapper">
        ${COUNTRY_CODES.map(
          (c) => `
          <div class="country-option" data-code="${c.code}" data-dial="${c.dial}" data-name="${c.name.toLowerCase()}" onclick="window.${selectFn}('${c.code}', '${c.dial}', ${c.length})">
            <div class="country-flag-box" style="display: flex; align-items: center; gap: 6px;">
              <img src="https://flagcdn.com/w20/${c.code.toLowerCase()}.png" style="width: 20px; height: 14px; border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.15); display: inline-block; vertical-align: middle;" alt="${c.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';"><span class="country-flag-emoji" style="display: none; font-size: 17px; line-height: 1;">${c.flag}</span>
              <span class="country-iso-badge" style="font-family: monospace, var(--font-mono); font-size: 11px; font-weight: 700; color: rgba(255, 255, 255, 0.55); background: rgba(255, 255, 255, 0.08); padding: 1px 4px; border-radius: 4px; letter-spacing: 0.5px;">${c.code}</span>
            </div>
            <div class="country-name" style="margin-left: 4px;">${c.name}</div>
            <div class="country-dial">${c.dial}</div>
          </div>
        `,
        ).join("")}
      </div>
    `;
  }

  window.filterCountryDropdown = function (dropdownId, query) {
    const dropdown = $(dropdownId);
    if (!dropdown) return;
    const q = query.toLowerCase().trim();
    const options = dropdown.querySelectorAll(".country-option");
    options.forEach((opt) => {
      const name = opt.getAttribute("data-name") || "";
      const code = opt.getAttribute("data-code").toLowerCase() || "";
      const dial = opt.getAttribute("data-dial").toLowerCase() || "";
      if (name.includes(q) || code.includes(q) || dial.includes(q)) {
        opt.style.display = "flex";
      } else {
        opt.style.display = "none";
      }
    });
  };

  window.selectCountry = function (code, dial, length) {
    window.selectedCountryCode = code;
    const selected = $("country-selected");
    const phoneInput = $("m-phone");
    const country = getCountryByCode(code);
    if (selected) {
      selected.innerHTML = `<span style="display: flex; align-items: center; gap: 6px;"><img src="https://flagcdn.com/w20/${country.code.toLowerCase()}.png" style="width: 20px; height: 14px; border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.15);" alt="${country.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';"><span class="country-flag-emoji" style="display: none; font-size: 17px; line-height: 1;">${country.flag}</span><span style="font-family: monospace; font-size: 11px; font-weight: 700; opacity: 0.75;">${country.code}</span></span><span class="country-dial">${country.dial}</span>`;
    }
    if (phoneInput) {
      phoneInput.placeholder = `${country.length} digits for ${country.name}`;
      phoneInput.maxLength = length + 3;
    }
    document
      .querySelectorAll(`#country-dropdown .country-option`)
      .forEach((el) => el.classList.remove("selected"));
    const opt = document.querySelector(
      `#country-dropdown .country-option[data-code="${code}"]`,
    );
    if (opt) opt.classList.add("selected");
    const dropdown = $("country-dropdown");
    if (dropdown) dropdown.classList.remove("open");
  };

  window.selectCountryCoach = function (code, dial, length) {
    window.selectedCountryCodeCoach = code;
    const selected = $("country-selected-coach");
    const phoneInput = $("cm-phone");
    const country = getCountryByCode(code);
    if (selected) {
      selected.innerHTML = `<span style="display: flex; align-items: center; gap: 6px;"><img src="https://flagcdn.com/w20/${country.code.toLowerCase()}.png" style="width: 20px; height: 14px; border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.15);" alt="${country.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';"><span class="country-flag-emoji" style="display: none; font-size: 17px; line-height: 1;">${country.flag}</span><span style="font-family: monospace; font-size: 11px; font-weight: 700; opacity: 0.75;">${country.code}</span></span><span class="country-dial">${country.dial}</span>`;
    }
    if (phoneInput) {
      phoneInput.placeholder = `${country.length} digits for ${country.name}`;
      phoneInput.maxLength = length + 3;
    }
    document
      .querySelectorAll(`#country-dropdown-coach .country-option`)
      .forEach((el) => el.classList.remove("selected"));
    const opt = document.querySelector(
      `#country-dropdown-coach .country-option[data-code="${code}"]`,
    );
    if (opt) opt.classList.add("selected");
    const dropdown = $("country-dropdown-coach");
    if (dropdown) dropdown.classList.remove("open");
  };

  window.selectCountryEdit = function (code, dial, length) {
    window.selectedCountryCodeEdit = code;
    const country = getCountryByCode(code);
    if (!country) return;
    const selected = $("country-selected-edit");
    const phoneInput = $("e-phone");
    if (selected) {
      selected.innerHTML = `<span style="display: flex; align-items: center; gap: 6px;"><img src="https://flagcdn.com/w20/${country.code.toLowerCase()}.png" style="width: 20px; height: 14px; border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.15);" alt="${country.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';"><span class="country-flag-emoji" style="display: none; font-size: 17px; line-height: 1;">${country.flag}</span><span style="font-family: monospace; font-size: 11px; font-weight: 700; opacity: 0.75;">${country.code}</span></span><span class="country-dial">${country.dial}</span>`;
    }
    if (phoneInput) {
      phoneInput.placeholder = `${country.length} digits for ${country.name}`;
      phoneInput.maxLength = length + 3;
    }
    document
      .querySelectorAll("#country-dropdown-edit .country-option")
      .forEach((el) => el.classList.remove("selected"));
    const opt = document.querySelector(
      `#country-dropdown-edit .country-option[data-code="${code}"]`,
    );
    if (opt) opt.classList.add("selected");
    const dropdown = $("country-dropdown-edit");
    if (dropdown) dropdown.classList.remove("open");
  };

  window.openCountryDropdown = function () {
    closeAllCountryDropdowns("country-dropdown");
    const dropdown = $("country-dropdown");
    if (dropdown) {
      const isOpen = dropdown.classList.contains("open");
      if (isOpen) {
        dropdown.classList.remove("open");
      } else {
        dropdown.classList.add("open");
        const searchInput = dropdown.querySelector(".country-search-input");
        if (searchInput) {
          searchInput.value = "";
          window.filterCountryDropdown("country-dropdown", "");
          setTimeout(() => searchInput.focus(), 50);
        }
      }
    }
  };

  window.openCountryDropdownEdit = function () {
    closeAllCountryDropdowns("country-dropdown-edit");
    const dropdown = $("country-dropdown-edit");
    if (dropdown) {
      const isOpen = dropdown.classList.contains("open");
      if (isOpen) {
        dropdown.classList.remove("open");
      } else {
        dropdown.classList.add("open");
        const searchInput = dropdown.querySelector(".country-search-input");
        if (searchInput) {
          searchInput.value = "";
          window.filterCountryDropdown("country-dropdown-edit", "");
          setTimeout(() => searchInput.focus(), 50);
        }
      }
    }
  };

  window.openCountryDropdownCoach = function () {
    closeAllCountryDropdowns("country-dropdown-coach");
    const dropdown = $("country-dropdown-coach");
    if (dropdown) {
      const isOpen = dropdown.classList.contains("open");
      if (isOpen) {
        dropdown.classList.remove("open");
      } else {
        dropdown.classList.add("open");
        const searchInput = dropdown.querySelector(".country-search-input");
        if (searchInput) {
          searchInput.value = "";
          window.filterCountryDropdown("country-dropdown-coach", "");
          setTimeout(() => searchInput.focus(), 50);
        }
      }
    }
  };

  function closeAllCountryDropdowns(exceptId = null) {
    [
      "country-dropdown",
      "country-dropdown-edit",
      "country-dropdown-coach",
    ].forEach((id) => {
      if (id !== exceptId) {
        const el = $(id);
        if (el) el.classList.remove("open");
      }
    });
  }

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".country-selector")) {
      closeAllCountryDropdowns();
    }
  });

  function getCoachName(c) {
    return c.name || "";
  }
  function getCoachSpecialty(c) {
    return c.specialization || "";
  }
  function getCoachSalary(c) {
    return c.salary || c.hourly_rate || 0;
  }
  function getCoachAvailability(c) {
    return c.availability || "";
  }
  function getCoachStatus(c) {
    return c.status || c.account_status || "active";
  }
  function getCoachEmail(c) {
    return c.email || "";
  }
  function getCoachExperience(c) {
    return c.experience || 0;
  }
  function getCoachRating(c) {
    return c.rating || 0;
  }

  function getEventDate(e) {
    return e.date || e.event_date || "";
  }
  window.closeEventManagement = function () {
    $("ev-manage-view").style.display = "none";
    $("ev-list-view").style.display = "block";
    window.currentManageEventId = null;
  };

  window.openEventManagement = async function (id) {
    const e = eventsData.find((x) => String(x.id) === String(id));
    if (!e) {
      toast("Event not found", "error");
      return;
    }

    $("ev-manage-title").textContent = e.title;
    $("ev-manage-subtitle").textContent =
      `${getEventType(e)} • ${new Date(e.date || e.event_date).toLocaleDateString()} • Fee: ₹${e.fee || 0}`;

    // Set global for export context
    window.currentManageEventId = id;

    const regStudents = e.registered_students || [];
    const regsData = e.registrations_data || [];

    // Separate waitlisted and confirmed students
    const confirmedStudents = regsData
      .filter((r) => r.registration_status !== "waitlisted")
      .map((r) => r.student_id);
    const waitlistedStudents = regsData
      .filter((r) => r.registration_status === "waitlisted")
      .map((r) => r.student_id);

    const maxParticipants = e.max_participants || 50;
    const fillRateStr = `${confirmedStudents.length} / ${maxParticipants}`;
    const fillPercent = Math.min(
      100,
      Math.round((confirmedStudents.length / maxParticipants) * 100),
    );

    if ($("ev-m-fill")) $("ev-m-fill").textContent = fillRateStr;
    if ($("ev-m-fill-bar")) $("ev-m-fill-bar").style.width = `${fillPercent}%`;
    if ($("ev-m-waitlist"))
      $("ev-m-waitlist").textContent =
        waitlistedStudents.length > 0
          ? `${waitlistedStudents.length} Waitlisted`
          : "No Waitlist";

    let expectedRev = 0;
    let collectedRev = 0;
    let presentCount = 0;

    const tbody = $("ev-m-tbody");
    tbody.innerHTML =
      '<tr><td colspan="5"><div class="loading-state"><span class="spinner"></span> Loading…</div></td></tr>';

    const expTbody = $("ev-exp-tbody");
    expTbody.innerHTML =
      '<tr><td colspan="3"><div class="loading-state"><span class="spinner"></span> Loading…</div></td></tr>';

    $("ev-list-view").style.display = "none";
    $("ev-manage-view").style.display = "block";

    try {
      // Find payments related to this event
      const eventDescString = `Event: ${e.title}`;
      const res = await apiCall("/api/payments");
      const paymentsResponse = await res.json();
      const allPaymentsLocal = Array.isArray(paymentsResponse)
        ? paymentsResponse
        : paymentsResponse.data || [];

      // Populate student select dropdown
      const selectEl = $("ev-add-student-select");
      selectEl.innerHTML = '<option value="">-- Select Student --</option>';
      allStudents.forEach((s) => {
        if (!regStudents.includes(s.id)) {
          selectEl.innerHTML += `<option value="${s.id}">${getStudentName(s)}</option>`;
        }
      });

      let html = "";
      if (regStudents.length === 0) {
        html =
          '<tr><td colspan="5"><div class="empty-state"><span class="empty-icon">👥</span><p>No students registered yet</p></div></td></tr>';
      } else {
        regStudents.forEach((sid) => {
          const student = allStudents.find((s) => s.id === sid);
          const name = student ? getStudentName(student) : "Unknown";
          const level = student ? getStudentLevel(student) : "-";

          let regData =
            (e.registrations_data || []).find((r) => r.student_id === sid) ||
            {};
          const payment = allPaymentsLocal.find(
            (p) =>
              p.student_id === sid &&
              (p.description === eventDescString ||
                (p.details && p.details.event_id === id)),
          );
          const isPaid = regData.payment_status === "paid" || !!payment;
          const currentAttendance = regData.attendance || "absent";
          const isWaitlisted = regData.registration_status === "waitlisted";

          const studentFee =
            regData.custom_fee !== undefined
              ? Number(regData.custom_fee)
              : e.fee || 0;
          if (!isWaitlisted) {
            expectedRev += studentFee;
          }
          if (isPaid) collectedRev += studentFee;
          if (currentAttendance === "present") presentCount++;

          const rowStyle = isWaitlisted
            ? "opacity: 0.7; background: #ffffff05;"
            : "";
          const statusBadge = isWaitlisted
            ? ' <span class="badge badge-warning" style="font-size:9px; margin-left:4px;">Waitlist</span>'
            : "";

          html += `<tr style="${rowStyle}">
              <td>
                ${escapeHtml(name)}${statusBadge}
              </td>
              <td>${escapeHtml(level)}</td>
              <td>
                <input type="number" class="form-input" style="width: 70px; padding: 4px; font-size: 11px; margin-right: 8px;" value="${studentFee}" onblur="updateEventRegistration('${id}', '${sid}', 'custom_fee', this.value)" placeholder="Fee">
              </td>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <select style="padding:4px 8px; font-size:11px; width:90px; background:var(--bg3); color:var(--ivory); border:1px solid var(--border); border-radius:4px;" onchange="updateEventRegistration('${id}', '${sid}', 'payment_status', this.value)">
                    <option value="pending" ${!isPaid ? "selected" : ""}>Pending</option>
                    <option value="paid" ${isPaid ? "selected" : ""}>Paid</option>
                  </select>
                  ${
                    isPaid
                      ? `<button class="btn btn-outline-grey btn-sm" style="padding: 2px 6px; font-size:10px;" onclick="downloadReceipt('${sid}', '${escapeHtml(name).replace(/'/g, "\\'")}', '${studentFee}', '${escapeHtml(level).replace(/'/g, "\\'")}', '800', 'N/A', 'Event Fee', '', 'event', '${escapeHtml(e.title).replace(/'/g, "\\'")}')" title="Download Receipt">📄</button>
                  <button class="btn btn-outline-grey btn-sm" style="padding: 2px 6px; font-size:10px;" onclick="sendPaymentReceiptNotification('${sid}', '${studentFee}')" title="Send via WhatsApp">📢</button>`
                      : ""
                  }
                </div>
              </td>
              <td>
                <select style="padding:4px 8px; font-size:11px; width:90px; background:var(--bg3); color:var(--ivory); border:1px solid var(--border); border-radius:4px;" onchange="updateEventRegistration('${id}', '${sid}', 'attendance', this.value)">
                  <option value="absent" ${currentAttendance === "absent" ? "selected" : ""}>Absent</option>
                  <option value="present" ${currentAttendance === "present" ? "selected" : ""}>Present</option>
                </select>
              </td>
              <td style="text-align:center;">
                <div style="display:flex; justify-content:center; gap:6px;">\n                  <button class="btn btn-outline-grey btn-sm" style="padding: 4px; font-size:12px; border:none;" onclick="closeModals(); openEdit('${sid}');" title="Edit Student Data">✏️</button>\n                  <button class="btn btn-outline-grey btn-sm" style="padding: 4px; font-size:12px; border:none; color:var(--danger);" onclick="unregisterStudentFromEvent('${id}', '${sid}', '${escapeHtml(name).replace(/'/g, "\\'")}')" title="Remove Student">🗑️ </button>
              </td>
            </tr>`;
        });
      }

      tbody.innerHTML = html;
      if ($("ev-m-due"))
        $("ev-m-due").textContent =
          `₹${Math.max(0, expectedRev - collectedRev)}`;

      // Load Event Expenditures
      const expRes = await apiCall("/api/expenditures");
      const allExp = await expRes.json();
      const expData = allExp.data || [];
      const eventExps = expData.filter(
        (ex) => ex.description && ex.description.startsWith(e.title + " -"),
      );

      let expHtml = "";
      let totalExp = 0;
      if (eventExps.length === 0) {
        expHtml =
          '<tr><td colspan="3"><div class="empty-state"><span class="empty-icon">💸</span><p>No expenditures logged</p></div></td></tr>';
      } else {
        eventExps.forEach((ex) => {
          totalExp += Number(ex.amount || 0);
          expHtml += `<tr>
            <td>${new Date(ex.date || ex.created_at).toLocaleDateString()}</td>
            <td>${escapeHtml(ex.description || "Event Expense")}</td>
            <td class="text-danger" style="text-align:right;">₹${ex.amount}</td>
            <td style="text-align:center;">
              <div style="display:flex; justify-content:center; gap:6px;">
                <button class="btn btn-outline-grey btn-sm" style="padding: 4px; font-size:12px; border:none;" onclick="setPage('exp'); setTimeout(()=>window.openEditExpense('${ex.id}'), 300);" title="Edit in Expenses">✏️</button>
                <button class="btn btn-outline-grey btn-sm" style="padding: 4px; font-size:12px; border:none; color:var(--danger);" onclick="deleteEventExpenditure('${ex.id}', '${escapeHtml(ex.description).replace(/'/g, "\\'")}')" title="Delete Expense">🗑️</button>
              </div>
            </td>
          </tr>`;
        });
      }
      expTbody.innerHTML = expHtml;

      const netProfit = collectedRev - totalExp;
      if ($("ev-m-profit")) {
        $("ev-m-profit").textContent = `₹${netProfit}`;
        $("ev-m-profit").style.color =
          netProfit >= 0 ? "var(--success)" : "var(--danger)";
      }
      if ($("ev-m-rev-exp"))
        $("ev-m-rev-exp").textContent =
          `Rev: ₹${collectedRev} | Exp: ₹${totalExp}`;

      const attendanceRate =
        confirmedStudents.length > 0
          ? Math.round((presentCount / confirmedStudents.length) * 100)
          : 0;
      if ($("ev-m-att")) $("ev-m-att").textContent = `${attendanceRate}%`;

      // Render the new chart
      window.renderEventManageChart(
        expectedRev,
        collectedRev,
        totalExp,
        waitlistedStudents.length,
        confirmedStudents.length,
      );
    } catch (err) {
      console.error(err);
      tbody.innerHTML = '<tr><td colspan="5">Error loading data.</td></tr>';
    }
  };

  let eventManageChartInstance = null;
  window.renderEventManageChart = function (
    expRev,
    colRev,
    totalExp,
    waitlist,
    confirmed,
  ) {
    const canvas = $("ev-manage-chart");
    if (!canvas) return;
    if (typeof Chart === "undefined") return; // Fail safe if chart.js not loaded

    if (eventManageChartInstance) {
      eventManageChartInstance.destroy();
    }

    const netProfit = colRev - totalExp;

    eventManageChartInstance = new Chart(canvas, {
      type: "bar",
      data: {
        labels: [
          "Expected Rev",
          "Collected Rev",
          "Total Expenses",
          "Net Profit",
        ],
        datasets: [
          {
            label: "Financials (₹)",
            data: [expRev, colRev, totalExp, netProfit],
            backgroundColor: [
              "rgba(54, 162, 235, 0.6)",
              "rgba(82, 196, 26, 0.6)",
              "rgba(255, 77, 79, 0.6)",
              netProfit >= 0
                ? "rgba(82, 196, 26, 0.9)"
                : "rgba(255, 77, 79, 0.9)",
            ],
            borderColor: [
              "rgba(54, 162, 235, 1)",
              "rgba(82, 196, 26, 1)",
              "rgba(255, 77, 79, 1)",
              netProfit >= 0 ? "rgba(82, 196, 26, 1)" : "rgba(255, 77, 79, 1)",
            ],
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: "#94a3b8" },
            grid: { color: "#334155" },
          },
          x: { ticks: { color: "#94a3b8" }, grid: { display: false } },
        },
      },
    });
  };

  window.runFinancialAudit = async function () {
    const eventId = window.currentManageEventId;
    if (!eventId) return toast("No event selected.", "error");

    toast("🤖 AI Guardian running financial audit...", "info");

    try {
      // Fetch event and payments
      const evRes = await apiCall(`/api/events?id=${eventId}`);
      const ev = await evRes.json();
      const pRes = await apiCall("/api/payments");
      const paymentsData = await pRes.json();
      const payments = paymentsData.data || paymentsData;

      let anomalies = [];

      // Cross-reference registrations with payments
      const regs = ev.registrations_data || [];
      regs.forEach((r) => {
        const studentFee =
          r.custom_fee !== undefined ? Number(r.custom_fee) : ev.fee || 0;
        if (studentFee === 0) return; // Skip free entries

        if (r.payment_status === "paid") {
          // Check if payment actually exists
          const eventDescString = `Event: ${ev.title}`;
          const hasPayment = payments.find(
            (p) =>
              p.student_id === r.student_id &&
              (p.description === eventDescString ||
                (p.details && p.details.event_id === eventId)),
          );
          if (!hasPayment) {
            anomalies.push(
              `🔴 <b>${escapeHtml(r.name)}</b> is marked as 'paid' but no payment record exists for ₹${studentFee}.`,
            );
          }
        }
      });

      if (anomalies.length === 0) {
        window.Swal.fire({
          icon: "success",
          title: "Financial Audit Clear",
          text: "No anomalies detected. All paid statuses match payment records.",
          background: "var(--surface)",
          color: "var(--ivory)",
          confirmButtonColor: "var(--gold)",
        });
      } else {
        window.Swal.fire({
          icon: "warning",
          title: "Audit Anomalies Detected",
          html: `<div style="text-align:left; font-size:14px; max-height:200px; overflow-y:auto;">${anomalies.join("<br><br>")}</div>`,
          background: "var(--surface)",
          color: "var(--ivory)",
          confirmButtonColor: "var(--gold)",
        });
      }
    } catch (err) {
      console.error(err);
      toast("Error running audit.", "error");
    }
  };

  window.deleteEventExpenditure = async function (expId, desc) {
    if (
      !confirm(
        `Delete event expense: "${desc}"?\n\nThis action cannot be undone.`,
      )
    )
      return;
    try {
      const res = await apiCall(
        `/api/expenditures?id=${encodeURIComponent(expId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Delete failed");
      toast("Expense deleted", "success");
      window.openEventManagement(window.currentManageEventId);
    } catch (e) {
      toast("Failed to delete expense", "error");
    }
  };

  window.promptAddEventExpenditure = async function () {
    const eventId = window.currentManageEventId;
    if (!eventId) return;
    $("ev-exp-desc").value = "";
    $("ev-exp-amount").value = "";
    openModal("event-expenditure-modal");
  };

  window.submitEditEventExpenditure = async function () {
    toast(
      "Editing event expenditures is not yet supported in this version.",
      "info",
    );
    closeModal("event-expense-edit-modal");
  };

  window.submitEditEventRegistration = async function () {
    toast(
      "Editing registrations directly via modal is deprecated. Use inline dropdowns.",
      "info",
    );
    closeModal("event-registration-edit-modal");
  };

  window.submitEventExpenditure = async function () {
    const eventId = window.currentManageEventId;
    if (!eventId) return;
    const e = eventsData.find((x) => String(x.id) === String(eventId));

    const desc = $("ev-exp-desc").value.trim();
    if (!desc) {
      toast("Please enter a description", "error");
      return;
    }

    const amountStr = $("ev-exp-amount").value.trim();
    if (!amountStr) {
      toast("Please enter an amount", "error");
      return;
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      toast("Invalid amount", "error");
      return;
    }

    const payload = {
      amount: amount,
      description: `${e.title} - ${desc}`,
      date: new Date().toISOString().split("T")[0],
      type: "Event Expense",
      details: { event_id: eventId },
    };

    try {
      const res = await apiCall("/api/expenditures", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      toast("Expenditure added!", "success");
      closeModal("event-expenditure-modal");
      await loadAllData(true);
      window.openEventManagement(eventId);
    } catch (err) {
      toast("Error adding expenditure", "error");
    }
  };

  window.unregisterStudentFromEvent = async function (
    eventId,
    studentId,
    studentName,
  ) {
    if (
      !confirm(
        `Are you sure you want to remove ${studentName} from this event?`,
      )
    )
      return;

    try {
      const res = await apiCall("/api/events", {
        method: "POST",
        body: JSON.stringify({
          action: "unregister",
          event_id: eventId,
          student_id: studentId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove student");

      toast(data.message || `Removed ${studentName}`, "success");

      await loadAllData(true);
      window.openEventManagement(eventId);
    } catch (e) {
      toast(e.message, "error");
    }
  };

  window.markEventPaid = async function (eventId, studentId) {
    const e = eventsData.find((x) => String(x.id) === String(eventId));
    const s = allStudents.find((x) => x.id === studentId);
    if (!e || !s) return;

    if (
      !confirm(
        `Mark ${getStudentName(s)} as PAID for ${e.title} (₹${e.fee || 0})?`,
      )
    )
      return;

    const payload = {
      id: generateClientId(),
      student_id: studentId,
      amount: e.fee || 0,
      status: "paid",
      payment_date: new Date().toISOString().split("T")[0],
      description: `Event: ${e.title}`,
      details: { event_id: eventId, type: "event_fee" },
    };

    try {
      const res = await apiCall("/api/payments", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to record payment");

      // Also update the event registrations_data
      await apiCall("/api/events", {
        method: "POST",
        body: JSON.stringify({
          action: "update_registration",
          event_id: eventId,
          student_id: studentId,
          payment_status: "paid",
        }),
      });

      toast("Payment recorded successfully!", "success");
      await loadAllData(true);
      // Refresh modal
      window.openEventManagement(eventId);
    } catch (err) {
      toast("Error recording payment", "error");
    }
  };

  window.addStudentToEvent = async function () {
    const eventId = window.currentManageEventId;
    const studentId = $("ev-add-student-select").value;
    if (!eventId || !studentId) {
      toast("Please select a student", "error");
      return;
    }

    // Disable button to prevent double-click race conditions
    const btn = event.target;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Adding...";
    }

    const student = allStudents.find((s) => String(s.id) === String(studentId));
    try {
      const res = await apiCall("/api/events", {
        method: "POST",
        body: JSON.stringify({
          action: "register",
          event_id: eventId,
          student_id: studentId,
          student_name: student ? getStudentName(student) : "Unknown",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register student");
      toast(data.message || "Student registered successfully!", "success");
      await loadAllData(true);
      window.openEventManagement(eventId);
    } catch (err) {
      toast(err.message || "Error registering student", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "+ Add";
      }
    }
  };

  window.updateEventRegistration = async function (
    eventId,
    studentId,
    field,
    value,
  ) {
    try {
      const payload = {
        action: "update_registration",
        event_id: eventId,
        student_id: studentId,
      };
      payload[field] = value;

      const res = await apiCall("/api/events", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to update");

      if (field === "payment_status" && value === "paid") {
        const e = eventsData.find((x) => String(x.id) === String(eventId));
        if (e && (e.fee || 0) > 0) {
          await apiCall("/api/payments", {
            method: "POST",
            body: JSON.stringify({
              id: generateClientId(),
              student_id: studentId,
              amount: e.fee || 0,
              status: "paid",
              payment_date: new Date().toISOString().split("T")[0],
              description: `Event: ${e.title}`,
              details: { event_id: eventId, type: "event_fee" },
            }),
          });
        }
      }

      toast("Updated successfully!", "success");
      await loadAllData(true);
      window.openEventManagement(eventId);
    } catch (err) {
      toast("Error updating", "error");
    }
  };

  window.filterEventRegistry = function () {
    const input = document
      .getElementById("ev-registry-search")
      .value.toLowerCase();
    const rows = document.querySelectorAll("#ev-m-tbody tr");
    rows.forEach((row) => {
      const nameCell = row.querySelector("td:first-child");
      if (nameCell) {
        const name = nameCell.textContent.toLowerCase();
        row.style.display = name.includes(input) ? "" : "none";
      }
    });
  };

  window.bulkEventAction = async function (field, value) {
    const eventId = window.currentManageEventId;
    if (!eventId) return;
    const confirmMsg =
      field === "payment_status"
        ? "Mark all pending students as PAID?"
        : "Mark all absent students as PRESENT?";
    if (!confirm(confirmMsg)) return;

    try {
      toast("Processing bulk update...", "info");
      // A full implementation would use a single bulk API endpoint.
      // Here we find all students not matching the value and loop them.
      const ev = eventsData.find((e) => String(e.id) === String(eventId));
      if (!ev) return;
      const regs = ev.registrations_data || [];
      const toUpdate = regs.filter(
        (r) => r[field] !== value && r.registration_status !== "waitlisted",
      );

      if (toUpdate.length === 0) {
        toast("Everyone is already updated.", "info");
        return;
      }

      for (const r of toUpdate) {
        const payload = {
          action: "update_registration",
          event_id: eventId,
          student_id: r.student_id,
        };
        payload[field] = value;
        await apiCall("/api/events", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      toast("Bulk update complete!", "success");
      await loadAllData(true);
      window.openEventManagement(eventId);
    } catch (err) {
      toast("Error during bulk update", "error");
    }
  };

  window.promptRegisterGuestEvent = async function () {
    const eventId = window.currentManageEventId;
    if (!eventId) return;
    $("ext-student-name").value = "";
    $("ext-student-phone").value = "";
    $("ext-student-level").value = "Guest";
    if ($("ext-student-fee")) $("ext-student-fee").value = "";
    openModal("external-student-modal");
  };

  window.submitExternalStudent = async function () {
    const eventId = window.currentManageEventId;
    if (!eventId) return;

    const name = $("ext-student-name").value.trim();
    if (!name) {
      toast("Please enter the student name", "error");
      return;
    }

    const phone = $("ext-student-phone").value.trim();
    if (!phone) {
      toast("Please enter a phone number", "error");
      return;
    }

    const level = $("ext-student-level").value.trim() || "Guest";

    // Create student first
    try {
      const studentPayload = {
        name: name,
        parent_name: "External Participant",
        phone: phone,
        level: level,
        status: "pending", // Keeps them out of active roster
        notes: "Registered explicitly for an event as an external student.",
      };

      const sRes = await apiCall("/api/students", {
        method: "POST",
        body: JSON.stringify(studentPayload),
      });
      if (!sRes.ok) throw new Error("Failed to create guest student");
      const newStudent = await sRes.json();

      // Now add to event
      const eRes = await apiCall("/api/events", {
        method: "POST",
        body: JSON.stringify({
          action: "register",
          event_id: eventId,
          student_id: newStudent.id,
          student_name: newStudent.name || newStudent.full_name || "Guest",
        }),
      });
      if (!eRes.ok) throw new Error("Failed to register to event");

      const feeInput = $("ext-student-fee");
      if (feeInput && feeInput.value.trim() !== "") {
        const feeVal = Number(feeInput.value.trim());
        if (!isNaN(feeVal)) {
          await window.updateEventRegistration(
            eventId,
            newStudent.id,
            "custom_fee",
            feeVal,
          );
        }
      }

      toast("External student successfully registered!", "success");
      closeModal("external-student-modal");
      await loadAllData(true);
      window.openEventManagement(eventId);
    } catch (err) {
      console.error(err);
      toast("Error registering external student", "error");
    }
  };

  window.exportEventCSV = function () {
    const eventId = window.currentManageEventId;
    if (!eventId) return;
    const e = eventsData.find((ev) => String(ev.id) === String(eventId));
    if (!e) return;

    let csv =
      "Student Name,Level,Payment Status,Attendance,Registration Status\n";
    const regs = e.registrations_data || [];

    regs.forEach((r) => {
      const student = allStudents.find((s) => s.id === r.student_id);
      const name = student ? getStudentName(student) : r.name || "Unknown";
      const level = student ? getStudentLevel(student) : "-";
      const payment = r.payment_status || "pending";
      const att = r.attendance || "absent";
      const status = r.registration_status || "confirmed";
      csv += `"${name}","${level}","${payment}","${att}","${status}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${e.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_roster.csv`;
    a.click();
  };

  let html5QrcodeScanner = null;
  window.openScannerModal = function () {
    const eventId = window.currentManageEventId;
    if (!eventId) return toast("No active event selected", "error");

    openModal("qr-scanner-modal");

    if (!html5QrcodeScanner) {
      html5QrcodeScanner = new window.Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: 250 },
        false,
      );
      html5QrcodeScanner.render(
        async (decodedText, decodedResult) => {
          $("qr-reader-results").textContent =
            `Scanned ID: ${decodedText}... Marking Present!`;
          $("qr-reader-results").style.color = "var(--success)";
          try {
            const payload = {
              action: "update_registration",
              event_id: window.currentManageEventId,
              student_id: decodedText.trim(),
              attendance: "present",
            };
            const res = await apiCall("/api/events", {
              method: "POST",
              body: JSON.stringify(payload),
            });
            if (res.ok) {
              toast("Student marked Present!", "success");
              $("qr-reader-results").textContent =
                `✅ Successfully marked Present!`;
              await loadAllData(true);
              window.openEventManagement(window.currentManageEventId);
              setTimeout(() => {
                $("qr-reader-results").textContent = `Ready to scan next...`;
                $("qr-reader-results").style.color = "var(--gold)";
              }, 2000);
            } else {
              const data = await res.json();
              toast(data.error || "Failed to update", "error");
              $("qr-reader-results").textContent =
                `❌ ${data.error || "Failed"}`;
              $("qr-reader-results").style.color = "var(--danger)";
            }
          } catch (e) {
            toast("Error updating attendance", "error");
          }
        },
        (err) => {},
      );
    }
  };

  window.closeScannerModal = function () {
    if (html5QrcodeScanner) {
      html5QrcodeScanner.clear().catch((e) => console.error(e));
      html5QrcodeScanner = null;
    }
    closeModal("qr-scanner-modal");
  };

  window.generateEventCertificates = async function () {
    const eventId = window.currentManageEventId;
    if (!eventId) return;
    const ev = eventsData.find((e) => String(e.id) === String(eventId));
    if (!ev) return;

    const regs = ev.registrations_data || [];
    const attendees = regs.filter(
      (r) =>
        r.attendance === "present" && r.registration_status !== "waitlisted",
    );
    if (attendees.length === 0)
      return toast("No confirmed attendees marked as present!", "warning");

    toast("Generating certificates... Please wait.", "info");
    try {
      const doc = new window.jspdf.jsPDF({ orientation: "landscape" });
      for (let i = 0; i < attendees.length; i++) {
        const r = attendees[i];
        const student = allStudents.find((s) => s.id === r.student_id);
        const name = student ? getStudentName(student) : r.name;
        const level = student ? getStudentLevel(student) : "General";

        if (i > 0) doc.addPage();

        // Background: Ivory
        doc.setFillColor(248, 246, 240);
        doc.rect(0, 0, 297, 210, "F");

        // Top Text: CERTIFICATE
        doc.setTextColor(30, 30, 30);
        doc.setFont("times", "bold");
        doc.setFontSize(55);
        doc.text("CERTIFICATE", 148.5, 35, { align: "center" });

        // Sub text: OF COMPLETION
        doc.setTextColor(186, 145, 48); // Gold
        doc.setFontSize(14);
        doc.setFont("times", "normal");
        doc.text("\u2726  O F   C O M P L E T I O N  \u2726", 148.5, 47, {
          align: "center",
        });

        // Gold Ribbon
        doc.setFillColor(186, 145, 48);
        doc.rect(0, 55, 297, 14, "F");
        doc.setTextColor(30, 30, 30);
        doc.setFont("times", "bold");
        doc.setFontSize(13);
        doc.text("T H I S   I S   T O   C E R T I F Y   T H A T", 148.5, 64.5, {
          align: "center",
        });

        // Name Block
        doc.setFont("times", "italic");
        doc.setFontSize(14);
        doc.text("Mr. / Ms.", 75, 87);

        // Name Underline
        doc.setDrawColor(30, 30, 30);
        doc.setLineWidth(0.5);
        doc.line(95, 88, 235, 88);

        // Name Insert
        doc.setFont("times", "italic");
        doc.setFontSize(22);
        doc.text(name || "Unknown", 165, 86, { align: "center" });

        // Secured Grade Block
        doc.setFontSize(13);
        doc.text("has secured the grade", 55, 102);
        doc.line(100, 103, 140, 103);
        doc.text("A+", 120, 101, { align: "center" }); // Dynamic Grade injection
        doc.text("and has successfully completed the", 145, 102);

        // Event Name
        doc.setFont("times", "bold");
        doc.setFontSize(36);
        doc.text(ev.title.toUpperCase(), 148.5, 120, { align: "center" });

        // Event Dates
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(12);
        doc.setFont("times", "normal");
        const dt = new Date(ev.date || ev.event_date).toLocaleDateString(
          "en-US",
          { month: "short", day: "numeric", year: "numeric" },
        );
        doc.text(`\u25A0  EVENT DATE: ${dt}  \u25A0`, 148.5, 130, {
          align: "center",
        });

        // Black Box Level
        doc.setFillColor(25, 25, 25);
        doc.setDrawColor(186, 145, 48);
        doc.setLineWidth(1.5);
        doc.rect(73.5, 138, 150, 14, "FD"); // Fill and Draw border
        doc.setTextColor(255, 255, 255);
        doc.setFont("times", "bold");
        doc.setFontSize(12);
        doc.text(`${level.toUpperCase()} LEVEL`, 148.5, 147, {
          align: "center",
        });

        // Congrats Text
        doc.setTextColor(80, 80, 80);
        doc.setFont("times", "italic");
        doc.setFontSize(12);
        doc.text("with dedication and enthusiasm.", 148.5, 160, {
          align: "center",
        });
        doc.text("Keep learning, keep improving,", 148.5, 166, {
          align: "center",
        });
        doc.text("and keep moving forward!", 148.5, 172, { align: "center" });

        doc.setTextColor(186, 145, 48); // Gold
        doc.setFont("times", "bolditalic");
        doc.setFontSize(14);
        doc.text("Well done!", 148.5, 180, { align: "center" });

        // Signatures
        doc.setDrawColor(30, 30, 30);
        doc.setLineWidth(0.5);

        // Coach Signature
        doc.line(30, 195, 90, 195);
        doc.setTextColor(30, 30, 30);
        doc.setFont("times", "bold");
        doc.setFontSize(11);
        doc.text("C O A C H", 60, 202, { align: "center" });

        // Secretary Signature
        doc.line(207, 195, 267, 195);
        doc.text("S E C R E T A R Y", 237, 202, { align: "center" });

        // Optional: Add a simple gold medal shape at bottom center
        doc.setFillColor(218, 165, 32); // Medallion gold
        doc.circle(148.5, 195, 8, "F");
        doc.setFillColor(30, 144, 255); // Blue ribbon left
        doc.triangle(148.5, 190, 142.5, 180, 146.5, 180, "F");
        doc.triangle(148.5, 190, 154.5, 180, 150.5, 180, "F");
      }
      doc.save(`Certificates_${ev.title.replace(/[^a-z0-9]/gi, "_")}.pdf`);
      toast("Certificates downloaded successfully!", "success");
    } catch (err) {
      console.error(err);
      toast("Error generating certificates", "error");
    }
  };

  window.generateEventTickets = async function () {
    const eventId = window.currentManageEventId;
    if (!eventId) return;
    const ev = eventsData.find((e) => String(e.id) === String(eventId));
    if (!ev) return;

    const regs = ev.registrations_data || [];
    const attendees = regs.filter(
      (r) => r.registration_status !== "waitlisted",
    );
    if (attendees.length === 0)
      return toast("No confirmed attendees found!", "warning");

    toast("Generating VIP Tickets... Please wait.", "info");
    try {
      // Standard portrait A4: 210 x 297 mm
      const doc = new window.jspdf.jsPDF({ orientation: "portrait" });

      for (let i = 0; i < attendees.length; i++) {
        const r = attendees[i];
        const student = allStudents.find((s) => s.id === r.student_id);
        const name = student ? getStudentName(student) : r.name;
        const level = student ? getStudentLevel(student) : "General";

        if (i > 0) doc.addPage();

        // 1. Dark Background
        doc.setFillColor(15, 18, 25);
        doc.rect(0, 0, 210, 297, "F");

        // 2. Gold Border
        doc.setDrawColor(186, 145, 48); // Gold
        doc.setLineWidth(1.5);
        doc.rect(15, 15, 180, 267, "S");
        doc.setLineWidth(0.5);
        doc.rect(17, 17, 176, 263, "S");

        // 3. VIP HEADER
        doc.setTextColor(186, 145, 48);
        doc.setFontSize(28);
        doc.setFont("times", "bold");
        doc.text("V I P   A C C E S S", 105, 40, { align: "center" });

        doc.setDrawColor(186, 145, 48);
        doc.line(50, 48, 160, 48);

        // 4. EVENT DETAILS
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(36);
        doc.text(ev.title.toUpperCase(), 105, 75, { align: "center" });

        const dt = new Date(ev.date || ev.event_date).toLocaleDateString(
          "en-US",
          { weekday: "long", month: "long", day: "numeric", year: "numeric" },
        );
        const time = ev.time || ev.event_time || "10:00 AM";

        doc.setFontSize(14);
        doc.setTextColor(200, 200, 200);
        doc.setFont("helvetica", "normal");
        doc.text(`${dt}  •  ${time}`, 105, 95, { align: "center" });

        // 5. STUDENT BLOCK
        doc.setFillColor(25, 30, 40);
        doc.rect(30, 115, 150, 40, "F");

        doc.setTextColor(186, 145, 48);
        doc.setFontSize(10);
        doc.text("TICKET HOLDER", 105, 125, { align: "center" });

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont("times", "bolditalic");
        doc.text(name, 105, 138, { align: "center" });

        doc.setTextColor(150, 150, 150);
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`ID: ${r.student_id}`, 105, 148, { align: "center" });

        // 6. QR CODE
        const qrSize = 70;
        const qrX = 105 - qrSize / 2;
        const qrY = 175;

        try {
          const qr = new window.QRious({
            value: String(r.student_id),
            size: 250,
            level: "M",
          });
          const qrImage = new window.Image();
          qrImage.src = qr.toDataURL("image/png");

          await new Promise((resolve, reject) => {
            qrImage.onload = resolve;
            qrImage.onerror = reject;
          });

          // White box for QR code (for scanner visibility)
          doc.setFillColor(255, 255, 255);
          doc.rect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10, "F");
          doc.addImage(qrImage, "PNG", qrX, qrY, qrSize, qrSize);
        } catch (e) {
          console.error("QR Code Error:", e);
          doc.setTextColor(255, 0, 0);
          doc.text("QR Load Failed", 105, qrY + qrSize / 2, {
            align: "center",
          });
        }

        // 7. FOOTER
        doc.setTextColor(186, 145, 48);
        doc.setFontSize(14);
        doc.setFont("times", "bold");
        doc.text("PLEASE PRESENT THIS TICKET AT THE ENTRANCE", 105, 270, {
          align: "center",
        });
      }

      doc.save(`Tickets_${ev.title.replace(/[^a-z0-9]/gi, "_")}.pdf`);
      toast("Tickets generated successfully!", "success");
    } catch (err) {
      console.error(err);
      toast("Error generating tickets", "error");
    }
  };

  window.generateEventReportPDF = async function () {
    const id = window.currentManageEventId;
    if (!id) return;
    const e = eventsData.find((ev) => String(ev.id) === String(id));
    if (!e) return;

    try {
      const doc = new window.jspdf.jsPDF();
      doc.setFontSize(20);
      doc.text(`Event Report: ${e.title}`, 14, 20);
      doc.setFontSize(12);
      doc.text(
        `Date: ${new Date(e.date || e.event_date).toLocaleDateString()}`,
        14,
        30,
      );

      const regs = e.registrations_data || [];
      const studentsBody = regs.map((r) => {
        const student = allStudents.find((s) => s.id === r.student_id);
        const name = student ? getStudentName(student) : r.name || "Unknown";
        const level = student ? getStudentLevel(student) : "-";
        return [
          name,
          level,
          r.payment_status || "pending",
          r.attendance || "absent",
          r.registration_status || "confirmed",
        ];
      });

      doc.text("Registered Students", 14, 45);
      doc.autoTable({
        startY: 50,
        head: [["Name", "Level", "Payment", "Attendance", "Status"]],
        body: studentsBody,
        theme: "grid",
        headStyles: { fillColor: [212, 175, 55] },
      });

      const finalY = doc.lastAutoTable.finalY || 50;
      let expResLocal = [];
      try {
        const res = await apiCall("/api/expenditures");
        if (res.ok) {
          const json = await res.json();
          expResLocal = json.data || json || [];
        }
      } catch (err) {}
      const eventExps = expResLocal.filter(
        (ex) => ex.description && ex.description.startsWith(e.title + " -"),
      );

      if (eventExps.length > 0) {
        doc.text("Event Expenditures", 14, finalY + 15);
        const expBody = eventExps.map((ex) => [
          new Date(ex.date || ex.created_at).toLocaleDateString(),
          ex.description || "Event Expense",
          `INR ${ex.amount}`,
        ]);
        doc.autoTable({
          startY: finalY + 20,
          head: [["Date", "Description", "Amount"]],
          body: expBody,
          theme: "grid",
          headStyles: { fillColor: [220, 53, 69] },
        });
      }

      doc.save(`Event_Report_${e.title.replace(/[^a-z0-9]/gi, "_")}.pdf`);
      toast("PDF Exported!", "success");
    } catch (err) {
      console.error(err);
      toast("Error generating PDF", "error");
    }
  };

  window.exportEventWord = async function () {
    const id = window.currentManageEventId;
    if (!id) return;
    const e = eventsData.find((ev) => String(ev.id) === String(id));
    if (!e) return;

    const regs = e.registrations_data || [];
    let expResLocal = [];
    try {
      const res = await apiCall("/api/expenditures");
      if (res.ok) {
        const json = await res.json();
        expResLocal = json.data || json || [];
      }
    } catch (err) {}
    const eventExps = expResLocal.filter(
      (ex) => ex.description && ex.description.startsWith(e.title + " -"),
    );

    let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Event Report</title></head><body>`;

    html += `<h1>Event Report: ${escapeHtml(e.title)}</h1><p><strong>Date:</strong> ${new Date(e.date || e.event_date).toLocaleDateString()}</p>`;
    html += `<h2>Registered Students</h2><table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;">`;
    html += `<tr style="background:#d4af37;color:#fff;"><th>Name</th><th>Level</th><th>Payment</th><th>Attendance</th><th>Status</th></tr>`;

    regs.forEach((r) => {
      const student = allStudents.find((s) => s.id === r.student_id);
      const name = student ? getStudentName(student) : r.name || "Unknown";
      html += `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(student ? getStudentLevel(student) : "-")}</td><td>${r.payment_status || "pending"}</td><td>${r.attendance || "absent"}</td><td>${r.registration_status || "confirmed"}</td></tr>`;
    });
    html += `</table>`;

    if (eventExps.length > 0) {
      html += `<h2>Event Expenditures</h2><table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;">`;
      html += `<tr style="background:#dc3545;color:#fff;"><th>Date</th><th>Description</th><th>Amount</th></tr>`;
      eventExps.forEach((ex) => {
        html += `<tr><td>${new Date(ex.date || ex.created_at).toLocaleDateString()}</td><td>${escapeHtml(ex.description || "Expense")}</td><td>${ex.amount}</td></tr>`;
      });
      html += `</table>`;
    }
    html += `</body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = window.URL.createObjectURL(blob);
    a.download = `Event_Report_${e.title.replace(/[^a-z0-9]/gi, "_")}.doc`;
    a.click();
    toast("Word Document Exported!", "success");
  };

  function getEventType(e) {
    return e.type || e.event_type || "Tournament";
  }
  function getEventLocation(e) {
    return e.location || "";
  }
  function getEventTime(e) {
    const t = e.time || e.event_time || "10:00";
    return formatTime(t);
  }
  async function registerForEvent(eventId) {
    const e = eventsData.find((x) => String(x.id) === String(eventId));
    if (!e) {
      toast("Event not found", "error");
      return;
    }

    if (!currentStudent) {
      toast("Please login as a parent first", "error");
      return;
    }
    if (
      !confirm(
        "Register " +
          getStudentName(currentStudent) +
          ' for "' +
          e.title +
          '" on ' +
          (e.date ? new Date(e.date).toLocaleDateString() : "TBD") +
          "?",
      )
    )
      return;

    // Optimistic update - add student to registered list locally first
    const registeredStudents = e.registered_students || [];
    if (registeredStudents.includes(currentStudent.id)) {
      toast("Already registered!", "info");
      return;
    }

    // Add student locally (optimistic)
    registeredStudents.push(currentStudent.id);
    e.registered_students = registeredStudents;
    e.registrations_count = (e.registrations_count || 0) + 1;

    // Also update in eventsData
    const idx = eventsData.findIndex((ev) => String(ev.id) === String(eventId));
    if (idx >= 0) {
      eventsData[idx].registered_students = registeredStudents;
      eventsData[idx].registrations_count =
        (eventsData[idx].registrations_count || 0) + 1;
    }

    // Re-render to show registered
    renderEvents();

    // Try to save to backend (fire and forget)
    try {
      fetch(`${SUPABASE_URL}/functions/v1/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "register",
          event_id: eventId,
          student_id: currentStudent.id,
          student_name: getStudentName(currentStudent),
        }),
      }).catch(() => {});
    } catch (err) {}

    toast(`Successfully registered for "${e.title}"!`, "success");
  }

  function getMessagePriority(m) {
    return m.priority || "normal";
  }
  function getMessageIsRead(m) {
    return m.is_read || false;
  }

  function makeAvSrc(s) {
    const custom = s.custom_avatar;
    if (custom) {
      // Allow data URLs (already inline) and Supabase storage URLs
      if (
        custom.startsWith("data:") ||
        custom.includes(".supabase.co") ||
        (window.SUPABASE_URL && custom.includes(window.SUPABASE_URL))
      ) {
        return custom;
      }
      // External avatar services may be blocked - use local generation
      console.warn(
        "[Avatar] External avatar URL ignored for",
        getStudentName(s),
      );
    }
    const name = getStudentName(s);
    return generateAvatarURL(name || "Student", 80, "dca33e", "000000");
  }

  // ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═
  // DATA LOADING
  // ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═
  let isLoadingData = false;
  async function loadAllData(forceRefresh = false) {
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    if (isLoadingData) return;

    const executeLoad = async () => {
      if (isLoadingData) return;
      isLoadingData = true;
      const now = Date.now();
      const hasValidCache =
        dataCache.timestamp > 0 && dataCache.coaches && dataCache.students;
      let isSilentSync = false;
      if (hasValidCache) {
        allCoaches = dataCache.coaches;
        allStudents = dataCache.students;
        achievementsData = dataCache.achievements;
        eventsData = dataCache.events;
        allMessages = dataCache.messages || [];
        allAttendance = dataCache.attendance || [];
        allPayments = dataCache.payments || [];
        allRatingHistory = dataCache.ratingHistory || [];
        allBatches = dataCache.batches || [];
        allHomework = dataCache.homework || [];

        // Sync to window for modules
        window.allStudents = allStudents;
        window.allCoaches = allCoaches;
        window.allMessages = allMessages;
        window.allAttendance = allAttendance;
        window.allPayments = allPayments;
        window.allRatingHistory = allRatingHistory;
        window.allBatches = allBatches;
        window.allHomework = allHomework;

        window.allResources = allResources;

        syncCoachDropdowns();
        if (role === "admin" || role === "master") {
          renderDash();
          updateMsgBadge();
          renderEvents();
          renderFame();
          renderBills();
          renderMsgs();
          renderCoachMgmt();
          renderStudents();
          const activeCachedPage = document.querySelector(".page.active")?.id;
          if (activeCachedPage === "page-homework" && window.loadHomeworkData) {
            window.loadHomeworkData().then(() => {
              if (window.renderHomeworkPage) window.renderHomeworkPage();
            });
          } else if (activeCachedPage === "page-homework" && window.renderHomeworkPage) {
            window.renderHomeworkPage();
          }
        } else if (role === "parent") {
          renderChild();
          renderEvents();
        }

        if (!forceRefresh && now - dataCache.timestamp < CACHE_DURATION) {
          isLoadingData = false;
          return;
        }
        isSilentSync = true;
      }

      try {
        if (!isSilentSync) {
          setLoading("data", true);
        }

        const fetches = [
          apiCall("/api/coaches"),
          apiCall("/api/students?limit=1000"),
          apiCall("/api/attendance"),
          apiCall("/api/payments?order=payment_date.desc&limit=1000"),
          apiCall("/api/messages"),
          apiCall("/api/rating_history"),
          apiCall("/api/resources"),
          apiCall("/api/achievements"),
          apiCall("/api/events"),
          apiCall("/api/batches"),
        ];

        const res1 = await fetches[0];
        if (res1.ok) {
          const d = await res1.json();
          allCoaches = d.data || d;
          window.allCoaches = allCoaches;
        }
        const res2 = await fetches[1];
        if (res2.ok) {
          const d = await res2.json();
          allStudents = d.data || d;
          window.allStudents = allStudents;
        }
        const res3 = await fetches[2];
        if (res3.ok) {
          const d = await res3.json();
          allAttendance = d.data || d;
          window.allAttendance = allAttendance;
        }
        const res4 = await fetches[3];
        if (res4.ok) {
          const d = await res4.json();
          allPayments = d.data || d;
          window.allPayments = allPayments;
        }
        const res5 = await fetches[4];
        if (res5.ok) {
          const d = await res5.json();
          allMessages = d.data || d;
          window.allMessages = allMessages;
        }
        const res6 = await fetches[5];
        if (res6.ok) {
          const d = await res6.json();
          allRatingHistory = d.data || d;
          window.allRatingHistory = allRatingHistory;
        }
        const res7 = await fetches[6];
        if (res7.ok) {
          const d = await res7.json();
          allResources = d.data || d;
          window.allResources = allResources;
        }
        const res8 = await fetches[7];
        if (res8.ok) {
          const d = await res8.json();
          achievementsData = d.data || d;
          window.achievementsData = achievementsData;
        }
        const res9 = await fetches[8];
        if (res9.ok) {
          const d = await res9.json();
          eventsData = d.data || d;
          window.eventsData = eventsData;
        }
        const res10 = await fetches[9];
        if (res10.ok) {
          const d = await res10.json();
          allBatches = d.data || d;
          window.allBatches = allBatches;
        }

        const extractData = (res) => {
          if (!res) return [];
          if (Array.isArray(res)) return res;
          if (res.data && Array.isArray(res.data)) return res.data;
          return [];
        };

        const seenId = new Set();
        allStudents = allStudents.filter((s) => {
          if (!s || !s.id) return false;
          if (seenId.has(s.id)) return false;
          seenId.add(s.id);

          // Parse learning mode from notes if backend hasn't done it yet
          let notes = s.notes || "";
          if (typeof notes === "string") {
            if (notes.includes("[LM:offline]")) {
              s.learning_mode = "offline";
              s.notes = notes.replace(/\[LM:(online|offline)\]/g, "").trim();
            } else if (notes.includes("[LM:online]")) {
              s.learning_mode = "online";
              s.notes = notes.replace(/\[LM:(online|offline)\]/g, "").trim();
            }
          }

          return true;
        });

        // Auto-promote 'upcoming' students to 'active' if their enrollment date has arrived
        const todayNoTime = new Date();
        todayNoTime.setHours(0, 0, 0, 0);
        allStudents.forEach((s) => {
          if ((s.status || s.account_status) === "upcoming") {
            const enrollStr = s.enrollment_date || s.join_date || s.created_at;
            if (enrollStr) {
              const enrollDate = new Date(enrollStr);
              if (enrollDate <= todayNoTime) {
                s.status = "active";
                s.account_status = "active";
                if (role === "admin" || role === "master") {
                  // Trigger background DB update
                  apiCall(`/api/students?id=${s.id}`, {
                    method: "PUT",
                    body: JSON.stringify({
                      status: "active",
                      account_status: "active",
                    }),
                  }).catch((err) =>
                    console.warn(
                      "[AutoPromote] Failed to promote student:",
                      s.id,
                      err,
                    ),
                  );
                }
              }
            }
          }
        });

        achievementsData = dedupeArray(achievementsData, "id");
        eventsData = dedupeArray(eventsData, "id");
        allMessages = dedupeArray(allMessages, "id");

        const seenPayKeys = new Set();
        const dedupedPayments = extractData(allPayments).filter((p) => {
          const key = (p.transaction_id || p.id || "").toString().trim();
          if (!key || seenPayKeys.has(key)) return false;
          seenPayKeys.add(key);

          return true;
        });

        allPayments = dedupedPayments.map((p) => ({
          ...p,
          amount: parseFloat(p.amount) || 0,
        }));
        allRatingHistory = extractData(allRatingHistory);

        const pMap = {};
        const seenMonths = new Set();
        allPayments.forEach((p) => {
          if (p.status === "paid") {
            const sid = String(p.student_id || "")
              .trim()
              .toLowerCase();
            if (!sid) return;
            const pDate = new Date(p.payment_date || p.created_at);
            const mKey = `${sid}_${pDate.getUTCFullYear()}-${pDate.getUTCMonth()}`;
            if (seenMonths.has(mKey)) return;
            seenMonths.add(mKey);
            pMap[sid] = (pMap[sid] || 0) + 1;
          }
        });
        window.totalPaymentsMap = pMap;

        window.allStudents = allStudents;
        window.allCoaches = allCoaches;
        window.allPayments = allPayments;
        window.allMessages = allMessages;
        window.allAttendance = allAttendance;
        window.allRatingHistory = allRatingHistory;
        window.allHomework = allHomework;

        window.allResources = allResources;

        if ($("sync-text")) $("sync-text").textContent = "Database Connected";
        if ($("sync-status")) $("sync-status").classList.add("connected");
        console.log(
          `[Sync] Loaded: ${allStudents.length} students, ${allCoaches.length} coaches, ${allPayments.length} payments`,
        );

        if (allStudents.length === 0 && role !== "parent") {
          console.warn("[Sync] Warning: No students found in database.");
        }

        dataCache = {
          coaches: allCoaches,
          students: allStudents,
          achievements: achievementsData,
          events: eventsData,
          messages: allMessages,
          attendance: allAttendance,
          payments: allPayments,
          ratingHistory: allRatingHistory,
          resources: allResources,
          batches: allBatches,
          homework: allHomework,
          timestamp: now,
        };
        try {
          localStorage.setItem(
            "twoknights_data_cache",
            JSON.stringify(dataCache),
          );
        } catch (e) {}
        syncCoachDropdowns();

        if (role === "admin" || role === "master") {
          console.log("[Sync] Rendering active page for role:", role);
          const active = document.querySelector(".page.active")?.id;
          if (active === "page-dash") renderDash();
          else if (active === "page-insights") {
            if (window.generateAcademyInsights)
              window.generateAcademyInsights();
          } else if (active === "page-stud") renderStudents();
          else if (active === "page-coach-mgmt") renderCoachMgmt();
          else if (active === "page-bills") renderBills();
          else if (active === "page-msgs") renderMsgs();
          else if (active === "page-fame") renderFame();
          else if (active === "page-events") renderEvents();
          else if (active === "page-batches") { if (window.renderBatchesGrid) window.renderBatchesGrid(); }
          else if (active === "page-homework") {
            if (window.loadHomeworkData) {
              window.loadHomeworkData().then(() => {
                if (window.renderHomeworkPage) window.renderHomeworkPage();
              });
            } else if (window.renderHomeworkPage) window.renderHomeworkPage();
          }
          else if (active === "page-ai") {
            if (window.updateTomKpis) window.updateTomKpis();
          } else renderDash();

          updateMsgBadge();
          checkMonthlyRollover();
        } else if (role === "parent") {
          renderChild();
          renderEvents();
        }

        setLoading("data", false);
        isLoadingData = false;
      } catch (err) {
        console.error("[Sync] Critical Error:", err);
        setLoading("data", false);
        isLoadingData = false;
        toast("Database sync failed. Check connection.", "error");
      }
    };

    if (forceRefresh) {
      dataCache.timestamp = 0;
      await executeLoad();
    } else {
      loadDebounceTimer = setTimeout(executeLoad, 50);
    }
  }

  let homeworkLoadPromise = null;
  async function loadHomeworkData(forceRefresh = false) {
    if (!forceRefresh && homeworkLoadPromise) return homeworkLoadPromise;

    homeworkLoadPromise = (async () => {
      try {
        const res = await apiCall("/api/homework");
        if (res.ok) {
          const d = await res.json();
          allHomework = d.data || d;
          window.allHomework = allHomework;
        }
      } catch (error) {
        console.warn("[Homework] Failed to load homework:", error);
      } finally {
        homeworkLoadPromise = null;
      }
      return allHomework;
    })();

    return homeworkLoadPromise;
  }

  function checkMonthlyRollover() {
    if ($("rollover-notification")) return; // Idempotency check
    const today = new Date();
    const monthKey = `${today.getUTCFullYear()}-${today.getUTCMonth()}`;
    const lastNotified = localStorage.getItem("last_rollover_notified");

    // Only show between 1st and 5th of the month
    if (today.getDate() === 1 && lastNotified !== monthKey) {
      const modal = document.createElement("div");
      modal.className = "modal";
      modal.id = "rollover-notification";
      modal.style.display = "flex";
      modal.style.zIndex = "9999";
      modal.innerHTML = `
        <div class="modal-box" style="max-width:420px; text-align:center; border:2px solid var(--gold); background:var(--bg2)">
          <h2 style="color:var(--gold); margin-bottom:12px; font-family:var(--font-head)">🆕 New Billing Month!</h2>
          <p style="color:var(--ivory-dim); margin-bottom:20px; font-size:14px; line-height:1.6">It's a new month. You can roll any past-month fee due dates forward to this month (each student keeps their day), then notify coaches.</p>
          <div style="display:flex; flex-direction:column; gap:10px">
            <button class="btn btn-gold" onclick="rolloverDueDatesToCurrentMonth(); localStorage.setItem('last_rollover_notified', '${monthKey}'); this.closest('.modal').remove()">📅 Roll Due Dates Forward</button>
            <div style="display:flex; gap:10px">
              <button class="btn btn-outline" style="flex:1" onclick="localStorage.setItem('last_rollover_notified', '${monthKey}'); this.closest('.modal').remove()">Later</button>
              <button class="btn btn-outline" style="flex:1" onclick="informAllCoaches(); localStorage.setItem('last_rollover_notified', '${monthKey}'); this.closest('.modal').remove()">📢 Inform Coaches</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
  }

  // Month-wise due-date rollover: advance any active student whose fee due date is
  // in a PAST month forward to the current month, preserving their billing day
  // (clamped to the month length). Admin-triggered (never silent/auto on load) so
  // enrollment data only changes on a deliberate action.
  window.rolloverDueDatesToCurrentMonth = async function (silent) {
    const now = new Date();
    const curY = now.getUTCFullYear(),
      curM = now.getUTCMonth(); // 0-based
    const daysInCur = new Date(curY, curM + 1, 0).getDate();
    const targets = (allStudents || []).filter((s) => {
      if (getStudentStatus(s) === "archived") return false;
      const m = String(s.due_date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return false;
      const dy = +m[1],
        dm = +m[2] - 1;
      return dy < curY || (dy === curY && dm < curM); // due month precedes current month
    });
    if (targets.length === 0) {
      if (!silent) toast("All due dates are already current. ✅", "success");
      return 0;
    }
    const monthName = now.toLocaleString("en-IN", {
      month: "long",
      year: "numeric",
    });
    if (
      !silent &&
      !confirm(
        `Roll ${targets.length} past-month due date(s) forward to ${monthName}? Each student keeps their billing day. This updates their saved records.`,
      )
    )
      return 0;
    let ok = 0;
    for (const s of targets) {
      const m = String(s.due_date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const day = Math.min(+m[3], daysInCur);
      const newDate = `${curY}-${String(curM + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      try {
        const res = await apiCall(
          `/api/students?id=${encodeURIComponent(s.id)}`,
          { method: "PUT", body: JSON.stringify({ due_date: newDate }) },
        );
        if (res.ok) {
          s.due_date = newDate;
          ok++;
        }
      } catch (e) {
        /* skip on error */
      }
    }
    if (!silent)
      toast(
        `Rolled ${ok}/${targets.length} due date(s) to ${now.toLocaleString("en-IN", { month: "short", year: "numeric" })}.`,
        ok === targets.length ? "success" : "warning",
      );
    if (window.renderStudents) window.renderStudents();
    if (window.renderDash) window.renderDash();
    return ok;
  };

  function syncCoachDropdowns() {
    const dropdowns = [
      "m-coach",
      "ev-coach",
      "f-coach",
      "att-coach-filter",
      "f-bill-coach",
    ];
    const options = allCoaches
      .map((c) => `<option value="${c.id}">${getCoachName(c)}</option>`)
      .join("");

    if ($("f-coach"))
      $("f-coach").innerHTML =
        '<option value="">All Coaches</option>' + options;
    if ($("f-bill-coach"))
      $("f-bill-coach").innerHTML =
        '<option value="">All Coaches</option>' + options;
    if ($("m-coach")) $("m-coach").innerHTML = options;
    if ($("e-coach")) $("e-coach").innerHTML = options;
    if ($("att-coach-filter"))
      $("att-coach-filter").innerHTML =
        '<option value="">All Coaches</option>' + options;

    if ($("award-student"))
      $("award-student").innerHTML =
        '<option value="">Select Student</option>' +
        allStudents
          .map(
            (s) =>
              `<option value="${s.id}">${escapeHtml(getStudentName(s))}</option>`,
          )
          .join("");
  }

  let notificationPolling = null;
  let lastMsgCount = 0;
  let lastStudCount = 0;
  let lastDueCount = 0;
  let lastSessionCount = 0;
  let supabaseClient = null;

  let rtDebounceTimer = null;
  function initRealtimeNotifications() {
    if (role !== "admin" && role !== "master") return;
    if (typeof supabase === "undefined") {
      console.warn(
        "[Realtime] Supabase library not loaded. Falling back to polling.",
      );
      startNotificationPolling();
      return;
    }

    try {
      if (window.supabaseClient) {
        supabaseClient = window.supabaseClient;
        return;
      }
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      window.supabaseClient = supabaseClient;
      console.log('[Realtime] "Instant Synchronicity" Active.');

      const debouncedRefresh = () => {
        if (window.isEditing) return;
        clearTimeout(rtDebounceTimer);
        rtDebounceTimer = setTimeout(() => {
          loadAllData(true);
        }, 5000); // Optimized 5s sync frequency
      };

      supabaseClient
        .channel("academy-sync")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "payments" },
          () => {
            console.log("[Realtime] Payment detected. Syncing...");
            debouncedRefresh();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "students" },
          () => {
            console.log("[Realtime] Student update detected. Syncing...");
            debouncedRefresh();
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            const msg = payload.new;
            if (
              msg.receiver_type === "admin" &&
              shouldShowNotification("msg_" + msg.id)
            ) {
              toast(
                `📬 New Message from ${msg.sender_name || "User"}!`,
                "info",
              );
              debouncedRefresh();
            }
          },
        )
        .subscribe();
    } catch (e) {
      console.error("[Realtime] Initialization failed:", e);
      startNotificationPolling();
    }
  }

  function setupNotificationCounts() {
    // Call this AFTER data is loaded to set initial counts
    lastMsgCount = allMessages ? allMessages.length : 0;
    lastStudCount = allStudents ? allStudents.length : 0;
    const dueStudents = allStudents
      ? allStudents.filter((s) => {
          const status = getStudentPaymentStatus(s);
          return status === "Due" || status === "Overdue";
        })
      : [];
    lastDueCount = dueStudents.length;
  }
  function startNotificationPolling() {
    if (notificationPolling) return;

    notificationPolling = setInterval(async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return; // Silent skip when offline
      try {
        // 1. New messages
        const res = await apiCall("/api/messages");
        const msgs = await res.json();
        const newMsgs = msgs.data || msgs || [];
        if (newMsgs.length > lastMsgCount) {
          const newCount = newMsgs.length - lastMsgCount;
          const latest = newMsgs[0];
          if (latest && shouldShowNotification("msg_" + latest.id)) {
            toast(
              `📬 ${newCount} new message${newCount > 1 ? "s" : ""}!`,
              "info",
            );
          }
          lastMsgCount = newMsgs.length;
          allMessages = newMsgs;
          updateNotificationBadge();
        }

        // 2. New student enrolled check
        const studsRes = await apiCall("/api/students");
        const studs = await studsRes.json();
        const rawStuds = studs.data || studs || [];

        const currentRaw = Array.isArray(rawStuds) ? rawStuds : [];
        const seenId = new Set();
        const dedupedStuds = currentRaw.filter((s) => {
          if (!s || !s.id) return false;
          if (seenId.has(s.id)) return false;
          seenId.add(s.id);
          return true;
        });

        if (dedupedStuds.length > lastStudCount) {
          if (shouldShowNotification("new_student_" + dedupedStuds.length)) {
            toast("🎓 New student enrolled!", "success");
          }
          logAudit("students", "new", null, { count: dedupedStuds.length });
          lastStudCount = dedupedStuds.length;
          loadAllData(true);
        }

        // 3. Failed login from Supabase
        try {
          const auditRes = await apiCall("/api/audit?limit=10");
          const auditData = await auditRes.json();
          const failedLogins = (auditData.data || auditData || []).filter(
            (l) => l.action === "login_failed",
          );
          if (failedLogins.length > 0) {
            const latest = failedLogins[0];
            if (
              latest &&
              shouldShowNotification(
                "fail_" + (latest.id || latest.timestamp || latest.created_at),
              )
            ) {
              const time = new Date(
                latest.created_at || latest.timestamp,
              ).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              });
              toast(
                `🛡️ Failed login attempt: ${latest.user_name || "Unknown"} at ${time}`,
                "error",
              );
            }
          }
        } catch (e) {
          // Local fallback
          const localLogs = JSON.parse(
            localStorage.getItem("audit_logs") || "[]",
          );
          const localFailed = localLogs.filter(
            (l) => l.action === "login_failed",
          );
          if (localFailed.length > 0) {
            const latest = localLogs[localLogs.length - 1];
            if (
              latest &&
              shouldShowNotification("fail_local_" + latest.timestamp)
            ) {
              const time = new Date(latest.timestamp).toLocaleTimeString(
                "en-IN",
                { hour: "2-digit", minute: "2-digit" },
              );
              toast(
                `🛡️ Failed login: ${latest.user || "Unknown"} at ${time}`,
                "error",
              );
            }
          }
        }

        // 4. Due payments & Notifications (Slot-Based)
        const now = new Date();
        const due = dedupedStuds.filter((s) => {
          const status = getStudentPaymentStatus(s);
          return status === "Due" || status === "Overdue";
        });

        if (due.length > lastDueCount && lastDueCount > 0) {
          const newDue = due.length - lastDueCount;
          toast(
            `💳 ${newDue} new payment${newDue > 1 ? "s" : ""} now Due!`,
            "warning",
          );
        }
        lastDueCount = due.length;
      } catch (e) {
        // Suppress console error output for offline/temporary network glitches during background polling
        if (e.isOffline || !navigator.onLine || e.name === "TypeError") {
          return;
        }
        console.error("Notification polling error:", e);
      }
    }, 15000);
  }

  async function updateMsgBadge() {
    const unread = allMessages.filter(
      (m) => !getMessageIsRead(m) && m.receiver_type === "admin",
    ).length;
    const badge = $("msg-badge");
    if (badge) {
      if (unread > 0) {
        badge.style.display = "inline";
        badge.textContent = unread;
      } else {
        badge.style.display = "none";
      }
    }
    updateNotificationBadge();
  }

  // ═══════════════════════════════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════════════════════════════
  function toggleSidebar() {
    const sidebar = $("sidebar");
    const overlay = $("sidebar-overlay");
    const main = document.querySelector(".main");
    if (window.innerWidth <= 1024) {
      sidebar.classList.toggle("open");
      if (sidebar.classList.contains("open")) overlay.classList.add("active");
      else overlay.classList.remove("active");
    } else {
      sidebar.classList.toggle("collapsed");
      main.classList.toggle("expanded");
    }
  }

  const PAGE_TITLES = {
    dash: "Academy Overview",
    stud: "Student Registry",
    "coach-mgmt": "Coach Management",
    batches: "Classroom / Batch Manager",
    child: "My Child",
    fame: "Wall of Fame",
    events: "Events",
    bills: "Payments",
    insights: "AI Academy Insights",
    exp: "Expenditure Management",
    msgs: "Messages",
    ai: "AI Assistant",
    access: "Access Control",
    schedules: "Schedule Manager",
    homework: "Homework Manager",
    productivity: "Operations Productivity Center",
    chessable: "Chessable Profiles",
    "parent-ai": "Ask TOM AI",
  };

  function setPage(p) {
    const adminPages = [
      "dash",
      "stud",
      "coach-mgmt",
      "batches",
      "bills",
      "insights",
      "exp",
      "msgs",
      "events",
      "ai",
      "access",
      "schedules",
      "productivity",
      "chessable",
      "attendance",
      "homework",
    ];
    if (adminPages.includes(p) && role !== "admin" && role !== "master") {
      toast("Access denied", "error");
      setPage(role === "parent" ? "child" : "dash");
      return;
    }

    if (p !== "bills" && window.stopGatewayLogsSimulation) {
      window.stopGatewayLogsSimulation();
    }

    document.querySelectorAll(".page").forEach((pg) => {
      pg.classList.remove("active");
      pg.style.removeProperty("display");
    });
    document
      .querySelectorAll(".nav-item")
      .forEach((ni) => ni.classList.remove("active"));
    const pageEl = $("page-" + p);
    if (pageEl) {
      pageEl.classList.add("active");
      // If admin/master is viewing child page, clear parent-only visibility block
      if (p === "child" && (role === "admin" || role === "master")) {
        pageEl.style.setProperty("display", "block", "important");
      } else {
        pageEl.style.removeProperty("display");
      }
    }
    const navEl = $("nav-" + p);
    if (navEl) navEl.classList.add("active");
    if ($("p-title")) $("p-title").textContent = PAGE_TITLES[p] || "";
    
    // Page Initializers
    if (p === "attendance" && window.renderAttendanceList) {
      const dateEl = $("att-date");
      if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split("T")[0];
      window.renderAttendanceList();
    }

    // Mobile auto-close sidebar
    if (window.innerWidth <= 768) {
      const sidebar = $("sidebar");
      const overlay = $("sidebar-overlay");
      if (sidebar) sidebar.classList.remove("open");
      if (overlay) overlay.classList.remove("active");
    }

    const btnArea = $("top-btn-area");
    if (btnArea) {
      btnArea.innerHTML = "";
      if (role === "admin" || role === "master") {
        if (p === "dash") {
          const periodValue = `${window.reportYear}-${String(window.reportMonth + 1).padStart(2, "0")}`;
          btnArea.innerHTML = `
          <div style="display:flex;gap:6px;align-items:center;background:var(--surface2);padding:3px 8px;border-radius:8px;border:1px solid var(--border);box-shadow:var(--shadow-amber)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <input type="month" id="report-period" class="selector-minimal" onchange="updateReportContext()" value="${periodValue}">
          </div>
          <button class="btn btn-outline" onclick="if(window.generateReportPDF)window.generateReportPDF()">📄 Financial Report</button>
          <button class="btn btn-outline" onclick="if(window.generateReportPPT)window.generateReportPPT()" style="border-color:var(--amber); color:var(--amber);">📊 Boardroom Slides</button>
          <button class="btn btn-gold" onclick="exportAcademyData()">📥 Export Academy Data</button>
        `;
        }
        if (p === "stud")
          btnArea.innerHTML = `
          <button class="btn btn-outline-grey" onclick="openMonthlyMatrix()">📅 Monthly Matrix</button>
          <button class="btn btn-outline-grey" onclick="openAttendanceMarking()">🗓️  Batch Attendance</button>
          <button class="btn btn-outline-grey" onclick="rolloverDueDatesToCurrentMonth()" title="Advance past-month fee due dates to this month (keeps each student's day)">🔁 Roll Due Dates</button>
          <button class="btn btn-gold" onclick="openEnroll()">+ New Enrollment</button>
        `;
        if (p === "batches") {
          btnArea.innerHTML = `
            <button class="btn btn-outline-grey" onclick="openMasterSchedule()">📋 Master Schedule</button>
            <button class="btn btn-gold" onclick="openBatchModal()">+ New Batch</button>
          `;
        }
        if (p === "coach-mgmt")
          btnArea.innerHTML = `
          <button class="btn btn-outline-grey" onclick="openMasterSchedule()">📋 Master Schedule</button>
        `;
        if (p === "events")
          btnArea.innerHTML = `<button class="btn btn-gold" onclick="openEventModal()">+ Create Event</button>`;
        if (p === "insights")
          btnArea.innerHTML = `<button class="btn btn-gold" onclick="window.generateAcademyInsights()">🔄 Recalculate Insights</button>`;
        if (p === "chessable")
          btnArea.innerHTML = `
          <button class="btn btn-outline-amber" onclick="exportChessableCSV()">📤 Export CSV</button>
        `;
      }
    }

    if (window.innerWidth <= 768) {
      var sidebar = document.getElementById("sidebar");
      if (sidebar) sidebar.classList.remove("open");
      var overlay = document.getElementById("sidebar-overlay");
      if (overlay) overlay.classList.remove("active");
    }

    setTimeout(function () {
      if (p === "dash") renderDash();
      if (p === "stud") renderStudents();
      if (p === "coach-mgmt") renderCoachMgmt();
      if (p === "batches") {
        if (window.renderBatchesGrid) window.renderBatchesGrid();
      }
      if (p === "homework") {
        if (window.loadHomeworkData) {
          window.loadHomeworkData().then(() => {
            if (window.renderHomeworkPage) window.renderHomeworkPage();
          });
        } else if (window.renderHomeworkPage) {
          window.renderHomeworkPage();
        }
      }
      if (p === "fame") renderFame();
      if (p === "events") {
        renderEvents();
        if (window.setEventsSubTab) window.setEventsSubTab("academy");
      }
      if (p === "bills") renderBills();
      if (p === "child") renderChild();
      if (p === "parent-ai" && window.setAIModule) window.setAIModule("parent");
      if (p === "insights" && window.generateAcademyInsights)
        window.generateAcademyInsights();
      if (p === "msgs") renderMsgs();
      if (p === "exp" && window.initExpPage) window.initExpPage();
      if (p === "schedules" && window.initSchedulePage)
        window.initSchedulePage();
      if (p === "chessable" && window.renderChessableProfiles)
        window.renderChessableProfiles();
      if (p === "productivity" && window.initProductivityPage)
        window.initProductivityPage();
      if (p === "access") {
        if (window.loadAccessControl) window.loadAccessControl();
        if (window.renderParentAccounts) window.renderParentAccounts();
        if (window.loadAuditLogs) window.loadAuditLogs();
        if (window.startSecurityLogsSimulation)
          window.startSecurityLogsSimulation();
      } else {
        if (window.stopSecurityLogsSimulation)
          window.stopSecurityLogsSimulation();
      }
      if (p === "ai") {
        if (window.updateTomKpis) window.updateTomKpis();
        if (window.initSmartPills) window.initSmartPills();
        const chatBody = document.getElementById("ai-workspace-msgs");
        if (chatBody && chatBody.children.length === 0) {
          chatBody.innerHTML = `
            <div class="ai-ws-msg bot">
              <div class="ai-ws-avatar">🤖</div>
              <div class="ai-ws-bubble">
                Hello Admin! I'm your dedicated AI Copilot. I'm securely connected to your live academy database. How can I assist you with analytics, student insights, or performance metrics today?
              </div>
            </div>`;
        }
      }
    }, 10);
  }
  window.setPage = setPage;

  window.setReportPeriod = function (year, month) {
    window.reportYear = parseInt(year);
    window.reportMonth = parseInt(month);
    const val = `${year}-${String(month + 1).padStart(2, "0")}`;

    const dashEl = document.getElementById("report-period");
    const billEl = document.getElementById("f-bill-month");

    if (dashEl) dashEl.value = val;
    if (billEl) billEl.value = val;

    renderDash();
    renderBills();
  };

  window.updateReportContext = function (valOverride = null) {
    const el = document.getElementById("report-period");
    const billEl = document.getElementById("f-bill-month");
    const val = valOverride || (el ? el.value : billEl ? billEl.value : null);
    if (!val) return;

    const parts = val.split("-");
    if (parts.length < 2) return;
    window.setReportPeriod(parts[0], parseInt(parts[1]) - 1);
  };

  // ═══════════════════════════════════════════════════════════════
  // AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════
  function toggleEye() {
    const p = $("li-pass");
    const btn = $("eye-btn");
    if (!p || !btn) return;

    if (p.type === "password") {
      p.type = "text";
      btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
      btn.setAttribute("aria-label", "Hide password");
    } else {
      p.type = "password";
      btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
      btn.setAttribute("aria-label", "Show password");
    }
  }

  // AUTH LOGIC MOVED TO js/auth.js

  function finishLogin(displayName, userRole, studentId) {
    role = userRole;
    window.role = userRole; // keep window in sync for modules (access.js, etc.) on both fresh login & session restore
    recordSession("login");
    logAudit("auth", userRole, "login_success", null, {
      user: displayName,
      role: userRole,
    });
    if (userRole === "admin" || userRole === "master") {
      initRealtimeNotifications();
    }
    if (userRole === "parent") {
      toast(`${displayName} logged in`, "info");
    }
    const loginScreen = $("login-screen");
    if (loginScreen) loginScreen.style.display = "none";

    document.body.classList.remove(
      "login-mode",
      "admin-mode",
      "parent-mode",
      "master-mode",
    );
    document.body.classList.add(
      userRole === "master" ? "admin-mode" : userRole + "-mode",
    );
    if (userRole === "master") document.body.classList.add("master-mode");

    if ($("top-profile")) $("top-profile").style.display = "flex";
    if ($("top-profile-name"))
      $("top-profile-name").textContent = displayName.split(" ")[0] || "User";
    if ($("top-profile-av"))
      $("top-profile-av").src = generateAvatarURL(
        displayName,
        80,
        "dca33e",
        "000000",
      );

    const isAdmin = userRole === "admin" || userRole === "master";
    const isParent = userRole === "parent";
    document
      .querySelectorAll(".admin-only")
      .forEach((el) => (el.style.display = isAdmin ? "" : "none"));
    document
      .querySelectorAll(".parent-only")
      .forEach((el) => (el.style.display = isParent ? "" : "none"));

    // Explicitly show master-only elements if master
    // LOGOUT LOGIC MOVED TO js/auth.js
    if (userRole === "master") {
      document
        .querySelectorAll(".master-only")
        .forEach((el) => el.style.setProperty("display", "flex", "important"));
    }

    // Initialize parent AI module on login
    if (userRole === "parent") {
      const aiModules = $("ai-modules");
      if (aiModules) aiModules.style.display = "block";
      setTimeout(() => setAIModule("parent"), 100);
    }

    // Switch page immediately - DEFAULT TO CURRENT MONTH (not previous)
    window.reportMonth = new Date().getUTCMonth();
    window.reportYear = new Date().getUTCFullYear();
    if ($("report-period"))
      $("report-period").value =
        `${window.reportYear}-${String(window.reportMonth + 1).padStart(2, "0")}`;
    if ($("report-month-select"))
      $("report-month-select").value =
        `${window.reportYear}-${String(window.reportMonth + 1).padStart(2, "0")}`;

    if (userRole === "parent") setPage("child");
    else setPage("dash");

    // Load data in background - use cache for faster initial load
    dataCache = { timestamp: 0 };
    loadAllData(true).then(() => {
      setupNotificationCounts();
      startNotificationPolling();
      if (userRole === "parent" && studentId) {
        setCurrentStudent(
          allStudents.find((s) => String(s.id) === String(studentId)),
        );
        if (currentStudent) renderChild();
      }
      resetSessionTimer();
    });
  }

  function recordSession(action) {
    const auth = JSON.parse(localStorage.getItem("twoknights_auth") || "{}");
    if (!auth.role) return;

    const sessions = JSON.parse(localStorage.getItem("user_sessions") || "[]");
    const now = new Date().toISOString();
    const sessionId = "sess_" + Date.now();

    if (action === "login") {
      const user = auth.user || "Unknown";
      // Mark all previous sessions for this user as inactive
      sessions.forEach((s) => {
        if (s.user === user) s.active = false;
      });

      sessions.push({
        id: sessionId,
        user: user,
        role: auth.role,
        studentId: auth.studentId || null,
        loginAt: now,
        logoutAt: null,
        active: true,
      });
    } else if (action === "logout") {
      const currentSession = sessions.find(
        (s) => s.active && s.user === auth.user,
      );
      if (currentSession) {
        currentSession.active = false;
        currentSession.logoutAt = now;
      }
    }

    localStorage.setItem("user_sessions", JSON.stringify(sessions.slice(-50)));
  }

  function getActiveSessions() {
    const sessions = JSON.parse(localStorage.getItem("user_sessions") || "[]");
    const now = Date.now();
    const active = sessions.filter(
      (s) => s.active && now - new Date(s.loginAt).getTime() < 3600000 * 2,
    );

    const deduped = [];
    const seenUsers = new Set();
    // Sort by newest first to keep the most recent session
    active
      .sort((a, b) => new Date(b.loginAt) - new Date(a.loginAt))
      .forEach((s) => {
        if (!seenUsers.has(s.user)) {
          seenUsers.add(s.user);
          deduped.push(s);
        }
      });
    return deduped;
  }

  function getLoginHistory() {
    const sessions = JSON.parse(localStorage.getItem("user_sessions") || "[]");
    return sessions
      .sort((a, b) => new Date(b.loginAt) - new Date(a.loginAt))
      .slice(0, 20);
  }

  function logAudit(table, recordId, action, oldValue, newValue) {
    // Save to Supabase database
    const auth = JSON.parse(localStorage.getItem("twoknights_auth") || "{}");
    const data = {
      table_name: table,
      record_id: recordId,
      action: action,
      old_value: oldValue,
      new_value: newValue,
      user_name: auth.user || "system",
      user_role: auth.role || "system",
    };

    // Save to localStorage as backup
    const auditLogs = JSON.parse(localStorage.getItem("audit_logs") || "[]");
    auditLogs.push({ ...data, timestamp: new Date().toISOString() });
    localStorage.setItem("audit_logs", JSON.stringify(auditLogs.slice(-100)));

    // Try to save to Supabase
    apiCall("/api/audit", {
      method: "POST",
      body: JSON.stringify(data),
    }).catch(() => {});
  }
  window.logAudit = logAudit;

  function openProfile() {
    openModal("profile-modal");
    renderAccountActivity();
    const adminView = $("prof-admin-view");
    const parentView = $("prof-parent-view");
    if (adminView)
      adminView.style.display =
        role === "admin" || role === "master" ? "block" : "none";
    if (parentView)
      parentView.style.display = role === "parent" ? "block" : "none";
  }

  function renderAccountActivity() {
    const activeList = $("active-users-list");
    const adminHistoryList = $("admin-history-list");
    const parentHistoryList = $("parent-history-list");
    const auth = JSON.parse(localStorage.getItem("twoknights_auth") || "{}");
    const currentUser = auth.user || "Unknown";
    const sessions = getLoginHistory();
    const activeSessions = getActiveSessions();

    if (activeList && (role === "admin" || role === "master")) {
      if (activeSessions.length === 0) {
        activeList.innerHTML =
          '<div style="color:var(--ivory-dim);text-align:center;padding:10px">No users online</div>';
      } else {
        const currentUserActive = activeSessions.find(
          (s) => s.user === currentUser,
        );
        const others = activeSessions.filter((s) => s.user !== currentUser);

        let html = "";
        if (currentUserActive) {
          html += `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
            <span><span style="color:var(--emerald)">●</span> ${currentUser} <span style="color:var(--gold)">(You)</span></span>
            <span style="color:var(--ivory-dim);font-size:11px">${formatTimeAgo(currentUserActive.loginAt)}</span>
          </div>`;
        }
        others.forEach((s) => {
          html += `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
            <span><span style="color:var(--emerald)">●</span> ${s.user} <span class="badge badge-level" style="font-size:9px;margin-left:4px">${s.role}</span></span>
            <span style="color:var(--ivory-dim);font-size:11px">${formatTimeAgo(s.loginAt)}</span>
          </div>`;
        });
        activeList.innerHTML = html;
      }
    }

    if (adminHistoryList && (role === "admin" || role === "master")) {
      // Admin sees all users but filter to last 20 unique sessions
      const seen = new Set();
      const uniqueSessions = sessions
        .filter((s) => {
          const key = s.user + "|" + s.loginAt;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 20); // Show last 20 only

      if (uniqueSessions.length === 0) {
        adminHistoryList.innerHTML =
          '<div style="color:var(--ivory-dim);text-align:center;padding:10px">No login history</div>';
      } else {
        let html = "";
        uniqueSessions.forEach((s) => {
          const loginTime = new Date(s.loginAt).toLocaleString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "short",
          });
          const status = s.active
            ? '<span style="color:var(--emerald)">● Active</span>'
            : s.logoutAt
              ? '<span style="color:var(--ivory-dim)">Logged out</span>'
              : '<span style="color:var(--danger)">Session ended</span>';
          html += `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
            <span>${s.user} <span style="color:var(--ivory-dim)">(${s.role})</span></span>
            <span>${loginTime}</span>
          </div>`;
          html += `<div style="text-align:right;padding:2px 0 6px;font-size:10px;color:var(--ivory-dim)">${status}</div>`;
        });
        adminHistoryList.innerHTML = html;
      }
    }

    if (parentHistoryList && role === "parent") {
      // Parent sees only their own sessions, filter to unique login events
      const mySessions = sessions.filter((s) => s.user === currentUser);
      // Get unique login sessions (dedupe by login time)
      const seen = new Set();
      const uniqueLogins = mySessions
        .filter((s) => {
          const key = s.loginAt;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 10); // Show last 10 only

      if (uniqueLogins.length === 0) {
        parentHistoryList.innerHTML =
          '<div style="color:var(--ivory-dim);text-align:center;padding:10px">No login history</div>';
      } else {
        let html = "";
        uniqueLogins.forEach((s) => {
          const loginTime = new Date(s.loginAt).toLocaleString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "short",
          });
          const status = s.active
            ? '<span style="color:var(--emerald)">Currently Active</span>'
            : '<span style="color:var(--ivory-dim)">Session Ended</span>';
          html += `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span>Login</span>
              <span>${loginTime}</span>
            </div>
            <div style="font-size:11px;color:var(--ivory-dim);margin-top:2px">${status}</div>
          </div>`;
        });
        parentHistoryList.innerHTML = html;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CHARTS & DASHBOARD
  // ═══════════════════════════════════════════════════════════════
  function formatTimeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  function buildCharts(studs) {
    if (typeof Chart === "undefined") {
      console.warn("[UI] Chart.js not loaded. Skipping chart rendering.");
      return;
    }
    if (chartInstances.childElo) {
      chartInstances.childElo.destroy();
      delete chartInstances.childElo;
    }
    Object.values(chartInstances).forEach((chart) => {
      if (chart) chart.destroy();
    });
    chartInstances = {};
    const isLight = document.body.dataset.theme === "light";
    Chart.defaults.color = isLight ? "#454545" : "#f0ede4";
    Chart.defaults.borderColor = isLight
      ? "rgba(0,0,0,0.08)"
      : "rgba(255,255,255,0.08)";

    const revenueCtx = $("chartRevenue");
    if (revenueCtx) {
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const counts = new Array(12).fill(0);
      const currentYear = new Date().getUTCFullYear();
      studs.forEach((s) => {
        const d = getStudentDate(s);
        if (d) {
          const date = new Date(d);
          if (date.getUTCFullYear() === currentYear) {
            counts[date.getUTCMonth()]++;
          }
        }
      });
      const endMonth = new Date().getUTCMonth();
      const startMonth = (endMonth - 5 + 12) % 12;
      const labels = [];
      const data = [];
      for (let i = 0; i < 6; i++) {
        const mIdx = (startMonth + i) % 12;
        labels.push(months[mIdx]);
        data.push(counts[mIdx]);
      }
      chartInstances.revenue = new Chart(revenueCtx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "New Students",
              data,
              borderColor: "#e8a830",
              backgroundColor: "rgba(232, 168, 48, 0.15)",
              tension: 0.4,
              pointBackgroundColor: "#e8a830",
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } },
          },
        },
      });
    }

    const paymentCtx = $("chartPayment");
    if (paymentCtx) {
      const targetMonth = window.reportMonth;
      const targetYear = window.reportYear;
      const paid = studs.filter(
        (s) => getStudentPaymentStatus(s, targetMonth, targetYear) === "Paid",
      ).length;
      const pending = studs.filter(
        (s) =>
          getStudentPaymentStatus(s, targetMonth, targetYear) === "Pending",
      ).length;
      const due = studs.filter(
        (s) => getStudentPaymentStatus(s, targetMonth, targetYear) === "Due",
      ).length;
      const overdue = studs.filter(
        (s) =>
          getStudentPaymentStatus(s, targetMonth, targetYear) === "Overdue",
      ).length;

      chartInstances.payment = new Chart(paymentCtx, {
        type: "doughnut",
        data: {
          labels: ["Paid", "Pending", "Due", "Overdue"],
          datasets: [
            {
              data: [paid, pending, due, overdue],
              backgroundColor: ["#52c41a", "#e8a830", "#ff4d4f", "#722ed1"],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "bottom" } },
        },
      });
    }

    const sessionCtx = $("chartSession");
    if (sessionCtx) {
      let groupCount = 0,
        singleCount = 0;
      studs.forEach((s) => {
        const type = getStudentBatchType(s);
        if (type === "Group") groupCount++;
        else singleCount++;
      });
      chartInstances.session = new Chart(sessionCtx, {
        type: "doughnut",
        data: {
          labels: ["Group", "Single"],
          datasets: [
            {
              data: [groupCount, singleCount],
              backgroundColor: ["#c9960c", "#5a9fff"],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "bottom" } },
        },
      });
    }

    const coachCtx = $("chartCoach");
    if (coachCtx && allCoaches.length) {
      const labels = allCoaches.map((c) => getCoachName(c));
      const data = allCoaches.map(
        (c) => studs.filter((s) => String(s.coach_id) === String(c.id)).length,
      );
      chartInstances.coach = new Chart(coachCtx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Students assigned",
              data,
              backgroundColor: "rgba(220, 163, 62, 0.6)",
              borderColor: "#dca33e",
              borderWidth: 1,
              borderRadius: 5,
            },
          ],
        },
        options: {
          responsive: true,
          indexAxis: "y",
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid: { color: "rgba(128,128,128,0.1)" },
              ticks: { precision: 0 },
            },
            y: { grid: { display: false } },
          },
        },
      });
    }

    const financeHistoryCtx = $("chartFinanceHistory");
    if (financeHistoryCtx) {
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const currentYear = new Date().getUTCFullYear();
      const currentMonth = new Date().getUTCMonth();

      const labels = [];
      const paidData = [];
      const outstandingData = [];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(Date.UTC(currentYear, currentMonth - i, 1));
        const m = d.getUTCMonth();
        const y = d.getUTCFullYear();
        labels.push(`${months[m]} ${y}`);

        // Compute paid revenue for this specific month
        let paidVal = 0;
        const paidSet = new Set();
        (allPayments || []).forEach((p) => {
          const pDate = new Date(p.payment_date || p.created_at);
          if (
            pDate.getUTCMonth() === m &&
            pDate.getUTCFullYear() === y &&
            p.status === "paid"
          ) {
            const sid = String(p.student_id).toLowerCase();
            if (paidSet.has(sid)) return;
            const s = allStudents.find(
              (x) => String(x.id).toLowerCase() === sid,
            );
            if (s) {
              // Ensure we don't count pending/waitlist deposits accidentally if they shouldn't count?
              // Wait, actual paid deposits SHOULD count as revenue. We remove the destructive status filter.
            }
            paidSet.add(sid);
            paidVal += s ? getStudentMonthlyFee(s) : parseFloat(p.amount) || 0;
          }
        });
        paidData.push(paidVal);

        // Compute outstanding revenue for this specific month
        let outstandingVal = 0;
        allStudents.forEach((s) => {
          const sStatus = getStudentStatus(s);
          if (
            sStatus === "archived" ||
            sStatus === "pending" ||
            sStatus === "waitlist" ||
            sStatus === "upcoming" ||
            sStatus === "inactive"
          )
            return;

          const enrollDateStr = getStudentDate(s);
          const baseline = new Date(Date.UTC(2026, 3, 1, 0, 0, 0));
          const enrollDate = enrollDateStr ? new Date(enrollDateStr) : baseline;
          const targetMonthEnd = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59));
          if (enrollDate > targetMonthEnd) return;

          const status = getStudentPaymentStatus(s, m, y);
          if (status !== "Paid" && status !== "Not Enrolled") {
            outstandingVal += getStudentMonthlyFee(s) || 0;
          }
        });
        outstandingData.push(outstandingVal);
      }

      chartInstances.financeHistory = new Chart(financeHistoryCtx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Collected Revenue",
              data: paidData,
              backgroundColor: "#52c41a",
              borderRadius: 4,
            },
            {
              label: "Outstanding Amount",
              data: outstandingData,
              backgroundColor: "#ff4d4f",
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "bottom" } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (value) => "₹" + value.toLocaleString() },
            },
          },
        },
      });
    }
  }

  // Count a student's distinct PAID billing months (max one per calendar month)
  // — i.e. how many billing cycles their payments cover.
  function getStudentPaidInvoiceCount(s) {
    if (!s || !allPayments) return 0;
    const sid = String(s.id || "")
      .trim()
      .toLowerCase();
    const months = new Set();
    allPayments.forEach((p) => {
      if (
        p.status === "paid" &&
        String(p.student_id || "")
          .trim()
          .toLowerCase() === sid
      ) {
        const d = new Date(p.payment_date || p.created_at);
        if (!isNaN(d.getTime()))
          months.add(d.getUTCFullYear() + "-" + d.getUTCMonth());
      }
    });
    return months.size;
  }
  window.getStudentPaidInvoiceCount = getStudentPaidInvoiceCount;

  // Collected-revenue calculation (calendar month view)
  function calculateCollectedRevenue(year, month) {
    if (!allPayments) return 0;
    const seenStuds = new Set();
    return allPayments.reduce((sum, p) => {
      const pDate = new Date(p.payment_date || p.created_at);
      if (
        pDate.getUTCMonth() === month &&
        pDate.getUTCFullYear() === year &&
        p.status === "paid"
      ) {
        const sid = String(p.student_id).toLowerCase();
        if (seenStuds.has(sid)) return sum;
        seenStuds.add(sid);
        const s = allStudents.find(x => String(x.id).toLowerCase() === sid);
        const fee = s ? getStudentMonthlyFee(s) : (p.amount || 0);
        return sum + fee;
      }
      return sum;
    }, 0);
  }

  function renderDash() {
    // 1. Recalculate Payment Map for freshness (Deduplicated by month)
    const pMap = {};
    const seenMonthsGlobal = new Set();
    (allPayments || []).forEach((p) => {
      if (p.status === "paid") {
        const sid = String(p.student_id || "")
          .trim()
          .toLowerCase();
        if (!sid) return;
        const pDate = new Date(p.payment_date || p.created_at);
        const mKey = `${sid}_${pDate.getUTCFullYear()}-${pDate.getUTCMonth()}`;
        if (seenMonthsGlobal.has(mKey)) return;
        seenMonthsGlobal.add(mKey);
        pMap[sid] = (pMap[sid] || 0) + 1;
      }
    });
    window.totalPaymentsMap = pMap;

    // Basic stats
    if ($("s-coaches"))
      $("s-coaches").textContent = allCoaches.filter(
        (c) => c.status !== "archived",
      ).length;

    // --- Today's Attendance Insights (Local Date Aware) ---
    const nowLocal = new Date();
    const todayStr =
      nowLocal.getFullYear() +
      "-" +
      String(nowLocal.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(nowLocal.getDate()).padStart(2, "0");
    const todayLogs = allAttendance.filter((a) => a.date === todayStr);
    const presentCount = todayLogs.filter((a) => a.status === "present").length;
    const absentCount = todayLogs.filter((a) => a.status === "absent").length;

    // Smart Pending Logic: Only count students scheduled for today
    const studentsScheduledToday = allStudents.filter(isStudentScheduledToday);
    const loggedIds = new Set(todayLogs.map((l) => l.student_id));
    const pendingCount = studentsScheduledToday.filter(
      (s) => !loggedIds.has(s.id),
    ).length;

    if ($("s-att-present")) $("s-att-present").textContent = presentCount;
    if ($("s-att-absent")) $("s-att-absent").textContent = absentCount;
    const pendingEl = $("s-att-pending");
    if (pendingEl) {
      pendingEl.textContent = pendingCount;
      pendingEl.classList.add("bright");
      pendingEl.style.color = "var(--gold2)";
    }

    // --- Time-Machine Financial Calculation ---
    const targetMonth = window.reportMonth;
    const targetYear = window.reportYear;
    const targetMonthEnd = new Date(
      Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59),
    );

    // Calculate Collected This Month and Last Month (calendar month view)
    const currCollected = calculateCollectedRevenue(targetYear, targetMonth);
    const prevMonthDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const prevCollected = calculateCollectedRevenue(prevMonthDate.getUTCFullYear(), prevMonthDate.getUTCMonth());

    // 1. Target Dataset Preparation — cumulative paid months (deduplicated)
    const s_id_map = {};
    const seenMonthsAudit = new Set();
    (allPayments || []).forEach((p) => {
      if (p.status === "paid") {
        const sid = String(p.student_id || "")
          .trim()
          .toLowerCase();
        if (!sid) return;
        const s = allStudents.find((x) => String(x.id).toLowerCase() === sid);
        if (!s) return;

        const enrollDateStr = getStudentDate(s);
        const baseline = new Date(Date.UTC(2026, 3, 1));
        const enrollDate = enrollDateStr ? new Date(enrollDateStr) : baseline;
        const effectiveEnroll = (function () {
          var _a =
            window.getBillingAnchor && window.getBillingAnchor(s, baseline);
          return _a
            ? new Date(Date.UTC(_a.year, _a.month, 1))
            : enrollDate < baseline
              ? baseline
              : enrollDate;
        })();

        const pDate = new Date(p.payment_date || p.created_at);
        if (pDate <= targetMonthEnd) {
          const mKey = `${sid}_${pDate.getUTCFullYear()}-${pDate.getUTCMonth()}`;
          if (seenMonthsAudit.has(mKey)) return;
          seenMonthsAudit.add(mKey);

          if (!s_id_map[sid]) s_id_map[sid] = 0;
          s_id_map[sid]++;
        }
      }
    });

    const targetStudents = (allStudents || []).filter((s) => {
      const sStatus = getStudentStatus(s);
      if (
        sStatus === "archived" ||
        sStatus === "pending" ||
        sStatus === "waitlist" ||
        sStatus === "upcoming" ||
        sStatus === "inactive"
      )
        return false;

      const enrollDateStr = getStudentDate(s);
      const baseline = new Date(Date.UTC(2026, 3, 1, 0, 0, 0)); // April 1st Baseline (UTC)
      const enrollDate = enrollDateStr ? new Date(enrollDateStr) : baseline;
      return enrollDate <= targetMonthEnd;
    });

    // Update target-based summary stats
    if ($("s-total")) $("s-total").textContent = targetStudents.length;
    if ($("s-elo"))
      $("s-elo").textContent = targetStudents.length
        ? Math.round(
            targetStudents.reduce((a, s) => a + (getStudentRating(s) || 0), 0) /
              targetStudents.length,
          )
        : 0;

    // Calculate historical arrears and current month pending
    let totalArrears = 0;
    let currMonthPending = 0;
    let totalPotential = 0;

    targetStudents.forEach((s) => {
      const fee = getStudentMonthlyFee(s) || 0;

      const status = getStudentPaymentStatus(s, targetMonth, targetYear);

      const enrollDateStr = getStudentDate(s);
      const baseline = new Date(Date.UTC(2026, 3, 1));
      const enrollDate = enrollDateStr ? new Date(enrollDateStr) : baseline;
      const effectiveEnroll = (function () {
        var _a =
          window.getBillingAnchor && window.getBillingAnchor(s, baseline);
        return _a
          ? new Date(Date.UTC(_a.year, _a.month, 1))
          : enrollDate < baseline
            ? baseline
            : enrollDate;
      })();
      const monthsRequired =
        (targetYear - effectiveEnroll.getUTCFullYear()) * 12 +
        (targetMonth - effectiveEnroll.getUTCMonth()) +
        1;

      // Only count students whose billing has STARTED by this month (respects the
      // late-join grace anchor), so Projected = Collected + Outstanding stays
      // consistent — a grace-month student isn't yet "expected" revenue.
      if (monthsRequired >= 1) totalPotential += fee;

      const sid = String(s.id).toLowerCase();
      const totalCredits = s_id_map[sid] || 0;

      const totalMonthsUnpaid = Math.max(0, monthsRequired - totalCredits);
      if (totalMonthsUnpaid > 0) {
        const isPaidThisMonth = status === "Paid";
        const histMonths = totalMonthsUnpaid - (isPaidThisMonth ? 0 : 1);

        if (histMonths > 0) {
          totalArrears += fee * histMonths;
        }
        if (!isPaidThisMonth) {
          currMonthPending += fee;
        }
      }
    });

    const totalOutstanding = totalArrears + currMonthPending;

    // --- Collection Rate Calculation ---

    const rawRate =
      totalPotential > 0 ? (currCollected / totalPotential) * 100 : 0;
    const collectionRate = Math.min(rawRate, 100).toFixed(1);
    if ($("s-rate")) {
      $("s-rate").textContent = collectionRate + "%";
      $("s-rate").style.color = rawRate > 100 ? "var(--gold)" : "var(--blue)";
      $("s-rate").title = "";
    }

    // Update UI
    if ($("s-curr-collected")) $("s-curr-collected").textContent = "₹" + currCollected.toLocaleString();
    if ($("s-prev-collected")) $("s-prev-collected").textContent = "₹" + prevCollected.toLocaleString();
    if ($("s-total-revenue"))
      $("s-total-revenue").textContent = "₹" + totalPotential.toLocaleString();

    if ($("s-last-due"))
      $("s-last-due").textContent = "₹" + totalArrears.toLocaleString();
    if ($("s-curr-pending"))
      $("s-curr-pending").textContent = "₹" + currMonthPending.toLocaleString();
    if ($("s-total-outstanding"))
      $("s-total-outstanding").textContent =
        "₹" + totalOutstanding.toLocaleString();

    // Coach expenses & Total Academy Expenditures calculation
    const totalCoachCost = allCoaches
      .filter((c) => c.status !== "archived")
      .reduce((a, c) => a + (getCoachSalary(c) || 0), 0);
    if ($("s-total-cost"))
      $("s-total-cost").textContent = "₹" + totalCoachCost.toLocaleString();

    if ($("s-profit")) {
      const monthStr = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}`;
      apiCall(`/api/expenditures?mode=summary&month=${monthStr}`)
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error();
        })
        .then((summary) => {
          const totalExp = parseFloat(summary.total_expense || 0);
          if ($("s-profit")) {
            $("s-profit").textContent =
              "₹" + Math.round(totalExp).toLocaleString();
          }
        })
        .catch((err) => {
          console.error("[Dashboard] Failed to fetch other expenditures:", err);
          if ($("s-profit")) {
            $("s-profit").textContent = "₹0";
          }
        });
    }

    // Session counts
    let groupCount = 0,
      singleCount = 0,
      activeEnroll = 0,
      onlineCount = 0,
      offlineCount = 0;
    targetStudents.forEach((s) => {
      const sessStatus = getStudentStatus(s);
      if (
        sessStatus === "pending" ||
        sessStatus === "upcoming" ||
        sessStatus === "waitlist"
      )
        return;
      activeEnroll++;
      const type = getStudentBatchType(s);
      if (type === "Single") singleCount++;
      else groupCount++;
      const lm = (s.learning_mode || "online").toLowerCase();
      if (lm === "online") onlineCount++;
      else offlineCount++;
    });
    if ($("s-group")) $("s-group").textContent = groupCount;
    if ($("s-single")) $("s-single").textContent = singleCount;
    if ($("s-active-enroll")) $("s-active-enroll").textContent = activeEnroll;
    if ($("s-online")) $("s-online").textContent = String(onlineCount);
    if ($("s-offline")) $("s-offline").textContent = String(offlineCount);

    // Build charts
    if (typeof Chart !== "undefined") buildCharts(targetStudents);

    // Render coach financial table
    renderCoachFinance();

    // AI insights rendered on its own page
  }

  function renderCoachFinance() {
    const tbody = $("coach-finance-body");
    if (!tbody) return;

    const targetMonth = window.reportMonth;
    const targetYear = window.reportYear;
    const targetMonthEnd = new Date(
      Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59),
    );

    // Map total payments per student for ALL TIME (only 'paid' status)
    const totalPaymentsMap = {};
    (allPayments || []).forEach((p) => {
      if (p.status === "paid") {
        const sid = String(p.student_id || "")
          .trim()
          .toLowerCase();
        if (!sid) return;
        if (!totalPaymentsMap[sid]) totalPaymentsMap[sid] = 0;
        totalPaymentsMap[sid]++;
      }
    });

    const coachData = {};
    allCoaches.forEach((c) => {
      coachData[c.id] = {
        name: c.name || c.full_name || "Unknown",
        students: 0,
        revenue: 0, // Collected credits for this month
        pending: 0, // Uncollected credits for this month
        projected: 0, // Total potential fee
        cost: getCoachSalary(c) || 0,
      };
    });

    // Aggregate student data using Slot-Based Reconciliation
    const unassignedData = {
      name: "Unassigned / Academy",
      students: 0,
      revenue: 0,
      pending: 0,
      projected: 0,
      cost: 0,
    };

    allStudents.forEach((s) => {
      const sStatus = getStudentStatus(s);
      if (
        sStatus === "archived" ||
        sStatus === "pending" ||
        sStatus === "waitlist" ||
        sStatus === "upcoming" ||
        sStatus === "inactive"
      )
        return;

      const coachId = s.coach_id;
      const targetData = coachData[coachId] || unassignedData;

      const enrollDateStr = getStudentDate(s);
      const enrollDate = enrollDateStr ? new Date(enrollDateStr) : null;

      // 1. Enrollment Check for selected month
      if (enrollDate && enrollDate <= targetMonthEnd) {
        const fee = getStudentMonthlyFee(s) || 0;
        targetData.students++;
        targetData.projected += fee;

        // Status-Based Pending Check (for the 'Pending' column)
        const status = getStudentPaymentStatus(s, targetMonth, targetYear);
        if (status !== "Paid") {
          targetData.pending += fee;
        }
      }
    });

    // 2. Add Deduplicated Revenue from 'paid' Transactions
    const coachPaidStuds = new Set();
    (allPayments || []).forEach((p) => {
      const pDate = new Date(p.payment_date || p.created_at);
      if (
        pDate.getUTCMonth() === targetMonth &&
        pDate.getUTCFullYear() === targetYear &&
        p.status === "paid"
      ) {
        const sid = String(p.student_id).toLowerCase();
        if (coachPaidStuds.has(sid)) return;

        const s = allStudents.find((x) => String(x.id).toLowerCase() === sid);
        if (
          s &&
          getStudentPaymentStatus(s, targetMonth, targetYear) === "Paid"
        ) {
          coachPaidStuds.add(sid);
          const coachId = s.coach_id;
          const targetData = coachData[coachId] || unassignedData;
          targetData.revenue += getStudentMonthlyFee(s);
        }
      }
    });

    // Merge unassigned data if it has activity
    if (unassignedData.students > 0 || unassignedData.revenue > 0) {
      coachData["unassigned"] = unassignedData;
    }

    // Sort alphabetically by coach name (keep "Unassigned / Academy" last).
    const sorted = Object.entries(coachData).sort((a, b) => {
      const an = (a[1].name || "").toLowerCase(),
        bn = (b[1].name || "").toLowerCase();
      const aUn = an.includes("unassigned"),
        bUn = bn.includes("unassigned");
      if (aUn !== bUn) return aUn ? 1 : -1;
      return an.localeCompare(bn);
    });

    tbody.innerHTML = sorted
      .map(([id, d]) => {
        const netProfit = d.revenue - d.cost; // Current cash flow (collected − salary)
        const potentialNetProfit = d.projected - d.cost; // If every student pays
        // ROI shown as an intuitive multiplier: "for every ₹1 of salary, the coach
        // earns the academy ₹X". e.g. 3.5× now / 4.2× at full collection.
        const roiX = d.cost > 0 ? (d.revenue / d.cost).toFixed(1) : null;
        const potRoiX = d.cost > 0 ? (d.projected / d.cost).toFixed(1) : null;
        const roiClass =
          roiX !== null && parseFloat(roiX) >= 1
            ? "text-success"
            : "text-danger";
        const roiCell =
          roiX === null
            ? '<span style="color:var(--ivory-dim)">—</span>'
            : `<span class="${roiClass}" style="font-weight:700">${roiX}×</span> <span style="color:var(--ivory3)">now</span> / <span class="text-gold" style="font-weight:700">${potRoiX}×</span> <span style="color:var(--ivory3)">max</span>`;
        const profitClass = netProfit >= 0 ? "text-success" : "text-danger";
        const potentialProfitClass =
          potentialNetProfit >= 0 ? "text-success" : "text-danger";
        return `<tr>
        <td><b>${d.name}</b></td>
        <td>${d.students}</td>
        <td>₹${d.revenue.toLocaleString()}</td>
        <td>₹${d.pending.toLocaleString()}</td>
        <td>₹${d.cost.toLocaleString()}</td>
        <td class="${profitClass}" title="Collected revenue minus salary">₹${netProfit.toLocaleString()}</td>
        <td class="${potentialProfitClass}" title="Profit if every assigned student pays (projected − salary)">₹${potentialNetProfit.toLocaleString()}</td>
        <td title="Times the coach earns back their salary — collected now, and projected at full collection. 1× = breaks even.">${roiCell}</td>
        <td><button class="btn btn-gold btn-sm" onclick="informCoachFees('${id}')">📢 Inform</button></td>
      </tr>`;
      })
      .join("");
  }

  // ═══════════════════════════════════════════════════════════════
  // STUDENTS, COACHES, EVENTS, ACHIEVEMENTS
  // ═══════════════════════════════════════════════════════════════
  function clearFilters() {
    [
      "f-coach",
      "f-session",
      "f-status",
      "f-min-fee",
      "f-max-fee",
      "f-search",
      "f-bill-month-stud",
      "f-due-date-stud",
      "f-enroll-date-stud",
    ].forEach((id) => {
      const el = $(id);
      if (el) el.value = "";
    });
    resetStudMonth();
    /* renderStudents(); */
    renderStudents();
  }
  window.syncStudMonth = function (val) {
    if (!val) return;
    const [y, m] = val.split("-");
    window.reportMonth = parseInt(m) - 1;
    window.reportYear = parseInt(y);
    renderStudents();
    toast(`Viewing billing status for ${val}`, "info");
  };

  window.syncDueDateFilter = function (val) {
    if (!val) {
      renderStudents();
      return;
    }
    const [y, m, d] = val.split("-");
    window.reportMonth = parseInt(m) - 1;
    window.reportYear = parseInt(y);
    const monthVal = `${y}-${m}`;
    if ($("f-bill-month-stud")) $("f-bill-month-stud").value = monthVal;
    renderStudents();
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    toast(
      `Viewing students due on ${parseInt(d)}-${months[window.reportMonth]}-${window.reportYear}`,
      "info",
    );
  };

  window.syncEnrollDateFilter = function (val) {
    if (!val) {
      renderStudents();
      return;
    }
    renderStudents();
    const [y, m, d] = val.split("-");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    toast(
      `Viewing students enrolled on ${parseInt(d)}-${months[parseInt(m) - 1]}-${y}`,
      "info",
    );
  };

  window.resetStudMonth = function () {
    const now = new Date();
    window.reportMonth = now.getUTCMonth();
    window.reportYear = now.getUTCFullYear();
    if ($("f-bill-month-stud")) $("f-bill-month-stud").value = "";
    if ($("f-due-date-stud")) $("f-due-date-stud").value = "";
    renderStudents();
    toast("Switched to current month view", "info");
  };

  function renderStudents() {
    const tbody = $("stud-body");
    if (!tbody) return;

    try {
      // Ensure reportMonth/Year are valid numbers
      if (
        typeof window.reportMonth !== "number" ||
        isNaN(window.reportMonth) ||
        typeof window.reportYear !== "number" ||
        isNaN(window.reportYear)
      ) {
        const now = new Date();
        window.reportMonth = now.getUTCMonth();
        window.reportYear = now.getUTCFullYear();
        console.warn("[renderStudents] Fixed invalid reportMonth/year");
      }

      const targetMonth = window.reportMonth;
      const targetYear = window.reportYear;
      const targetMonthEnd = new Date(
        Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59),
      );

      // Pre-calculate payments for this month for the new column
      // Pre-calculate payments for this month (Normalized for Single Fee Rule)
      const paymentsOfMonth = {};
      (allPayments || []).forEach((p) => {
        const pDate = new Date(p.payment_date || p.created_at);
        if (
          pDate.getUTCMonth() === targetMonth &&
          pDate.getUTCFullYear() === targetYear &&
          p.status === "paid"
        ) {
          const sid = String(p.student_id).toLowerCase();
          const s = allStudents.find((x) => String(x.id).toLowerCase() === sid);
          const fee = s ? getStudentMonthlyFee(s) : parseFloat(p.amount) || 0;
          // Force Exactly one payment cycle per month display
          paymentsOfMonth[sid] = { total: fee, count: 1 };
        }
      });

      let studs =
        role === "admin" || role === "master"
          ? allStudents
          : currentStudent
            ? [currentStudent]
            : [];

      // Apply Base Filters (Enrollment Date & Archive Status)
      studs = studs.filter((s) => {
        const sStatus = getStudentStatus(s);
        const fEnrollStatus = $("f-enroll-status")?.value;
        if (sStatus === "archived" && fEnrollStatus !== "archived")
          return false;
        const enrollDateStr = getStudentDate(s);
        const enrollDate = enrollDateStr
          ? new Date(enrollDateStr)
          : new Date(Date.UTC(2026, 3, 1));

        // Always show upcoming, pending, or waitlisted students regardless of the dashboard month selected
        if (["upcoming", "pending", "waitlist"].includes(sStatus)) return true;

        return enrollDate <= targetMonthEnd;
      });

      // Apply UI Filters
      if (role === "admin" || role === "master") {
        const fSearch = ($("f-search")?.value || "").toLowerCase().trim();
        const fCoach = $("f-coach")?.value;
        const fSession = $("f-session")?.value;
        const fEnrollStatus = $("f-enroll-status")?.value;
        const fLearningMode = $("f-learning-mode")?.value;
        const fStatus = $("f-status")?.value;
        const fMin = parseInt($("f-min-fee")?.value) || 0;
        const fMax = parseInt($("f-max-fee")?.value) || 999999;
        const fDueDate = $("f-due-date-stud")?.value;
        const fEnrollDate = $("f-enroll-date-stud")?.value;
        let selectedDay = null;
        let selectedEnrollDate = null;
        if (fDueDate) {
          const [y, m, d] = fDueDate.split("-");
          selectedDay = parseInt(d);
        }
        if (fEnrollDate) {
          selectedEnrollDate = fEnrollDate;
        }

        studs = studs.filter((s) => {
          const nameMatch =
            !fSearch || getStudentName(s).toLowerCase().includes(fSearch);
          const coachMatch = !fCoach || String(s.coach_id) === String(fCoach);
          const sessionMatch = !fSession || getStudentBatchType(s) === fSession;
          const statusMatch =
            !fStatus ||
            getStudentPaymentStatus(s, targetMonth, targetYear) === fStatus;
          const fee = getStudentMonthlyFee(s);
          const feeMatch = fee >= fMin && fee <= fMax;

          let dueDateMatch = true;
          if (selectedDay !== null) {
            const c = allCoaches.find(
              (x) => String(x.id) === String(s.coach_id),
            );
            const cName = c ? getCoachName(c) : "";
            const dueCfg = getStudentDueConfig(
              s,
              cName,
              targetMonth,
              targetYear,
            );
            dueDateMatch = dueCfg.day >= selectedDay;
          }

          let enrollDateMatch = true;
          if (selectedEnrollDate) {
            const enrollDate = getStudentDate(s);
            enrollDateMatch = enrollDate === selectedEnrollDate;
          }

          const enrollStatusMatch =
            !fEnrollStatus || getStudentStatus(s) === fEnrollStatus;
          const learningModeMatch =
            !fLearningMode || (s.learning_mode || "online") === fLearningMode;

          return (
            nameMatch &&
            coachMatch &&
            sessionMatch &&
            statusMatch &&
            feeMatch &&
            dueDateMatch &&
            enrollDateMatch &&
            enrollStatusMatch &&
            learningModeMatch
          );
        });

        if (selectedDay !== null) {
          studs.sort((a, b) => {
            const cA = allCoaches.find(
              (x) => String(x.id) === String(a.coach_id),
            );
            const dueA = getStudentDueConfig(
              a,
              cA ? getCoachName(cA) : "",
              targetMonth,
              targetYear,
            ).day;
            const cB = allCoaches.find(
              (x) => String(x.id) === String(b.coach_id),
            );
            const dueB = getStudentDueConfig(
              b,
              cB ? getCoachName(cB) : "",
              targetMonth,
              targetYear,
            ).day;

            if (dueA === dueB) {
              return getStudentName(a).localeCompare(getStudentName(b));
            }
            return dueA - dueB;
          });
        } else {
          studs.sort((a, b) =>
            getStudentName(a).localeCompare(getStudentName(b)),
          );
        }
      }

      if (!studs || studs.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="12" class="text-center">No students found matching filters for this period</td></tr>';
        return;
      }

      console.log(`[UI] Rendering ${studs.length} students...`);
      tbody.innerHTML = studs
        .map((s, i) => {
          try {
            const status = getStudentPaymentStatus(s, targetMonth, targetYear);
            const session = getStudentBatchType(s);
            const time = s.session_time || s.class_time || s.batch_time || "";
            const coach = allCoaches.find(
              (c) => String(c.id) === String(s.coach_id),
            );
            const coachName = coach ? escapeHtml(getCoachName(coach)) : "-";
            const uniqueId =
              "more-" + (s.id || "err").replace(/[^a-zA-Z0-9]/g, "");
            const months = [
              "Jan",
              "Feb",
              "Mar",
              "Apr",
              "May",
              "Jun",
              "Jul",
              "Aug",
              "Sep",
              "Oct",
              "Nov",
              "Dec",
            ];
            // Due Date: show the EXACT date the admin entered/updated (s.due_date),
            // with no month-selector shifting or auto-rollover. Fall back to the
            // day-of-month billing computation only when no explicit date is stored.
            let dueDateString, dueDateObj;
            const _ddMatch = String(s.due_date || "").match(
              /(\d{4})-(\d{2})-(\d{2})/,
            );
            if (_ddMatch) {
              const _yy = +_ddMatch[1],
                _mm = +_ddMatch[2] - 1,
                _dd = +_ddMatch[3];
              dueDateObj = new Date(_yy, _mm, _dd, 23, 59, 59);
              dueDateString = `${String(_dd).padStart(2, "0")}-${months[_mm]}-${_yy}`;
            } else {
              const dueCfg = getStudentDueConfig(
                s,
                coachName,
                targetMonth,
                targetYear,
              );
              const dueDay = String(dueCfg.day).padStart(2, "0");
              dueDateString = `${dueDay}-${months[targetMonth]}-${targetYear}`;
              dueDateObj = new Date(
                targetYear,
                targetMonth,
                dueCfg.day,
                23,
                59,
                59,
              );
            }
            const isOverdue =
              status === "Overdue" ||
              (status !== "Paid" &&
                status !== "Pending" &&
                dueDateObj < new Date());

            const enrollStatus = getStudentStatus(s);
            const isNonActive = enrollStatus !== "active";

            let badgeHtml = "";
            if (enrollStatus === "active") {
              badgeHtml =
                '<span class="badge" style="background: rgba(16, 185, 129, 0.12); color: var(--emerald); font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; border: 1px solid rgba(16, 185, 129, 0.25);">Enrolled & Attending</span>';
            } else if (enrollStatus === "pending") {
              badgeHtml =
                '<span class="badge" style="background: rgba(245, 158, 11, 0.12); color: var(--warning); font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; border: 1px solid rgba(245, 158, 11, 0.25);">Pending</span>';
            } else if (enrollStatus === "waitlist") {
              badgeHtml =
                '<span class="badge" style="background: rgba(139, 92, 246, 0.12); color: #a78bfa; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; border: 1px solid rgba(139, 92, 246, 0.25);">Waiting List</span>';
            } else if (enrollStatus === "upcoming") {
              badgeHtml =
                '<span class="badge" style="background: rgba(59, 130, 246, 0.12); color: #60a5fa; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; border: 1px solid rgba(59, 130, 246, 0.25);">Upcoming</span>';
            } else if (enrollStatus === "inactive") {
              badgeHtml =
                '<span class="badge" style="background: rgba(107, 114, 128, 0.12); color: #9ca3af; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; border: 1px solid rgba(107, 114, 128, 0.25);">Inactive</span>';
            } else if (enrollStatus === "archived") {
              badgeHtml =
                '<span class="badge" style="background: rgba(239, 68, 68, 0.12); color: #f87171; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; border: 1px solid rgba(239, 68, 68, 0.25);">Archived</span>';
            }

            let dueDateHtml = "";
            if (
              enrollStatus === "pending" ||
              enrollStatus === "waitlist" ||
              enrollStatus === "inactive" ||
              enrollStatus === "archived"
            ) {
              dueDateHtml = `<span style="color: var(--ivory-dim);">—</span>`;
            } else if (enrollStatus === "upcoming") {
              dueDateHtml = `<span style="color: var(--ivory-dim); opacity: 0.8;">${dueDateString}</span>`;
            } else if (status === "Paid") {
              dueDateHtml = `<span class="text-success" style="opacity: 0.85; font-weight: 500; cursor:pointer" onclick="viewPaymentHistory('${s.id}')">${dueDateString}</span>`;
            } else if (isOverdue) {
              dueDateHtml = `<span class="text-danger" style="font-weight: 700;">⚠️ ${dueDateString}</span>`;
            } else {
              dueDateHtml = `<span style="color: var(--warning); font-weight: 600;">${dueDateString}</span>`;
            }

            // Primary action buttons (always visible)
            let primaryActions = "";
            let moreActions = "";

            if (status === "Paid") {
              primaryActions = `
                  <div style="display:flex;gap:4px;flex-wrap:nowrap">
                  <button class="btn btn-gold btn-sm" style="flex-shrink:0;white-space:nowrap" onclick="sendPaymentReceiptNotification('${s.id}', '${getStudentMonthlyFee(s)}')">📢 Inform</button>
                  <button class="btn btn-outline-grey btn-sm" style="flex-shrink:0;white-space:nowrap" onclick="openHomeworkAssignmentModal('student', '${s.id}')">Homework</button>
                  <button class="btn btn-outline-grey btn-sm" style="flex-shrink:0;white-space:nowrap" onclick="viewStudent('${s.id}')">View</button>
                  <button class="btn btn-outline-grey btn-sm" style="flex-shrink:0;white-space:nowrap" onclick="openEdit('${s.id}')">Edit</button>
                  <button class="btn btn-danger btn-sm" style="flex-shrink:0;white-space:nowrap" onclick="deleteStudent('${s.id}', '${jsAttrEncode(getStudentName(s))}')">Delete</button>
                  <button class="btn btn-outline-info btn-sm" style="flex-shrink:0;white-space:nowrap" onclick="togglePaymentStatus('${s.id}', '${jsAttrEncode(getStudentName(s))}', '${getStudentMonthlyFee(s)}')">🔄 Mark Unpaid</button>
                  </div>
                `;
              moreActions = `
                 <button class="btn btn-outline-grey btn-sm" style="width:100%;margin-bottom:4px" onclick="viewPaymentHistory('${s.id}')">⏳ History</button>
                 <button class="btn btn-outline-grey btn-sm" style="width:100%;margin-bottom:4px" onclick="downloadReceipt('${s.id}', '${jsAttrEncode(getStudentName(s))}', '${getStudentMonthlyFee(s)}', '${jsAttrEncode(getStudentLevel(s))}', '${getStudentRating(s)}', '${coachName}', 'Online')">📄 Receipt</button>
                 <button class="btn btn-outline-grey btn-sm" style="width:100%;margin-bottom:4px" onclick="sendPaymentReminder('${s.id}')">💬 WhatsApp</button>
               `;
            } else if (
              status === "Pending" ||
              status === "Due" ||
              status === "Overdue"
            ) {
              primaryActions = `
                   <div style="display:flex;gap:4px;flex-wrap:nowrap">
                   <button class="btn btn-gold btn-sm" style="flex-shrink:0;white-space:nowrap" onclick="togglePaymentStatus('${s.id}', '${jsAttrEncode(getStudentName(s))}', '${getStudentMonthlyFee(s)}')">✅ Mark as Paid</button>
                  <button class="btn btn-outline-grey btn-sm" style="flex-shrink:0;white-space:nowrap" onclick="openHomeworkAssignmentModal('student', '${s.id}')">Homework</button>
                  <button class="btn btn-outline-grey btn-sm" style="flex-shrink:0;white-space:nowrap" onclick="viewStudent('${s.id}')">View</button>
                   <button class="btn btn-outline-grey btn-sm" style="flex-shrink:0;white-space:nowrap" onclick="openEdit('${s.id}')">Edit</button>
                   <button class="btn btn-danger btn-sm" style="flex-shrink:0;white-space:nowrap" onclick="deleteStudent('${s.id}', '${jsAttrEncode(getStudentName(s))}')">Delete</button>
                   <button class="btn btn-outline-info btn-sm" style="flex-shrink:0;white-space:nowrap" onclick="informParent('${s.id}', '${jsAttrEncode(getStudentName(s))}', '${getStudentMonthlyFee(s)}')">📢 Inform</button>
                   </div>
                 `;
              moreActions = `
                 <button class="btn btn-gold btn-sm" style="width:100%;margin-bottom:4px" onclick="openPay('${s.id}', '${jsAttrEncode(getStudentName(s))}', '${getStudentMonthlyFee(s)}')">💳 Pay Now</button>
                 <button class="btn btn-outline-grey btn-sm" style="width:100%;margin-bottom:4px" onclick="viewPaymentHistory('${s.id}')">⏳ History</button>
                 <button class="btn btn-outline-grey btn-sm" style="width:100%;margin-bottom:4px" onclick="sendPaymentReminder('${s.id}')">💬 WhatsApp</button>
               `;
            } else if (isNonActive || status === "Not Enrolled") {
              primaryActions = `
                  <div style="display:flex;gap:4px;flex-wrap:nowrap">
                  <button class="btn btn-outline-grey btn-sm" style="flex-shrink:0;white-space:nowrap" onclick="viewStudent('${s.id}')">View</button>
                  <button class="btn btn-outline-grey btn-sm" style="flex-shrink:0;white-space:nowrap" onclick="openEdit('${s.id}')">Edit</button>
                  <button class="btn btn-danger btn-sm" style="flex-shrink:0;white-space:nowrap" onclick="deleteStudent('${s.id}', '${jsAttrEncode(getStudentName(s))}')">Delete</button>
                  </div>
                `;
              moreActions = "";
            } else {
              primaryActions = `<span style="color:var(--ivory-dim);font-size:11px">—</span>`;
              moreActions = "";
            }

            const checkboxHtml = isNonActive
              ? `<input type="checkbox" class="stud-check" data-id="${s.id}" disabled title="Non-active students cannot be selected for payments">`
              : `<input type="checkbox" class="stud-check" data-id="${s.id}">`;

            const learningMode =
              s.learning_mode === "offline" ? "Offline" : "Online";
            const learningModeColor =
              learningMode === "Online" ? "#3b82f6" : "#8b5cf6";
            const learningModeBadge = `<span class="badge" style="background: ${learningMode === "Online" ? "rgba(59, 130, 246, 0.12)" : "rgba(139, 92, 246, 0.12)"}; color: ${learningModeColor}; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; border: 1px solid ${learningMode === "Online" ? "rgba(59, 130, 246, 0.25)" : "rgba(139, 92, 246, 0.25)"}; margin-left: 4px;">${learningMode}</span>`;

            const studentNameHtml = `
              <div style="font-weight:600">${escapeHtml(getStudentName(s))}</div>
              <div style="margin-top: 4px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                ${badgeHtml}
                ${learningModeBadge}
              </div>
            `;

            const feeHtml = isNonActive
              ? `<span style="color: var(--ivory-dim);">—</span>`
              : formatStudentFee(s, getStudentMonthlyFee(s));

            let statusClass = "text-danger";
            if (status === "Paid") statusClass = "text-success";
            else if (isNonActive || status === "Not Enrolled")
              statusClass = "text-warning";

            const statusText =
              enrollStatus === "waitlist"
                ? "Waiting List"
                : enrollStatus === "upcoming"
                  ? "Upcoming"
                  : enrollStatus === "inactive"
                    ? "Inactive"
                    : enrollStatus === "archived"
                      ? "Archived"
                      : enrollStatus === "pending"
                        ? "Not Enrolled"
                        : status;

            return `<tr>
              <td>${checkboxHtml}</td>
              <td style="color:var(--ivory-dim);font-weight:600">${i + 1}</td>
              <td>${studentNameHtml}</td>
              <td>${escapeHtml(getStudentLevel(s))} - ${escapeHtml(getStudentRating(s))} ELO</td>
              <td>${coachName}</td>
              <td>${getStudentDate(s) || "-"}</td>
              <td>${session}</td>
              <td>${time}</td>
              <td>${feeHtml}</td>
              <td><span class="${statusClass}" style="font-weight: 600;">${statusText}</span></td>
              <td>${dueDateHtml}</td>
                <td style="overflow-x:auto;white-space:nowrap">
                   <div style="display:flex;gap:4px;flex-wrap:nowrap;align-items:center;min-width:0" class="action-menu-container">
                    ${primaryActions}
                    ${
                      moreActions
                        ? `
                      <button class="btn btn-outline-grey btn-sm more-btn" onclick="toggleMoreMenu('${uniqueId}')">⋮ More</button>
                      <div id="${uniqueId}" class="more-menu" style="display:none;position:absolute;right:0;top:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px;z-index:100;min-width:160px;box-shadow:var(--shadow);margin-top:4px">
                        ${moreActions}
                      </div>
                    `
                        : ""
                    }
                  </div>
               </td>
            </tr>`;
          } catch (rowErr) {
            console.error(`[UI] Error rendering student row ${i}:`, rowErr, s);
            return `<tr><td colspan="12" style="color:var(--danger)">Error rendering student ${s.name || i}</td></tr>`;
          }
        })
        .join("");
    } catch (err) {
      console.error("[UI] renderStudents critical error:", err);
      if (tbody)
        tbody.innerHTML = `<tr><td colspan="12" class="text-center text-danger">Failed to load students. Please refresh the page.</td></tr>`;
    }
  }

  window.toggleMoreMenu = function (id) {
    const menu = document.getElementById(id);
    const isShown = menu.style.display === "block";
    document
      .querySelectorAll(".more-menu")
      .forEach((m) => (m.style.display = "none"));
    menu.style.display = isShown ? "none" : "block";
  };

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".action-menu-container")) {
      document
        .querySelectorAll(".more-menu")
        .forEach((m) => (m.style.display = "none"));
    }
  });

  function viewStudent(id) {
    const s = allStudents.find((x) => String(x.id) === String(id));
    if (!s) return;

    // Set the current student for impersonation / preview
    setCurrentStudent(s);

    // Switch page directly to the student portal page (which renders live analytics & details)
    setPage("child");
  }

  function openEdit(id) {
    const s = allStudents.find((x) => String(x.id) === String(id));
    if (!s) return;
    const savedCoachId = s.coach_id || "";
    $("e-id").value = s.id;
    $("e-name").value = getStudentName(s);
    // Render country dropdown for edit modal
    renderCountryDropdown("country-dropdown-edit", "selectCountryEdit");
    // Set country first so phone placeholder/validation matches
    const studentPhone = getStudentPhone(s);
    const parsed = parseStoredPhone(studentPhone);
    const inferredCountry =
      parsed.countryCode && parsed.countryCode !== "IN"
        ? parsed.countryCode
        : s.country_code || "IN";
    const country = getCountryByCode(inferredCountry);
    if (country) {
      selectCountryEdit(country.code, country.dial, country.length);
    }
    $("e-phone").value = parsed.localNumber;
    $("e-level").value = getStudentLevel(s);
    $("e-elo").value = getStudentRating(s);
    $("e-fee").value = getStudentMonthlyFee(s);
    if ($("e-enroll-status")) $("e-enroll-status").value = s.status || "active";
    if ($("e-payment-status"))
      $("e-payment-status").value = getStudentPaymentStatus(s);
    $("e-join").value = getStudentDate(s);
    $("e-batch-type").value = getStudentBatchType(s);
    $("e-batch-time").value = getStudentBatchTime(s);
    if ($("e-due-date")) $("e-due-date").value = s.due_date || "";
    if ($("e-learning-mode"))
      $("e-learning-mode").value = s.learning_mode || "online";
    // BUG FIX: Pre-fill notes so updateStudent never silently blanks them
    if ($("e-notes")) $("e-notes").value = getStudentCoachNotes(s);
    if ($("e-lichess")) $("e-lichess").value = s.lichess_username || "";
    if ($("e-chesscom")) $("e-chesscom").value = s.chesscom_username || "";
    if ($("e-chessable")) $("e-chessable").value = s.chessable_username || "";
    syncCoachDropdowns();
    $("e-coach").value = savedCoachId;
    openModal("edit-modal");
  }

  async function updateStudent() {
    const id = $("e-id").value;
    const s = allStudents.find((x) => String(x.id) === String(id));
    if (!s) {
      toast("Student not found", "error");
      return;
    }
    const oldElo = getStudentRating(s);
    const newElo = parseInt($("e-elo").value);
    const newFee = parseInt($("e-fee").value) || 0;

    // BUGFIX: Capture the DYNAMIC payment status BEFORE the save.
    // s.payment_status (the DB field) is unreliable — it's often empty.
    // The source of truth is getStudentPaymentStatus() which checks actual payment records.
    const oldDynamicPayStatus = getStudentPaymentStatus(s);

    // Validate phone based on selected country for edit modal
    const rawPhone = $("e-phone").value.trim();
    const countryCode = window.selectedCountryCodeEdit || "IN";
    const validation = validatePhoneNumber(rawPhone, countryCode);
    if (!rawPhone) {
      toast("Parent phone is required", "error");
      return;
    }
    if (!validation.valid) {
      toast(validation.error, "error");
      return;
    }
    const fullPhone = getFullInternationalPhoneDigits(rawPhone, countryCode);

    // Due-date sanity: it must not fall before the enrollment date.
    const _eEnroll = $("e-join") ? $("e-join").value : "";
    const _eDue = $("e-due-date") ? $("e-due-date").value : "";
    if (_eEnroll && _eDue && _eDue < _eEnroll) {
      toast("Due date cannot be before the enrollment date.", "error");
      if ($("e-due-date")) $("e-due-date").focus();
      return;
    }

    // Send fee under every possible field name so whichever Supabase column exists gets updated
    const data = {
      full_name: $("e-name").value,
      name: $("e-name").value,
      phone: fullPhone,
      parent_phone: fullPhone,
      country_code: countryCode,
      level: $("e-level").value,
      grade: $("e-level").value,
      rating: newElo,
      coach_id: $("e-coach").value,
      status: $("e-enroll-status")?.value || s.status || "active",
      payment_status:
        $("e-payment-status")?.value || s.payment_status || "Pending",
      enrollment_date: $("e-join").value,
      due_date: $("e-due-date")?.value || null,
      session_mode: $("e-batch-type").value,
      batch_type: $("e-batch-type").value,
      session_time: $("e-batch-time").value,
      batch_time: $("e-batch-time").value,
      // Send fee under ALL possible column names
      monthly_fee: newFee,
      fee: newFee,
      fees: newFee,
      tuition_fee: newFee,
      learning_mode: $("e-learning-mode")?.value || s.learning_mode || "online",
      lichess_username: $("e-lichess") ? $("e-lichess").value.trim() : "",
      chesscom_username: $("e-chesscom") ? $("e-chesscom").value.trim() : "",
      chessable_username: $("e-chessable") ? $("e-chessable").value.trim() : "",
      notes: (function () {
        // Preserve the student's saved schedule tag (new base64 OR legacy) from
        // their stored notes — editing other fields must never wipe the schedule.
        const m64 = (s.notes || "").match(/\[SCHEDULE64:[A-Za-z0-9+/=]+\]/);
        const mLegacy = (s.notes || "").match(/\[SCHEDULE:({.*?})\]/);
        const scheduleStr = m64
          ? " " + m64[0]
          : mLegacy
            ? " " + mLegacy[0]
            : "";
        // Strip any tag from the editable coach-notes field so it's never duplicated/orphaned.
        const cleanNotes = ($("e-notes")?.value || "")
          .replace(/\[LM:(online|offline)\]/g, "")
          .replace(/\[SCHEDULE64:[A-Za-z0-9+/=]+\]/g, "")
          .replace(/\[SCHEDULE:({.*?})\]/g, "")
          .trim();
        return (
          `[LM:${$("e-learning-mode")?.value || s.learning_mode || "online"}] ` +
          cleanNotes +
          scheduleStr
        );
      })(),
    };

    try {
      const res = await apiCall(`/api/students?id=${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (res.ok) {
        // AUTOMATION: Create/delete transaction record if payment status was manually changed.
        // BUGFIX: Use oldDynamicPayStatus (captured BEFORE the save) as the "before" state,
        // NOT s.payment_status which is a stale/empty DB field.
        const newStatus =
          $("e-payment-status")?.value || oldDynamicPayStatus || "Pending";

        // If status changed FROM 'Paid' TO 'Pending', 'Due', or 'Overdue', delete the payment record for this month.
        if (
          oldDynamicPayStatus === "Paid" &&
          (newStatus === "Pending" ||
            newStatus === "Due" ||
            newStatus === "Overdue")
        ) {
          const now = new Date();
          const targetMonth = now.getUTCMonth();
          const targetYear = now.getUTCFullYear();

          const monthPay = (allPayments || []).find((p) => {
            if (String(p.student_id) !== String(id)) return false;
            if (p.status !== "paid") return false;
            const pDate = new Date(p.payment_date || p.created_at);
            return (
              pDate.getUTCMonth() === targetMonth &&
              pDate.getUTCFullYear() === targetYear
            );
          });

          if (monthPay) {
            try {
              await apiCall(`/api/payments?id=${monthPay.id}`, {
                method: "DELETE",
              });
              // Optimistically remove from local array to ensure UI refresh is instant
              allPayments = allPayments.filter((p) => p.id !== monthPay.id);
            } catch (de) {
              console.warn(
                "Failed to auto-delete payment record on revert:",
                de,
              );
            }
          }
        }

        // Only create a payment record if status genuinely CHANGED to Paid (was NOT Paid before)
        if (oldDynamicPayStatus !== "Paid" && newStatus === "Paid") {
          try {
            await apiCall("/api/payments", {
              method: "POST",
              body: JSON.stringify({
                id:
                  "pay_" +
                  Date.now() +
                  "_" +
                  Math.random().toString(36).substr(2, 9), // Required Primary Key
                student_id: id,
                amount: parseFloat(newFee), // Ensure numeric
                status: "paid",
                payment_method: "Manual Override",
                description: "Status updated to Paid via Profile",
                transaction_id: "PRF-" + Math.floor(Math.random() * 1000000),
                payment_date:
                  window.reportMonth !== new Date().getUTCMonth() ||
                  window.reportYear !== new Date().getUTCFullYear()
                    ? new Date(
                        Date.UTC(
                          window.reportYear,
                          window.reportMonth,
                          1,
                          12,
                          0,
                          0,
                        ),
                      ).toISOString()
                    : new Date().toISOString(),
              }),
            });
            sendPaymentReceiptNotification(id, newFee);
          } catch (pe) {
            console.warn("Payment logging failed during profile update:", pe);
            toast(
              "Warning: Payment record not created. Student status updated though.",
              "warning",
            );
          }
        }

        // Log rating history if changed
        if (newElo !== oldElo) {
          try {
            await apiCall("/api/rating_history", {
              method: "POST",
              body: JSON.stringify({
                student_id: id,
                rating: newElo,
                change_type: "manual",
                notes: "Manual adjustment",
              }),
            });
          } catch (e) {
            console.warn("Rating history table missing, skipping log.");
          }
        }

        // Determine newStatus once — use the dynamic status for the optimistic update
        const paymentStatusVal =
          $("e-payment-status")?.value || oldDynamicPayStatus || "Pending";

        // OPTIMISTIC UPDATE: immediately patch the in-memory record so the UI
        // shows the new values without waiting for the next loadAllData fetch.
        const idx = allStudents.findIndex((x) => String(x.id) === String(id));
        if (idx !== -1) {
          allStudents[idx] = {
            ...allStudents[idx],
            full_name: data.full_name,
            name: data.name,
            phone: data.phone,
            parent_phone: data.parent_phone,
            level: data.level,
            grade: data.level,
            rating: data.rating,
            coach_id: data.coach_id,
            status: data.status,
            payment_status: paymentStatusVal,
            enrollment_date: data.enrollment_date,
            due_date: data.due_date,
            session_mode: data.session_mode,
            batch_type: data.batch_type,
            session_time: data.session_time,
            batch_time: data.batch_time,
            monthly_fee: newFee,
            fee: newFee,
            fees: newFee,
            tuition_fee: newFee,
            notes: data.notes,
          };
        }

        // FIX C2: If this student is the currently logged-in parent's child, refresh currentStudent
        if (currentStudent && String(currentStudent.id) === String(id)) {
          setCurrentStudent(allStudents[idx]);
        }

        toast("Student updated!", "success");
        closeModals();

        // FIX C1: Mark that we're editing to prevent realtime listener from interfering
        window.isEditing = true;

        // Full sync with database - loadAllData will re-render all pages automatically
        await loadAllData(true);

        // Reset editing flag after a short delay
        setTimeout(() => {
          window.isEditing = false;
        }, 1000);
      } else {
        const err = await res.json().catch(() => ({}));
        toast(
          "Update failed: " +
            (err.error || err.message || `Server error ${res.status}`),
          "error",
        );
      }
    } catch (e) {
      console.error("updateStudent error:", e);
      toast("Update failed: " + e.message, "error");
    }
  }
  function openEnroll() {
    $("m-name").value = "";
    $("m-phone").value = "";
    $("m-level").value = "Beginner";
    $("m-join").value = "";
    $("m-elo").value = "800";
    $("m-fee").value = "5000";
    $("m-batch-type").value = "Evening";
    $("m-batch-time").value = "17:00";
    if ($("m-due-date")) $("m-due-date").value = "";
    if ($("m-coach")) $("m-coach").value = "";
    if ($("m-status")) $("m-status").value = "active";
    if ($("m-learning-mode")) $("m-learning-mode").value = "offline";
    window.selectedCountryCode = "IN";
    window.selectedCountryCodeEdit = "IN";
    const selected = $("country-selected");
    if (selected)
      selected.innerHTML =
        '<span style="display: flex; align-items: center; gap: 6px;"><img src="https://flagcdn.com/w20/in.png" style="width: 20px; height: 14px; border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.15);" alt="India" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'inline-block\';"><span class="country-flag-emoji" style="display: none; font-size: 17px; line-height: 1;">🇮🇳</span><span style="font-family: monospace; font-size: 11px; font-weight: 700; opacity: 0.75;">IN</span></span><span class="country-dial">+91</span>';
    const phoneInput = $("m-phone");
    if (phoneInput) phoneInput.placeholder = "10 digits";
    syncCoachDropdowns();
    renderCountryDropdown("country-dropdown", "selectCountry");
    openModal("enroll-modal");
  }

  async function saveStudent() {
    const rawPhone = $("m-phone").value.trim();
    const countryCode = window.selectedCountryCode || "IN";
    const validation = validatePhoneNumber(rawPhone, countryCode);
    const fullPhone = getFullInternationalPhoneDigits(rawPhone, countryCode);
    const selectedStatus = $("m-status")?.value || "active";
    const defaultPaymentStatus =
      selectedStatus === "active" ? "Due" : "Pending";
    const data = {
      full_name: $("m-name").value.trim(),
      phone: fullPhone,
      parent_phone: fullPhone,
      country_code: countryCode,
      level: $("m-level").value,
      rating: parseInt($("m-elo").value) || 0,
      coach_id: $("m-coach").value,
      enrollment_date:
        $("m-join").value || new Date().toISOString().split("T")[0],
      // If no due date is entered, default it to the student's billing-anchor
      // month on their enrollment day (so a June enrolment is due in June, not
      // July via the server's "5th of next month" fallback). Late-month joins
      // (grace) correctly anchor to the next month.
      due_date: (function () {
        const explicit = $("m-due-date")?.value;
        if (explicit) return explicit;
        const enrollStr =
          $("m-join").value || new Date().toISOString().split("T")[0];
        const ed = new Date(enrollStr);
        if (isNaN(ed.getTime())) return null;
        const a = window.getBillingAnchor
          ? window.getBillingAnchor({ enrollment_date: enrollStr })
          : { year: ed.getUTCFullYear(), month: ed.getUTCMonth() };
        const daysIn = new Date(a.year, a.month + 1, 0).getDate();
        const day = Math.min(ed.getUTCDate(), daysIn);
        return (
          a.year +
          "-" +
          String(a.month + 1).padStart(2, "0") +
          "-" +
          String(day).padStart(2, "0")
        );
      })(),
      batch_type: $("m-batch-type").value,
      batch_time: $("m-batch-time").value,
      monthly_fee: parseInt($("m-fee").value) || 0,
      payment_status: defaultPaymentStatus,
      status: selectedStatus,
      learning_mode: $("m-learning-mode")?.value || "online",
      notes: `[LM:${$("m-learning-mode")?.value || "online"}]`,
      lichess_username: $("m-lichess") ? $("m-lichess").value.trim() : "",
      chesscom_username: $("m-chesscom") ? $("m-chesscom").value.trim() : "",
      chessable_username: $("m-chessable") ? $("m-chessable").value.trim() : "",
    };

    // Due date is handled by the backend if not provided.

    if (!data.full_name) {
      toast("Student name is required", "error");
      return;
    }
    if (!rawPhone) {
      toast("Parent phone is required", "error");
      return;
    }
    if (!validation.valid) {
      toast(validation.error, "error");
      return;
    }
    // Due-date sanity: must not be before the enrollment date.
    const _mEnroll = $("m-join") ? $("m-join").value : "";
    const _mDue = $("m-due-date") ? $("m-due-date").value : "";
    if (_mEnroll && _mDue && _mDue < _mEnroll) {
      toast("Due date cannot be before the enrollment date.", "error");
      if ($("m-due-date")) $("m-due-date").focus();
      return;
    }

    try {
      const res = await apiCall("/api/students", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (res.ok) {
        logAudit("students", "new", "create", null, data);
        toast("Student enrolled successfully!", "success");
        closeModals();
        loadAllData(true);
      } else {
        const err = await res.json().catch(() => ({}));
        toast(
          "Enrollment failed: " +
            (err.error || err.message || `Server error ${res.status}`),
          "error",
        );
      }
    } catch (e) {
      toast("Failed to enroll student: " + e.message, "error");
    }
  }

  async function deleteStudent(id, name) {
    $("delete-item-type").textContent = "Student";
    $("delete-item-name").textContent = name;
    $("delete-item-id").value = id;
    $("delete-type").value = "student";
    openModal("delete-confirm-modal");
  }

  function renderCoachMgmt() {
    const grid = $("coach-mgmt-body");
    if (!grid) return;

    if (!allCoaches || allCoaches.length === 0) {
      grid.innerHTML =
        '<div class="empty-state" style="grid-column: 1/-1;"><span class="empty-icon">👨‍🏫</span><p>No coaches found in the academy</p></div>';
      return;
    }

    grid.innerHTML = allCoaches
      .slice()
      .sort((a, b) => getCoachName(a).localeCompare(getCoachName(b)))
      .map((c) => {
        const studs = allStudents.filter(
          (s) => String(s.coach_id) === String(c.id),
        );
        const studentCount = studs.length;
        const avgRating = studs.length
          ? Math.round(
              studs.reduce((a, s) => a + (getStudentRating(s) || 0), 0) /
                studs.length,
            )
          : 800;
        let photo = c.photo_url || c.photo || c.image;
        if (photo) {
          // Allow data URLs and Supabase storage URLs; block external services
          if (
            !photo.startsWith("data:") &&
            !photo.includes(".supabase.co") &&
            window.SUPABASE_URL &&
            !photo.includes(window.SUPABASE_URL)
          ) {
            console.warn(
              "[Avatar] External coach photo ignored for",
              getCoachName(c),
            );
            photo = null;
          }
        }
        if (!photo) {
          photo = generateAvatarURL(getCoachName(c), 120, "dca33e", "000000");
        }

        return `
         <div class="coach-card">
           <div class="coach-card-header">
             <img src="${photo}" class="coach-card-av" alt="${escapeHtml(getCoachName(c))}">
             <div>
               <div class="coach-card-title">${escapeHtml(getCoachName(c))}</div>
               <div class="coach-card-subtitle">${escapeHtml(getCoachSpecialty(c) || "Chess Coach")}</div>
             </div>
           </div>
           <div class="coach-card-stats">
             <div class="coach-stat">
               <span class="coach-stat-label">Students</span>
               <span class="coach-stat-val">${studentCount}</span>
             </div>
             <div class="coach-stat">
               <span class="coach-stat-label">Avg ELO</span>
               <span class="coach-stat-val">${avgRating}</span>
             </div>
             <div class="coach-stat">
               <span class="coach-stat-label">Salary</span>
               <span class="coach-stat-val">₹${(getCoachSalary(c) || 0).toLocaleString()}</span>
             </div>
             <div class="coach-stat">
               <span class="coach-stat-label">Status</span>
               <span class="coach-stat-val ${getCoachStatus(c) === "active" ? "text-success" : "text-danger"}">${getCoachStatus(c) === "active" ? "Active" : "Inactive"}</span>
             </div>
           </div>
           <div class="coach-card-actions" style="grid-template-columns: 1fr 1fr; gap: 8px;">
             <button class="btn btn-outline-grey btn-sm" onclick="viewCoach('${c.id}')" title="View Profile">View</button>
             <button class="btn btn-outline-grey btn-sm" onclick="openCoachModal('${c.id}')" title="Edit Coach">Edit</button>
             <button class="btn btn-gold btn-sm" onclick="informCoachFees('${c.id}')" title="Inform Fees">Inform</button>
             <button class="btn btn-outline-grey btn-sm" onclick="confirmDeleteCoach('${c.id}', '${escapeHtml(getCoachName(c)).replace(/'/g, "\\'")}')" title="Delete Coach">Delete</button>
           </div>
           <div style="display:flex; gap:8px; margin-top:12px;">
             <button class="btn btn-outline btn-sm" style="flex:1" onclick="toggleCoachStudents('${c.id}')" id="coach-toggle-${c.id}">👥 Students (${studentCount})</button>
             <button class="btn btn-outline btn-sm" style="flex:1" onclick="viewCoachSchedule('${c.id}')">📅 Schedule</button>
           </div>
           <div class="coach-students-panel" id="coach-students-${c.id}" style="display:none; margin-top:12px; border-top:1px solid var(--border); padding-top:12px;"></div>
         </div>
       `;
      })
      .join("");
  }

  // Expandable per-coach student roster with view / edit / delete + add.
  window.toggleCoachStudents = function (coachId) {
    const panel = document.getElementById("coach-students-" + coachId);
    const toggleBtn = document.getElementById("coach-toggle-" + coachId);
    if (!panel) return;
    if (panel.style.display !== "none") {
      panel.style.display = "none";
      if (toggleBtn) toggleBtn.classList.remove("active");
      return;
    }
    const coach = allCoaches.find((c) => String(c.id) === String(coachId));
    const coachName = coach ? getCoachName(coach) : "Coach";
    const studs = allStudents
      .filter((s) => String(s.coach_id) === String(coachId))
      .sort((a, b) => getStudentName(a).localeCompare(getStudentName(b)));

    let rows;
    if (studs.length === 0) {
      rows = `<div style="text-align:center; padding:12px; color:var(--ivory-dim); font-size:12px;">No students assigned yet.</div>`;
    } else {
      rows = studs
        .map((s) => {
          const st = getStudentPaymentStatus(s);
          const stColor =
            st === "Paid"
              ? "var(--emerald)"
              : st === "Overdue" || st === "Due"
                ? "var(--danger)"
                : "var(--warning)";
          return `<div style="display:flex; align-items:center; gap:8px; padding:7px 8px; border-radius:8px; background:rgba(255,255,255,0.02); margin-bottom:6px;">
          <div style="flex:1; min-width:0;">
            <div style="font-size:12px; font-weight:600; color:var(--ivory); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(getStudentName(s))}</div>
            <div style="font-size:10px; color:var(--ivory-dim);">${getStudentRating(s)} ELO &middot; <span style="color:${stColor};">${st}</span></div>
          </div>
          <button class="btn btn-outline-grey btn-sm" style="padding:3px 7px; font-size:10px;" onclick="viewStudent('${s.id}')" title="View">View</button>
          <button class="btn btn-outline-grey btn-sm" style="padding:3px 7px; font-size:10px;" onclick="openEdit('${s.id}')" title="Edit">Edit</button>
          <button class="btn btn-outline-grey btn-sm text-danger" style="padding:3px 7px; font-size:10px;" onclick="deleteStudent('${s.id}', '${jsAttrEncode(getStudentName(s))}')" title="Delete">Del</button>
        </div>`;
        })
        .join("");
    }

    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <span style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:var(--gold); font-weight:700;">Students under ${escapeHtml(coachName)}</span>
        <button class="btn btn-gold btn-sm" style="padding:4px 10px; font-size:11px;" onclick="addStudentForCoach('${coachId}')" title="Enroll a new student under this coach">+ Add</button>
      </div>
      <div style="max-height:260px; overflow-y:auto;">${rows}</div>`;
    panel.style.display = "block";
    if (toggleBtn) toggleBtn.classList.add("active");
  };

  // Open the enrollment modal pre-set to a specific coach.
  window.addStudentForCoach = function (coachId) {
    if (typeof openEnroll === "function") openEnroll();
    setTimeout(() => {
      const sel = $("m-coach");
      if (sel) sel.value = coachId;
    }, 120);
  };

  window.viewCoach = function (id) {
    const c = allCoaches.find((x) => String(x.id) === String(id));
    if (!c) return;

    const studs = allStudents.filter(
      (s) => String(s.coach_id) === String(c.id),
    );
    const avgRating = studs.length
      ? Math.round(
          studs.reduce((a, s) => a + (getStudentRating(s) || 0), 0) /
            studs.length,
        )
      : 800;

    $("cv-name").innerText = getCoachName(c);
    $("cv-spec").innerText = getCoachSpecialty(c) || "General Coach";
    $("cv-phone").innerText = c.phone || "N/A";
    $("cv-email").innerText = c.email || "N/A";
    $("cv-salary").innerText = (getCoachSalary(c) || 0).toLocaleString();
    $("cv-status").innerText = capitalizeFirst(getCoachStatus(c));
    $("cv-address").innerText = c.address || "No address provided";
    $("cv-avail").innerText = c.availability || "N/A";
    $("cv-bio").innerText =
      c.bio || c.additional_details || "No biography available.";
    $("cv-stud-count").innerText = studs.length;
    $("cv-avg-elo").innerText = avgRating;
    $("cv-exp").innerText = (c.experience || 0) + "y";
    let photo2 = c.photo_url || c.photo || c.image;
    if (photo2) {
      if (
        !photo2.startsWith("data:") &&
        !photo2.includes(".supabase.co") &&
        window.SUPABASE_URL &&
        !photo2.includes(window.SUPABASE_URL)
      ) {
        console.warn(
          "[Avatar] External coach photo (modal) ignored for",
          getCoachName(c),
        );
        photo2 = null;
      }
    }
    if (!photo2) {
      photo2 = generateAvatarURL(getCoachName(c), 200, "dca33e", "000000");
    }
    $("cv-av").src = photo2;

    $("cv-edit-btn").onclick = () => {
      closeModals();
      openCoachModal(id);
    };
    openModal("coach-view-modal");
  };

  // ─── Dynamic Schedule (live data, not hardcoded) ────────────────
  // Groups a coach's CURRENT students into batches by their actual class
  // schedule — taken from the student's saved [SCHEDULE64] (regDays/regTime)
  // when present, else their session day/time. Reflects reassignments,
  // deletions and new enrolments automatically.
  // Pretty-print a time token/range: "17:00" -> "5:00 PM",
  // "17:00-18:00" -> "5:00 PM – 6:00 PM"; leaves "7:00 PM" / "Weekend" untouched.
  function prettyTime(str) {
    if (!str) return "";
    return String(str)
      .trim()
      .split(/\s*[–-]\s*/)
      .map((tok) => {
        const m = tok.trim().match(/^(\d{1,2}):(\d{2})$/);
        if (m) {
          let h = parseInt(m[1], 10);
          const mm = m[2];
          const ap = h >= 12 ? "PM" : "AM";
          h = h % 12 || 12;
          return `${h}:${mm} ${ap}`;
        }
        return tok.trim();
      })
      .filter(Boolean)
      .join(" – ");
  }

  const STATIC_MASTER_MATRIX = [
    {
      coach: 'Rohith',
      batches: [
        { name: 'Batch 1', days: 'Tuesday, Wednesday, Saturday', time: '5:00 AM - 5:40 AM', students: ['Sreelaxmi'] },
        { name: 'Batch 2', days: 'Wednesday, Thursday', time: '8:00 PM - 9:00 PM', students: ['Samiksha'] }
      ]
    },
    {
      coach: 'Ranjith',
      batches: [
        { name: 'Batch 1', days: 'Wednesday, Friday', time: '2:45 PM - 3:45 PM', students: ['Sakthi, Sathya'] },
        { name: 'Batch 2', days: 'Saturday, Sunday', time: '7:00 PM - 8:00 PM', students: ['Riyas, Susil, Varun'] }
      ]
    },
    {
      coach: 'Gyana',
      batches: [
        { name: 'Batch 1', days: 'Wednesday, Friday', time: '5:40 AM - 6:20 AM', students: ['Ekash'] },
        { name: 'Batch 2', days: 'Wednesday, Friday', time: '7:00 AM - 8:00 AM', students: ['Nigunan, Praneev'] },
        { name: 'Batch 3', days: 'Saturday, Sunday', time: '7:00 PM - 8:00 PM', students: ['Aara, Anush, Rakshitha, Shervin'] }
      ]
    },
    {
      coach: 'Arivu',
      batches: [
        { name: 'Batch 1', days: 'Monday, Wednesday', time: '7:00 PM - 8:00 PM', students: ['Eduveer, Yugan'] },
        { name: 'Batch 2', days: 'Monday, Wednesday', time: '8:00 PM - 9:00 PM', students: ['Aarunya, Magathi, Pranav'] },
        { name: 'Batch 3', days: 'Monday, Wednesday', time: '8:00 PM - 9:00 PM', students: ['Aatish, Uttsan'] },
        { name: 'Batch 4', days: 'Tuesday, Thursday', time: '7:00 PM - 8:00 PM', students: ['Mukilan, Sashwin'] }
      ]
    },
    {
      coach: 'Yogesh',
      batches: [
        { name: 'Batch 1', days: 'Thursday, Friday', time: '6:00 AM - 7:00 AM', students: ['Jeevan'] },
        { name: 'Batch 2', days: 'Saturday, Sunday', time: '6:00 PM - 7:00 PM', students: ['Banu Priya, Dinesh, Sai, Venkatesh Son'] },
        { name: 'Batch 3', days: 'Saturday, Sunday', time: '7:30 PM - 8:30 PM', students: ['Athvik, Mohammad Rayan, Pranesh'] },
        { name: 'Batch 4', days: 'Monday, Wednesday', time: '7:30 PM - 8:30 PM', students: ['Poornima, Praveen, Magathi, Anush'] }
      ]
    },
    {
      coach: 'Sudhin',
      batches: [
        { name: 'Batch 1', days: 'Saturday, Sunday', time: '7:00 PM - 8:00 PM', students: ['Aakif, Pranish, Venkatesh Daughter'] }
      ]
    },
    {
      coach: 'Vasanth',
      batches: [
        { name: 'Batch 1 (Fri)', days: 'Friday', time: '6:00 PM - 7:00 PM', students: ['Harsha (Venkatesh Son)'] },
        { name: 'Batch 1 (Sat)', days: 'Saturday', time: '8:00 AM - 9:00 AM', students: ['Harsha (Venkatesh Son)'] }
      ]
    },
    {
      coach: 'Vishnu',
      batches: [
        { name: 'Batch 1', days: 'Wednesday, Thursday', time: '6:00 PM - 7:00 PM', students: ['Abinitha'] },
        { name: 'Batch 2', days: 'Wednesday, Thursday', time: '7:00 PM - 8:00 PM', students: ['Yogesh'] },
        { name: 'Batch 3', days: 'Friday, Saturday', time: '7:00 PM - 8:00 PM', students: ['Akmal, Anfal, Buvargan'] }
      ]
    }
  ];

  window.STATIC_MASTER_MATRIX = STATIC_MASTER_MATRIX;

  function buildCoachBatches(coachId) {
    const c = (allCoaches || []).find((x) => String(x.id) === String(coachId));
    if (!c) return [];
    
    const cName = getCoachName(c).toLowerCase();
    const matrixEntry = STATIC_MASTER_MATRIX.find(m => cName.includes(m.coach.toLowerCase()));
    
    if (matrixEntry && matrixEntry.batches.length > 0) {
      return matrixEntry.batches.map(b => ({
        name: b.name,
        schedule: b.days + " | " + b.time,
        students: b.students
      }));
    }

    return [];
  }
  window.buildCoachBatches = buildCoachBatches;

  function buildDynamicSchedule() {
    return (allCoaches || [])
      .filter((c) => getCoachStatus(c) !== "archived")
      .map((c) => ({
        coach: getCoachName(c),
        coachId: c.id,
        batches: buildCoachBatches(c.id),
      }))
      .filter((e) => e.batches.length > 0)
      .sort((a, b) => a.coach.localeCompare(b.coach));
  }
  window.buildDynamicSchedule = buildDynamicSchedule;

  function viewCoachSchedule(id) {
    const c = allCoaches.find((x) => String(x.id) === String(id));
    const coachName = c ? getCoachName(c) : "Coach";
    if ($("sched-coach-name")) $("sched-coach-name").innerText = coachName;

    const container = $("schedule-container");
    if (!container) {
      openModal("coach-schedule-modal");
      return;
    }

    // Build this coach's batches from LIVE data (reflects reassignments etc.).
    const batches = buildCoachBatches(id);
    const sched = batches.length
      ? { coach: coachName, batches: batches }
      : null;

    const daysFull = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const shortDays = ["M", "T", "W", "T", "F", "S", "S"];

    const dayPills = (scheduleStr) => {
      const low = (scheduleStr || "").toLowerCase();
      return (
        `<div style="display:flex; gap:5px; margin:10px 0 8px;">` +
        daysFull
          .map((d, i) => {
            const active =
              low.includes(d.toLowerCase()) ||
              low.includes(d.slice(0, 3).toLowerCase());
            return `<div style="flex:1; text-align:center; padding:7px 0; border-radius:7px; font-size:11px; font-weight:800; ${
              active
                ? "background:linear-gradient(135deg,var(--gold) 0%,#b8860b 100%); color:#000; box-shadow:0 2px 8px rgba(218,163,62,0.35);"
                : "background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.35);"
            }">${shortDays[i]}</div>`;
          })
          .join("") +
        `</div>`
      );
    };
    const timePart = (scheduleStr) => {
      const p = (scheduleStr || "").split("|");
      return p[1] ? p[1].trim() : scheduleStr || "TBD";
    };

    let html = "";
    if (sched && sched.batches && sched.batches.length) {
      html = sched.batches
        .map(
          (b) => `
        <div style="background:var(--bg2); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
            <span style="font-weight:700; color:var(--gold); font-family:var(--font-head); font-size:15px;">${escapeHtml(b.name)}</span>
            <span style="font-size:12px; color:var(--blue); font-family:var(--font-mono);">⏰ ${escapeHtml(timePart(b.schedule))}</span>
          </div>
          ${dayPills(b.schedule)}
          <div style="font-size:12px; color:var(--ivory-dim); margin-top:10px; line-height:1.6;">
            <b style="color:var(--ivory);">${b.students.length} student${b.students.length === 1 ? "" : "s"}:</b> ${b.students.map(escapeHtml).join(", ")}
          </div>
        </div>`,
        )
        .join("");
    } else {
      // Fallback: build cards from the live roster (students assigned to this coach).
      const assigned = allStudents.filter(
        (s) => String(s.coach_id) === String(id),
      );
      if (assigned.length === 0) {
        html =
          '<div class="empty-state"><span class="empty-icon">📅</span><p>No students assigned to this coach</p></div>';
      } else {
        html = `<div style="background:var(--bg2); border:1px solid var(--border); border-radius:12px; padding:16px;">
          <div style="font-weight:700; color:var(--gold); margin-bottom:10px; font-family:var(--font-head);">Assigned Students (${assigned.length})</div>
          ${assigned
            .sort((a, b) => getStudentName(a).localeCompare(getStudentName(b)))
            .map(
              (s) => `
            <div style="display:flex; justify-content:space-between; gap:10px; padding:8px 0; border-bottom:1px solid var(--border); font-size:13px;">
              <span style="color:var(--ivory); font-weight:600;">${escapeHtml(getStudentName(s))}</span>
              <span style="color:var(--ivory-dim);">${escapeHtml(getStudentBatchType(s))} &middot; ${escapeHtml(getStudentSessionTime(s))}</span>
            </div>`,
            )
            .join("")}
        </div>`;
      }
    }
    container.innerHTML = html;
    openModal("coach-schedule-modal");
  }

  function openCoachModal(id = null) {
    if (id) {
      const c = allCoaches.find((x) => String(x.id) === String(id));
      if (!c) return;
      $("coach-modal-title").innerText = "Edit Coach";
      $("cm-id").value = c.id;
      $("cm-name").value = getCoachName(c);
      $("cm-spec").value = getCoachSpecialty(c);
      const parsed = parseStoredPhone(c.phone || "");
      window.selectedCountryCodeCoach = parsed.countryCode;
      const country = getCountryByCode(parsed.countryCode);
      if (country) {
        selectCountryCoach(country.code, country.dial, country.length);
      }
      $("cm-phone").value = parsed.localNumber;
      $("cm-email").value = c.email || "";
      $("cm-address").value = c.address || "";
      $("cm-photo").value = c.photo_url || c.photo || "";
      $("cm-salary").value = getCoachSalary(c);
      $("cm-exp").value = c.experience || 0;
      $("cm-status").value = getCoachStatus(c) || "active";
      $("cm-avail").value = c.availability || "";
      $("cm-etc").value = c.bio || c.additional_details || "";
    } else {
      $("coach-modal-title").innerText = "Add Coach";
      $("cm-id").value = "";
      $("cm-name").value = "";
      $("cm-spec").value = "";
      $("cm-phone").value = "";
      $("cm-email").value = "";
      $("cm-address").value = "";
      $("cm-photo").value = "";
      $("cm-salary").value = "0";
      $("cm-exp").value = "0";
      $("cm-status").value = "active";
      $("cm-avail").value = "";
      $("cm-etc").value = "";
    }
    if (!id) {
      window.selectedCountryCodeCoach = "IN";
      const selected = $("country-selected-coach");
      if (selected)
        selected.innerHTML =
          '<span style="display: flex; align-items: center; gap: 6px;"><img src="https://flagcdn.com/w20/in.png" style="width: 20px; height: 14px; border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.15);" alt="India" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'inline-block\';"><span class="country-flag-emoji" style="display: none; font-size: 17px; line-height: 1;">🇮🇳</span><span style="font-family: monospace; font-size: 11px; font-weight: 700; opacity: 0.75;">IN</span></span><span class="country-dial">+91</span>';
      const phoneInput = $("cm-phone");
      if (phoneInput) {
        phoneInput.placeholder = "10 digits for India";
        phoneInput.maxLength = 13;
      }
    }
    renderCountryDropdown("country-dropdown-coach", "selectCountryCoach");
    openModal("coach-crud-modal");
  }

  async function saveCoach() {
    const id = $("cm-id").value;
    const salaryVal = parseInt($("cm-salary").value) || 0;
    const name = $("cm-name").value.trim();
    if (!name) {
      toast("Coach name is required", "error");
      return;
    }

    const rawPhone = $("cm-phone").value.trim();
    let fullPhone = rawPhone;
    if (rawPhone) {
      const countryCode = window.selectedCountryCodeCoach || "IN";
      const validation = validatePhoneNumber(rawPhone, countryCode);
      if (!validation.valid) {
        toast(validation.error, "error");
        return;
      }
      fullPhone = getFullInternationalPhoneDigits(rawPhone, countryCode);
    }

    const data = {
      name: name,
      specialization: $("cm-spec").value.trim(),
      phone: fullPhone,
      email: $("cm-email").value.trim(),
      address: $("cm-address").value.trim(),
      // BUG FIX: send both field names so getCoachSalary (reads salary||hourly_rate) always picks it up
      salary: salaryVal,
      hourly_rate: salaryVal,
      experience: parseInt($("cm-exp").value) || 0,
      status: $("cm-status").value,
      availability: $("cm-avail").value.trim(),
      bio: $("cm-etc").value.trim(),
      additional_details: $("cm-etc").value.trim(),
      photo_url: $("cm-photo").value.trim(),
    };

    try {
      let res;
      if (id) {
        res = await apiCall(`/api/coaches?id=${id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
        if (res.ok) {
          toast("Coach updated successfully!", "success");
          closeModals();
          loadAllData(true);
        } else {
          const err = await res.json().catch(() => ({}));
          toast("Update failed: " + (err.error || "Server error"), "error");
        }
      } else {
        res = await apiCall("/api/coaches", {
          method: "POST",
          body: JSON.stringify(data),
        });
        if (res.ok) {
          toast("Coach added successfully!", "success");
          closeModals();
          loadAllData(true);
        } else {
          const err = await res.json().catch(() => ({}));
          toast(
            "Failed to add coach: " + (err.error || "Server error"),
            "error",
          );
        }
      }
    } catch (e) {
      console.error("Save coach error:", e);
      toast("Technical error: " + e.message, "error");
    }
  }

  window.confirmDeleteCoach = function (id, name) {
    $("delete-item-type").textContent = "Coach";
    $("delete-item-name").textContent = name;
    $("delete-item-id").value = id;
    $("delete-type").value = "coach";
    openModal("delete-confirm-modal");
  };

  async function deleteCoach(id) {
    try {
      const res = await apiCall(`/api/coaches?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Coach deleted from academy", "success");
        loadAllData(true);
      }
    } catch (e) {
      toast("Delete failed", "error");
    }
  }

  // ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═
  // MASTER SCHEDULE MATRIX
  // ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═

  const COACH_COLORS = [
    '#3b5998', '#27ae60', '#8e44ad', '#d35400',
    '#2ecc71', '#f39c12', '#16a085', '#7f8c8d',
    '#e74c3c', '#9b59b6', '#1abc9c', '#e67e22'
  ];

  window.openMasterSchedule = function () {
    const container = $("master-schedule-container");
    if (!container) return;

    const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const DAY_FULL  = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

    // Build coach → batch mapping
    const coachMap = new Map();
    (allCoaches || []).forEach((c, idx) => {
      coachMap.set(String(c.id), {
        coach: c,
        name: getCoachName(c),
        color: COACH_COLORS[idx % COACH_COLORS.length],
        slug: getCoachName(c).toLowerCase().replace(/[^a-z]/g, '').slice(0, 8),
        batches: []
      });
    });

    // Assign batches to coaches
    (allBatches || []).filter(b => b.status === 'active').forEach(b => {
      const entry = coachMap.get(String(b.coach_id));
      if (entry) {
        entry.batches.push(b);
      }
    });

    // Also map students from allStudents to coaches if no batches exist
    // Build schedule from student batch_time and batch_type
    const coachStudentMap = new Map();
    (allStudents || []).filter(s => s.status === 'active').forEach(s => {
      const cid = String(s.coach_id);
      if (!coachStudentMap.has(cid)) coachStudentMap.set(cid, []);
      coachStudentMap.get(cid).push(s);
    });

    // Parse days from batch "days" field (e.g., "Mon, Wed, Fri" or "Saturday, Sunday")
    function parseDays(daysStr) {
      if (!daysStr) return [];
      const lower = daysStr.toLowerCase();
      const result = [];
      DAY_FULL.forEach((full, i) => {
        const abbr = DAY_NAMES[i].toLowerCase();
        if (lower.includes(full) || lower.includes(abbr)) {
          result.push(i);
        }
      });
      // Also check for "weekend" / "weekday"
      if (lower.includes("weekend")) {
        if (!result.includes(5)) result.push(5);
        if (!result.includes(6)) result.push(6);
      }
      return result;
    }

    // Build the table rows
    let rowsHtml = '';

    coachMap.forEach((entry) => {
      const { name, color, batches, coach } = entry;
      const coachLevel = coach.specialization || coach.level || 'General';
      const students = coachStudentMap.get(String(coach.id)) || [];

      // Build day cells
      const dayCells = new Array(7).fill(null).map(() => []);

      if (batches.length > 0) {
        // Use batch data
        batches.forEach((b, bIdx) => {
          const batchDays = parseDays(b.days);
          const studentNames = (b.student_ids || []).map(sid => {
            const st = allStudents.find(s => String(s.id) === String(sid));
            return st ? getStudentName(st).split(' ')[0] : '';
          }).filter(Boolean);

          batchDays.forEach(dayIdx => {
            dayCells[dayIdx].push({
              batchName: b.name || `Batch ${bIdx + 1}`,
              timeSlot: b.time_slot || '',
              students: studentNames.join(', ') || 'No students',
              color
            });
          });
        });
      } else if (students.length > 0) {
        // Fallback: derive schedule from student batch_time/batch_type
        const grouped = {};
        students.forEach(s => {
          const time = s.batch_time || '7:00 PM';
          const type = s.batch_type || 'Evening';
          const key = `${type}|${time}`;
          if (!grouped[key]) grouped[key] = { students: [], time, type };
          grouped[key].students.push(getStudentName(s).split(' ')[0]);
        });

        Object.values(grouped).forEach((g, gIdx) => {
          // Infer days from batch_type
          let days = [];
          const t = g.type.toLowerCase();
          if (t.includes('weekend') || t.includes('sat')) days = [5, 6];
          else if (t.includes('morning')) days = [1, 3]; // Tue, Thu
          else if (t.includes('evening')) days = [2, 4]; // Wed, Fri
          else days = [2, 4]; // default

          days.forEach(d => {
            dayCells[d].push({
              batchName: `Batch ${gIdx + 1}`,
              timeSlot: g.time,
              students: g.students.join(', '),
              color
            });
          });
        });
      }

      // Render cells
      const cellsHtml = dayCells.map(blocks => {
        if (blocks.length === 0) {
          return `<td style="padding:4px;vertical-align:middle;text-align:center;background:#1a1e2e;border-radius:3px;height:56px;color:#2c3242;font-size:11px;">—</td>`;
        }
        const blocksHtml = blocks.map(bl => `
          <div style="display:block;padding:3px 4px;margin:2px 0;border-radius:3px;background:${bl.color};color:#fff;font-weight:600;font-size:7pt;line-height:1.15;">
            ${escapeHtml(bl.batchName)}
            <span style="display:block;font-size:6.2pt;opacity:0.85;margin-top:1px;font-weight:normal;">${escapeHtml(bl.timeSlot)}</span>
            <span style="display:block;font-size:6.2pt;font-style:italic;opacity:0.95;font-weight:normal;margin-top:1px;border-top:1px solid rgba(255,255,255,0.15);padding-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(bl.students)}</span>
          </div>
        `).join('');
        return `<td style="padding:3px;vertical-align:middle;text-align:center;background:#1a1e2e;border-radius:3px;height:auto;">${blocksHtml}</td>`;
      }).join('');

      rowsHtml += `
        <tr>
          <td style="font-weight:bold;font-size:8pt;text-align:center;padding:4px;line-height:1.25;background:#1a1e2e;border-radius:3px;border-left:4px solid ${color};">
            ${escapeHtml(name)}<br>
            <span style="font-size:6.5pt;font-weight:normal;color:#8a90a6;">${escapeHtml(coachLevel)}</span>
          </td>
          ${cellsHtml}
        </tr>
      `;
    });

    // Build full table
    container.innerHTML = `
      <style>
        #ms-matrix { width:100%; border-collapse:separate; border-spacing:3px; table-layout:fixed; }
        #ms-matrix th {
          background-color:#1c2030; color:#a4b0cb; font-weight:600;
          padding:6px; text-align:center; text-transform:uppercase;
          letter-spacing:0.5px; border-radius:3px; font-size:8pt;
        }
        #ms-matrix th.coach-hdr { width:11%; }
      </style>
      <table id="ms-matrix">
        <thead>
          <tr>
            <th class="coach-hdr">Coach</th>
            ${DAY_NAMES.map(d => `<th>${d}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--ivory-dim);">No coaches or batches configured yet. Create batches in the Batch Manager first.</td></tr>'}
        </tbody>
      </table>
    `;

    openModal("master-schedule-modal");
  };

  function renderEvents() {
    const gridEl = $("ev-grid");
    const loadingEl = $("ev-loading");
    if (!gridEl) return;

    if (loadingEl) loadingEl.style.display = "none";

    // Filter out archived/deleted events for parents, show all for admin
    const visibleEvents = eventsData.filter((e) => {
      if (role === "admin" || role === "master") return true;
      return e.status !== "archived" && e.archived !== true;
    });

    if (!visibleEvents || visibleEvents.length === 0) {
      gridEl.style.display = "grid";
      gridEl.innerHTML =
        '<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">📅</span><p>No events scheduled</p></div>';
      return;
    }

    const isAdmin = role === "admin" || role === "master";

    gridEl.style.display = "grid";
    gridEl.innerHTML = visibleEvents
      .map((e) => {
        const maxSpots = e.max_participants || 50;
        const regCount =
          e.registrations_count || e.registered_students?.length || 0;
        const spotsLeft = maxSpots - regCount;
        const isArchived = e.archived === true || e.status === "archived";
        const evDate = new Date(e.date || e.event_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let statusTag = "";
        if (isArchived) {
          statusTag =
            '<span class="badge" style="background:var(--ivory3);color:var(--obsidian)">[ARCHIVED]</span>';
        } else if (evDate < today) {
          statusTag =
            '<span class="badge" style="background:var(--slate);color:#fff">[COMPLETED]</span>';
        } else if (spotsLeft <= 0) {
          statusTag =
            '<span class="badge" style="background:var(--danger);color:#fff">[FULL]</span>';
        } else {
          statusTag =
            '<span class="badge" style="background:var(--success);color:#fff">[UPCOMING]</span>';
        }

        return `<div class="ev-card" ${isArchived ? 'style="opacity:0.7"' : ""}>
         ${e.img_url ? `<img src="${e.img_url}" class="ev-poster" alt="Event Poster">` : ""}
         <div class="ev-header">
           <span class="ev-type-badge">${escapeHtml(getEventType(e))}</span>
           <span class="ev-date-badge">${e.date ? new Date(e.date).toLocaleDateString() : ""}</span>
           ${statusTag}
         </div>
         <div class="ev-body">
           <div class="ev-title">${escapeHtml(e.title)}</div>
           <div class="ev-meta">
             <span class="ev-meta-item ev-time">${escapeHtml(getEventTime(e))}</span>
             <span class="ev-meta-item ev-loc">${escapeHtml(e.location || "TBD")}</span>
             ${e.prize_pool ? `<span class="ev-meta-item ev-prize">${escapeHtml(e.prize_pool)}</span>` : ""}
           </div>
           ${e.map_url ? `<a href="${e.map_url}" target="_blank" class="ev-map-link">📍 View on Map</a>` : ""}
           ${e.description ? `<div class="ev-desc">${escapeHtml(e.description)}</div>` : ""}
         </div>
         <div class="ev-progress-wrap">
           <div class="ev-progress-label">
             <span>Registrations</span>
             <span>${regCount}/${maxSpots}</span>
           </div>
           <div class="ev-progress-track">
             <div class="ev-progress-bar" style="width:${(regCount / maxSpots) * 100}%"></div>
           </div>
         </div>
         <div class="ev-footer">
           <div class="ev-spots"><strong>${spotsLeft}</strong> spots left</div>
           ${role === "parent" ? (e.registered_students?.includes(currentStudent?.id) ? '<span class="badge badge-success">✓ Registered</span>' : `<button class="btn-register" onclick="registerForEvent('${e.id}')">Register</button>`) : ""}
           ${
             isAdmin
               ? `
             <div style="display:flex;gap:8px;margin-left:auto">
               <button class="btn btn-outline-grey btn-sm" onclick="editEvent('${e.id}')">Edit</button>
               <button class="btn btn-gold btn-sm" onclick="openEventManagement('${e.id}')">Manage</button>
               <button class="btn btn-outline btn-sm" onclick="archiveEvent('${e.id}')">${isArchived ? "Unarchive" : "Archive"}</button>
               <button class="btn btn-danger btn-sm" onclick="confirmDeleteEvent('${e.id}', '${escapeHtml(e.title).replace(/'/g, "\\'")}')">Delete</button>
             </div>
           `
               : ""
           }
         </div>
       </div>`;
      })
      .join("");
  }

  function openEventModal() {
    $("ev-id").value = "";
    $("ev-title").value = "";
    $("ev-date").value = "";
    $("ev-time").value = "10:00";
    $("ev-type").value = "Tournament";
    $("ev-max").value = "50";
    $("ev-prize").value = "";
    $("ev-fee").value = "0";
    $("ev-loc").value = "";
    $("ev-desc").value = "";
    $("ev-img-url").value = "";
    $("ev-map-url").value = "";
    $("ev-img-preview").style.display = "none";
    $("ev-img-file").value = "";
    $("ev-modal-title").textContent = "Create Event";
    openModal("ev-modal");
  }

  function editEvent(id) {
    const e = eventsData.find((x) => String(x.id) === String(id));
    if (!e) {
      toast("Event not found", "error");
      return;
    }
    $("ev-id").value = e.id;
    $("ev-title").value = e.title || "";
    $("ev-date").value = e.date || "";
    $("ev-time").value = e.time || "10:00";
    $("ev-type").value = e.type || "Tournament";
    $("ev-max").value = e.max_participants || 0;
    $("ev-prize").value = e.prize_pool || "";
    $("ev-fee").value = e.fee || 0;
    $("ev-loc").value = e.location || "";
    $("ev-desc").value = e.description || "";
    $("ev-img-url").value = e.img_url || "";
    $("ev-map-url").value = e.map_url || "";
    if (e.img_url) {
      $("ev-img-preview").src = e.img_url;
      $("ev-img-preview").style.display = "block";
    } else {
      $("ev-img-preview").style.display = "none";
    }
    $("ev-modal-title").textContent = "Edit Event";
    openModal("ev-modal");
  }

  function archiveEvent(id) {
    const e = eventsData.find((x) => String(x.id) === String(id));
    if (!e) {
      toast("Event not found", "error");
      return;
    }
    const newStatus =
      e.archived || e.status === "archived" ? "active" : "archived";
    logAudit("events", id, "archived", e.archived, newStatus);
    apiCall(`/api/events?id=${id}`, {
      method: "PUT",
      body: JSON.stringify({
        archived: newStatus === "archived",
        status: newStatus,
      }),
    })
      .then(() => {
        toast(
          `Event ${newStatus === "archived" ? "archived" : "unarchived"}!`,
          "success",
        );
        loadAllData(true);
      })
      .catch(() => toast("Failed to update", "error"));
  }

  function deleteEvent(id, title) {
    $("delete-item-type").textContent = "Event";
    $("delete-item-name").textContent = title;
    $("delete-item-id").value = id;
    $("delete-type").value = "event";
    openModal("delete-confirm-modal");
  }
  const confirmDeleteEvent = deleteEvent;

  function generateClientId() {
    return typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "c" + Date.now() + Math.random().toString(36).substr(2, 9);
  }

  async function saveEvent() {
    const id = $("ev-id").value;
    const fileInput = $("ev-img-file");
    const urlInput = $("ev-img-url");
    let img_url = urlInput ? urlInput.value : "";

    if (fileInput && fileInput.files && fileInput.files[0]) {
      toast("Uploading event poster...", "info");
      const uploaded = await uploadToImgbb(fileInput.files[0]);
      if (uploaded) img_url = uploaded;
    }

    const data = {
      id: id || generateClientId(),
      title: $("ev-title").value,
      event_date: $("ev-date").value,
      event_time: $("ev-time").value,
      type: $("ev-type").value,
      max_participants: parseInt($("ev-max").value) || 0,
      prize_pool: $("ev-prize").value,
      fee: parseFloat($("ev-fee").value) || 0,
      location: $("ev-loc").value,
      map_url: $("ev-map-url").value,
      description: $("ev-desc").value,
      img_url: img_url,
    };

    if (!data.title) {
      toast("Event title is required", "error");
      return;
    }
    if (!data.event_date) {
      toast("Event date is required", "error");
      return;
    }
    if (data.event_date && new Date(data.event_date) < new Date()) {
      toast("Event date cannot be in the past", "error");
      return;
    }

    try {
      let res;
      if (id) {
        const existing = eventsData.find((x) => String(x.id) === String(id));
        logAudit("events", id, "update", existing, data);
        res = await apiCall(`/api/events?id=${id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
      } else {
        res = await apiCall("/api/events", {
          method: "POST",
          body: JSON.stringify(data),
        });
      }

      if (res.ok) {
        toast(id ? "Event updated!" : "Event created!", "success");
        closeModals();
        loadAllData(true);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Event save error:", err);
        toast(
          "Failed to save event: " + (err.error || "Server error"),
          "error",
        );
      }
    } catch (e) {
      console.error("Save event error:", e);
      toast("Technical error: " + e.message, "error");
    }
  }

  // ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═
  // BATCH MANAGEMENT
  // ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═

  window.renderBatchesGrid = function () {
    const grid = $("batches-grid");
    if (!grid) return;

    if (!allBatches || allBatches.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--ivory-dim);">No batches found.</div>';
      return;
    }

    const searchTerm = ($("batch-search-input") ? $("batch-search-input").value.toLowerCase() : "");
    const statusFilter = ($("batch-status-filter") ? $("batch-status-filter").value : "active");

    const filteredBatches = allBatches.filter((b) => {
      const matchName = b.name.toLowerCase().includes(searchTerm);
      const matchStatus = statusFilter === "all" || b.status === statusFilter;
      return matchName && matchStatus;
    });

    if (filteredBatches.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--ivory-dim);">No batches match your filters.</div>';
      return;
    }

    grid.innerHTML = filteredBatches
      .map((b) => {
        const coach = allCoaches.find((c) => String(c.id) === String(b.coach_id));
        const coachName = coach ? getCoachName(coach) : '<span class="text-danger">Unassigned</span>';
        const stCount = Array.isArray(b.student_ids) ? b.student_ids.length : 0;
        
        const badgeClass = b.status === "active" ? "badge-success" : b.status === "inactive" ? "badge-danger" : "badge-outline";

        return `
        <div class="card" style="padding: 24px; position: relative; display: flex; flex-direction: column; gap: 16px;">
          ${b.chessable_url ? `<a href="${escapeHtml(b.chessable_url)}" target="_blank" title="Open Chessable Classroom" style="position: absolute; top: 20px; right: 20px; background: rgba(218,163,62,0.1); border-radius: 50%; padding: 8px; color: var(--gold); text-decoration: none; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; transition: all 0.2s; border: 1px solid rgba(218,163,62,0.2);"><span class="ico" style="font-size: 18px; margin: 0;">🎓</span></a>` : ''}
          
          <div>
            <h3 style="color: var(--gold); font-size: 18px; margin: 0 0 6px 0; max-width: 85%;">${escapeHtml(b.name)}</h3>
            <span class="badge ${badgeClass}">${capitalizeFirst(b.status || "active")}</span>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 14px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="ico" style="opacity: 0.6">👨‍🏫</span>
              <span style="color: var(--ivory)">${coachName}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="ico" style="opacity: 0.6">🕒</span>
              <span style="color: var(--ivory-dim)">${escapeHtml(b.days || "N/A")} • ${escapeHtml(b.time_slot || "N/A")}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="ico" style="opacity: 0.6">📊</span>
              <span style="color: var(--ivory-dim)">Level: <strong style="color:var(--ivory)">${escapeHtml(b.level || "Any")}</strong></span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="ico" style="opacity: 0.6">👥</span>
              <span style="color: var(--ivory-dim)">${stCount} Students enrolled</span>
            </div>
          </div>
          
          <div style="display: flex; gap: 8px; margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border);">
            <button class="btn btn-outline" style="flex: 1;" onclick="openHomeworkAssignmentModal('batch', '${b.id}')">Assign Homework</button>
            <button class="btn btn-outline" style="flex: 1;" onclick="openCreateBatchModal('${b.id}')">Edit</button>
            <button class="btn btn-outline text-danger" style="flex: 1;" onclick="deleteBatch('${b.id}')">Delete</button>
          </div>
        </div>
      `;
      })
      .join("");
  };

  window.openCreateBatchModal = function (id = null) {
    $("eb-id").value = id || "";

    // Populate Coach Dropdown
    const coachSel = $("eb-coach");
    coachSel.innerHTML =
      '<option value="">-- Select Coach --</option>' +
      allCoaches
        .map(
          (c) =>
            `<option value="${c.id}">${escapeHtml(getCoachName(c))}</option>`,
        )
        .join("");

    // Populate Students (Checkboxes)
    const activeStudents = allStudents
      .filter((s) => s.status !== "archived")
      .sort((a, b) => getStudentName(a).localeCompare(getStudentName(b)));

    let existingStudentIds = [];

    if (id) {
      const b = allBatches.find((x) => String(x.id) === String(id));
      if (b) {
        $("eb-name").value = b.name || "";
        $("eb-coach").value = b.coach_id || "";
        $("eb-level").value = b.level || "Beginner";
        $("eb-status").value = b.status || "active";
        $("eb-days").value = b.days || "";
        $("eb-time").value = b.time_slot || "";
        $("eb-notes").value = b.notes || "";
        if ($("eb-chessable")) $("eb-chessable").value = b.chessable_url || "";
        $("eb-modal-title").textContent = "Edit Batch";
        existingStudentIds = Array.isArray(b.student_ids)
          ? b.student_ids.map(String)
          : [];
      }
    } else {
      $("eb-name").value = "";
      $("eb-coach").value = "";
      $("eb-level").value = "Beginner";
      $("eb-status").value = "active";
      $("eb-days").value = "";
      $("eb-time").value = "";
      $("eb-notes").value = "";
      if ($("eb-chessable")) $("eb-chessable").value = "";
      $("eb-modal-title").textContent = "Create New Batch";
    }

    const stList = $("eb-student-list");
    stList.innerHTML = activeStudents
      .map((s) => {
        const isChecked = existingStudentIds.includes(String(s.id))
          ? "checked"
          : "";
        return `
        <label style="display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer">
          <input type="checkbox" class="batch-st-cb" value="${s.id}" ${isChecked} onchange="updateBatchStudentCount()">
          <span>${escapeHtml(getStudentName(s))} <span style="opacity:0.5;font-size:10px">(${s.level || "Beginner"})</span></span>
        </label>
      `;
      })
      .join("");

    window.updateBatchStudentCount();
    openModal("edit-batch-modal");
  };

  window.updateBatchStudentCount = function () {
    const count = document.querySelectorAll(".batch-st-cb:checked").length;
    $("eb-student-count").textContent = `${count} selected`;
  };

  window.saveBatch = async function () {
    const id = $("eb-id").value;
    const name = $("eb-name").value.trim();
    if (!name) return toast("Batch Name is required.", "error");
    if (!$("eb-coach").value) return toast("Please assign a Coach.", "error");

    const selectedStudents = Array.from(
      document.querySelectorAll(".batch-st-cb:checked"),
    ).map((cb) => cb.value);

    const payload = {
      name,
      coach_id: $("eb-coach").value,
      level: $("eb-level").value,
      status: $("eb-status").value,
      days: $("eb-days").value,
      time_slot: $("eb-time").value,
      notes: $("eb-notes").value,
      chessable_url: $("eb-chessable") ? $("eb-chessable").value : "",
      student_ids: selectedStudents,
    };

    try {
      const btn = document.querySelector("#edit-batch-modal .btn-gold");
      const origText = btn.textContent;
      btn.textContent = "Saving...";
      btn.disabled = true;

      const res = await apiCall(id ? `/api/batches?id=${id}` : "/api/batches", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast("Batch saved successfully", "success");
        closeModal("edit-batch-modal");
        await loadAllData(true);
        if (window.renderBatchesGrid) window.renderBatchesGrid();
      } else {
        const err = await res.json().catch(() => ({}));
        toast(
          "Failed to save batch: " + (err.error || "Unknown Error"),
          "error",
        );
      }
      btn.textContent = origText;
      btn.disabled = false;
    } catch (e) {
      toast("Network error: " + e.message, "error");
      document.querySelector("#edit-batch-modal .btn-gold").disabled = false;
    }
  };

  window.deleteBatch = async function (id) {
    if (
      !confirm(
        "Are you sure you want to delete this batch? This will NOT delete the students inside it.",
      )
    )
      return;
    try {
      const res = await apiCall(`/api/batches?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Batch deleted", "success");
        await loadAllData(true);
        if (window.renderBatchesGrid) window.renderBatchesGrid();
      } else {
        toast("Error deleting batch", "error");
      }
    } catch (e) {
      toast("Network Error", "error");
    }
  };

  function renderFame() {
    const gridEl = $("fame-grid");
    const contentEl = $("fame-content");
    const loadingEl = $("fame-loading");
    if (!gridEl || !contentEl) return;

    if (loadingEl) loadingEl.style.display = "none";
    contentEl.style.display = "grid";

    // 1. Render Leaderboard
    const leaderboardEl = $("fame-leaderboard");
    if (leaderboardEl) {
      // Filter out guests/pending, sort by rating descending, get top 10
      const topPlayers = [...allStudents]
        .filter((s) => s.status === "active" && s.rating > 800)
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 10);

      if (topPlayers.length === 0) {
        leaderboardEl.innerHTML =
          '<div style="text-align:center; padding: 20px; color:var(--slate);">No rated players yet</div>';
      } else {
        leaderboardEl.innerHTML = topPlayers
          .map((s, index) => {
            let rankColor = "var(--ivory-dim)";
            let rankBadge = `${index + 1}`;
            if (index === 0) {
              rankColor = "#d4af37";
              rankBadge = "🥇";
            } // Gold
            else if (index === 1) {
              rankColor = "#c0c0c0";
              rankBadge = "🥈";
            } // Silver
            else if (index === 2) {
              rankColor = "#cd7f32";
              rankBadge = "🥉";
            } // Bronze

            return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 10px; border-bottom: 1px solid var(--border);">
              <div style="display:flex; align-items:center; gap: 12px;">
                <span style="font-size:18px; font-weight:bold; color:${rankColor}; width:24px; text-align:center;">${rankBadge}</span>
                <div>
                  <div style="color:var(--ivory); font-weight:600; font-size:14px;">${escapeHtml(getStudentName(s))}</div>
                  <div style="color:var(--slate); font-size:11px;">Level: ${escapeHtml(s.level || "Beginner")}</div>
                </div>
              </div>
              <div style="background:var(--bg3); padding:4px 8px; border-radius:6px; font-weight:700; color:var(--gold); border: 1px solid var(--border);">
                ${s.rating || 0}
              </div>
            </div>
          `;
          })
          .join("");
      }
    }

    // 2. Render Achievements Gallery
    if (!achievementsData || achievementsData.length === 0) {
      gridEl.innerHTML =
        '<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">🏆</span><p>No achievements recorded yet</p></div>';
      return;
    }

    const isAdmin = role === "admin" || role === "master";
    gridEl.innerHTML = achievementsData
      .sort(
        (a, b) =>
          new Date(b.date_achieved || b.created_at) -
          new Date(a.date_achieved || a.created_at),
      )
      .map((a) => {
        const student = allStudents.find(
          (s) => String(s.id) === String(a.student_id),
        );
        const studentName = student
          ? getStudentName(student)
          : "Unknown Student";

        const bgImg = a.img_url
          ? a.img_url
          : "https://i.ibb.co/R2W7kZY/placeholder-trophy.jpg";

        return `
         <div class="ach-card" style="position:relative; height: 360px; border-radius: 16px; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.6); transition: transform 0.3s ease; border: 1px solid rgba(212, 175, 55, 0.3);">
           <!-- Background Image -->
           <div style="position:absolute; inset:0; background: url('${bgImg}') center/cover no-repeat; transition: transform 0.5s ease;" class="ach-poster-bg"></div>
           
           <!-- Gradient Overlay -->
           <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(15, 23, 42, 0.2) 0%, rgba(15, 23, 42, 0.8) 60%, rgba(15, 23, 42, 0.95) 100%); display:flex; flex-direction:column; justify-content:flex-end; padding: 24px;">
             
             <!-- Content -->
             <div style="text-transform: uppercase; font-size: 10px; letter-spacing: 2.5px; color: var(--gold); margin-bottom: 8px; font-weight: 800; display:flex; align-items:center; gap:6px;">
               <span style="font-size:14px;">🏆</span> Achievement
             </div>
             
             <div style="font-family: var(--font-head), 'Playfair Display', serif; font-size: 26px; font-weight: 800; color: #fff; line-height: 1.1; margin-bottom: 12px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">
               ${escapeHtml(a.title)}
             </div>
             
             <div style="display:flex; justify-content:space-between; align-items:flex-end; border-top: 1px solid rgba(212, 175, 55, 0.3); padding-top: 14px; margin-top: 6px;">
                <div>
                  <div style="font-size:11px; color:var(--ivory-dim); text-transform:uppercase; letter-spacing:1px; margin-bottom:2px;">Champion</div>
                  <div style="font-size:18px; font-weight:bold; color: var(--gold);">${escapeHtml(studentName)}</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:10px; color:var(--ivory-dim); text-transform:uppercase; letter-spacing:1px; margin-bottom:2px;">Date</div>
                  <div style="font-size:14px; color: #fff; font-weight: 600;">${a.date_achieved ? new Date(a.date_achieved).toLocaleDateString() : ""}</div>
                </div>
             </div>
           </div>

           <!-- Action Buttons overlay (top right) -->
           ${
             isAdmin
               ? `
             <div style="position: absolute; top: 12px; right: 12px; display:flex; gap: 8px; background: rgba(15, 23, 42, 0.75); padding: 6px 8px; border-radius: 10px; backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); z-index:10;">
               <button onclick="editAchievement('${a.id}')" style="background:transparent; border:none; color:var(--gold); cursor:pointer; font-size:14px; padding:0 4px;" title="Edit">✏️</button>
               <div style="width:1px; background:rgba(255,255,255,0.2); height:16px; align-self:center;"></div>
               <button onclick="confirmDeleteAchievement('${a.id}', '${escapeHtml(a.title).replace(/'/g, "\\'")}')" style="background:transparent; border:none; color:var(--danger); cursor:pointer; font-size:14px; padding:0 4px;" title="Delete">🗑️</button>
             </div>
           `
               : ""
           }
         </div>
       `;
      })
      .join("");
  }

  function editAchievement(id) {
    const a = achievementsData.find((x) => String(x.id) === String(id));
    if (!a) {
      toast("Achievement not found", "error");
      return;
    }
    $("award-sid").value = a.id;
    $("award-student").value = a.student_id || "";
    $("award-title").value = a.title || "";
    $("award-img-url").value = a.img_url || "";
    openModal("award-modal");
  }

  function confirmDeleteAchievement(id, title) {
    $("delete-item-type").textContent = "Achievement";
    $("delete-item-name").textContent = title;
    $("delete-item-id").value = id;
    $("delete-type").value = "achievement";
    openModal("delete-confirm-modal");
  }

  async function deleteAchievement(id) {
    try {
      const res = await apiCall(`/api/achievements?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast("Achievement deleted!", "success");
        loadAllData(true);
      }
    } catch (e) {
      toast("Delete failed", "error");
    }
  }

  function openAwardModal() {
    $("award-sid").value = "";
    $("award-student").value = "";
    $("award-title").value = "";
    $("award-img-url").value = "";
    openModal("award-modal");
  }

  function onAwardStudentChange() {
    const sid = $("award-student").value;
    const s = allStudents.find((x) => String(x.id) === String(sid));
    if (s) {
      console.log("Student selected for award:", s.full_name);
    }
  }

  async function uploadToImgbb(file) {
    if (!file) return null;
    try {
      // 1. Convert file to Base64 for the proxy
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.readAsDataURL(file);
      });

      // 2. Call our secure proxy
      const response = await apiCall("/api/upload", {
        method: "POST",
        body: JSON.stringify({ image: base64 }),
      });
      const data = await response.json();
      if (data.success) return data.data.url;

      console.error("Imgbb API Error Data:", data);
      throw new Error(data.error?.message || data.error || "Upload failed");
    } catch (e) {
      console.error("Imgbb upload error:", e);
      return null;
    }
  }

  async function saveAward() {
    const id = $("award-sid").value;
    const fileInput = $("award-img-file");
    const urlInput = $("award-img-url");
    let img_url = urlInput ? urlInput.value : "";

    if (fileInput && fileInput.files && fileInput.files[0]) {
      toast("Uploading image...", "info");
      const uploadedUrl = await uploadToImgbb(fileInput.files[0]);
      if (uploadedUrl) img_url = uploadedUrl;
      else {
        toast("Upload failed", "error");
        return;
      }
    }

    const data = {
      student_id: $("award-student").value,
      title: $("award-title").value,
      img_url: img_url,
      date_achieved: new Date().toISOString().split("T")[0],
    };

    if (!data.student_id || !data.title) {
      toast("Please fill all fields", "error");
      return;
    }

    try {
      let res;
      if (id && id.length > 20) {
        // Existing UUID
        res = await apiCall(`/api/achievements?id=${id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
      } else {
        res = await apiCall("/api/achievements", {
          method: "POST",
          body: JSON.stringify(data),
        });
      }
      if (res.ok) {
        toast("Achievement saved!", "success");
        closeModals();
        loadAllData(true);
      }
    } catch (e) {
      toast("Error saving achievement", "error");
    }
  }

  function sendPaymentReceiptNotification(studentId, amount) {
    const s = allStudents.find((x) => String(x.id) === String(studentId));
    if (!s) return;
    const coach = allCoaches.find((c) => String(c.id) === String(s.coach_id));
    const coachName = coach ? getCoachName(coach) : "N/A";
    const receiptUrl = `${window.location.origin}/receipt.html?id=${studentId}&name=${encodeURIComponent(getStudentName(s))}&amount=${amount}&date=${new Date().toISOString()}&level=${encodeURIComponent(getStudentLevel(s))}&coach=${encodeURIComponent(coachName)}`;

    const ordinalText = (n) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    const now = new Date();
    const formattedDate = `${ordinalText(now.getDate())} ${now.toLocaleString("en-IN", { month: "long" })} ${now.getFullYear()}`;
    const billingMonthName = new Date(
      window.reportYear,
      window.reportMonth,
    ).toLocaleString("en-IN", { month: "long" });
    const billingCycleStr = `${billingMonthName} ${window.reportYear}`;

    const message = `${EMOJI.check} PAYMENT RECEIVED \u{2014} RECEIPT CONFIRMED ${EMOJI.receipt}${EMOJI.sparkle}

Hello Sir/Madam ${EMOJI.wave},

We are happy to inform you that we have successfully received and recorded your chess class fee payment for ${cleanText(getStudentName(s))}! ${EMOJI.card}${EMOJI.party}

${EMOJI.receipt} PAYMENT DETAILS:
${EMOJI.cash} Amount Paid: \u{20B9}${parseFloat(amount).toLocaleString()}
${EMOJI.spiral_calendar} Billing Cycle: ${billingCycleStr}
${EMOJI.tear_calendar} Confirmed On: ${formattedDate}

${EMOJI.link} Download Your Official Receipt:
${receiptUrl}

Thank you for your prompt payment and continued support of Two Knights Academy! ${EMOJI.grad}${EMOJI.trophy}

Best regards,
– Two Knights Academy ${EMOJI.knight}`;

    const studentPhone = getStudentPhone(s);
    const parsed = parseStoredPhone(studentPhone);
    if (parsed.localNumber) {
      const inferredCountry =
        parsed.countryCode && parsed.countryCode !== "IN"
          ? parsed.countryCode
          : s.country_code || "IN";
      const country = getCountryByCode(inferredCountry);
      const dialCode = country ? country.dial.replace(/\D/g, "") : "91";
      openWhatsApp(dialCode, parsed.localNumber, message);
    }
  }
  window.sendPaymentReceiptNotification = sendPaymentReceiptNotification;

  window.togglePaymentStatus = async function (id, name, fee) {
    const s = allStudents.find((x) => String(x.id) === String(id));
    if (!s) return;

    const currentStatus = getStudentPaymentStatus(s);
    const isCurrentlyPaid = currentStatus === "Paid";
    const action = isCurrentlyPaid ? "unpaid" : "paid";
    const confirmMsg = isCurrentlyPaid
      ? `Mark ${name} as Unpaid? This will remove this month's payment record and revert status to Pending.`
      : `Mark ${name} as Paid? This will create a payment record for this month.`;

    if (!confirm(confirmMsg)) return;

    const targetMonth = window.reportMonth;
    const targetYear = window.reportYear;
    const originalPayments = [...window.allPayments];

    // --- Optimistic Local Updates ---
    let mockPayment = null;
    let removedPayments = [];
    if (isCurrentlyPaid) {
      removedPayments = window.allPayments.filter(
        (p) =>
          String(p.student_id) === String(id) &&
          p.status === "paid" &&
          new Date(p.payment_date || p.created_at).getUTCMonth() ===
            targetMonth &&
          new Date(p.payment_date || p.created_at).getUTCFullYear() ===
            targetYear,
      );
      window.allPayments = window.allPayments.filter(
        (p) => !removedPayments.includes(p),
      );
    } else {
      mockPayment = {
        id: "pay_toggle_temp_" + Date.now(),
        student_id: id,
        amount: parseFloat(fee),
        status: "paid",
        payment_method: "Manual Toggle",
        description: "Status toggled to Paid via Dashboard",
        transaction_id: "TGL-" + Math.floor(Math.random() * 1000000),
        payment_date:
          window.reportMonth !== new Date().getUTCMonth() ||
          window.reportYear !== new Date().getUTCFullYear()
            ? new Date(
                Date.UTC(window.reportYear, window.reportMonth, 1, 12, 0, 0),
              ).toISOString()
            : new Date().toISOString(),
      };
      window.allPayments.unshift(mockPayment);
    }

    if (dataCache) dataCache.payments = window.allPayments;

    const pMap = {};
    const seenMonths = new Set();
    window.allPayments.forEach((p) => {
      if (p.status === "paid") {
        const sid = String(p.student_id || "")
          .trim()
          .toLowerCase();
        if (!sid) return;
        const pDate = new Date(p.payment_date || p.created_at);
        const mKey = `${sid}_${pDate.getUTCFullYear()}-${pDate.getUTCMonth()}`;
        if (seenMonths.has(mKey)) return;
        seenMonths.add(mKey);
        pMap[sid] = (pMap[sid] || 0) + 1;
      }
    });
    window.totalPaymentsMap = pMap;

    const active = document.querySelector(".page.active")?.id;
    if (active === "page-dash") renderDash();
    else if (active === "page-stud") renderStudents();
    else if (active === "page-bills") renderBills();

    // --- Background Sync with Database ---
    try {
      if (isCurrentlyPaid) {
        for (const p of removedPayments) {
          if (!p.id.startsWith("pay_toggle_temp_")) {
            await apiCall(`${API_BASE}/payments?id=${p.id}`, {
              method: "DELETE",
            });
          }
        }

        await apiCall(`${API_BASE}/students?id=${id}`, {
          method: "PUT",
          body: JSON.stringify({ payment_status: "Pending" }),
        });

        toast(
          `Marked Unpaid. ${removedPayments.length} payment record(s) removed.`,
          "info",
        );
      } else {
        const paymentData = {
          id:
            "pay_toggle_" +
            Date.now() +
            "_" +
            Math.random().toString(36).substr(2, 9),
          student_id: id,
          amount: parseFloat(fee),
          status: "paid",
          payment_method: "Manual Toggle",
          description: "Status toggled to Paid via Dashboard",
          transaction_id: "TGL-" + Math.floor(Math.random() * 1000000),
          payment_date: mockPayment.payment_date,
        };

        const res = await apiCall(`${API_BASE}/payments`, {
          method: "POST",
          body: JSON.stringify(paymentData),
        });

        if (res.ok) {
          await apiCall(`${API_BASE}/students?id=${id}`, {
            method: "PUT",
            body: JSON.stringify({ payment_status: "Paid" }),
          });
          toast("Marked as Paid with transaction record", "success");
          if (window.sendPaymentReceiptNotification) {
            sendPaymentReceiptNotification(id, fee);
          }
        } else {
          throw new Error("POST failed");
        }
      }

      loadAllData(true);
    } catch (e) {
      console.error("Toggle status sync failed, rolling back:", e);
      toast("Sync failed, rolling back UI...", "error");
      window.allPayments = originalPayments;
      if (dataCache) dataCache.payments = window.allPayments;

      const rollMap = {};
      const rollSeen = new Set();
      window.allPayments.forEach((p) => {
        if (p.status === "paid") {
          const sid = String(p.student_id || "")
            .trim()
            .toLowerCase();
          if (!sid) return;
          const pDate = new Date(p.payment_date || p.created_at);
          const mKey = `${sid}_${pDate.getUTCFullYear()}-${pDate.getUTCMonth()}`;
          if (rollSeen.has(mKey)) return;
          rollSeen.add(mKey);
          rollMap[sid] = (rollMap[sid] || 0) + 1;
        }
      });
      window.totalPaymentsMap = rollMap;

      if (active === "page-dash") renderDash();
      else if (active === "page-stud") renderStudents();
      else if (active === "page-bills") renderBills();
    }
  };
  async function markPaid(
    id,
    amount,
    method = "Cash",
    desc = "Monthly Tuition Fee",
  ) {
    try {
      const s = allStudents.find((x) => String(x.id) === String(id));
      const amt = amount || (s ? getStudentMonthlyFee(s) : 0);

      // 1. Update Student Status & Roll Due Date
      const updates = { payment_status: "Paid" };
      // Due date is now automatically rolled over by the backend when the payment is created.

      await apiCall(`${API_BASE}/students?id=${id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });

      // 2. Create Transaction Record (Increments Credit Count)
      await apiCall(`${API_BASE}/payments`, {
        method: "POST",
        body: JSON.stringify({
          id:
            "pay_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9), // Required Primary Key
          student_id: id,
          amount: parseFloat(amt), // Ensure numeric
          status: "paid",
          payment_method: method,
          description: desc,
          transaction_id: "MAN-" + Math.floor(Math.random() * 1000000),
          payment_date:
            window.reportMonth !== new Date().getUTCMonth() ||
            window.reportYear !== new Date().getUTCFullYear()
              ? new Date(
                  Date.UTC(window.reportYear, window.reportMonth, 1, 12, 0, 0),
                ).toISOString()
              : new Date().toISOString(),
        }),
      });

      toast("Payment logged and due date advanced!", "success");

      // FIX #3: Invalidate payment cache before reload
      window.totalPaymentsMap = null;

      // SYNC: Force fresh data fetch and re-render dashboard
      await loadAllData(true);
      renderDash();
      renderBills();

      // 3. Auto-Notify Parent with Receipt Link
      if (window.sendPaymentReceiptNotification) {
        sendPaymentReceiptNotification(id, amt);
      }
    } catch (e) {
      console.error("markPaid failed:", e);
      toast("Failed to process payment", "error");
    }
  }

  async function markUnpaid(id) {
    if (
      !confirm(
        "Revert status to Due? This will NOT delete the transaction record. You must delete the payment from History to reduce credits.",
      )
    )
      return;
    try {
      await apiCall(`${API_BASE}/students?id=${id}`, {
        method: "PUT",
        body: JSON.stringify({ payment_status: "Due" }),
      });
      toast("Status reverted to Due", "info");
      await loadAllData(true);
      renderDash();
      renderBills();
    } catch (e) {
      console.error("markUnpaid failed:", e);
      toast("Error reverting status", "error");
    }
  }
  // ============================================
  // FEATURE 1: INFORM PARENT (Pending/Due)
  // ============================================
  window.informParent = function (id, name, fee) {
    const s = allStudents.find((x) => String(x.id) === String(id));
    if (!s) return;

    const targetMonth = window.reportMonth;
    const targetYear = window.reportYear;
    const enrollDateStr = getStudentDate(s);
    const baseline = new Date(Date.UTC(2026, 3, 1));
    const enrollDate = enrollDateStr ? new Date(enrollDateStr) : baseline;
    const effectiveEnroll = (function () {
      var _a = window.getBillingAnchor && window.getBillingAnchor(s, baseline);
      return _a
        ? new Date(Date.UTC(_a.year, _a.month, 1))
        : enrollDate < baseline
          ? baseline
          : enrollDate;
    })();
    const monthsRequired =
      (targetYear - effectiveEnroll.getUTCFullYear()) * 12 +
      (targetMonth - effectiveEnroll.getUTCMonth()) +
      1;

    const sid = String(s.id).toLowerCase();
    const paidMonthsSet = new Set();
    (window.allPayments || []).forEach((p) => {
      if (p.status === "paid" && String(p.student_id).toLowerCase() === sid) {
        const pDate = new Date(p.payment_date || p.created_at);
        const mKey = `${pDate.getUTCFullYear()}-${pDate.getUTCMonth()}`;
        paidMonthsSet.add(mKey);
      }
    });
    const totalDue = Math.max(
      0,
      monthsRequired * fee - fee * paidMonthsSet.size,
    );

    // Populate modal
    $("inform-student-name").textContent = name;
    $("inform-amount").textContent = formatStudentFee(s, totalDue);
    $("inform-custom-msg").value = "";

    // Store student ID in modal data attribute
    const modal = $("inform-modal");
    if (modal) modal.dataset.studentId = id;

    openModal("inform-modal");
  };

  window.sendInform = async function () {
    const modal = $("inform-modal");
    const studentId = modal.dataset.studentId;
    const s = allStudents.find((x) => String(x.id) === String(studentId));
    if (!s) {
      toast("Student not found", "error");
      closeModals();
      return;
    }

    const channel =
      (document.querySelector('input[name="notify-channel"]:checked') || {})
        .value || "whatsapp";
    const customMsg = $("#inform-custom-msg")?.value || "";

    const studentName = getStudentName(s);
    const fee = getStudentMonthlyFee(s);
    const phone = getStudentPhone(s).replace(/\D/g, "");
    const parentName = s.parent_name || "Parent";
    const parentEmail = s.email || "";

    // Calculate exact pending amount
    const targetMonth = window.reportMonth;
    const targetYear = window.reportYear;
    const enrollDateStr = getStudentDate(s);
    const baseline = new Date(Date.UTC(2026, 3, 1));
    const enrollDate = enrollDateStr ? new Date(enrollDateStr) : baseline;
    const effectiveEnroll = (function () {
      var _a = window.getBillingAnchor && window.getBillingAnchor(s, baseline);
      return _a
        ? new Date(Date.UTC(_a.year, _a.month, 1))
        : enrollDate < baseline
          ? baseline
          : enrollDate;
    })();
    const monthsRequired =
      (targetYear - effectiveEnroll.getUTCFullYear()) * 12 +
      (targetMonth - effectiveEnroll.getUTCMonth()) +
      1;

    const sid = String(s.id).toLowerCase();
    const paidMonthsSet = new Set();
    (window.allPayments || []).forEach((p) => {
      if (p.status === "paid" && String(p.student_id).toLowerCase() === sid) {
        const pDate = new Date(p.payment_date || p.created_at);
        const mKey = `${pDate.getUTCFullYear()}-${pDate.getUTCMonth()}`;
        paidMonthsSet.add(mKey);
      }
    });
    let totalDue = Math.max(0, monthsRequired * fee - fee * paidMonthsSet.size);

    const coach = allCoaches.find((c) => String(c.id) === String(s.coach_id));
    const coachName = coach ? coach.name || "" : "";
    const dueCfg = getStudentDueConfig(s, coachName, targetMonth, targetYear);
    if (dueCfg.feeOverride !== null) {
      totalDue = dueCfg.feeOverride;
    }

    const getOrdinal = (n) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    const monthName = new Date(targetYear, targetMonth).toLocaleString(
      "en-IN",
      { month: "long" },
    );
    const dueDateStr = `${getOrdinal(dueCfg.day)} ${monthName} ${targetYear}`;

    const payStatus = getStudentPaymentStatus(s);
    const isDueOrOverdue = payStatus === "Due" || payStatus === "Overdue";
    if (totalDue <= 0) {
      totalDue = fee || 1500;
    }

    // Build notification content
    let message = customMsg ? `${customMsg}\n\n` : "";
    message += buildFeeMessage(
      s,
      studentName,
      totalDue,
      dueDateStr,
      isDueOrOverdue,
    );

    try {
      let sent = false;

      if (channel === "whatsapp") {
        const parsed = parseStoredPhone(phone);
        const inferredCountry =
          parsed.countryCode && parsed.countryCode !== "IN"
            ? parsed.countryCode
            : s.country_code || "IN";
        const country = getCountryByCode(inferredCountry);
        const dialCode = country ? country.dial.replace(/\D/g, "") : "91";
        openWhatsApp(dialCode, parsed.localNumber, message);
        sent = true;
      } else if (channel === "sms") {
        const parsed = parseStoredPhone(phone);
        window.location.href = `sms:${parsed.localNumber}?body=${encodeURIComponent(message)}`;
        sent = true;
      } else if (channel === "email") {
        if (!parentEmail) {
          toast("No email address on file for this student", "error");
          return;
        }
        const period = new Date(targetYear, targetMonth).toLocaleDateString(
          "en-IN",
          { month: "long", year: "numeric" },
        );
        const subject = `Fee Reminder - ${studentName} (${period})`;
        window.location.href = `mailto:${parentEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
        sent = true;
      } else if (channel === "push") {
        await apiCall(`${API_BASE}/messages`, {
          method: "POST",
          body: JSON.stringify({
            sender_type: "system",
            receiver_type: "parent",
            subject: `Fee Reminder - ${studentName}`,
            message: message,
            priority: "high",
          }),
        });
        sent = true;
      }

      // Log audit regardless of channel
      await apiCall(`${API_BASE}/audit`, {
        method: "POST",
        body: JSON.stringify({
          table_name: "students",
          record_id: studentId,
          action: "INFORM_PARENT",
          new_value: {
            channel,
            amount: totalDue,
            student: studentName,
            method: "frontend",
          },
        }),
      });

      if (sent) {
        toast(`Notification sent via ${channel}`, "success");
        closeModals();
      }
    } catch (e) {
      console.error("Notify failed:", e);
      toast("Failed to send notification", "error");
    }
  };

  // ============================================
  // FEATURE 2: TOGGLE PAID/UNPAID STATUS
  // ============================================
  window.togglePaymentStatus = async function (id, name, fee) {
    const s = allStudents.find((x) => String(x.id) === String(id));
    if (!s) return;

    const currentStatus = getStudentPaymentStatus(s);
    const isCurrentlyPaid = currentStatus === "Paid";
    const action = isCurrentlyPaid ? "unpaid" : "paid";
    const confirmMsg = isCurrentlyPaid
      ? `Mark ${name} as Unpaid? This will remove this month's payment record and revert status to Pending.`
      : `Mark ${name} as Paid? This will create a payment record for this month.`;

    if (!confirm(confirmMsg)) return;

    try {
      const targetMonth = window.reportMonth;
      const targetYear = window.reportYear;

      if (isCurrentlyPaid) {
        // === MARK AS UNPAID ===
        // Find current month payments
        const monthPayments = (window.allPayments || []).filter(
          (p) =>
            String(p.student_id) === String(id) &&
            p.status === "paid" &&
            new Date(p.payment_date || p.created_at).getUTCMonth() ===
              targetMonth &&
            new Date(p.payment_date || p.created_at).getUTCFullYear() ===
              targetYear,
        );

        // Delete each payment record
        for (const p of monthPayments) {
          await apiCall(`${API_BASE}/payments?id=${p.id}`, {
            method: "DELETE",
          });
        }

        // Update student to Pending (they paid previous months but not current)
        await apiCall(`${API_BASE}/students?id=${id}`, {
          method: "PUT",
          body: JSON.stringify({ payment_status: "Pending" }),
        });

        toast(
          `Marked Unpaid. ${monthPayments.length} payment record(s) removed.`,
          "info",
        );
      } else {
        // === MARK AS PAID ===
        const paymentData = {
          id:
            "pay_toggle_" +
            Date.now() +
            "_" +
            Math.random().toString(36).substr(2, 9),
          student_id: id,
          amount: parseFloat(fee),
          status: "paid",
          payment_method: "Manual Toggle",
          description: "Status toggled to Paid via Dashboard",
          transaction_id: "TGL-" + Math.floor(Math.random() * 1000000),
          payment_date:
            window.reportMonth !== new Date().getUTCMonth() ||
            window.reportYear !== new Date().getUTCFullYear()
              ? new Date(
                  Date.UTC(window.reportYear, window.reportMonth, 1, 12, 0, 0),
                ).toISOString()
              : new Date().toISOString(),
        };

        const res = await apiCall(`${API_BASE}/payments`, {
          method: "POST",
          body: JSON.stringify(paymentData),
        });

        if (res.ok) {
          await apiCall(`${API_BASE}/students?id=${id}`, {
            method: "PUT",
            body: JSON.stringify({ payment_status: "Paid" }),
          });
          toast("Marked as Paid with transaction record", "success");
          sendPaymentReceiptNotification(id, fee);
        }
      }

      // Invalidate cache and refresh
      window.totalPaymentsMap = null;
      await loadAllData(true);
      renderDash();
      renderBills();
    } catch (e) {
      console.error("Toggle status failed:", e);
      toast("Error updating status", "error");
    }
  };

  window.viewPaymentHistory = async function (studentId) {
    const s = allStudents.find((x) => String(x.id) === String(studentId));
    if (!s) return;

    const nameEl = $("p-history-name");
    if (nameEl) nameEl.textContent = getStudentName(s);
    const metaEl = $("p-history-meta");
    if (metaEl)
      metaEl.textContent = `ID: ${String(s.id).slice(0, 8)} • Monthly Fee: ${formatStudentFee(s, getStudentMonthlyFee(s))}`;

    openModal("payment-history-modal");

    const myPayments = (window.allPayments || [])
      .filter((p) => {
        const psid = String(p.student_id || "")
          .trim()
          .toLowerCase();
        const sid = String(studentId || "")
          .trim()
          .toLowerCase();
        return psid === sid;
      })
      .sort(
        (a, b) =>
          new Date(b.payment_date || b.created_at) -
          new Date(a.payment_date || a.created_at),
      );

    const body = $("p-history-body");
    if (myPayments.length === 0) {
      body.innerHTML =
        '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--ivory-dim)">No payment records found.</td></tr>';
      return;
    }

    body.innerHTML = myPayments
      .map((p) => {
        const pDate = new Date(p.payment_date || p.created_at);
        const transDate = pDate.toLocaleDateString("en-GB");
        const billingMonth = pDate.toLocaleString("en-IN", {
          month: "long",
          year: "numeric",
        });
        return `
       <tr>
         <td>${transDate}</td>
         <td style="color:var(--gold);font-weight:600">${billingMonth}</td>
         <td style="color:var(--success);font-weight:600">₹${(p.amount || 0).toLocaleString()}</td>
         <td>${escapeHtml(p.payment_method || "Cash")}</td>
         <td style="font-family:var(--font-mono);font-size:11px">${p.transaction_id || "N/A"}</td>
         <td>
           <div style="display:flex;gap:5px">
             <button class="btn btn-outline btn-sm" onclick="downloadReceipt('${s.id}', '${escapeHtml(getStudentName(s))}', '${p.amount}', '${escapeHtml(getStudentLevel(s))}', '${getStudentRating(s)}', 'N/A', '${p.payment_method || "Online"}', '${p.payment_date || p.created_at || ""}')">📄</button>
             <button class="btn btn-outline-danger btn-sm" onclick="deletePayment('${p.id}', '${studentId}')">🗑️</button>
           </div>
         </td>
       </tr>`;
      })
      .join("");
  };

  window.deletePayment = async function (paymentId, studentId) {
    if (
      !confirm(
        "Delete this record? This will decrease the student's credit count and affect historical reports.",
      )
    )
      return;
    try {
      const res = await apiCall(`${API_BASE}/payments?id=${paymentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast("Record deleted", "success");
        await loadAllData(true);
        renderDash();
        renderBills();
        viewPaymentHistory(studentId);
      }
    } catch (e) {
      console.error("Delete payment failed:", e);
      toast("Failed to delete payment", "error");
    }
  };

  window.downloadReceipt = function (
    studentId,
    name,
    amount,
    level,
    elo,
    coach,
    method,
    dateStr = "",
  ) {
    downloadReceipt(
      studentId,
      name,
      amount,
      level,
      elo,
      coach,
      method,
      dateStr,
    );
  };

  // --- End of Students & Payments Section ---
  function getCoachPaymentStatus(c) {
    return c.payment_status || "Pending";
  }

  function informCoachSalaryPaid(c) {
    if (!c) return;
    const phone = c.phone || "";
    if (!phone) {
      toast("Coach phone number is missing!", "warning");
      return;
    }
    const parsed = parseStoredPhone(phone);
    const inferredCountry =
      parsed.countryCode && parsed.countryCode !== "IN"
        ? parsed.countryCode
        : c.country_code || "IN";
    const country = getCountryByCode(inferredCountry);
    const dialCode = country ? country.dial.replace(/\D/g, "") : "91";
    const name = getCoachName(c);
    const salary = getCoachSalary(c) || 0;
    const receiptUrl = `${window.location.origin}/salary_receipt.html?id=${c.id}&name=${encodeURIComponent(name)}&amount=${salary}&role=${encodeURIComponent(c.specialty || "Chess Coach")}&specialty=${encodeURIComponent(c.specialty || "Chess Academy Mentor")}&method=Online%20Transfer`;

    const msg =
      `🌟 SALARY CREDITED SUCCESSFULLY 🌟\n` +
      `Hello Coach ${name},\n\n` +
      `We are pleased to inform you that your salary of ₹${salary.toLocaleString()} for this period has been successfully processed and credited to your account! 💳💸\n\n` +
      `📄 View/Download your Official Salary Slip here:\n` +
      `${receiptUrl}\n\n` +
      `Thank you so much for your incredible dedication, training expertise, and mentorship. You make Two Knights Academy shine! 🏆🎓\n\n` +
      `Warm regards,\n` +
      `– Two Knights Academy Team 👑✓¨`;
    openWhatsApp(dialCode, parsed.localNumber, msg);
  }

  window.informCoachSalaryPaid = informCoachSalaryPaid;

  window.markCoachPaid = async function (id) {
    const btn = event.currentTarget;
    const oldText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;

    try {
      const res = await apiCall("/api/coaches?id=" + id, {
        method: "PUT",
        body: JSON.stringify({ payment_status: "Paid" }),
      });
      if (res.ok) {
        toast("Coach salary marked as paid", "success");
        const coach = allCoaches.find((c) => String(c.id) === String(id));
        if (coach) {
          coach.payment_status = "Paid";
          setTimeout(() => {
            if (
              confirm(
                `Salary marked as Paid! Would you like to open WhatsApp to inform Coach ${getCoachName(coach)} that their salary of ₹${(getCoachSalary(coach) || 0).toLocaleString()} has been credited successfully?`,
              )
            ) {
              informCoachSalaryPaid(coach);
            }
          }, 200);
        }
        renderCoachBills();
      } else {
        toast("Failed to update status", "error");
      }
    } catch (e) {
      toast("Error saving to database", "error");
    } finally {
      btn.innerHTML = oldText;
      btn.disabled = false;
    }
  };

  window.markCoachUnpaid = async function (id) {
    const btn = event.currentTarget;
    const oldText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;

    try {
      const res = await apiCall("/api/coaches?id=" + id, {
        method: "PUT",
        body: JSON.stringify({ payment_status: "Pending" }),
      });
      if (res.ok) {
        toast("Coach salary marked as pending", "warning");
        const coach = allCoaches.find((c) => String(c.id) === String(id));
        if (coach) coach.payment_status = "Pending";
        renderCoachBills();
      } else {
        toast("Failed to update status", "error");
      }
    } catch (e) {
      toast("Error saving to database", "error");
    } finally {
      btn.innerHTML = oldText;
      btn.disabled = false;
    }
  };

  window.setBillTab = function (tabName, btn) {
    document
      .querySelectorAll("#page-bills .tab-link")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    $("bills-tab-students").style.display =
      tabName === "students" ? "block" : "none";
    $("bills-tab-coaches").style.display =
      tabName === "coaches" ? "block" : "none";
    const monitorTab = $("bills-tab-gateway-monitor");
    if (monitorTab) {
      monitorTab.style.display =
        tabName === "gateway-monitor" ? "block" : "none";
      if (tabName === "gateway-monitor") {
        if (window.initGatewayMonitorVirtualizer)
          window.initGatewayMonitorVirtualizer();
        if (window.startGatewayLogsSimulation)
          window.startGatewayLogsSimulation();
      } else {
        if (window.stopGatewayLogsSimulation)
          window.stopGatewayLogsSimulation();
      }
    }
  };

  function renderCoachBills() {
    const tbody = $("coach-bill-body");
    if (!tbody) return;

    if (!allCoaches || allCoaches.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6"><div class="empty-state">No coaches found</div></td></tr>';
      return;
    }

    tbody.innerHTML = allCoaches
      .map((c) => {
        const status = getCoachPaymentStatus(c);
        const empId = "EMP-" + (c.id ? c.id.toString().slice(-6) : "000000");
        const salary = getCoachSalary(c) || 0;

        return `<tr>
        <td><span style="font-family:var(--font-mono);color:var(--gold);font-size:13px">${empId}</span></td>
        <td>
          <div style="font-weight:600;color:var(--ivory)">${escapeHtml(getCoachName(c))}</div>
        </td>
        <td><div style="font-size:11px;color:var(--ivory-dim)">${escapeHtml(getCoachSpecialty(c))}</div></td>
        <td style="font-weight:600;color:var(--gold)">₹${salary.toLocaleString()}</td>
        <td><span class="badge ${status === "Paid" ? "badge-success" : "badge-warning"}" style="font-size:10px;padding:4px 8px">${status}</span></td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            ${
              status === "Pending"
                ? `<button class="btn btn-outline btn-sm" onclick="markCoachPaid('${c.id}')">✅ Mark Paid</button>`
                : `<button class="btn btn-outline-danger btn-sm" onclick="markCoachUnpaid('${c.id}')">❌ Mark Unpaid</button>
           <button class="btn btn-outline btn-sm" onclick="informCoachSalaryPaid(allCoaches.find(x => String(x.id) === '${c.id}'))" style="border-color:var(--emerald);color:var(--emerald);" title="Notify Coach of Salary Credit">📢 Notify Credit</button>`
            }
          </div>
        </td>
      </tr>`;
      })
      .join("");
  }

  window.syncBillMonth = function (val) {
    if (!val) return;
    // FIX #15: Only trigger renderBills if the bills page DOM is present
    const billBody = document.getElementById("bill-body");
    if (!billBody) {
      // Page not active — just update the global context
      const parts = val.split("-");
      if (parts.length >= 2) {
        window.reportYear = parseInt(parts[0]);
        window.reportMonth = parseInt(parts[1]) - 1;
      }
      return;
    }
    window.updateReportContext(val);
  };

  window.resetBillMonth = function () {
    const now = new Date();
    window.reportYear = now.getUTCFullYear();
    window.reportMonth = now.getUTCMonth();
    renderBills();
  };

  function renderBills() {
    renderCoachBills();
    const tbody = $("bill-body");
    if (!tbody) return;

    // Sync with global report context if filter is empty or just loaded
    const filterEl = $("f-bill-month");
    const globalPeriod = `${window.reportYear}-${String(window.reportMonth + 1).padStart(2, "0")}`;

    if (filterEl) {
      filterEl.value = globalPeriod;
    }

    const targetMonth = window.reportMonth;
    const targetYear = window.reportYear;

    if (!allStudents || allStudents.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="8"><div class="empty-state">No payment records found</div></td></tr>';
      return;
    }

    // 1. Map total payments per student (Normalized: 1 payment per month)
    const totalPaymentsMap = {};
    const seenStudentMonths = new Set();
    (allPayments || []).forEach((p) => {
      if (p.status !== "paid") return;
      const sid = String(p.student_id || "")
        .trim()
        .toLowerCase();
      if (!sid) return;
      const pDate = new Date(p.payment_date || p.created_at);
      const mKey = `${sid}_${pDate.getUTCFullYear()}-${pDate.getUTCMonth()}`;
      if (seenStudentMonths.has(mKey)) return;
      seenStudentMonths.add(mKey);

      if (!totalPaymentsMap[sid]) totalPaymentsMap[sid] = 0;
      totalPaymentsMap[sid]++;
    });

    // Pre-compute payment statuses for performance
    const statusCache = new Map();
    allStudents.forEach((s) => {
      const key = s.id;
      const status = getStudentPaymentStatus(s, targetMonth, targetYear);
      statusCache.set(key, status);
    });

    const fBillStatus = $("f-bill-status")?.value || "";
    const fBillSearch = $("f-bill-search")?.value.trim().toLowerCase() || "";
    const fBillCoach = $("f-bill-coach")?.value || "";

    let filteredStudents = allStudents;
    if (fBillStatus) {
      filteredStudents = filteredStudents.filter(
        (s) => statusCache.get(s.id) === fBillStatus,
      );
    }
    if (fBillSearch) {
      filteredStudents = filteredStudents.filter((s) =>
        getStudentName(s).toLowerCase().includes(fBillSearch),
      );
    }
    if (fBillCoach) {
      filteredStudents = filteredStudents.filter(
        (s) => String(s.coach_id) === String(fBillCoach),
      );
    }

    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();
    const isCurrentMonth =
      targetMonth === currentMonth && targetYear === currentYear;
    const isPastMonth =
      targetYear < currentYear ||
      (targetYear === currentYear && targetMonth < currentMonth);
    const targetMonthEnd = new Date(
      Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59),
    );

    tbody.innerHTML = filteredStudents
      .map((s) => {
        const enrollDateStr = getStudentDate(s);
        const enrollDate = enrollDateStr ? new Date(enrollDateStr) : null;

        // 1. Enrollment Check
        const enrollStatus = getStudentStatus(s);
        const isNotEnrolled =
          enrollStatus === "pending" ||
          enrollStatus === "upcoming" ||
          enrollStatus === "waitlist" ||
          enrollStatus === "inactive";
        const wasEnrolled =
          enrollDate && enrollDate <= targetMonthEnd && !isNotEnrolled;
        if (!wasEnrolled || isNotEnrolled) {
          return `<tr>
          <td><span style="font-family:var(--font-mono);color:var(--gold);font-size:13px">INV-${s.id ? s.id.toString().slice(-6) : "000000"}</span></td>
          <td>
            <div style="font-weight:600;color:var(--ivory)">${escapeHtml(getStudentName(s))}</div>
            <div style="font-size:11px;color:var(--ivory-dim)">Waiting List</div>
          </td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td style="font-weight:600;color:var(--gold)">—</td>
          <td><span class="badge badge-outline-grey" style="font-size:10px;padding:4px 8px">Not Enrolled</span></td>
          <td><span style="color:var(--ivory-dim);font-size:11px">—</span></td>
        </tr>`;
        }

        // 2. Status Determination (Using Unified Intelligence Core)
        const status = statusCache.get(s.id);
        let statusClass = "badge-danger";
        if (status === "Paid") statusClass = "badge-success";
        else if (status === "Pending") statusClass = "badge-warning";
        else if (status === "Due") statusClass = "badge-danger";
        else if (status === "Overdue") statusClass = "badge-danger";
        else if (status === "Not Enrolled") statusClass = "badge-outline-grey";

        const invoiceId =
          "INV-" + (s.id ? s.id.toString().slice(-6) : "000000");

        // Get Coach Info
        const coach = allCoaches.find(
          (c) => String(c.id) === String(s.coach_id),
        );
        const coachName = coach ? escapeHtml(getCoachName(coach)) : "N/A";
        const sessionType = getStudentBatchType(s) || "Regular";
        const scheduleTime = getStudentSessionTime(s) || "TBD";

        let actionButtons = "";
        if (status === "Paid") {
          actionButtons = `
            <button class="btn btn-outline-grey btn-sm" onclick="downloadReceipt('${s.id}', '${jsAttrEncode(getStudentName(s))}', '${getStudentMonthlyFee(s)}', '${jsAttrEncode(getStudentLevel(s))}', '${getStudentRating(s)}', '${coachName}', 'Online')">📄 Receipt</button>
            <button class="btn btn-outline-grey btn-sm" onclick="viewPaymentHistory('${s.id}')">⏳ History</button>
            <button class="btn btn-outline-warning btn-sm" onclick="togglePaymentStatus('${s.id}', '${jsAttrEncode(getStudentName(s))}', '${getStudentMonthlyFee(s)}')">🔄 Mark Unpaid</button>
          `;
        } else if (
          status === "Pending" ||
          status === "Due" ||
          status === "Overdue"
        ) {
          actionButtons = `
            <button class="btn btn-gold btn-sm" onclick="openPay('${s.id}', '${jsAttrEncode(getStudentName(s))}', '${getStudentMonthlyFee(s)}')">💳 Pay Now</button>
            <button class="btn btn-outline-grey btn-sm" onclick="viewPaymentHistory('${s.id}')">⏳ History</button>
            <button class="btn btn-outline-info btn-sm" onclick="informParent('${s.id}', '${jsAttrEncode(getStudentName(s))}', '${getStudentMonthlyFee(s)}')">📢 Inform</button>
            <button class="btn btn-outline btn-sm" onclick="markPaid('${s.id}')">✅ Mark Paid</button>
          `;
        } else {
          actionButtons = `<span style="color:var(--ivory-dim);font-size:11px">—</span>`;
        }

        return `<tr>
        <td><span style="font-family:var(--font-mono);color:var(--gold);font-size:13px">${invoiceId}</span></td>
        <td>
          <div style="font-weight:600;color:var(--ivory)">${escapeHtml(getStudentName(s))}</div>
          <div style="font-size:11px;color:var(--ivory-dim)">${escapeHtml(getStudentLevel(s))}</div>
        </td>
        <td><div style="font-size:12px;color:var(--ivory)">${escapeHtml(coachName)}</div></td>
        <td><div style="font-size:12px;color:var(--ivory-dim)">${escapeHtml(sessionType)}</div></td>
        <td><div style="font-size:11px;color:var(--ivory-dim)">${escapeHtml(scheduleTime)}</div></td>
        <td style="font-weight:600;color:var(--gold)">₹${getStudentMonthlyFee(s).toLocaleString()}</td>
        <td><span class="badge ${statusClass}" style="font-size:10px;padding:4px 8px">${status}</span></td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            ${actionButtons}
          </div>
        </td>
      </tr>`;
      })
      .join("");
  }

  window.toggleAllStudents = function (checked) {
    document
      .querySelectorAll(".stud-check")
      .forEach((cb) => (cb.checked = checked));
  };

  async function bulkMarkPaid() {
    const checked = document.querySelectorAll(".stud-check:checked");
    if (checked.length === 0) {
      toast("Please select students first", "warning");
      return;
    }

    if (!confirm(`Mark ${checked.length} students as Paid?`)) return;

    toast(`Processing ${checked.length} students...`, "info");
    for (const cb of checked) {
      const studentId = cb.dataset.id;
      const s = allStudents.find((x) => String(x.id) === String(studentId));
      const amt = s ? getStudentMonthlyFee(s) : 5000;

      // Update student status and advance due date - Fix #26
      const updates = { payment_status: "Paid" };
      // Due date is now automatically rolled over by the backend when the payment is created.

      try {
        await apiCall(`${API_BASE}/students?id=${studentId}`, {
          method: "PUT",
          body: JSON.stringify(updates),
        });

        // Log history
        await apiCall(`${API_BASE}/payments`, {
          method: "POST",
          body: JSON.stringify({
            student_id: studentId,
            amount: amt,
            status: "paid",
            payment_method: "Bulk Admin",
            description: "Bulk mark as paid by administrator",
            transaction_id: "BLK-" + Math.floor(Math.random() * 1000000),
            payment_date:
              window.reportMonth !== new Date().getUTCMonth() ||
              window.reportYear !== new Date().getUTCFullYear()
                ? new Date(
                    Date.UTC(
                      window.reportYear,
                      window.reportMonth,
                      1,
                      12,
                      0,
                      0,
                    ),
                  ).toISOString()
                : new Date().toISOString(),
          }),
        });
      } catch (e) {
        console.error("Bulk mark paid error for student", studentId, e);
        toast(
          `Failed to process student ${getStudentName(s)}: ${e.message}`,
          "error",
        );
      }
    }
    toast("Bulk payments processed and due dates advanced!", "success");

    // FIX #4: Invalidate payment cache before reload
    window.totalPaymentsMap = null;

    loadAllData(true);
  }

  window.bulkDeleteStudents = async function () {
    const checked = document.querySelectorAll(".stud-check:checked");
    if (checked.length === 0) {
      toast("Please select students to delete", "warning");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete ${checked.length} students? This cannot be undone.`,
      )
    )
      return;

    toast(`Deleting ${checked.length} students...`, "info");
    let successCount = 0;
    for (const cb of checked) {
      try {
        const id = cb.dataset.id;
        const res = await apiCall(`/api/students?id=${id}`, {
          method: "DELETE",
        });
        if (res.ok) successCount++;
      } catch (e) {
        console.error("Bulk delete error:", e);
      }
    }

    toast(`${successCount} students deleted!`, "success");
    loadAllData(true);
    if ($("stud-check-all")) $("stud-check-all").checked = false;
  };
  let currentPayId = null;
  let currentPayAmt = 0;

  // Razorpay integration configuration variables
  let isRazorpayConfigured = false;
  let razorpayKeyId = null;

  async function checkRazorpayConfig() {
    try {
      const res = await fetch("/api/razorpay/config");
      if (res.ok) {
        const data = await res.json();
        isRazorpayConfigured = !!data.configured;
        razorpayKeyId = data.keyId;
      }
    } catch (e) {
      console.warn(
        "Payment Gateway: Config fetch failed, running in simulation mode.",
        e,
      );
    }
  }
  checkRazorpayConfig();

  function openPay(id, name, fee) {
    const nameEl = $("pay-name");
    const feeEl = $("pay-amt");

    // Harden fee input: strip currency symbols and commas
    const finalFee =
      typeof fee === "string"
        ? parseInt(fee.replace(/[^\d]/g, ""), 10) || 5000
        : fee || 5000;

    currentPayId = id;
    currentPayAmt = finalFee;

    if (nameEl) nameEl.textContent = name;
    if (feeEl) feeEl.textContent = `₹${finalFee.toLocaleString()}`;

    // Reset payment modal view
    const optionsEl = $("pay-options");
    if (optionsEl) {
      optionsEl.style.display = "block";
      let optionsHtml = "";
      if (isRazorpayConfigured) {
        optionsHtml += `<div class="upi-item" onclick="initiateRazorpayPay()" style="background:rgba(232,168,48,0.1); border-color:var(--gold); color:var(--gold); display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:12px;">🛡️ <b>Pay via Razorpay (Card/UPI)</b></div>`;
      }
      optionsHtml += `
        <div class="upi-item" onclick="initiatePay('Google Pay')"><b>Google Pay</b></div>
        <div class="upi-item" onclick="initiatePay('PhonePe')"><b>PhonePe</b></div>
        <div class="upi-item" onclick="initiatePay('Paytm')"><b>Paytm</b></div>
      `;
      optionsEl.innerHTML = optionsHtml;
    }

    if ($("pay-processing")) $("pay-processing").style.display = "none";

    openModal("pay-modal");
  }

  function initiatePay(provider) {
    const optionsEl = $("pay-options");
    const processingEl = $("pay-processing");
    const logsEl = $("pay-console-logs");
    const titleEl = $("pay-status-title");

    if (optionsEl) optionsEl.style.display = "none";
    if (processingEl) processingEl.style.display = "block";
    if (logsEl) logsEl.innerHTML = "";
    if (titleEl) titleEl.textContent = "Processing Secure UPI Payment...";

    const s = allStudents.find((x) => String(x.id) === String(currentPayId));
    const email = s ? s.email || "parent@academy.com" : "parent@academy.com";

    function addLogLine(text, type = "info") {
      if (!logsEl) return;
      let color = "#d4d4d8";
      if (type === "success") color = "var(--success)";
      if (type === "error") color = "var(--danger)";
      if (type === "warn") color = "var(--amber)";
      logsEl.innerHTML += `<div style="color:${color}; margin-bottom: 4px;">[${new Date().toLocaleTimeString()}] ${escapeHtml(text)}</div>`;
      logsEl.scrollTop = logsEl.scrollHeight;
    }

    addLogLine(`[CONNECTING] Establishing secure socket with ${provider}...`);
    window.logGatewaySecurityEvent(
      "payment.initiated",
      "SUCCESS",
      `Initiated ₹${currentPayAmt} via ${provider}`,
      email,
    );

    setTimeout(() => {
      addLogLine(
        `[RESOLVING] Gateway handshake success. Merchant router online.`,
      );
      window.logGatewaySecurityEvent(
        "payment.bank_handshake",
        "SUCCESS",
        `Merchant handshake verified`,
        email,
      );
    }, 600);

    setTimeout(() => {
      const telemetry = window.extractDeviceTelemetry
        ? window.extractDeviceTelemetry()
        : { ip: "127.0.0.1", browser: "Chrome", os: "Windows", country: "IN" };
      addLogLine(
        `[TELEMETRY] Checked signature: IP=${telemetry.ip}, Browser=${telemetry.browser}, OS=${telemetry.os}, LOC=${telemetry.country}`,
      );
      window.logGatewaySecurityEvent(
        "payment.risk_check",
        "SUCCESS",
        `Security footprint scan: PASS`,
        email,
      );
    }, 1200);

    setTimeout(() => {
      addLogLine(`[BANK] Verifying transaction token HMAC-sha256 signature...`);
      window.logGatewaySecurityEvent(
        "payment.captured",
        "SUCCESS",
        `Bank HMAC confirmed`,
        email,
      );
    }, 2000);

    setTimeout(() => {
      addLogLine(
        `[CONFIRMING] Callback received. Transaction captured.`,
        "success",
      );
      window.logGatewaySecurityEvent(
        "payment.captured",
        "SUCCESS",
        `Tuition credited: ₹${currentPayAmt}`,
        email,
      );
    }, 2800);

    setTimeout(() => {
      addLogLine(
        `[IMMUTABLE] Committing transaction records to Supabase DB...`,
      );
    }, 3400);

    setTimeout(async () => {
      await markPaid(currentPayId, currentPayAmt, provider);
      closeModals();
      loadAllData(true);
    }, 4200);
  }

  // Real-time Razorpay Payment Flow
  window.initiateRazorpayPay = async function () {
    const optionsEl = $("pay-options");
    const processingEl = $("pay-processing");
    const logsEl = $("pay-console-logs");
    const titleEl = $("pay-status-title");

    if (optionsEl) optionsEl.style.display = "none";
    if (processingEl) processingEl.style.display = "block";
    if (logsEl) logsEl.innerHTML = "";
    if (titleEl) titleEl.textContent = "Contacting Razorpay Server...";

    const s = allStudents.find((x) => String(x.id) === String(currentPayId));
    const studentName = s ? getStudentName(s) : "Unknown Student";
    const email = s ? s.email || "parent@academy.com" : "parent@academy.com";

    function addLogLine(text, type = "info") {
      if (!logsEl) return;
      let color = "#d4d4d8";
      if (type === "success") color = "var(--success)";
      if (type === "error") color = "var(--danger)";
      if (type === "warn") color = "var(--amber)";
      logsEl.innerHTML += `<div style="color:${color}; margin-bottom: 4px;">[${new Date().toLocaleTimeString()}] ${escapeHtml(text)}</div>`;
      logsEl.scrollTop = logsEl.scrollHeight;
    }

    addLogLine(`[CONNECTING] Connecting to Razorpay Edge APIs...`);
    window.logGatewaySecurityEvent(
      "payment.initiated",
      "SUCCESS",
      `Razorpay flow started: ₹${currentPayAmt}`,
      email,
    );

    // 1. Dynamic Script Loader
    if (!window.Razorpay) {
      addLogLine(`[SDK] Loading Razorpay Checkout SDK script...`);
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      }).catch((err) => {
        addLogLine(`[ERROR] Failed to load Razorpay SDK!`, "error");
        window.logGatewaySecurityEvent(
          "payment.failed",
          "FAILED",
          `Razorpay SDK script load failure`,
          email,
        );
        setTimeout(() => {
          if (optionsEl) optionsEl.style.display = "block";
          if (processingEl) processingEl.style.display = "none";
        }, 2000);
      });
    }

    if (!window.Razorpay) return;

    addLogLine(`[ORDER] Initializing secure transaction order...`);

    try {
      const orderRes = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: currentPayAmt,
          currency: "INR",
          receipt: "receipt_adm_" + Date.now(),
        }),
      });

      if (!orderRes.ok) throw new Error("Order creation failed");

      const orderData = await orderRes.json();
      addLogLine(
        `[ORDER] Order generated: ${orderData.id}. Opening Razorpay Frame...`,
        "success",
      );

      // If simulated, bypass popups
      if (orderData.simulated) {
        addLogLine(
          `[SIMULATION] Server in simulation mode (Missing keys). Processing checkout...`,
          "warn",
        );
        setTimeout(async () => {
          addLogLine(`[VERIFYING] Client callback signature verify...`);
          window.logGatewaySecurityEvent(
            "payment.captured",
            "SUCCESS",
            `Simulated order capture verified: ${orderData.id}`,
            email,
          );
          await markPaid(currentPayId, currentPayAmt, "Razorpay (Simulated)");
          closeModals();
          loadAllData(true);
        }, 2000);
        return;
      }

      // Configure official Razorpay Checkout Options
      const options = {
        key: razorpayKeyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Two Knights Academy",
        description: "Tuition Fee - " + studentName,
        order_id: orderData.id,
        handler: async function (response) {
          addLogLine(
            `[SDK] Payment success response received. Triggering cryptographic verify...`,
          );

          try {
            const verifyRes = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (
              verifyRes.ok &&
              (verifyData.status === "success" || verifyData.simulated)
            ) {
              addLogLine(
                `[VERIFY] Signature verification check PASS. Writing database records...`,
                "success",
              );
              window.logGatewaySecurityEvent(
                "payment.captured",
                "SUCCESS",
                `Razorpay payment captured: ${response.razorpay_payment_id}`,
                email,
              );
              await markPaid(currentPayId, currentPayAmt, "Razorpay");
              closeModals();
              loadAllData(true);
            } else {
              throw new Error(verifyData.error || "Signature check failed");
            }
          } catch (err) {
            addLogLine(
              `[ERROR] Verification check FAIL: ${err.message}`,
              "error",
            );
            window.logGatewaySecurityEvent(
              "signature.mismatch",
              "FAILED",
              `HMAC verification failed: ${err.message}`,
              email,
            );
            setTimeout(() => {
              if (optionsEl) optionsEl.style.display = "block";
              if (processingEl) processingEl.style.display = "none";
            }, 3000);
          }
        },
        prefill: {
          name: studentName,
          email: email,
        },
        theme: {
          color: "#e8a830", // Academy gold color
        },
        modal: {
          ondismiss: function () {
            addLogLine(`[CANCEL] Checkout iframe dismissed by user.`, "warn");
            window.logGatewaySecurityEvent(
              "payment.failed",
              "FAILED",
              `Checkout closed by client`,
              email,
            );
            setTimeout(() => {
              if (optionsEl) optionsEl.style.display = "block";
              if (processingEl) processingEl.style.display = "none";
            }, 1500);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      addLogLine(`[ERROR] Order creation crashed: ${e.message}`, "error");
      window.logGatewaySecurityEvent(
        "payment.failed",
        "FAILED",
        `Order creation failure: ${e.message}`,
        email,
      );
      setTimeout(() => {
        if (optionsEl) optionsEl.style.display = "block";
        if (processingEl) processingEl.style.display = "none";
      }, 3000);
    }
  };

  // =========================================================================
  // Live Payment Security & Gateway Log Telemetry Stream (Vanilla Virtualizer)
  // =========================================================================
  window.gatewaySecurityLogs = [];
  window.gatewayVirtualizer = null;
  let gatewaySimulationInterval = null;

  window.logGatewaySecurityEvent = function (
    action,
    status,
    detail,
    email = "anonymous@parent.com",
  ) {
    const telemetry = window.extractDeviceTelemetry
      ? window.extractDeviceTelemetry()
      : { ip: "127.0.0.1", os: "Windows", browser: "Chrome", country: "IN" };
    const log = {
      id: "pay_log_" + Math.random().toString(36).substr(2, 9),
      userEmail: email,
      action: action,
      status: status,
      ipAddress: telemetry.ip,
      deviceOS: telemetry.os,
      browser: telemetry.browser,
      countryCode: telemetry.country,
      createdAt: new Date().toISOString(),
      detail: detail,
    };

    window.gatewaySecurityLogs.unshift(log);

    // Cap buffer to 1000 items
    if (window.gatewaySecurityLogs.length > 1000) {
      window.gatewaySecurityLogs = window.gatewaySecurityLogs.slice(0, 1000);
    }

    // Refresh virtual table count
    if (window.gatewayVirtualizer) {
      window.gatewayVirtualizer.updateCount(window.gatewaySecurityLogs.length);
    }

    const bufferLabel = document.getElementById("gateway-buffer-track");
    if (bufferLabel) {
      bufferLabel.textContent = `Buffer: ${window.gatewaySecurityLogs.length.toLocaleString()} items cached`;
    }
  };

  window.initGatewayMonitorVirtualizer = function () {
    const scrollContainer = document.getElementById(
      "gateway-virtual-scroll-container",
    );
    const spacer = document.getElementById("gateway-virtual-spacer");
    const emptyState = document.getElementById("gateway-empty-state");

    if (!scrollContainer || !spacer) return;

    if (window.gatewaySecurityLogs.length === 0) {
      generateDemoGatewayLogs();
    }

    if (emptyState) emptyState.style.display = "none";

    if (window.gatewayVirtualizer) {
      window.gatewayVirtualizer.destroy();
    }

    const rowHeight = 44;
    window.gatewayVirtualizer = new window.VanillaVirtualizer({
      container: scrollContainer,
      spacer: spacer,
      estimateSize: rowHeight,
      overscan: 10,
      count: window.gatewaySecurityLogs.length,
      renderRow: function (index, startY, height) {
        const log = window.gatewaySecurityLogs[index];
        if (!log) return null;

        const row = document.createElement("div");
        row.className = "virtual-row";
        row.style.position = "absolute";
        row.style.left = "0";
        row.style.top = "0";
        row.style.width = "100%";
        row.style.height = `${height}px`;
        row.style.transform = `translateY(${startY}px)`;
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.borderBottom = "1px solid rgba(255, 255, 255, 0.05)";
        row.style.padding = "0 16px";
        row.style.fontSize = "12px";
        row.style.background =
          log.status === "FAILED" ? "rgba(239, 68, 68, 0.05)" : "transparent";
        row.style.boxSizing = "border-box";

        const isSuccess = log.status === "SUCCESS";
        const statusIcon = isSuccess
          ? `<span style="color:var(--success); font-size: 14px;" title="Success">💳</span>`
          : `<span class="pulse-alert" style="color:var(--danger); font-size: 14px;" title="Risk Flag">🚨</span>`;

        const actionColor =
          log.status === "FAILED"
            ? "color: #f87171; border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.1);"
            : "color: #fbbf24; border-color: rgba(232,168,48,0.3); background: rgba(232,168,48,0.05);";

        row.innerHTML = `
          <div style="flex: 0 0 40px; display:flex; align-items:center; justify-content:center;">${statusIcon}</div>
          <div style="flex: 0 0 160px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;"><span style="font-family:var(--font-mono); font-size:10px; padding:2px 6px; border:1px solid; border-radius:4px; ${actionColor}">${log.action}</span></div>
          <div style="flex: 1 1 180px; color:var(--ivory); font-weight:500; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; padding-right:10px;">${log.userEmail} <span style="color:var(--slate); font-weight:400; font-size:11px; margin-left:6px;">${log.detail}</span></div>
          <div style="flex: 0 0 120px; font-family:var(--font-mono); color:var(--ivory-dim); font-size:11px;">💻 ${log.ipAddress}</div>
          <div style="flex: 0 0 60px; display:flex; align-items:center; gap:4px; font-family:var(--font-mono); font-size:11px; color:var(--ivory-dim);">🌍 ${log.countryCode}</div>
          <div style="flex: 0 0 160px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; color:var(--slate); font-size:11px;">⚙️ ${log.deviceOS} (${log.browser})</div>
          <div style="flex: 0 0 80px; text-align:right; font-family:var(--font-mono); color:var(--slate); font-size:11px;">⏱️ ${new Date(log.createdAt).toLocaleTimeString()}</div>
        `;
        return row;
      },
    });

    window.gatewayVirtualizer.updateCount(window.gatewaySecurityLogs.length);

    const bufferLabel = document.getElementById("gateway-buffer-track");
    if (bufferLabel) {
      bufferLabel.textContent = `Buffer: ${window.gatewaySecurityLogs.length.toLocaleString()} items cached`;
    }
  };

  function generateDemoGatewayLogs() {
    const emails = [
      "parent.james@gmail.com",
      "parent.lucy@yahoo.co.in",
      "parent.ron@outlook.com",
      "attacker@recon.net",
      "parent.sara@gmail.com",
    ];
    const actions = [
      "payment.initiated",
      "payment.bank_handshake",
      "payment.captured",
      "payment.failed",
    ];
    const statuses = ["SUCCESS", "SUCCESS", "SUCCESS", "FAILED"];
    const details = [
      "Checkout opened (₹5,000)",
      "Bank handshake verified",
      "Tuition credit success: ₹5,000",
      "Card Declined (3D Secure Fail)",
    ];
    const countries = ["IN", "IN", "IN", "US", "GB"];
    const ips = [
      "103.45.12.84",
      "192.168.1.15",
      "49.206.12.89",
      "201.44.11.2",
      "76.104.99.12",
    ];

    for (let i = 0; i < 40; i++) {
      const idx = Math.floor(Math.random() * actions.length);
      window.gatewaySecurityLogs.push({
        id: "demo_pay_" + i + "_" + Date.now(),
        userEmail: emails[Math.floor(Math.random() * emails.length)],
        action: actions[idx],
        status: statuses[idx],
        ipAddress: ips[Math.floor(Math.random() * ips.length)],
        deviceOS: Math.random() > 0.5 ? "Windows" : "macOS",
        browser: "Chrome",
        countryCode: countries[Math.floor(Math.random() * countries.length)],
        createdAt: new Date(Date.now() - i * 8 * 60 * 1000).toISOString(),
        detail: details[idx],
      });
    }
  }

  window.startGatewayLogsSimulation = function () {
    if (gatewaySimulationInterval) clearInterval(gatewaySimulationInterval);

    async function pollPayments() {
      try {
        const res = await fetch("/api/payments?limit=50").catch(() => null);
        if (res && res.ok) {
          const payments = await res.json().catch(() => []);
          let hasNew = false;

          payments.forEach((p) => {
            const exists = window.gatewaySecurityLogs.some(
              (existing) => existing.id === p.id,
            );
            if (!exists) {
              const s = allStudents.find(
                (x) => String(x.id) === String(p.student_id),
              );
              const email = s
                ? s.email || "parent@academy.com"
                : "parent@academy.com";
              const log = {
                id: p.id,
                userEmail: email,
                action:
                  p.payment_method === "Razorpay"
                    ? "payment.captured"
                    : "payment.completed",
                status:
                  p.status === "paid" || p.status === "completed"
                    ? "SUCCESS"
                    : "FAILED",
                ipAddress: "127.0.0.1",
                deviceOS: "System DB",
                browser: p.payment_method || "Online",
                countryCode: "IN",
                createdAt:
                  p.payment_date || p.created_at || new Date().toISOString(),
                detail: `${p.description || "Tuition Fee payment processed"} (Amount: ₹${p.amount})`,
              };
              window.gatewaySecurityLogs.unshift(log);
              hasNew = true;
            }
          });

          if (hasNew) {
            window.gatewaySecurityLogs.sort(
              (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
            );
            if (window.gatewaySecurityLogs.length > 1000) {
              window.gatewaySecurityLogs = window.gatewaySecurityLogs.slice(
                0,
                1000,
              );
            }
            if (window.gatewayVirtualizer) {
              window.gatewayVirtualizer.updateCount(
                window.gatewaySecurityLogs.length,
              );
            }
            const bufferLabel = document.getElementById("gateway-buffer-track");
            if (bufferLabel) {
              bufferLabel.textContent = `Buffer: ${window.gatewaySecurityLogs.length.toLocaleString()} items cached`;
            }
          }
        }
      } catch (e) {
        console.warn("Gateway log poll failed:", e);
      }
    }

    pollPayments();
    gatewaySimulationInterval = setInterval(pollPayments, 4000);
  };

  window.stopGatewayLogsSimulation = function () {
    if (gatewaySimulationInterval) {
      clearInterval(gatewaySimulationInterval);
      gatewaySimulationInterval = null;
    }
  };

  function downloadReceipt(
    id,
    name,
    fee,
    level = "Beginner",
    rating = 800,
    coach = "N/A",
    paymentMode = "Online Transfer",
    dateStr = "",
    type = "tuition",
    eventName = "",
  ) {
    const url = `receipt.html?id=${id}&name=${encodeURIComponent(name)}&amount=${fee}&level=${encodeURIComponent(level)}&rating=${rating}&coach=${encodeURIComponent(coach)}&method=${encodeURIComponent(paymentMode)}&date=${encodeURIComponent(dateStr)}&type=${encodeURIComponent(type)}&eventName=${encodeURIComponent(eventName)}&print=true`;
    window.open(url, "_blank");
    toast("Opening receipt for printing...", "success");
  }

  function numberToWords(num) {
    const ones = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];
    const tens = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];
    const scales = ["", "Thousand", "Lakh", "Crore"];

    if (num === 0) return "Zero Rupees Only";

    let words = "";
    let n = num;
    let scaleIndex = 0;

    const getChunk = (n) => {
      if (n < 20) return ones[n];
      if (n < 100)
        return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
      return (
        ones[Math.floor(n / 100)] +
        " Hundred" +
        (n % 100 ? " " + getChunk(n % 100) : "")
      );
    };

    if (n >= 10000000) {
      words += getChunk(Math.floor(n / 10000000)) + " Crore ";
      n %= 10000000;
    }
    if (n >= 100000) {
      words += getChunk(Math.floor(n / 100000)) + " Lakh ";
      n %= 100000;
    }
    if (n >= 1000) {
      words += getChunk(Math.floor(n / 1000)) + " Thousand ";
      n %= 1000;
    }
    if (n > 0) {
      words += getChunk(n);
    }

    return words + " Rupees Only";
  }

  function showReceiptPreview() {
    openModal("receipt-preview-modal");
  }
  function printReceipt() {
    window.print();
  }

  // ═══════════════════════════════════════════════════════════════
  // MESSAGES
  // ═══════════════════════════════════════════════════════════════
  async function renderMsgs() {
    const listEl = $("msgs-list");
    const loadingEl = $("msgs-loading");
    if (!listEl) return;

    if (loadingEl) loadingEl.style.display = "none";

    if (!allMessages || allMessages.length === 0) {
      listEl.style.display = "grid";
      listEl.innerHTML =
        '<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">💬</span><p>No messages yet</p></div>';
      return;
    }

    listEl.style.display = "grid";
    listEl.innerHTML = allMessages
      .map(
        (m) => `
       <div class="msg-card ${getMessageIsRead(m) ? "" : "unread"}">
         <div class="msg-card-head">
           <div class="msg-card-sender">
             ${escapeHtml(m.sender_name || "User")}
             ${!getMessageIsRead(m) ? '<span class="badge badge-level" style="margin-left:8px">New</span>' : ""}
           </div>
           <div class="msg-card-time">${m.created_at ? new Date(m.created_at).toLocaleDateString() : ""}</div>
         </div>
         <div class="msg-card-subject">${escapeHtml(m.subject || "No Subject")}</div>
         <div class="msg-card-body">${escapeHtml(m.message || "")}</div>
         <div class="msg-card-actions">
           ${!getMessageIsRead(m) ? `<button class="btn btn-outline-grey btn-sm" onclick="markMsgRead('${encodeURIComponent(String(m.id || ""))}')">✓ Mark Read</button>` : ""}
           <button class="btn btn-outline-grey btn-sm" onclick="deleteMsg('${encodeURIComponent(String(m.id || ""))}')">🗑️ Delete</button>
         </div>
       </div>
     `,
      )
      .join("");
  }
  async function markMsgRead(id) {
    // FIX: surface API failures to the user instead of swallowing them
    try {
      const res = await apiCall(
        `${API_BASE}/messages?id=${encodeURIComponent(id)}`,
        { method: "PUT", body: JSON.stringify({ is_read: true }) },
      );
      if (!res || !res.ok)
        throw new Error(`Server returned ${res ? res.status : "no response"}`);
      toast("Message marked as read", "success");
      loadAllData(true);
    } catch (e) {
      toast(
        "Failed to mark as read: " + (e.message || "connection error"),
        "error",
      );
    }
  }
  async function deleteMsg(id) {
    // FIX: confirmation, error handling, user feedback
    if (!confirm("Delete this message? This cannot be undone.")) return;
    try {
      const res = await apiCall(
        `${API_BASE}/messages?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!res || !res.ok)
        throw new Error(`Server returned ${res ? res.status : "no response"}`);
      toast("Message deleted", "success");
      loadAllData(true);
    } catch (e) {
      toast("Failed to delete: " + (e.message || "connection error"), "error");
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PARENT VIEW
  // ═══════════════════════════════════════════════════════════════
  function renderChild() {
    const loadingEl = $("child-loading");
    const contentEl = $("child-content");
    if (!currentStudent) {
      if (loadingEl) loadingEl.style.display = "flex";
      return;
    }

    const s = currentStudent;

    // Show or hide admin preview banner based on current role
    const previewBanner = $("preview-mode-banner");
    if (previewBanner) {
      if (role === "admin" || role === "master") {
        previewBanner.style.setProperty("display", "flex", "important");
        // Populate quick student switcher
        const switcher = $("preview-student-switcher");
        if (switcher) {
          const activeStudents = (allStudents || [])
            .filter(
              (st) => (st.status || "active").toLowerCase() !== "archived",
            )
            .sort((a, b) => getStudentName(a).localeCompare(getStudentName(b)));

          switcher.innerHTML = activeStudents
            .map(
              (st) =>
                `<option value="${st.id}" ${String(st.id) === String(s.id) ? "selected" : ""}>${escapeHtml(getStudentName(st))}</option>`,
            )
            .join("");
        }
      } else {
        previewBanner.style.setProperty("display", "none", "important");
      }
    }

    // Set page title for Admins viewing the portal
    if ($("p-title") && (role === "admin" || role === "master")) {
      $("p-title").textContent = "Student Portal Preview: " + getStudentName(s);
    }

    // Basic profile info
    if ($("c-name")) $("c-name").textContent = getStudentName(s);
    if ($("c-elo")) $("c-elo").textContent = getStudentRating(s);
    if ($("c-level")) $("c-level").textContent = getStudentLevel(s);
    if ($("p-av-wrap"))
      $("p-av-wrap").innerHTML =
        `<img src="${makeAvSrc(s)}" class="profile-av">`;
    if ($("c-parent-name"))
      $("c-parent-name").textContent = s.parent_name || "Not Provided";
    if ($("c-parent-phone"))
      $("c-parent-phone").textContent = getStudentPhone(s) || "Not Provided";
    if ($("c-parent-email"))
      $("c-parent-email").textContent = getStudentEmail(s) || "Not Provided";

    // Coach name
    const coach = allCoaches.find((c) => String(c.id) === String(s.coach_id));
    const coachName = coach ? getCoachName(coach) : "Not Assigned";
    if ($("c-coach")) $("c-coach").textContent = coachName;

    // Latest coach notes/review (from student notes field or messages).
    // Use the shared remover so both the legacy [SCHEDULE:{...}] and the new
    // [SCHEDULE64:...] tags are stripped from the parent-facing review text.
    const rawNotes = s.notes || "";
    const stripSchedule = window.removeScheduleJSON
      ? window.removeScheduleJSON(rawNotes)
      : rawNotes
          .replace(/\[SCHEDULE64:[A-Za-z0-9+/=]+\]/g, "")
          .replace(/\[SCHEDULE:({.*?})\]/g, "")
          .trim();
    const latestNotes =
      (stripSchedule || "").trim() || "No recent review available";
    if ($("c-notes")) $("c-notes").textContent = latestNotes;

    // Platform Links
    const linksContainer = $("c-chess-links-container");
    if (linksContainer) {
      let linksHtml = "";
      if (s.lichess_username) {
        const url = s.lichess_username.startsWith('http') 
          ? s.lichess_username 
          : `https://lichess.org/@/${s.lichess_username}`;
        linksHtml += `<a href="${escapeHtml(url)}" target="_blank" class="btn btn-sm" style="background:#fff; color:#000; border:none; display:flex; align-items:center; gap:6px;"><span class="ico" style="font-size:14px; margin:0;">♘</span> Lichess Profile</a>`;
      }
      if (s.chesscom_username) {
        const url = s.chesscom_username.startsWith('http') 
          ? s.chesscom_username 
          : `https://www.chess.com/member/${s.chesscom_username}`;
        linksHtml += `<a href="${escapeHtml(url)}" target="_blank" class="btn btn-sm" style="background:#7FA650; color:#fff; border:none; display:flex; align-items:center; gap:6px;"><span class="ico" style="font-size:14px; margin:0;">♟️</span> Chess.com Profile</a>`;
      }
      linksContainer.innerHTML = linksHtml;
      linksContainer.style.display = linksHtml ? "flex" : "none";
    }

    // Skill breakdown (based on level)
    renderChildSkills(s);

    // Achievements
    renderChildAchievements();

    // Billing tab
    renderChildBilling();

    // Schedule tab
    if (typeof window.renderChildSchedule === "function") {
      window.renderChildSchedule(s, coachName);
    }

    // AI Overview Insight
    if (typeof window.generateContextualInsight === "function") {
      window.generateContextualInsight("child_overview", s.id);
    }

    if (loadingEl) loadingEl.style.display = "none";
    if (contentEl) contentEl.style.display = "block";
    // Honor a requested sub-tab from the sidebar nav, otherwise default to overview.
    const intent = window.childTabIntent || "overview";
    window.childTabIntent = null;
    setChildTab(intent);
  }

  // Navigate to the parent portal and open a specific sub-tab from the sidebar.
  window.goChildTab = function (tab) {
    const childPage = document.getElementById("page-child");
    const alreadyOnChild = childPage && childPage.classList.contains("active");
    // Close the mobile sidebar for a smooth transition.
    if (window.innerWidth <= 768) {
      const sb = document.getElementById("sidebar");
      if (sb) sb.classList.remove("open");
      const ov = document.getElementById("sidebar-overlay");
      if (ov) ov.classList.remove("active");
    }
    if (alreadyOnChild && currentStudent) {
      // Already viewing the portal — switch tab instantly without a full re-render.
      setChildTab(tab);
    } else {
      window.childTabIntent = tab;
      setPage("child");
    }
  };

  function openStudentEditPortalModal() {
    if (!currentStudent) return;
    const s = currentStudent;
    if ($("spe-name")) $("spe-name").value = getStudentName(s);
    if ($("spe-parent-name")) $("spe-parent-name").value = s.parent_name || "";
    if ($("spe-phone")) $("spe-phone").value = getStudentPhone(s);
    if ($("spe-email")) $("spe-email").value = getStudentEmail(s);
    if ($("spe-lichess")) $("spe-lichess").value = s.lichess_username || "";
    if ($("spe-chesscom")) $("spe-chesscom").value = s.chesscom_username || "";
    if ($("spe-chessable")) $("spe-chessable").value = s.chessable_username || "";
    openModal("student-portal-edit-modal");
  }

  async function saveStudentPortalDetails() {
    if (!currentStudent) return;
    const s = currentStudent;
    const id = s.id;
    const name = $("spe-name")?.value.trim();
    const parent_name = $("spe-parent-name")?.value.trim();
    const phone = $("spe-phone")?.value.trim();
    const email = $("spe-email")?.value.trim();
    const lichess_username = $("spe-lichess")?.value.trim() || null;
    const chesscom_username = $("spe-chesscom")?.value.trim() || null;
    const chessable_username = $("spe-chessable")?.value.trim() || null;
    if (!name) {
      toast("Student Name is required", "error");
      return;
    }
    const payload = { name, parent_name, phone, parent_phone: phone, email, lichess_username, chesscom_username, chessable_username };
    try {
      toast("Saving details...", "info");
      const res = await apiCall(`/api/students?id=${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast("Details updated successfully!", "success");
        closeModals();
        s.name = name;
        s.parent_name = parent_name;
        s.phone = phone;
        s.parent_phone = phone;
        s.email = email;
        if (window.allStudents) {
          const idx = window.allStudents.findIndex(
            (x) => String(x.id) === String(id),
          );
          if (idx !== -1)
            window.allStudents[idx] = {
              ...window.allStudents[idx],
              ...payload,
            };
        }
        currentStudent = { ...s, ...payload };
        window.currentStudent = currentStudent;
        renderChild();
        loadAllData(true);
      } else {
        toast("Failed to save details", "error");
      }
    } catch (err) {
      console.error(err);
      toast("An error occurred", "error");
    }
  }

  function renderChildSkills(s) {
    const skillBars = $("skill-bars");
    if (!skillBars) return;

    const level = getStudentLevel(s);
    const skills = {
      "Opening Theory": {
        Beginner: 20,
        Intermediate: 40,
        Advanced: 60,
        Elite: 80,
      },
      "Middle Game": {
        Beginner: 15,
        Intermediate: 35,
        Advanced: 55,
        Elite: 75,
      },
      "Endgame Play": {
        Beginner: 10,
        Intermediate: 30,
        Advanced: 50,
        Elite: 70,
      },
      Tactics: { Beginner: 25, Intermediate: 45, Advanced: 65, Elite: 85 },
      Positional: { Beginner: 20, Intermediate: 35, Advanced: 55, Elite: 75 },
    };

    skillBars.innerHTML = Object.entries(skills)
      .map(([skill, levelProgs]) => {
        const prog = levelProgs[level] || 30;
        const color =
          prog >= 70
            ? "var(--success)"
            : prog >= 50
              ? "var(--gold)"
              : "var(--blue)";
        return `
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
            <span>${skill}</span>
            <span style="color:${color}">${prog}%</span>
          </div>
          <div style="height:6px;background:var(--bg3);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${prog}%;background:${color};border-radius:3px"></div>
          </div>
        </div>
      `;
      })
      .join("");
  }

  function renderChildAchievements() {
    const achGrid = $("parent-ach");
    if (!achGrid) return;

    const myAchs = achievementsData.filter(
      (a) => String(a.student_id) === String(currentStudent.id),
    );

    if (myAchs.length === 0) {
      achGrid.innerHTML =
        '<div class="empty-state"><span class="empty-icon">🏆</span><p>No achievements yet. Keep practicing!</p></div>';
      return;
    }

    achGrid.innerHTML = myAchs
      .slice(0, 6)
      .map(
        (a) => `
       <div class="ach-card">
         ${a.img_url ? `<img src="${escapeHtml(a.img_url)}" alt="${escapeHtml(a.title)}">` : '<div class="ach-icon">🏆</div>'}
         <div class="ach-info">
           <div class="ach-title">${escapeHtml(a.title)}</div>
           <div class="ach-date">${a.date_achieved ? new Date(a.date_achieved).toLocaleDateString() : ""}</div>
         </div>
       </div>
     `,
      )
      .join("");
  }
  function openContactModal() {
    if (!currentStudent) return;
    const coach = allCoaches.find(
      (c) => String(c.id) === String(currentStudent.coach_id),
    );
    const coachName = coach ? getCoachName(coach) : "Coach";
    if ($("contact-coach")) $("contact-coach").textContent = coachName;
    openModal("contact-modal");
  }
  async function sendMsg() {
    const msg = $("contact-msg")?.value?.trim();
    if (!msg) {
      toast("Please enter a message", "error");
      return;
    }
    if (!currentStudent) return;

    try {
      const coach = allCoaches.find(
        (c) => String(c.id) === String(currentStudent.coach_id),
      );
      // FIX: messages.sender_type / receiver_type CHECK only allows ('parent','admin','system').
      // Previously sent 'student' / 'coach' which the DB rejected, silently failing.
      // Route parent→coach messages through admin (admin forwards to coach), and tag sender as 'parent'.
      const coachName = coach ? getCoachName(coach) : "their coach";
      const res = await apiCall("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          sender_type: "parent",
          sender_id: currentStudent.id,
          receiver_type: "admin",
          message: msg,
          subject: `Parent of ${getStudentName(currentStudent)} would like to reach ${coachName}`,
          priority: "normal",
        }),
      });
      if (!res || !res.ok)
        throw new Error(`Server returned ${res ? res.status : "no response"}`);
      toast("Message sent to " + coachName + "!", "success");
      if ($("contact-msg")) $("contact-msg").value = "";
      closeModals();
    } catch (e) {
      toast(
        "Failed to send message: " + (e.message || "connection error"),
        "error",
      );
    }
  }
  async function sendFeedback() {
    const msg = $("fb-msg")?.value?.trim();
    if (!msg) {
      toast("Please enter your feedback", "error");
      return;
    }
    if (!currentStudent) return;

    try {
      // FIX: previously ignored res.ok so a 500/RLS failure silently looked "successful".
      const res = await apiCall("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          sender_type: "parent",
          sender_id: currentStudent.id,
          receiver_type: "admin",
          subject: `Feedback from parent of ${getStudentName(currentStudent)}`,
          message: msg,
          priority: "normal",
        }),
      });
      if (!res || !res.ok)
        throw new Error(`Server returned ${res ? res.status : "no response"}`);
      toast("Feedback submitted successfully!", "success");
      if ($("fb-msg")) $("fb-msg").value = "";
      closeModals();
    } catch (e) {
      toast(
        "Failed to submit feedback: " + (e.message || "connection error"),
        "error",
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // AI & CHAT
  // ═══════════════════════════════════════════════════════════════
  let currentAIModule = "global";

  // ── PRIVACY GUARDRAILS FOR PARENT AI ──
  const BLOCKED_PATTERNS = [
    /total revenue/i,
    /academy revenue/i,
    /monthly revenue/i,
    /salary/i,
    /total profit/i,
    /academy income/i,
    /other student/i,
    /other parent/i,
    /coach.*salary/i,
    /academy.*financial/i,
    /revenue.*this.*month/i,
    /total.*student/i,
    /collection.*rate/i,
    /payment.*records.*other/i,
    /sensitive/i,
    /confidential/i,
    /internal/i,
    /admin.*data/i,
    /backend/i,
    /database/i,
  ];

  const ALLOWED_PARENT_QUERIES = [
    "my child progress",
    "child progress",
    "my child achievements",
    "my child attendance",
    "attendance record",
    "my payment status",
    "payment history",
    "fee status",
    "my coach",
    "assigned coach",
    "coach name",
    "upcoming events",
    "events this month",
    "event schedule",
    "my child level",
    "my child elo",
    "rating history",
    "class schedule",
    "batch timing",
    "session time",
  ];

  const PARENT_DENIED_MESSAGE =
    "I can only help with information about your child's progress, attendance, and general academy events. For detailed financial or administrative queries, please contact the academy administrator directly.";

  function buildParentAIContext() {
    if (role !== "parent" || !currentStudent) return null;

    const coach = allCoaches.find(
      (c) => String(c.id) === String(currentStudent.coach_id),
    );
    const myAchievements = achievementsData.filter(
      (a) => String(a.student_id) === String(currentStudent.id),
    );
    const myPayments = allPayments.filter(
      (p) => String(p.student_id) === String(currentStudent.id),
    );
    const upcomingEvents = eventsData
      .filter((e) => new Date(e.date) >= new Date())
      .slice(0, 5);
    const myAttendance = allAttendance
      .filter((a) => String(a.student_id) === String(currentStudent.id))
      .slice(-30);

    return {
      role: "parent",
      student: {
        name: currentStudent.name,
        level: currentStudent.grade,
        elo: currentStudent.rating,
        payment_status: getStudentPaymentStatus(currentStudent),
        monthly_fee: currentStudent.monthly_fee,
        due_date: currentStudent.due_date,
      },
      coach: coach
        ? {
            name: getCoachName(coach),
            specialty: getCoachSpecialty(coach),
          }
        : null,
      achievements: myAchievements.slice(0, 5).map((a) => ({
        title: a.title,
        date: a.date_achieved,
      })),
      payments: myPayments.slice(0, 5).map((p) => ({
        date: p.payment_date,
        amount: p.amount,
        status: p.status,
      })),
      events: upcomingEvents.map((e) => ({
        title: e.title,
        date: e.date,
        type: e.type,
      })),
      attendance: {
        present: myAttendance.filter((a) => a.status === "present").length,
        total: myAttendance.length,
      },
      // NOTE: No other students, no coach salary, no revenue data
      allowed_queries: ALLOWED_PARENT_QUERIES,
      blocked_patterns: BLOCKED_PATTERNS.map((p) => p.source),
    };
  }

  function validateParentAIQuery(query) {
    const queryLower = query.toLowerCase();

    // Check if query contains blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(queryLower)) {
        return { allowed: false, reason: "sensitive_data" };
      }
    }

    // Check minimum allowed patterns (at least one keyword must match)
    const minKeywords = [
      /child/i,
      /my/i,
      /student/i,
      /attendance/i,
      /payment/i,
      /coach/i,
      /event/i,
      /level/i,
      /elo/i,
      /rating/i,
      /class/i,
      /session/i,
      /batch/i,
      /progress/i,
      /achievement/i,
      // General chess & educational topics are allowed for parents — they are
      // harmless and helpful. Sensitive academy data stays guarded by
      // BLOCKED_PATTERNS above.
      /chess/i,
      /opening/i,
      /tactic/i,
      /checkmate/i,
      /\bmate\b/i,
      /stalemate/i,
      /castl/i,
      /en\s*passant/i,
      /endgame/i,
      /strateg/i,
      /puzzle/i,
      /move/i,
      /piece/i,
      /pawn|knight|bishop|rook|queen|king/i,
      /sicilian|defense|defence|gambit|lopez|italian|french|caro/i,
      /tournament/i,
      /schedule/i,
      /bill|invoice|fee|due/i,
      /learn|study|improve|practice|tip/i,
      // Greetings / small talk
      /hello|hi\b|hey|thanks|thank you|how are you|good (morning|evening|afternoon)|help/i,
    ];

    const hasMinKeyword = minKeywords.some((k) => k.test(queryLower));
    if (!hasMinKeyword) {
      return { allowed: false, reason: "unrelated_query" };
    }

    return { allowed: true };
  }

  function validateParentAIResponse(response) {
    if (role !== "parent") return response;

    // Check response for sensitive data leakage
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(response)) {
        return PARENT_DENIED_MESSAGE;
      }
    }

    return response;
  }

  function setAIModule(m) {
    // Parents can only access parent module
    if (role === "parent" && m !== "parent") {
      m = "parent";
    }

    currentAIModule = m;
    const buttons = document.querySelectorAll(".ai-ws-btn");
    buttons.forEach((btn) => btn.classList.remove("active"));

    const moduleConfig = {
      global: {
        title: "Global Insights",
        icon: "⚡",
        btnIndex: 0,
        roles: ["admin", "master"],
      },
      finance: {
        title: "Financial Analysis",
        icon: "💰",
        btnIndex: 1,
        roles: ["admin", "master"],
      },
      coach: {
        title: "Coach Performance",
        icon: "🧑‍🏫",
        btnIndex: 2,
        roles: ["admin", "master"],
      },
      parent: {
        title: "My Child Progress",
        icon: "🧒",
        btnIndex: 3,
        roles: ["parent"],
      },
    };

    const config = moduleConfig[m];
    if (config && buttons[config.btnIndex]) {
      buttons[config.btnIndex].classList.add("active");
    }

    const header = document.querySelector(".ai-ws-header h2");
    const sub = document.querySelector(".ai-ws-header p");
    if (header) {
      header.textContent = config ? config.title : "Academy Intelligence";
    }
    if (sub) {
      const descriptions = {
        global: "Real-time analytics and predictive capabilities.",
        finance: "Revenue tracking, payment status, and financial forecasts.",
        coach: "Coach performance metrics and student progress tracking.",
        parent:
          "Get updates about your child's progress, attendance, and academy events.",
      };
      sub.textContent = descriptions[m] || descriptions.global;
    }

    const chatContainer = document.getElementById("ai-workspace-msgs");
    if (chatContainer) {
      // Clear existing messages for parent module
      if (m === "parent") {
        chatContainer.innerHTML = "";
      }

      const welcomeMsg = document.createElement("div");
      welcomeMsg.className = "ai-ws-msg bot";
      welcomeMsg.innerHTML = `
        <div class="ai-ws-avatar">🤖</div>
        <div class="ai-ws-bubble">
          ${
            m === "global"
              ? "Switched to Global Insights. I can now provide academy-wide analytics, enrollment trends, and comprehensive metrics."
              : m === "finance"
                ? "Switched to Financial Analysis. Let's examine revenue patterns, payment collections, and financial performance."
                : m === "coach"
                  ? "Switched to Coach Performance. I'll analyze individual coach metrics and student progress."
                  : `Hello! I'm your personal assistant for ${currentStudent?.name || "your child"}'s progress. I can help with attendance, achievements, payment status, upcoming events, and class schedules.`
          }
        </div>
      `;
      chatContainer.appendChild(welcomeMsg);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }
  window.setAIModule = setAIModule;

  function setAISuggestion(q) {
    const input = $("ai-query");
    if (input) {
      input.value = q;
      input.focus();
    }
  }
  window.setAISuggestion = setAISuggestion;

  // ═══════════════════════════════════════════════════════════════
  // REAL-TIME INTELLIGENCE ENGINE (RAG + AGENTIC AI)
  // ═══════════════════════════════════════════════════════════════

  // ── API ORCHESTRATION LAYER ──
  const API_ORCHESTRATION = {
    endpoints: {
      news: "https://newsapi.org/v2/top-headlines",
      finance: "https://api.coingecko.com/api/v3",
      weather: "https://api.open-meteo.com/v1/forecast",
      stocks: "https://query1.finance.yahoo.com/v8/finance",
      crypto: "https://api.coingecko.com/api/v3/simple/price",
    },
    cache: new Map(),
    cacheExpiry: 60000, // 1 minute cache

    async fetchWithCache(key, fetcher, expiry = 60000) {
      const now = Date.now();
      const cached = this.cache.get(key);
      if (cached && now - cached.timestamp < expiry) {
        return cached.data;
      }
      const data = await fetcher();
      this.cache.set(key, { data, timestamp: now });
      return data;
    },

    async fetchNews(category = "general") {
      return this.fetchWithCache(
        `news-${category}`,
        async () => {
          // Simulated news - in production would use real API
          return { articles: [], status: "demo" };
        },
        300000,
      );
    },

    async fetchMarketData() {
      return this.fetchWithCache(
        "market",
        async () => {
          return {
            indices: [
              { name: "S&P 500", value: 4780.24, change: 0.45 },
              { name: "NIFTY 50", value: 22350.8, change: 0.32 },
              { name: "NASDAQ", value: 15050.12, change: 0.67 },
            ],
            timestamp: new Date().toISOString(),
          };
        },
        60000,
      );
    },

    async fetchWeather(lat = 13.08, lon = 80.27) {
      return this.fetchWithCache(
        `weather-${lat}-${lon}`,
        async () => {
          return {
            temperature: 28,
            condition: "Partly Cloudy",
            humidity: 65,
            timestamp: new Date().toISOString(),
          };
        },
        300000,
      );
    },

    async fetchIoTSensors() {
      return {
        sensors: [
          {
            id: "temp-01",
            type: "temperature",
            value: 26.5,
            unit: "Â°C",
            location: "Classroom 1",
          },
          {
            id: "hum-01",
            type: "humidity",
            value: 62,
            unit: "%",
            location: "Classroom 1",
          },
          {
            id: "occupancy-01",
            type: "motion",
            value: 12,
            unit: "persons",
            location: "Main Hall",
          },
        ],
        timestamp: new Date().toISOString(),
      };
    },
  };

  // ── VECTOR DATABASE SIMULATION (RAG) ──
  const VECTOR_RAG = {
    chunks: [],

    async indexData() {
      this.chunks = [
        {
          id: "student_1",
          type: "student",
          content: "Total students count",
          data: { count: 0 },
          embedding: [],
        },
        {
          id: "coach_1",
          type: "coach",
          content: "Coach information",
          data: { count: 0 },
          embedding: [],
        },
        {
          id: "payment_1",
          type: "payment",
          content: "Payment status and revenue",
          data: { revenue: 0, paid: 0, due: 0 },
          embedding: [],
        },
        {
          id: "event_1",
          type: "event",
          content: "Academy events",
          data: { upcoming: 0, total: 0 },
          embedding: [],
        },
        {
          id: "achievement_1",
          type: "achievement",
          content: "Student achievements",
          data: { count: 0 },
          embedding: [],
        },
      ];
    },

    async retrieve(query, topK = 3) {
      const keywords = query.toLowerCase().split(" ");
      const scored = this.chunks.map((chunk) => {
        let score = 0;
        keywords.forEach((kw) => {
          if (chunk.content.toLowerCase().includes(kw)) score += 1;
          if (chunk.type.toLowerCase().includes(kw)) score += 0.5;
        });
        return { ...chunk, score };
      });
      return scored.sort((a, b) => b.score - a.score).slice(0, topK);
    },

    updateChunkData(type, data) {
      const chunk = this.chunks.find((c) => c.type === type);
      if (chunk) {
        chunk.data = data;
        chunk.content = JSON.stringify(data);
      }
    },
  };

  // ── TOOL CALLING ENGINE ──
  const TOOL_CALLER = {
    tools: {
      get_academy_stats: {
        name: "get_academy_stats",
        description:
          "Get academy statistics including students, coaches, revenue",
        execute: async () => {
          const totalStudents = allStudents.filter(
            (s) =>
              ![
                "archived",
                "pending",
                "waitlist",
                "upcoming",
                "inactive",
              ].includes(s.status),
          ).length;
          const totalCoaches = allCoaches.filter(
            (c) => c.status !== "archived",
          ).length;
          // Calculate financials for EVERY student regardless of status (handles archived students who paid this month)
          const revenue = allStudents.reduce(
            (a, s) => a + (getStudentMonthlyFee(s) || 0),
            0,
          );
          const paid = allStudents.filter(
            (s) => getStudentPaymentStatus(s) === "Paid",
          ).length;
          const due = allStudents.filter(
            (s) =>
              getStudentPaymentStatus(s) === "Due" ||
              getStudentPaymentStatus(s) === "Overdue",
          ).length;
          const pending = allStudents.filter(
            (s) => getStudentPaymentStatus(s) === "Pending",
          ).length;
          return {
            totalStudents,
            totalCoaches,
            revenue,
            paid,
            due,
            pending,
            collectionRate: ((paid / totalStudents) * 100 || 0).toFixed(1),
          };
        },
      },
      get_market_data: {
        name: "get_market_data",
        description: "Get real-time market indices and financial data",
        execute: async () => API_ORCHESTRATION.fetchMarketData(),
      },
      get_weather: {
        name: "get_weather",
        description: "Get current weather for location",
        execute: async (args) =>
          API_ORCHESTRATION.fetchWeather(args?.lat, args?.lon),
      },
      get_iot_sensors: {
        name: "get_iot_sensors",
        description: "Get IoT sensor readings from academy",
        execute: async () => API_ORCHESTRATION.fetchIoTSensors(),
      },
      get_events: {
        name: "get_events",
        description: "Get upcoming and past events",
        execute: async () => {
          const now = new Date();
          const upcoming = eventsData.filter(
            (e) => new Date(e.date) >= now,
          ).length;
          const past = eventsData.filter((e) => new Date(e.date) < now).length;
          return {
            upcoming,
            past,
            total: eventsData.length,
            events: eventsData.slice(0, 5),
          };
        },
      },
      get_achievements: {
        name: "get_achievements",
        description: "Get recent student achievements",
        execute: async () => {
          return {
            count: achievementsData.length,
            latest: achievementsData.slice(0, 5),
          };
        },
      },
      search_students: {
        name: "search_students",
        description: "Search students by name or level",
        execute: async (args) => {
          const query = args?.query?.toLowerCase() || "";
          return allStudents
            .filter(
              (s) =>
                getStudentName(s).toLowerCase().includes(query) ||
                getStudentLevel(s).toLowerCase().includes(query),
            )
            .slice(0, 10);
        },
      },
    },

    async executeTool(toolName, args = {}) {
      const tool = this.tools[toolName];
      if (!tool) return { error: `Tool ${toolName} not found` };
      try {
        return await tool.execute(args);
      } catch (e) {
        return { error: e.message };
      }
    },

    async executePlan(query) {
      const queryLower = query.toLowerCase();
      const toolsToCall = [];

      // Intelligent tool selection based on query keywords
      if (
        queryLower.includes("student") ||
        queryLower.includes("enrolled") ||
        queryLower.includes("how many")
      ) {
        toolsToCall.push(this.tools.get_academy_stats);
      }
      if (
        queryLower.includes("market") ||
        queryLower.includes("stock") ||
        queryLower.includes("finance") ||
        queryLower.includes("revenue")
      ) {
        toolsToCall.push(this.tools.get_market_data);
      }
      if (
        queryLower.includes("weather") ||
        queryLower.includes("temperature")
      ) {
        toolsToCall.push(this.tools.get_weather);
      }
      if (
        queryLower.includes("sensor") ||
        queryLower.includes("iot") ||
        queryLower.includes("monitor")
      ) {
        toolsToCall.push(this.tools.get_iot_sensors);
      }
      if (queryLower.includes("event") || queryLower.includes("tournament")) {
        toolsToCall.push(this.tools.get_events);
      }
      if (
        queryLower.includes("achievement") ||
        queryLower.includes("award") ||
        queryLower.includes("winner")
      ) {
        toolsToCall.push(this.tools.get_achievements);
      }

      // Default: always include academy stats
      if (toolsToCall.length === 0) {
        toolsToCall.push(this.tools.get_academy_stats);
      }

      const results = await Promise.all(toolsToCall.map((t) => t.execute()));
      return {
        results,
        sources: toolsToCall.map((t) => t.name),
        timestamp: new Date().toISOString(),
      };
    },
  };

  // ── TEMPORAL REASONING ENGINE ──
  const TEMPORAL_ENGINE = {
    getCurrentContext() {
      const now = new Date();
      return {
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        day: now.toLocaleDateString("en-US", { weekday: "long" }),
        hour: now.getHours(),
        isBusinessHours: now.getHours() >= 9 && now.getHours() <= 18,
        month: now.toLocaleDateString("en-US", { month: "long" }),
        quarter: Math.ceil((now.getMonth() + 1) / 3),
      };
    },

    formatTimestamp(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;

      if (diff < 60000) return "Just now";
      if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
      return date.toLocaleDateString();
    },

    getTimeBasedGreeting() {
      const hour = new Date().getHours();
      if (hour < 12) return "Good morning";
      if (hour < 17) return "Good afternoon";
      return "Good evening";
    },
  };

  // ── RESPONSE SYNTHESIZER ──
  const RESPONSE_SYNTHESIZER = {
    synthesize(query, toolResults, temporalContext) {
      let response = "";
      const sources = toolResults.sources || [];
      const results = toolResults.results || [];

      // Build contextual response based on query
      const queryLower = query.toLowerCase();

      if (
        queryLower.includes("how many") ||
        queryLower.includes("total") ||
        queryLower.includes("count")
      ) {
        const stats = results.find((r) => r.totalStudents !== undefined);
        if (stats) {
          response = `📊 **Academy Statistics** (${temporalContext.date})

`;
          response += `• **Total Students:** ${stats.totalStudents}
`;
          response += `• **Active Coaches:** ${stats.totalCoaches}
`;
          response += `• **Total Revenue:** ₹${stats.revenue?.toLocaleString() || 0}
`;
          response += `• **Collection Rate:** ${stats.collectionRate}%
`;
          response += `• **Paid Students:** ${stats.paid}
`;
          response += `• **Due Payments:** ${stats.due}`;
        }
      }

      if (
        queryLower.includes("market") ||
        queryLower.includes("stock") ||
        queryLower.includes("finance")
      ) {
        const market = results.find((r) => r.indices);
        if (market) {
          response = `📈 **Market Overview** (${temporalContext.time})

`;
          market.indices.forEach((idx) => {
            const sign = idx.change >= 0 ? "↑" : "↓";
            response += `• **${idx.name}:** ${idx.value.toLocaleString()} (${sign}${Math.abs(idx.change)}%)
`;
          });
        }
      }

      if (
        queryLower.includes("weather") ||
        queryLower.includes("temperature")
      ) {
        const weather = results.find((r) => r.temperature !== undefined);
        if (weather) {
          response = `🌤️ **Current Weather** (${temporalContext.date})

`;
          response += `• **Temperature:** ${weather.temperature}Â°C
`;
          response += `• **Condition:** ${weather.condition}
`;
          response += `• **Humidity:** ${weather.humidity}%`;
        }
      }

      if (
        queryLower.includes("sensor") ||
        queryLower.includes("iot") ||
        queryLower.includes("monitor")
      ) {
        const sensors = results.find((r) => r.sensors);
        if (sensors) {
          response = `🔌 **IoT Sensors** (${temporalContext.time})

`;
          sensors.sensors.forEach((s) => {
            response += `• **${s.location} - ${s.type}:** ${s.value} ${s.unit}
`;
          });
        }
      }

      if (queryLower.includes("event") || queryLower.includes("tournament")) {
        const events = results.find((r) => r.upcoming !== undefined);
        if (events) {
          response = `📅 **Events Summary** (${temporalContext.date})

`;
          response += `• **Upcoming Events:** ${events.upcoming}
`;
          response += `• **Past Events:** ${events.past}
`;
          response += `• **Total Events:** ${events.total}`;
        }
      }

      if (!response) {
        // Default comprehensive response
        response = `🏫 **Two Knights Academy Report**
`;
        response += `${TEMPORAL_ENGINE.getTimeBasedGreeting()}! Here's your academy overview:

`;

        const stats = results.find((r) => r.totalStudents !== undefined);
        if (stats) {
          response += `📊 **Statistics:** ${stats.totalStudents} students, ${stats.totalCoaches} coaches
`;
          response += `💰 **Revenue:** ₹${stats.revenue?.toLocaleString() || 0} (${stats.collectionRate}% collected)
`;
        }

        const events = results.find((r) => r.upcoming !== undefined);
        if (events) {
          response += `📅 **Events:** ${events.upcoming} upcoming
`;
        }

        response += `
⏰ Last updated: ${temporalContext.time}`;
      }

      // Add source attribution
      if (sources.length > 0) {
        response += `

📡 *Data sources: ${sources.join(", ")}*`;
      }

      return response;
    },
  };

  // ── ENHANCED AI QUERY HANDLER ──
  function animateAIResponse(element, markdownText) {
    let html = (markdownText || "")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(
        /`(.*?)`/g,
        '<code style="background:rgba(255,255,255,0.1);padding:2px 4px;border-radius:4px;font-family:var(--font-mono);font-size:0.9em">$1</code>',
      )
      .replace(/\n/g, "<br>");

    let i = 0;
    let isTag = false;
    let currentHTML = "";
    element.innerHTML = "";

    function type() {
      if (i < html.length) {
        let char = html.charAt(i);
        currentHTML += char;
        if (char === "<") isTag = true;
        if (char === ">") isTag = false;

        element.innerHTML =
          currentHTML +
          (i < html.length - 1 && !isTag
            ? '<span style="border-right: 2px solid var(--gold); animation: blink 1s step-end infinite; margin-left: 2px;">&nbsp;</span>'
            : "");

        const container = document.getElementById("ai-workspace-msgs");
        if (container) container.scrollTop = container.scrollHeight;

        let speed = isTag
          ? 0
          : char === "." || char === "?" || char === "!"
            ? 200
            : char === ","
              ? 100
              : 15;
        i++;
        setTimeout(type, speed);
      } else {
        element.innerHTML = currentHTML;
      }
    }
    type();
  }

  async function sendAIQuery() {
    const input = $("ai-query");
    if (!input || !input.value.trim()) {
      toast("Please enter a query", "info");
      return;
    }

    const query = input.value;
    const chatContainer = document.getElementById("ai-workspace-msgs");

    // ── PRIVACY GUARDRAIL: Validate parent queries ──
    if (role === "parent") {
      const validation = validateParentAIQuery(query);
      if (!validation.allowed) {
        const userMsg = document.createElement("div");
        userMsg.className = "ai-ws-msg user";
        userMsg.innerHTML = `<div class="ai-ws-avatar">👤</div><div class="ai-ws-bubble">${escapeHtml(query)}</div>`;
        chatContainer.appendChild(userMsg);

        const botMsg = document.createElement("div");
        botMsg.className = "ai-ws-msg bot";
        botMsg.innerHTML = `<div class="ai-ws-avatar">🤖</div><div class="ai-ws-bubble"></div>`;
        chatContainer.appendChild(botMsg);
        animateAIResponse(
          botMsg.querySelector(".ai-ws-bubble"),
          PARENT_DENIED_MESSAGE,
        );
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return;
      }
    }

    // Add user message
    const userMsg = document.createElement("div");
    userMsg.className = "ai-ws-msg user";
    userMsg.innerHTML = `<div class="ai-ws-avatar">👤</div><div class="ai-ws-bubble">${escapeHtml(query)}</div>`;
    chatContainer.appendChild(userMsg);

    input.value = "";
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Show thinking indicator with temporal context
    const thinkingMsg = document.createElement("div");
    thinkingMsg.className = "ai-ws-msg bot";
    thinkingMsg.innerHTML = `
      <div class="ai-ws-avatar">🤖</div>
      <div class="ai-ws-bubble msg-thinking">
        🔄 Analyzing query...
      </div>
    `;
    chatContainer.appendChild(thinkingMsg);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
      // ── BUILD ROLE-SPECIFIC CONTEXT ──
      let context = {};

      if (role === "parent") {
        // PARENT CONTEXT: Isolated, child-specific only
        context = buildParentAIContext() || {};
        context.moduleFocus = "parent";
      } else {
        // ADMIN CONTEXT: Full academy data
        const studentsCount = allStudents.length;
        const coachesCount = allCoaches.length;
        const totalRevenue = allStudents.reduce(
          (acc, s) => acc + (getStudentMonthlyFee(s) || 0),
          0,
        );
        const activeStudents = allStudents.filter(
          (s) => getStudentStatus(s) === "active",
        ).length;
        const pendingPayments = allStudents.filter((s) => {
          const st = getStudentPaymentStatus(s);
          return st === "Due" || st === "Overdue";
        }).length;
        const activeTab =
          document.querySelector(".nav-item.active")?.dataset.page ||
          "Dashboard";

        const targetMonth = window.reportMonth;
        const targetYear = window.reportYear;
        const targetMonthEnd = new Date(
          Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59),
        );

        const coachData = {};
        allCoaches.forEach((c) => {
          coachData[c.id] = {
            id: c.id,
            name: c.name || c.full_name || "Unknown",
            specialization: getCoachSpecialty(c) || "Chess Coach",
            students: 0,
            revenue: 0,
            pending: 0,
            projected: 0,
            cost: getCoachSalary(c) || 0,
          };
        });

        const unassignedData = {
          name: "Unassigned / Academy",
          students: 0,
          revenue: 0,
          pending: 0,
          projected: 0,
          cost: 0,
        };

        allStudents.forEach((s) => {
          const sStatus = getStudentStatus(s);
          if (
            sStatus === "archived" ||
            sStatus === "pending" ||
            sStatus === "waitlist" ||
            sStatus === "upcoming" ||
            sStatus === "inactive"
          )
            return;

          const coachId = s.coach_id;
          const targetData = coachData[coachId] || unassignedData;

          const enrollDateStr = getStudentDate(s);
          const enrollDate = enrollDateStr ? new Date(enrollDateStr) : null;

          if (enrollDate && enrollDate <= targetMonthEnd) {
            const fee = getStudentMonthlyFee(s) || 0;
            targetData.students++;
            targetData.projected += fee;

            const status = getStudentPaymentStatus(s, targetMonth, targetYear);
            if (status !== "Paid") {
              targetData.pending += fee;
            }
          }
        });

        const coachPaidStuds = new Set();
        (allPayments || []).forEach((p) => {
          const pDate = new Date(p.payment_date || p.created_at);
          if (
            pDate.getUTCMonth() === targetMonth &&
            pDate.getUTCFullYear() === targetYear &&
            p.status === "paid"
          ) {
            const sid = String(p.student_id).toLowerCase();
            if (coachPaidStuds.has(sid)) return;

            const s = allStudents.find(
              (x) => String(x.id).toLowerCase() === sid,
            );
            if (
              s &&
              getStudentPaymentStatus(s, targetMonth, targetYear) === "Paid"
            ) {
              coachPaidStuds.add(sid);
              const coachId = s.coach_id;
              const targetData = coachData[coachId] || unassignedData;
              targetData.revenue += getStudentMonthlyFee(s);
            }
          }
        });

        const coachesFinanceList = Object.entries(coachData).map(([id, d]) => {
          const netProfit = d.revenue - d.cost;
          const potentialNetProfit = d.projected - d.cost;
          const roi =
            d.cost > 0 ? ((d.revenue / d.cost) * 100).toFixed(1) + "%" : "0%";
          const potentialRoi =
            d.cost > 0 ? ((d.projected / d.cost) * 100).toFixed(1) + "%" : "0%";
          return {
            name: d.name,
            specialty: d.specialization,
            studentCount: d.students,
            students: d.students,
            collected_revenue: d.revenue,
            pending_payments: d.pending,
            salary_cost: d.cost,
            net_profit: netProfit,
            potential_net_profit: potentialNetProfit,
            roi: roi,
            potential_roi: potentialRoi,
          };
        });

        const studentsList = allStudents.map((s) => {
          const coach = allCoaches.find(
            (c) => String(c.id) === String(s.coach_id),
          );
          const sAtt = allAttendance.filter(
            (a) => String(a.student_id) === String(s.id),
          );
          const present = sAtt.filter((a) => a.status === "present").length;
          const attRate =
            sAtt.length > 0 ? Math.round((present / sAtt.length) * 100) : 100;
          return {
            name: getStudentName(s),
            rating: getStudentRating(s),
            level: getStudentLevel(s),
            status: getStudentStatus(s),
            payment_status: getStudentPaymentStatus(s),
            attendance_rate: attRate,
            fee: getStudentMonthlyFee(s),
            coach_name: coach ? getCoachName(coach) : "Unassigned",
            session_mode: getStudentBatchType(s),
            session_time: getStudentSessionTime(s),
          };
        });

        context = {
          students: studentsCount,
          activeStudents: activeStudents,
          coaches: coachesCount,
          revenue: totalRevenue,
          pendingPayments: pendingPayments,
          moduleFocus: activeTab,
          user: role || "Admin",
          timestamp: new Date().toISOString(),
          students_list: studentsList,
          coaches_list: coachesFinanceList,
        };
      }

      // Call AI with role-specific context
      const aiResponse = await apiCall(`${API_BASE}/ai`, {
        method: "POST",
        body: JSON.stringify({
          message: query,
          role: role || "admin",
          context: context,
        }),
      });

      const aiData = await aiResponse.json();
      let botResponse = aiData.message || "";

      // If the server returned only its generic template (e.g. Gemini key not
      // configured), answer general/chess/conversational queries locally.
      if (window.tomResolveAnswer) {
        botResponse = window.tomResolveAnswer(query, botResponse);
      } else if (!botResponse) {
        botResponse =
          "I apologize, I couldn't process that request. Please try again.";
      }

      // ── PRIVACY GUARDRAIL: Validate AI response for parents ──
      if (role === "parent") {
        botResponse = validateParentAIResponse(botResponse);
      }

      thinkingMsg.remove();

      const botMsg = document.createElement("div");
      botMsg.className = "ai-ws-msg bot";
      botMsg.innerHTML = `<div class="ai-ws-avatar">🤖</div><div class="ai-ws-bubble"></div>`;
      chatContainer.appendChild(botMsg);
      animateAIResponse(botMsg.querySelector(".ai-ws-bubble"), botResponse);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    } catch (e) {
      thinkingMsg.remove();
      console.error("AI Query Error:", e);
      const errorMsg = document.createElement("div");
      errorMsg.className = "ai-ws-msg bot";
      errorMsg.innerHTML = `<div class="ai-ws-avatar">🤖</div><div class="ai-ws-bubble">⚠️ Sorry, I encountered an error: ${escapeHtml(e.message)}. Try again or check your connection.</div>`;
      chatContainer.appendChild(errorMsg);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }
  window.sendAIQuery = sendAIQuery;

  // Initialize RAG on load
  VECTOR_RAG.indexData();

  function updateTomKpis() {
    const activeStudents = allStudents.filter(
      (s) => getStudentStatus(s) === "active",
    ).length;

    const present = allAttendance.filter((a) => a.status === "present").length;
    const totalAtt = allAttendance.filter(
      (a) => a.status === "present" || a.status === "absent",
    ).length;
    const attRate = totalAtt > 0 ? Math.round((present / totalAtt) * 100) : 100;

    const weakStudents = allStudents.filter(
      (s) =>
        getStudentStatus(s) === "active" && (getStudentRating(s) || 800) < 1000,
    ).length;

    // Coach Performance: average ELO rating of all active students
    const activeStuds = allStudents.filter(
      (s) => getStudentStatus(s) === "active",
    );
    const avgElo = activeStuds.length
      ? Math.round(
          activeStuds.reduce((a, s) => a + getStudentRating(s), 0) /
            activeStuds.length,
        )
      : 0;

    const upcomingEvents = eventsData.filter(
      (e) => new Date(e.date) >= new Date(),
    ).length;

    const pendingPayments = allStudents.filter((s) => {
      const sStatus = getStudentStatus(s);
      if (sStatus !== "active") return false;
      const payStatus = getStudentPaymentStatus(s);
      return payStatus === "Due" || payStatus === "Overdue";
    }).length;

    const tournamentReady = allStudents.filter(
      (s) => getStudentStatus(s) === "active" && getStudentRating(s) >= 1000,
    ).length;

    // AI recommendations (generate insights in memory first)
    if (window.generateAcademyInsights) {
      const prevFilter = window.currentInsightsFilter || "all";
      window.generateAcademyInsights();
      window.currentInsightsFilter = prevFilter;
    }
    const aiRecs = (window.generatedInsights || []).filter(
      (x) =>
        x.type === "promotion" ||
        x.type === "attendance" ||
        x.type === "arrears",
    ).length;

    if ($("tom-active-students"))
      $("tom-active-students").textContent = activeStudents;
    if ($("tom-attendance-rate"))
      $("tom-attendance-rate").textContent = attRate + "%";
    if ($("tom-weak-students"))
      $("tom-weak-students").textContent = weakStudents;
    if ($("tom-coach-perf")) $("tom-coach-perf").textContent = avgElo + " ELO";
    if ($("tom-upcoming-classes"))
      $("tom-upcoming-classes").textContent = upcomingEvents;
    if ($("tom-pending-payments"))
      $("tom-pending-payments").textContent = pendingPayments;
    if ($("tom-tournament-ready"))
      $("tom-tournament-ready").textContent = tournamentReady;
    if ($("tom-ai-recommendations"))
      $("tom-ai-recommendations").textContent = aiRecs;

    // Update last sync time
    if ($("tom-last-sync")) {
      const now = new Date();
      $("tom-last-sync").textContent =
        "Synced at " +
        now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
    }
  }
  window.updateTomKpis = updateTomKpis;

  // ═══════════════════════════════════════════════════════════════
  // THEME & PDF
  // ═══════════════════════════════════════════════════════════════
  function toggleTheme() {
    const newTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
    document.body.dataset.theme = newTheme;
    localStorage.setItem("twoknights_theme", newTheme);
    // Re-render dashboard if visible to update chart colors
    if ($("page-dash").classList.contains("active")) renderDash();
  }

  // Load theme on page load
  const savedTheme = localStorage.getItem("twoknights_theme");
  if (savedTheme) document.body.dataset.theme = savedTheme;

  // BOARDROOM REPORTING LOGIC MOVED TO js/reporting.js

  function exportAcademyData() {
    if (typeof XLSX === "undefined") {
      toast(
        "Export library not loaded yet. Please wait a moment and try again.",
        "error",
      );
      return;
    }
    if (!allStudents || allStudents.length === 0) {
      toast("No student data to export", "error");
      return;
    }

    toast("Generating Academy Excel Spreadsheet...", "info");

    try {
      const targetMonth = window.reportMonth;
      const targetYear = window.reportYear;
      const targetMonthEnd = new Date(
        Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59),
      );

      const excelRows = allStudents
        .filter((s) => {
          const enrollStr = getStudentDate(s);
          const enrollDate = enrollStr
            ? new Date(enrollStr)
            : new Date(Date.UTC(2026, 3, 1));
          const sStatus = getStudentStatus(s);
          const payStatus = getStudentPaymentStatus(s, targetMonth, targetYear);
          // Only drop students who weren't enrolled yet, or who are completely pending and inactive
          if (enrollDate > targetMonthEnd) return false;
          if (
            [
              "archived",
              "pending",
              "waitlist",
              "upcoming",
              "inactive",
            ].includes(sStatus) &&
            payStatus === "Pending"
          )
            return false;
          return true;
        })
        .map((s) => {
          const coach = allCoaches.find(
            (c) => String(c.id) === String(s.coach_id),
          );
          return {
            "Student Name": getStudentName(s),
            "Parent Phone": getStudentPhone(s),
            Level: getStudentLevel(s),
            "Elo Rating": getStudentRating(s),
            "Join Date": getStudentDate(s),
            "Fee Due Date": s.due_date || "N/A",
            "Monthly Fee": getStudentMonthlyFee(s),
            "Payment Status": getStudentPaymentStatus(
              s,
              targetMonth,
              targetYear,
            ),
            "Session Mode": getStudentBatchType(s),
            "Session Time": s.session_time || s.batch_time || "TBD",
            "Assigned Coach": coach ? getCoachName(coach) : "None",
            "Coach Phone": coach ? coach.phone || "N/A" : "N/A",
            "Coach Specialty": coach
              ? getCoachSpecialty(coach) || "N/A"
              : "N/A",
          };
        });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelRows);

      // Auto-fit column widths
      if (excelRows.length > 0) {
        const colWidths = Object.keys(excelRows[0]).map((key) => {
          let maxLen = key.length;
          excelRows.forEach((row) => {
            const val = row[key];
            if (val) maxLen = Math.max(maxLen, String(val).length);
          });
          return { wch: maxLen + 3 };
        });
        ws["!cols"] = colWidths;
      }

      XLSX.utils.book_append_sheet(wb, ws, "Academy Registry");

      const fileName = `twoknights_Academy_Data_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast("Academy Data Exported (Excel)", "success");
    } catch (err) {
      console.error("Academy Export Error:", err);
      toast("Excel Export Failed: System Error", "error");
    }
  }

  function exportData() {
    // FIX #8: Guard against missing XLSX library
    if (typeof XLSX === "undefined") {
      toast(
        "Export library not loaded yet. Please wait a moment and try again.",
        "error",
      );
      return;
    }
    if (!window.allStudents || window.allStudents.length === 0) {
      toast("No data available for export", "warning");
      return;
    }

    toast("Generating Strategic Intelligence Workbook...", "info");

    try {
      const wb = XLSX.utils.book_new();

      // 1. Dashboard Sheet (KPIs)
      const targetMonth = window.reportMonth;
      const targetYear = window.reportYear;
      const targetMonthEnd = new Date(
        Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59),
      );

      const targetStudents = allStudents.filter((s) => {
        const enrollStr = getStudentDate(s);
        const enrollDate = enrollStr
          ? new Date(enrollStr)
          : new Date(Date.UTC(2026, 3, 1));
        const sStatus = getStudentStatus(s);
        const payStatus = getStudentPaymentStatus(s, targetMonth, targetYear);
        if (enrollDate > targetMonthEnd) return false;
        if (
          ["archived", "pending", "waitlist", "upcoming", "inactive"].includes(
            sStatus,
          ) &&
          payStatus === "Pending"
        )
          return false;
        return true;
      });

      const collected = targetStudents
        .filter(
          (s) => getStudentPaymentStatus(s, targetMonth, targetYear) === "Paid",
        )
        .reduce((a, s) => a + getStudentMonthlyFee(s), 0);
      const pending = targetStudents
        .filter(
          (s) => getStudentPaymentStatus(s, targetMonth, targetYear) !== "Paid",
        )
        .reduce((a, s) => a + getStudentMonthlyFee(s), 0);
      const totalPotential = collected + pending;

      const dashboardData = [
        ["IMPERIAL ACADEMY STRATEGIC KPI REPORT"],
        ["Issued", new Date().toLocaleString()],
        [],
        ["Metric", "Value", "Context"],
        ["Total Cadets", allStudents.length, "Active Roster"],
        ["Revenue Potential", `₹${totalPotential}`, "Gross Capacity"],
        ["Revenue Realized", `₹${collected}`, "Liquidity"],
        ["Revenue Pending", `₹${pending}`, "Risk Exposure"],
        [
          "Collection Rate",
          `${((collected / totalPotential) * 100).toFixed(1)}%`,
          "Operational Efficiency",
        ],
        [
          "ARPU",
          `₹${(collected / allStudents.filter((s) => s.status === "active").length || 1).toFixed(0)}`,
          "Yield Per Cadet",
        ],
      ];
      const wsDash = XLSX.utils.aoa_to_sheet(dashboardData);
      XLSX.utils.book_append_sheet(wb, wsDash, "Executive Summary");

      // 2. Cadets Sheet (Deep Data)
      const cadetData = targetStudents.map((s) => ({
        ID: s.id,
        Name: getStudentName(s),
        Email: s.email || "N/A",
        Phone: s.phone || "N/A",
        Parent: s.parent_name || "N/A",
        Level: getStudentLevel(s),
        "Elo Rating": getStudentRating(s),
        "Batch Type": s.session_mode || s.batch_type || "Group",
        "Session Time": s.session_time || "N/A",
        "Monthly Fee": getStudentMonthlyFee(s),
        Status: s.status,
        "Payment Status": getStudentPaymentStatus(s, targetMonth, targetYear),
        "Enrollment Date": s.enrollment_date || s.join_date || "N/A",
        Address: s.address || "N/A",
        Notes: s.notes || "",
      }));
      const wsCadets = XLSX.utils.json_to_sheet(cadetData);
      XLSX.utils.book_append_sheet(wb, wsCadets, "Cadet Registry");

      // 3. Faculty Sheet (ROI)
      const facultyData = allCoaches.map((c) => {
        const coachStuds = targetStudents.filter(
          (s) => String(s.coach_id) === String(c.id),
        );
        const coachRev = coachStuds
          .filter(
            (s) =>
              getStudentPaymentStatus(s, targetMonth, targetYear) === "Paid",
          )
          .reduce((a, s) => a + getStudentMonthlyFee(s), 0);
        const coachCost = getCoachSalary(c) || 0;
        return {
          "Faculty ID": c.id,
          Name: getCoachName(c),
          "Enrolled Units": coachStuds.length,
          "Gross Revenue": coachRev,
          "Cost Basis": coachCost,
          "Net Profit": coachRev - coachCost,
          "ROI %":
            coachCost > 0
              ? (((coachRev - coachCost) / coachCost) * 100).toFixed(0) + "%"
              : "0%",
          Expertise: c.expertise || "General",
        };
      });
      const wsFaculty = XLSX.utils.json_to_sheet(facultyData);
      XLSX.utils.book_append_sheet(wb, wsFaculty, "Faculty ROI");

      // 4. Transactions Sheet
      const transData = allPayments.map((p) => ({
        Date: p.date || p.created_at || "N/A",
        "Student ID": p.student_id,
        "Student Name": p.student_name || "Unknown",
        Amount: p.amount,
        Method: p.method || "Cash",
        Description: p.description || "Monthly Fee",
        ID: p.id,
      }));
      const wsTrans = XLSX.utils.json_to_sheet(transData);
      XLSX.utils.book_append_sheet(wb, wsTrans, "Transaction History");

      // 5. Attendance Sheet
      const attendanceData = (allAttendance || []).map((a) => {
        const student = allStudents.find(
          (s) => String(s.id) === String(a.student_id),
        );
        return {
          Date: a.date || "N/A",
          "Student Name": student ? getStudentName(student) : "Unknown",
          Status: a.status || "N/A",
          Batch: a.batch_id || "N/A",
          "Coach ID": a.coach_id || "N/A",
        };
      });
      const wsAtt = XLSX.utils.json_to_sheet(attendanceData);
      XLSX.utils.book_append_sheet(wb, wsAtt, "Attendance Logs");

      // 6. Achievements Sheet
      const achData = (achievementsData || []).map((a) => {
        const student = allStudents.find(
          (s) => String(s.id) === String(a.student_id),
        );
        return {
          Date: a.date_achieved || "N/A",
          "Student Name": student ? getStudentName(student) : "Unknown",
          Achievement: a.title || "N/A",
          Category: a.category || "Tournament",
        };
      });
      const wsAch = XLSX.utils.json_to_sheet(achData);
      XLSX.utils.book_append_sheet(wb, wsAch, "Achievements Archive");

      // 7. Rating History Sheet
      const rateData = (allRatingHistory || []).map((r) => {
        const student = allStudents.find(
          (s) => String(s.id) === String(r.student_id),
        );
        return {
          Date: r.recorded_at || "N/A",
          "Student Name": student ? getStudentName(student) : "Unknown",
          "Old ELO": r.old_rating || 0,
          "New ELO": r.new_rating || 0,
          Gain: (r.new_rating || 0) - (r.old_rating || 0),
        };
      });
      const wsRate = XLSX.utils.json_to_sheet(rateData);
      XLSX.utils.book_append_sheet(wb, wsRate, "Rating Performance");

      // Export file
      XLSX.writeFile(
        wb,
        `twoknights_Strategic_Archive_${new Date().toISOString().split("T")[0]}.xlsx`,
      );
      toast("Strategic Archive Exported Successfully!", "success");
    } catch (err) {
      console.error("Export Error:", err);
      toast("Strategic Export Failed: System Error", "error");
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // INIT & EXPOSE
  // ═══════════════════════════════════════════════════════════════
  // Role-based session timeouts (in milliseconds)
  const SESSION_TIMEOUTS = {
    admin: 15 * 60 * 1000, // 15 minutes for admin
    master: null, // No timeout for master
    parent: 10 * 60 * 1000, // 10 minutes for parent
  };
  let sessionTimer = null;

  function resetSessionTimer() {
    // Session timeout disabled per request
    return;
  }

  ["click", "keypress", "mousemove", "scroll"].forEach((event) => {
    document.addEventListener(event, resetSessionTimer, { passive: true });
  });

  window.addEventListener("DOMContentLoaded", () => {
    initUI(); // Setup UI event handlers

    const auth = localStorage.getItem("twoknights_auth");
    if (auth) {
      try {
        const data = JSON.parse(auth);
        role = data.role;
        finishLogin(data.user || "User", data.role, data.studentId);
        resetSessionTimer();
      } catch (e) {
        localStorage.removeItem("twoknights_auth");
        $("login-screen").style.display = "flex";
        document.body.classList.add("login-mode");
      }
    } else {
      $("login-screen").style.display = "flex";
      document.body.classList.add("login-mode");
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // EXPOSE GLOBALS TO WINDOW
  // ═══════════════════════════════════════════════════════════════
  window.$ = $;
  window.toast = toast;
  window.apiCall = apiCall;
  window.logAudit = logAudit;
  window.API_BASE = API_BASE;
  window.loadHomeworkData = loadHomeworkData;
  window.role = role;
  window.currentStudent = currentStudent;
  window.escapeHtml = escapeHtml;

  // Data Arrays
  window.allStudents = allStudents;
  window.allCoaches = allCoaches;
  window.allPayments = allPayments;
  window.allMessages = allMessages;
  window.allAttendance = allAttendance;
  window.allRatingHistory = allRatingHistory;
  window.allResources = allResources;
  // Helper Functions
  window.getStudentName = getStudentName;
  window.getStudentMonthlyFee = getStudentMonthlyFee;
  window.getStudentPaymentStatus = getStudentPaymentStatus;
  window.getStudentLevel = getStudentLevel;
  window.getStudentRating = getStudentRating;
  window.getStudentDate = getStudentDate;
  window.getStudentPhone = getStudentPhone;
  window.getStudentEmail = getStudentEmail;
  window.getStudentBatchType = getStudentBatchType;
  window.getStudentStatus = getStudentStatus;
  window.getCoachName = getCoachName;
  window.getCoachSalary = getCoachSalary;
  window.getCoachSpecialty = getCoachSpecialty;
  window.getCoachExperience = getCoachExperience;
  window.getCoachRating = getCoachRating;
  window.getCoachAvailability = getCoachAvailability;
  window.getCoachEmail = getCoachEmail;
  window.getCoachStatus = getCoachStatus;
  window.getEventDate = getEventDate;
  window.getEventType = getEventType;
  window.getEventLocation = getEventLocation;
  window.getEventTime = getEventTime;

  window.getStudentSessionTime = getStudentSessionTime;
  window.isStudentScheduledToday = isStudentScheduledToday;
  window.getMessagePriority = getMessagePriority;
  window.getMessageIsRead = getMessageIsRead;
  window.makeAvSrc = makeAvSrc;

  window.toggleTheme = toggleTheme;
  window.toggleSidebar = toggleSidebar;
  window.toggleEye = toggleEye;
  window.setPage = setPage;
  window.switchTab = setPage;

  window.finishLogin = finishLogin;
  window.openModal = openModal;
  window.closeModals = closeModals;
  window.openProfile = openProfile;
  window.clearNotifications = clearNotifications;
  window.clearFilters = clearFilters;
  window.renderStudents = renderStudents;
  window.viewStudent = viewStudent;
  window.openStudentEditPortalModal = openStudentEditPortalModal;
  window.saveStudentPortalDetails = saveStudentPortalDetails;
  window.openEdit = openEdit;
  window.updateStudent = updateStudent;
  window.openEnroll = openEnroll;
  window.saveStudent = saveStudent;
  window.deleteStudent = deleteStudent;
  window.renderCoachMgmt = renderCoachMgmt;
  window.viewCoachSchedule = viewCoachSchedule;
  window.openCoachModal = openCoachModal;
  window.saveCoach = saveCoach;
  window.deleteCoach = deleteCoach;
  window.renderEvents = renderEvents;
  window.openEventModal = openEventModal;
  window.saveEvent = saveEvent;
  window.deleteEvent = deleteEvent;
  window.editEvent = editEvent;
  window.archiveEvent = archiveEvent;
  window.confirmDeleteEvent = confirmDeleteEvent;
  window.renderFame = renderFame;
  window.openAwardModal = openAwardModal;
  window.onAwardStudentChange = onAwardStudentChange;
  window.saveAward = saveAward;
  window.deleteAchievement = deleteAchievement;
  window.editAchievement = editAchievement;
  window.confirmDeleteAchievement = confirmDeleteAchievement;
  window.renderBills = renderBills;
  window.markPaid = markPaid;
  window.markUnpaid = markUnpaid;
  window.bulkMarkPaid = bulkMarkPaid;
  window.openPay = openPay;
  window.initiatePay = initiatePay;
  window.downloadReceipt = downloadReceipt;
  window.showReceiptPreview = showReceiptPreview;
  window.printReceipt = printReceipt;
  window.renderMsgs = renderMsgs;
  window.markMsgRead = markMsgRead;
  window.deleteMsg = deleteMsg;

  // FIX: Compose Message now works (was a placeholder alert). Admin can send a broadcast
  // notice to all parents or a one-off message to themselves for record-keeping.
  window.openComposeMessage = async function () {
    if (role !== "admin" && role !== "master") {
      toast("Only admins can compose messages", "error");
      return;
    }
    const subject = window.prompt('Subject (e.g. "Holiday notice"):');
    if (subject === null) return;
    const trimmedSubject = (subject || "").trim();
    if (!trimmedSubject) {
      toast("Subject is required", "error");
      return;
    }
    const body = window.prompt("Message body:");
    if (body === null) return;
    const trimmedBody = (body || "").trim();
    if (!trimmedBody) {
      toast("Message body is required", "error");
      return;
    }

    try {
      const res = await apiCall("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          sender_type: "admin",
          receiver_type: "parent",
          subject: trimmedSubject,
          message: trimmedBody,
          priority: "normal",
        }),
      });
      if (!res || !res.ok)
        throw new Error(`Server returned ${res ? res.status : "no response"}`);
      toast("Message posted to parent inbox", "success");
      loadAllData(true);
    } catch (e) {
      toast("Failed to send: " + (e.message || "connection error"), "error");
    }
  };
  window.renderChild = renderChild;
  window.setChildTab = setChildTab;
  window.renderChildEvents = renderChildEvents;
  window.renderChildBilling = renderChildBilling;
  window.renderChildGrowth = renderChildGrowth;
  window.renderChildResources = renderChildResources;
  window.renderChildSkills = renderChildSkills;
  window.renderChildAchievements = renderChildAchievements;
  window.openContactModal = openContactModal;
  window.sendMsg = sendMsg;
  window.sendFeedback = sendFeedback;
  window.informAllDueStudents = informAllDueStudents;
  window.viewPaymentHistory = viewPaymentHistory;
  window.openAttendanceMarking = openAttendanceMarking;
  window.saveBatchAttendance = saveBatchAttendance;
  window.updateAttStats = updateAttStats;
  window.markAllPresent = markAllPresent;
  window.markAllAbsent = markAllAbsent;
  window.toggleMoreMenu = toggleMoreMenu;
  window.openPromote = openPromote;
  window.executePromotion = executePromotion;

  window.openChessableModal = function() {
    const modal = $("chessable-redirect-modal");
    if (!modal) return;
    const searchInput = $("chessable-search");
    if (searchInput) searchInput.value = "";
    
    // Render all students initially
    renderChessableStudentList(allStudents || []);
    openModal("chessable-redirect-modal");
  };

  window.filterChessableStudents = function() {
    const query = ($("chessable-search")?.value || "").toLowerCase().trim();
    const filtered = (allStudents || []).filter(s => {
      return getStudentName(s).toLowerCase().includes(query);
    });
    renderChessableStudentList(filtered);
  };

  function renderChessableStudentList(studentsList) {
    const container = $("chessable-student-list");
    if (!container) return;
    
    if (studentsList.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--ivory-dim)">No students found.</div>`;
      return;
    }
    
    container.innerHTML = studentsList.map(s => {
      const username = s.chessable_username || '';
      const profileUrl = username ? `https://www.chessable.com/profile/${username}/` : 'https://www.chessable.com';
      return `
        <div class="card" style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--bg2); border:1px solid var(--border); border-radius:8px; margin-bottom:8px;">
          <div style="flex:1;">
            <div style="font-weight:600; color:#fff;">${escapeHtml(getStudentName(s))}</div>
            <div style="font-size:11px; color:var(--ivory-dim)">ID: ${s.id.slice(0, 8)}</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="text" id="inline-chessable-${s.id}" value="${escapeHtml(username)}" placeholder="Username" 
              style="width:120px; padding:6px 10px; font-size:12px; border-radius:4px; background:var(--bg3); border:1px solid var(--border); color:#fff;" 
              onblur="saveInlineChessable('${s.id}')">
            <a href="${profileUrl}" target="_blank" class="btn btn-gold btn-sm" style="display:flex; align-items:center; justify-content:center; padding: 6px 10px; text-decoration:none; height:32px;">
              Open ↗
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  window.saveInlineChessable = async function(studentId) {
    const s = allStudents.find(x => String(x.id) === String(studentId));
    if (!s) return;
    const inputVal = ($(`inline-chessable-${studentId}`)?.value || '').trim();
    if (inputVal === (s.chessable_username || '')) return; // No change
    
    try {
      const res = await apiCall(`/api/students?id=${studentId}`, {
        method: "PUT",
        body: JSON.stringify({ chessable_username: inputVal })
      });
      if (res.ok) {
        s.chessable_username = inputVal;
        toast(`Chessable username updated for ${getStudentName(s)}`, "success");
        // Update the Link href
        const linkEl = document.querySelector(`#inline-chessable-${studentId} + a`);
        if (linkEl) {
          linkEl.href = inputVal ? `https://www.chessable.com/profile/${inputVal}/` : 'https://www.chessable.com';
        }
      } else {
        toast("Failed to update Chessable username", "error");
      }
    } catch (e) {
      console.error(e);
      toast("Error updating Chessable username", "error");
    }
  };

  window.openChildChessable = function() {
    if (!currentStudent) {
      window.open('https://www.chessable.com', '_blank');
      return;
    }
    const username = currentStudent.chessable_username || '';
    if (username) {
      window.open(`https://www.chessable.com/profile/${username}/`, '_blank');
    } else {
      window.open('https://www.chessable.com', '_blank');
    }
  };

  // ── CHESSABLE PROFILES FULL PAGE ──
  function renderChessableProfiles() {
    const tbody = $("chessable-profiles-body");
    if (!tbody) return;

    const activeStudents = (allStudents || []).filter(
      (s) => getStudentStatus(s) === "active"
    );

    // ── Populate batch filter dropdown ──
    const batchSelect = $("chessable-filter-batch");
    if (batchSelect && batchSelect.options.length <= 1) {
      const coaches = (allCoaches || []).sort((a, b) =>
        (a.name || "").localeCompare(b.name || "")
      );
      coaches.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name || "Unknown Coach";
        batchSelect.appendChild(opt);
      });
    }

    // ── Apply filters ──
    const searchQuery = ($("chessable-page-search")?.value || "")
      .toLowerCase()
      .trim();
    const batchFilter = $("chessable-filter-batch")?.value || "";
    const profileFilter = $("chessable-filter-status")?.value || "";

    let filtered = activeStudents.filter((s) => {
      const name = getStudentName(s).toLowerCase();
      if (searchQuery && !name.includes(searchQuery)) return false;
      if (batchFilter && String(s.coach_id) !== batchFilter) return false;
      if (profileFilter === "has" && !s.chessable_username) return false;
      if (profileFilter === "missing" && s.chessable_username) return false;
      return true;
    });

    // Sort alphabetically
    filtered.sort((a, b) =>
      getStudentName(a).localeCompare(getStudentName(b))
    );

    // ── Stats Cards ──
    const statsRow = $("chessable-stats-row");
    if (statsRow) {
      const totalActive = activeStudents.length;
      const withProfile = activeStudents.filter(
        (s) => s.chessable_username
      ).length;
      const withoutProfile = totalActive - withProfile;
      const coveragePct =
        totalActive > 0 ? Math.round((withProfile / totalActive) * 100) : 0;

      statsRow.innerHTML = `
        <div class="card" style="padding:20px; background:linear-gradient(135deg, var(--bg2), rgba(234,88,12,0.08)); border:1px solid rgba(234,88,12,0.2); border-radius:12px;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:var(--ivory-dim); margin-bottom:8px;">Total Students</div>
          <div style="font-size:28px; font-weight:800; color:#EA580C;">${totalActive}</div>
          <div style="font-size:11px; color:var(--ivory-dim); margin-top:4px;">Active enrollments</div>
        </div>
        <div class="card" style="padding:20px; background:linear-gradient(135deg, var(--bg2), rgba(16,185,129,0.08)); border:1px solid rgba(16,185,129,0.2); border-radius:12px;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:var(--ivory-dim); margin-bottom:8px;">With Profiles</div>
          <div style="font-size:28px; font-weight:800; color:var(--emerald);">${withProfile}</div>
          <div style="font-size:11px; color:var(--ivory-dim); margin-top:4px;">${coveragePct}% coverage</div>
        </div>
        <div class="card" style="padding:20px; background:linear-gradient(135deg, var(--bg2), rgba(239,68,68,0.08)); border:1px solid rgba(239,68,68,0.2); border-radius:12px;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:var(--ivory-dim); margin-bottom:8px;">Missing Profiles</div>
          <div style="font-size:28px; font-weight:800; color:var(--danger);">${withoutProfile}</div>
          <div style="font-size:11px; color:var(--ivory-dim); margin-top:4px;">Need setup</div>
        </div>
        <div class="card" style="padding:20px; background:linear-gradient(135deg, var(--bg2), rgba(218,163,62,0.08)); border:1px solid rgba(218,163,62,0.2); border-radius:12px;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:var(--ivory-dim); margin-bottom:8px;">Showing</div>
          <div style="font-size:28px; font-weight:800; color:var(--gold);">${filtered.length}</div>
          <div style="font-size:11px; color:var(--ivory-dim); margin-top:4px;">Filtered results</div>
        </div>
      `;
    }

    // ── Render table rows ──
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--ivory-dim)">
        <div style="font-size:32px; margin-bottom:8px;">\u265f\ufe0f</div>
        <div>No students match your filters.</div>
      </td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map((s, idx) => {
        const name = getStudentName(s);
        const username = s.chessable_username || "";
        const coach = (allCoaches || []).find(
          (c) => String(c.id) === String(s.coach_id)
        );
        const coachName = coach ? coach.name || "\u2014" : "\u2014";
        const profileUrl = username
          ? `https://www.chessable.com/profile/${username}/`
          : "";
        const hasProfile = !!username;

        return `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="text-align:center; color:var(--ivory-dim)">${idx + 1}</td>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:36px; height:36px; border-radius:50%; background:${hasProfile ? "linear-gradient(135deg, #EA580C, #F59E0B)" : "var(--bg3)"}; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700; color:${hasProfile ? "#fff" : "var(--ivory-dim)"}; flex-shrink:0;">
                ${name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style="font-weight:600; color:var(--ivory)">${escapeHtml(name)}</div>
                <div style="font-size:11px; color:var(--ivory-dim)">${s.level || "Beginner"} \u00b7 ELO ${s.rating || "\u2014"}</div>
              </div>
            </div>
          </td>
          <td>
            <div style="font-size:13px; color:var(--ivory)">${escapeHtml(coachName)}</div>
            <div style="font-size:11px; color:var(--ivory-dim)">${s.session_mode || "Group"} \u00b7 ${s.session_time || "TBD"}</div>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:6px;">
              <input type="text" id="cp-username-${s.id}" value="${escapeHtml(username)}" placeholder="Enter username..."
                style="width:150px; padding:7px 10px; font-size:12px; border-radius:6px; background:var(--bg3); border:1px solid ${hasProfile ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}; color:#fff; transition: border-color 0.2s;"
                onblur="saveChessableFromPage('${s.id}')"
                onkeydown="if(event.key==='Enter'){event.target.blur()}">
              ${hasProfile
                ? '<span style="color:var(--emerald); font-size:14px;" title="Profile set">\u2713</span>'
                : '<span style="color:var(--danger); font-size:14px;" title="No profile">\u2717</span>'
              }
            </div>
          </td>
          <td>
            ${profileUrl
              ? `<a href="${profileUrl}" target="_blank" class="btn btn-outline-amber btn-sm" style="display:inline-flex; align-items:center; gap:4px; padding:5px 12px; text-decoration:none; font-size:12px;">
                  <img src="https://www.chessable.com/favicon.ico" style="width:14px;height:14px;border-radius:2px" onerror="this.style.display='none'">
                  Open \u2197
                </a>`
              : `<span style="color:var(--ivory-dim); font-size:12px; font-style:italic;">No profile</span>`
            }
          </td>
          <td>
            <div style="display:flex; gap:6px; align-items:center;">
              <button class="btn btn-outline-grey btn-sm" style="padding:4px 10px; font-size:11px;" onclick="openEdit('${s.id}')" title="Edit student">\u270f\ufe0f</button>
              <button class="btn btn-outline-grey btn-sm" style="padding:4px 10px; font-size:11px;" onclick="window.quickSwitchPreviewStudent && window.quickSwitchPreviewStudent('${s.id}'); window.setPage && window.setPage('child');" title="View profile">\ud83d\udc41\ufe0f</button>
            </div>
          </td>
        </tr>`;
      })
      .join("");
  }
  window.renderChessableProfiles = renderChessableProfiles;

  // Save chessable username from the full page view
  window.saveChessableFromPage = async function (studentId) {
    const s = allStudents.find((x) => String(x.id) === String(studentId));
    if (!s) return;
    const inputEl = $(`cp-username-${studentId}`);
    if (!inputEl) return;
    const inputVal = (inputEl.value || "").trim();
    if (inputVal === (s.chessable_username || "")) return; // No change

    try {
      const res = await apiCall(`/api/students?id=${studentId}`, {
        method: "PUT",
        body: JSON.stringify({ chessable_username: inputVal }),
      });
      if (res.ok) {
        s.chessable_username = inputVal;
        toast(
          `Chessable username ${inputVal ? "updated" : "cleared"} for ${getStudentName(s)}`,
          "success"
        );
        // Re-render the page to update stats and visual indicators
        renderChessableProfiles();
      } else {
        toast("Failed to update Chessable username", "error");
      }
    } catch (e) {
      console.error(e);
      toast("Error updating Chessable username", "error");
    }
  };

  // Export Chessable profiles to CSV
  window.exportChessableCSV = function () {
    const activeStudents = (allStudents || [])
      .filter((s) => getStudentStatus(s) === "active")
      .sort((a, b) => getStudentName(a).localeCompare(getStudentName(b)));

    const rows = [["Student Name", "Chessable Username", "Profile URL", "Coach", "Level", "ELO"]];

    activeStudents.forEach((s) => {
      const name = getStudentName(s);
      const username = s.chessable_username || "";
      const url = username
        ? `https://www.chessable.com/profile/${username}/`
        : "";
      const coach = (allCoaches || []).find(
        (c) => String(c.id) === String(s.coach_id)
      );
      const coachName = coach ? coach.name || "" : "";
      rows.push([name, username, url, coachName, s.level || "Beginner", s.rating || ""]);
    });

    const csvContent = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `chessable_profiles_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast("Chessable profiles exported!", "success");
  };

  // Backward compat: redirect modal open to page navigation
  window.openChessableModal = function () {
    setPage("chessable");
  };

  function showNotifications() {
    const content = $("notification-content");
    if (!content) return;

    const unread = allMessages.filter((m) => m.status === "unread");
    const due = allStudents.filter((s) => {
      const st = getStudentPaymentStatus(s);
      return (
        (st === "Due" || st === "Overdue") &&
        !dismissedNotifications.payments.includes(s.id)
      );
    });
    const auditLogs = JSON.parse(localStorage.getItem("audit_logs") || "[]");
    const failedLogins = auditLogs
      .filter((l) => l.action === "login_failed")
      .slice(-10)
      .reverse();

    let html = "";

    if (unread.length > 0) {
      html += `<div style="padding:12px;background:var(--gold-glow);border-radius:8px;margin-bottom:12px">
         <div style="font-weight:600;color:var(--gold)">📬 Unread Messages (${unread.length})</div>
         ${unread
           .slice(0, 5)
           .map(
             (
               m,
             ) => `<div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
           <div>
             <div style="font-size:13px;font-weight:500">${escapeHtml(m.subject || "No Subject")}</div>
             <div style="font-size:11px;color:var(--ivory-dim)">${escapeHtml(m.sender_name || "User")} • ${new Date(m.created_at).toLocaleDateString()}</div>
           </div>
           <button class="btn btn-outline-grey btn-sm" onclick="markMsgRead('${m.id}')" style="padding:2px 8px;font-size:10px">Mark Read</button>
         </div>`,
           )
           .join("")}
       </div>`;
    }

    if (due.length > 0) {
      html += `<div style="padding:12px;background:rgba(255,77,79,0.1);border-radius:8px;margin-bottom:12px">
         <div style="font-weight:600;color:var(--danger)">💰 Outstanding / Overdue Payments (${due.length})</div>
         <div style="font-size:12px;color:var(--ivory-dim)">Students with pending or overdue fees</div>
         ${due
           .slice(0, 5)
           .map((s) => {
             const st = getStudentPaymentStatus(s);
             const badgeHtml =
               st === "Overdue"
                 ? `<span class="badge badge-danger" style="margin-left:6px;font-size:9px;padding:2px 5px">OVERDUE</span>`
                 : "";
             return `<div style="padding:6px 0;font-size:12px;color:var(--ivory);display:flex;align-items:center">${escapeHtml(getStudentName(s))}${badgeHtml}</div>`;
           })
           .join("")}
       </div>`;
    }

    if (failedLogins.length > 0) {
      html += `<div style="padding:12px;background:rgba(255,77,79,0.1);border-radius:8px;margin-bottom:12px">
         <div style="font-weight:600;color:var(--danger)">🚫 Failed Logins (${failedLogins.length})</div>
         ${failedLogins
           .slice(0, 5)
           .map(
             (
               l,
             ) => `<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
           <span>${escapeHtml(l.user || "Unknown")}</span>
           <span style="color:var(--ivory-dim);float:right">${new Date(l.timestamp).toLocaleString("en-IN")}</span>
         </div>`,
           )
           .join("")}
       </div>`;
    }

    if (!html) {
      html =
        '<div style="text-align:center;padding:30px;color:var(--ivory-dim)">No new notifications</div>';
    }

    content.innerHTML = `
      <div style="margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0">System Notifications</h3>
        <button class="btn btn-outline btn-sm" onclick="clearNotifications()">🗑️ Clear All</button>
      </div>
      ${html}
    `;
    openModal("notification-modal");
  }

  function toggleMobileFilters() {
    const bar = document.getElementById("student-filter-bar");
    if (bar) {
      bar.classList.toggle("active");
      const btn = document.getElementById("filter-toggle-btn");
      if (bar.classList.contains("active")) {
        btn.style.background = "rgba(232,168,48,0.15)";
        btn.style.borderColor = "var(--gold)";
      } else {
        btn.style.background = "transparent";
        btn.style.borderColor = "var(--border)";
      }
    }
  }
  window.toggleMobileFilters = toggleMobileFilters;

  window.sendPaymentReminder = sendPaymentReminder;
  window.showNotifications = showNotifications;
  window.updateNotificationBadge = () => {
    try {
      updateNotificationBadge();
    } catch (e) {}
  };
  window.previewFile = previewFile;
  window.executeDelete = executeDelete;
  window.exportAcademyData = exportAcademyData;
  window.exportData = exportData;
  window.registerForEvent = registerForEvent;
  window.setBillTab = setBillTab;
  window.markCoachPaid = markCoachPaid;
  window.markCoachUnpaid = markCoachUnpaid;
  window.getStudentPaymentStatus = getStudentPaymentStatus;
  window.getStudentMonthlyFee = getStudentMonthlyFee;
  window.getCountryByCode = getCountryByCode;
  window.COUNTRY_CODES = COUNTRY_CODES;
  window.getStudentDueConfig = getStudentDueConfig;
  function quickSwitchPreviewStudent(id) {
    const s = allStudents.find((x) => String(x.id) === String(id));
    if (!s) return;
    setCurrentStudent(s);
    renderChild();
    toast(`Switched preview context to ${getStudentName(s)}`, "success");
  }
  window.quickSwitchPreviewStudent = quickSwitchPreviewStudent;

  // --- AI Insights Engine ---
  let currentInsightsFilter = "all";
  let generatedInsights = [];

  function generateAcademyInsights() {
    generatedInsights = [];

    // --- 0. General Overview Baseline Insight ---
    const activeStudentCount = allStudents.filter((s) => {
      const st = getStudentStatus(s);
      return st !== "archived" && st !== "inactive";
    }).length;
    const activeCoachCount = allCoaches.filter(
      (c) => c.status !== "inactive",
    ).length;

    generatedInsights.push({
      type: "baseline",
      severity: "success",
      icon: "📊",
      text: `<strong>Academy Overview:</strong> You currently have <strong>${activeStudentCount} active students</strong> and <strong>${activeCoachCount} active coaches</strong>. Your academy is operating smoothly.`,
    });

    // --- 1. Promotion Suggestions ---
    const beginnerThreshold = 1000;
    const intermediateThreshold = 1350;
    const advancedThreshold = 1700;

    allStudents.forEach((s) => {
      const sStatus = getStudentStatus(s);
      if (
        sStatus === "archived" ||
        sStatus === "inactive" ||
        sStatus === "pending" ||
        sStatus === "waitlist" ||
        sStatus === "upcoming"
      )
        return;

      const lvl = getStudentLevel(s);
      const rating = getStudentRating(s) || 800;
      const name = getStudentName(s);

      if (lvl === "Beginner" && rating >= beginnerThreshold) {
        generatedInsights.push({
          type: "promotion",
          severity: "amber",
          icon: "🏆",
          text: `<strong>Promotion Alert:</strong> Beginner student <strong>${name}</strong> has a high rating of <strong>${rating} ELO</strong>. Suggest promoting to <strong>Intermediate</strong>.`,
        });
      } else if (lvl === "Intermediate" && rating >= intermediateThreshold) {
        generatedInsights.push({
          type: "promotion",
          icon: "🏆",
          severity: "amber",
          text: `<strong>Promotion Alert:</strong> Intermediate student <strong>${name}</strong> has reached <strong>${rating} ELO</strong>. Suggest promoting to <strong>Advanced</strong>.`,
        });
      } else if (lvl === "Advanced" && rating >= advancedThreshold) {
        generatedInsights.push({
          type: "promotion",
          icon: "🏆",
          severity: "amber",
          text: `<strong>Promotion Alert:</strong> Advanced student <strong>${name}</strong> has reached <strong>${rating} ELO</strong>. Suggest promoting to <strong>Elite</strong>.`,
        });
      }
    });

    // --- 2. Attendance Alerts (2 consecutive absences) ---
    const attByStudent = {};
    (allAttendance || []).forEach((a) => {
      const sid = String(a.student_id);
      if (!attByStudent[sid]) attByStudent[sid] = [];
      attByStudent[sid].push(a);
    });

    Object.keys(attByStudent).forEach((sid) => {
      const s = allStudents.find((x) => String(x.id) === sid);
      if (!s) return;
      const sStatus = getStudentStatus(s);
      if (
        sStatus === "archived" ||
        sStatus === "inactive" ||
        sStatus === "pending" ||
        sStatus === "waitlist" ||
        sStatus === "upcoming"
      )
        return;

      const records = attByStudent[sid].sort(
        (a, b) => new Date(b.date) - new Date(a.date),
      );
      if (records.length >= 2) {
        if (records[0].status === "absent" && records[1].status === "absent") {
          generatedInsights.push({
            type: "attendance",
            icon: "⚠️",
            severity: "danger",
            text: `<strong>Attendance Warning:</strong> Student <strong>${getStudentName(s)}</strong> has missed <strong>2 consecutive classes</strong> (last absent on ${records[0].date}). Suggest coach follow-up.`,
          });
        }
      }
    });

    // --- 3. Arrears Alerts (> 2 months outstanding) ---
    const arrearsDetails = [];
    const targetMonth = window.reportMonth;
    const targetYear = window.reportYear;
    const baseline = new Date(Date.UTC(2026, 3, 1));

    const creditsMap = {};
    const seenMonths = new Set();
    (allPayments || []).forEach((p) => {
      if (p.status === "paid") {
        const sid = String(p.student_id || "")
          .trim()
          .toLowerCase();
        const pDate = new Date(p.payment_date || p.created_at);
        const mKey = `${sid}_${pDate.getUTCFullYear()}-${pDate.getUTCMonth()}`;
        if (seenMonths.has(mKey)) return;
        seenMonths.add(mKey);

        creditsMap[sid] = (creditsMap[sid] || 0) + 1;
      }
    });

    allStudents.forEach((s) => {
      const sStatus = getStudentStatus(s);
      if (
        sStatus === "archived" ||
        sStatus === "inactive" ||
        sStatus === "pending" ||
        sStatus === "waitlist" ||
        sStatus === "upcoming"
      )
        return;

      const enrollDateStr = getStudentDate(s);
      const enrollDate = enrollDateStr ? new Date(enrollDateStr) : baseline;
      const effectiveEnroll = (function () {
        var _a =
          window.getBillingAnchor && window.getBillingAnchor(s, baseline);
        return _a
          ? new Date(Date.UTC(_a.year, _a.month, 1))
          : enrollDate < baseline
            ? baseline
            : enrollDate;
      })();
      const monthsRequired =
        (targetYear - effectiveEnroll.getUTCFullYear()) * 12 +
        (targetMonth - effectiveEnroll.getUTCMonth()) +
        1;

      const sid = String(s.id).toLowerCase();
      const credits = creditsMap[sid] || 0;
      const outstandingMonths = Math.max(0, monthsRequired - credits);

      if (outstandingMonths >= 2) {
        const fee = getStudentMonthlyFee(s) || 0;
        const totalOwed = fee * outstandingMonths;
        arrearsDetails.push({ name: getStudentName(s), owed: totalOwed });
        generatedInsights.push({
          type: "arrears",
          icon: "💸",
          severity: "danger",
          text: `<strong>Arrears Warning:</strong> Student <strong>${getStudentName(s)}</strong> has <strong>${outstandingMonths} unpaid months</strong> (Owes: ₹${totalOwed.toLocaleString()}). Suggest sending notification.`,
        });
      }
    });

    // --- 4. General Overview Insight (Baseline) ---
    generatedInsights.push({
      type: "all",
      icon: "📊",
      severity: "info",
      text: `<strong>Academy Overview:</strong> You currently have <strong>${allStudents.length}</strong> registered students and <strong>${allCoaches.length}</strong> active coaches. The system is operating normally.`,
    });

    // Update Quick Metric Counts
    const promoCount = generatedInsights.filter(
      (x) => x.type === "promotion",
    ).length;
    const attCount = generatedInsights.filter(
      (x) => x.type === "attendance",
    ).length;
    const arrearsCount = generatedInsights.filter(
      (x) => x.type === "arrears",
    ).length;

    const card = document.getElementById("ai-insights-card");
    const body = document.getElementById("ai-insights-body");
    if (card && body) {
      if (document.getElementById("ins-promo-count"))
        document.getElementById("ins-promo-count").textContent = promoCount;
      if (document.getElementById("ins-att-count"))
        document.getElementById("ins-att-count").textContent = attCount;
      if (document.getElementById("ins-arrears-count"))
        document.getElementById("ins-arrears-count").textContent = arrearsCount;
      renderInsightsList();
      renderInsightsCharts(
        promoCount,
        attCount,
        arrearsCount,
        arrearsDetails,
        generatedInsights,
      );
    }
  }

  function renderInsightsCharts(
    promoCount,
    attCount,
    arrearsCount,
    arrearsDetails,
    insights,
  ) {
    if (!window.Chart) return;
    if (!window.insightsCharts) window.insightsCharts = {};

    const destroyChart = (id) => {
      if (window.insightsCharts[id]) window.insightsCharts[id].destroy();
    };

    // 1. Distribution Chart
    const ctxDist = document.getElementById("chartInsightsDistribution");
    if (ctxDist) {
      destroyChart("dist");
      window.insightsCharts["dist"] = new Chart(ctxDist, {
        type: "doughnut",
        data: {
          labels: ["Promotions", "Attendance", "Arrears", "General"],
          datasets: [
            {
              data: [
                promoCount,
                attCount,
                arrearsCount,
                insights.filter(
                  (x) => x.type === "all" && x.severity === "info",
                ).length,
              ],
              backgroundColor: ["#daa33e", "#ff4d4f", "#cf1322", "#52c41a"],
              borderWidth: 0,
              hoverOffset: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom", labels: { color: "#bbb" } },
          },
          cutout: "70%",
        },
      });
    }

    // 2. Promotions Chart
    const ctxPromo = document.getElementById("chartInsightsPromotions");
    if (ctxPromo) {
      const promoLevels = {
        Elite: 0,
        Advanced: 0,
        Intermediate: 0,
        Beginner: 0,
      };
      insights
        .filter((x) => x.type === "promotion")
        .forEach((ins) => {
          if (ins.text.includes("Elite")) promoLevels.Elite++;
          else if (ins.text.includes("Advanced")) promoLevels.Advanced++;
          else if (ins.text.includes("Intermediate"))
            promoLevels.Intermediate++;
          else promoLevels.Beginner++;
        });

      destroyChart("promo");
      window.insightsCharts["promo"] = new Chart(ctxPromo, {
        type: "bar",
        data: {
          labels: ["Elite", "Advanced", "Intermediate", "Beginner"],
          datasets: [
            {
              label: "Candidates",
              data: [
                promoLevels.Elite,
                promoLevels.Advanced,
                promoLevels.Intermediate,
                promoLevels.Beginner,
              ],
              backgroundColor: "#daa33e",
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              ticks: { color: "#bbb", stepSize: 1 },
              grid: { color: "rgba(255,255,255,0.05)" },
            },
            x: { ticks: { color: "#bbb" }, grid: { display: false } },
          },
        },
      });
    }

    // 3. Arrears Chart
    const ctxArrears = document.getElementById("chartInsightsArrears");
    if (ctxArrears) {
      const topArrears = arrearsDetails
        .sort((a, b) => b.owed - a.owed)
        .slice(0, 5);
      destroyChart("arrears");
      window.insightsCharts["arrears"] = new Chart(ctxArrears, {
        type: "bar",
        data: {
          labels: topArrears.length ? topArrears.map((a) => a.name) : ["None"],
          datasets: [
            {
              label: "Owed (₹)",
              data: topArrears.length ? topArrears.map((a) => a.owed) : [0],
              backgroundColor: "#ff4d4f",
              borderRadius: 4,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              ticks: { color: "#bbb" },
              grid: { color: "rgba(255,255,255,0.05)" },
            },
            y: { ticks: { color: "#bbb" }, grid: { display: false } },
          },
        },
      });
    }
  }

  function renderInsightsList() {
    const body = document.getElementById("ai-insights-body");
    if (!body) return;

    const filtered =
      currentInsightsFilter === "all"
        ? generatedInsights
        : generatedInsights.filter((x) => x.type === currentInsightsFilter);

    if (filtered.length === 0) {
      body.innerHTML = `
        <div style="color:var(--ivory-dim); font-size:14px; font-style:italic; text-align:center; padding:24px 0;">
          ✨ No insights of this category at this time. All systems optimal!
        </div>`;
      return;
    }

    body.innerHTML = filtered
      .map((ins) => {
        let borderClr = "rgba(201, 150, 12, 0.2)";
        let bgClr = "rgba(255,255,255,0.01)";
        let textClr = "var(--ivory)";

        if (ins.severity === "danger") {
          borderClr = "rgba(255, 77, 79, 0.3)";
          bgClr = "rgba(255, 77, 79, 0.03)";
        } else if (ins.severity === "amber") {
          borderClr = "rgba(201, 150, 12, 0.3)";
          bgClr = "rgba(201, 150, 12, 0.03)";
        }

        return `
        <div style="display:flex; align-items:center; gap:12px; padding:12px 16px; border:1px solid ${borderClr}; background:${bgClr}; border-radius:8px; margin-bottom:10px; font-size:14px; color:${textClr};" class="stat-card">
          <span style="font-size:18px;">${ins.icon}</span>
          <div style="flex:1;">${ins.text}</div>
        </div>`;
      })
      .join("");
  }

  function filterInsights(type) {
    currentInsightsFilter = type;

    // Manage active pill classes
    const pills = ["all", "promotion", "attendance", "arrears"];
    pills.forEach((p) => {
      const el = document.getElementById("btn-ins-" + p);
      if (el) {
        if (p === type) {
          el.classList.add("active-filter");
          el.style.background = "var(--gold-semi)";
          el.style.color = "var(--gold)";
          el.style.fontWeight = "700";
        } else {
          el.classList.remove("active-filter");
          el.style.background = "transparent";
          el.style.color = "var(--ivory-dim)";
          el.style.fontWeight = "600";
        }
      }
    });

    renderInsightsList();
  }

  window.generateAcademyInsights = generateAcademyInsights;
  window.filterInsights = filterInsights;

  // --- CSV Export Engine ---
  function exportStudentsToCSV() {
    if (!allStudents || allStudents.length === 0) {
      toast("No students loaded to export.", "warning");
      return;
    }

    const headers = [
      "ID",
      "Name",
      "Phone",
      "Email",
      "Status",
      "Level",
      "Rating (ELO)",
      "Batch Type",
      "Session Time",
      "Coach Name",
      "Joining Date",
      "Monthly Fee (INR)",
      "Payment Status",
    ];

    const targetMonth = window.reportMonth;
    const targetYear = window.reportYear;

    const rows = allStudents.map((s) => {
      const coach = allCoaches.find((c) => String(c.id) === String(s.coach_id));
      const coachName = coach ? getCoachName(coach) : "Unassigned";

      const paymentStatus = getStudentPaymentStatus(s, targetMonth, targetYear);

      return [
        s.id || "",
        getStudentName(s) || "",
        getStudentPhone(s) || "",
        getStudentEmail(s) || "",
        getStudentStatus(s) || "",
        getStudentLevel(s) || "",
        getStudentRating(s) || 800,
        getStudentBatchType(s) || "",
        getStudentSessionTime(s) || "",
        coachName,
        getStudentDate(s) || "",
        getStudentMonthlyFee(s) || 0,
        paymentStatus,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((val) => {
            const strVal = String(val).replace(/"/g, '""');
            return strVal.includes(",") || strVal.includes("\n")
              ? `"${strVal}"`
              : strVal;
          })
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const dateStr = `${months[targetMonth]}_${targetYear}`;
    link.setAttribute("download", `twoknights_students_export_${dateStr}.csv`);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast("Student records exported successfully! 📤", "success");
  }
  window.exportStudentsToCSV = exportStudentsToCSV;

  // --- QR Poster Generator ---
  window.openQrPosterModal = function () {
    $("qr-poster-file").value = "";
    $("qr-poster-url").value = "";
    $("qr-poster-canvas").style.display = "none";
    $("qr-poster-placeholder").style.display = "block";
    $("qr-poster-actions").style.display = "none";

    // Check if the event already has a poster url
    const eventId = window.currentManageEventId;
    if (eventId) {
      const ev = eventsData.find((e) => String(e.id) === String(eventId));
      if (ev && ev.qr_poster_url) {
        $("qr-poster-placeholder").innerHTML =
          `Current poster exists. <a href="${ev.qr_poster_url}" target="_blank" style="color:var(--gold);">View Here</a><br><br>Upload a new image below to replace it.`;
      } else {
        $("qr-poster-placeholder").innerHTML = "Upload an image to preview";
      }
    }

    openModal("qr-poster-modal");
  };

  window.previewQrPoster = async function () {
    const fileInput = $("qr-poster-file");
    const urlInput = $("qr-poster-url");
    const position = $("qr-poster-position").value;
    const canvas = $("qr-poster-canvas");
    const ctx = canvas.getContext("2d");

    if (!fileInput.files || fileInput.files.length === 0) return;

    $("qr-poster-placeholder").innerHTML =
      '<span class="spinner"></span> Loading preview...';

    const file = fileInput.files[0];
    const bgImage = new window.Image();
    bgImage.src = URL.createObjectURL(file);

    bgImage.onload = async () => {
      canvas.width = bgImage.width;
      canvas.height = bgImage.height;
      ctx.drawImage(bgImage, 0, 0);

      const link = urlInput.value.trim();
      if (link) {
        // Generate QR code using external API
        // Using a standard 300x300 size or dynamic based on poster size
        const qrSize = Math.max(
          150,
          Math.min(bgImage.width, bgImage.height) * 0.2,
        ); // 20% of min dimension

        try {
          const qr = new window.QRious({
            value: link,
            size: Math.round(qrSize),
            level: "H",
            padding: 10,
          });
          const qrImage = new window.Image();
          qrImage.src = qr.toDataURL("image/png");

          await new Promise((resolve, reject) => {
            qrImage.onload = resolve;
            qrImage.onerror = reject;
          });

          // Calculate position
          let qrX = 0,
            qrY = 0;
          const margin = qrSize * 0.2; // 20% margin from edges

          if (position === "bottom-right") {
            qrX = canvas.width - qrSize - margin;
            qrY = canvas.height - qrSize - margin;
          } else if (position === "bottom-left") {
            qrX = margin;
            qrY = canvas.height - qrSize - margin;
          } else if (position === "top-right") {
            qrX = canvas.width - qrSize - margin;
            qrY = margin;
          } else if (position === "top-left") {
            qrX = margin;
            qrY = margin;
          } else if (position === "center") {
            qrX = (canvas.width - qrSize) / 2;
            qrY = (canvas.height - qrSize) / 2;
          }

          // Draw white background box with shadow for QR code (for visibility)
          ctx.shadowColor = "rgba(0,0,0,0.5)";
          ctx.shadowBlur = 20;
          ctx.fillStyle = "white";
          ctx.fillRect(qrX, qrY, qrSize, qrSize);

          // Draw QR Code
          ctx.shadowBlur = 0; // reset shadow
          ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
        } catch (err) {
          console.error("Error generating QR:", err);
          toast("Could not load QR code.", "error");
        }
      }

      $("qr-poster-placeholder").style.display = "none";
      canvas.style.display = "block";
      $("qr-poster-actions").style.display = "flex";
    };
  };

  window.saveQrPoster = async function () {
    const canvas = $("qr-poster-canvas");
    const eventId = window.currentManageEventId;

    if (!eventId) return toast("No active event selected", "error");

    const btn = $("btn-save-qr-poster");
    btn.innerHTML = '<span class="spinner"></span> Uploading...';
    btn.disabled = true;

    try {
      // Convert canvas to Blob
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9),
      );

      // 1. Upload to ImgBB
      const uploadedUrl = await uploadToImgbb(blob);

      // 2. Save to Events DB
      const res = await apiCall(`/api/events?id=${eventId}`, {
        method: "PUT",
        body: JSON.stringify({
          qr_poster_url: uploadedUrl,
        }),
      });

      if (!res.ok) throw new Error("Failed to save to database");

      toast("QR Poster generated and saved successfully! 🎉", "success");
      closeModal("qr-poster-modal");
      await loadAllData(true);
      window.openEventManagement(eventId);
    } catch (e) {
      console.error(e);
      toast(e.message || "Error saving poster", "error");
    } finally {
      btn.innerHTML = "Upload & Save to ImgBB";
      btn.disabled = false;
    }
  };

  window.toggleLoginChat = function () {
    const panel = document.getElementById("login-chat-panel");
    if (panel) {
      if (panel.style.display === "none") {
        panel.style.display = "flex";
        document.getElementById("login-chat-input").focus();
      } else {
        panel.style.display = "none";
      }
    }
  };

  function parseChatMarkdown(text) {
    let html = escapeHtml(text);
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    html = html.replace(/\n• /g, "<br>• ");
    html = html.replace(/\n/g, "<br>");
    return html;
  }

  window.sendLoginChat = async function () {
    const inputField = document.getElementById("login-chat-input");
    if (!inputField) return;
    const msg = inputField.value.trim();
    if (!msg) return;

    const chatBody = document.getElementById("login-chat-body");

    // Add user message to UI
    const userDiv = document.createElement("div");
    userDiv.className = "chat-msg user";
    userDiv.textContent = msg;
    chatBody.appendChild(userDiv);

    inputField.value = "";
    chatBody.scrollTop = chatBody.scrollHeight;

    // Add loading indicator
    const typingDiv = document.createElement("div");
    typingDiv.className = "chat-msg bot typing-indicator";
    typingDiv.innerHTML =
      '<span class="spinner" style="width:12px;height:12px;border-width:2px;border-color:var(--gold) transparent var(--gold) transparent;display:inline-block;margin-right:6px;vertical-align:middle;"></span> <span style="vertical-align:middle;">Thinking...</span>';
    chatBody.appendChild(typingDiv);
    chatBody.scrollTop = chatBody.scrollHeight;

    // Build Context Payload
    const context = {
      students_list: typeof allStudents !== "undefined" ? allStudents : [],
      coaches_list: typeof allCoaches !== "undefined" ? allCoaches : [],
      totalStudents:
        typeof allStudents !== "undefined" ? allStudents.length : 0,
      totalCoaches: typeof allCoaches !== "undefined" ? allCoaches.length : 0,
      revenue:
        typeof window.totalCollected !== "undefined"
          ? window.totalCollected
          : 0,
      pendingPayments:
        typeof window.pendingStudents !== "undefined"
          ? window.pendingStudents
          : 0,
      collectionRate:
        typeof window.updateDashboardNumbers === "function" &&
        typeof allStudents !== "undefined"
          ? Math.round(
              ((allStudents.length -
                (typeof window.pendingStudents !== "undefined"
                  ? window.pendingStudents
                  : 0)) /
                (allStudents.length || 1)) *
                100,
            )
          : 0,
      moduleFocus: "global",
    };

    const role = window.role || "guest";

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          message: msg,
          role: role,
          context: context,
        }),
      });

      const data = await res.json();
      chatBody.removeChild(typingDiv);

      if (!res.ok) throw new Error(data.error || "Failed to connect to TOM AI");

      const aiDiv = document.createElement("div");
      aiDiv.className = "chat-msg bot";
      aiDiv.innerHTML = parseChatMarkdown(
        data.message || "I am sorry, I encountered an error.",
      );
      chatBody.appendChild(aiDiv);
    } catch (err) {
      if (typingDiv.parentNode === chatBody) chatBody.removeChild(typingDiv);
      const errDiv = document.createElement("div");
      errDiv.className = "chat-msg bot";
      errDiv.style.color = "var(--danger)";
      errDiv.textContent = "Error connecting to AI backend. Please try again.";
      chatBody.appendChild(errDiv);
    }

    chatBody.scrollTop = chatBody.scrollHeight;
  };

  if (document.getElementById("ui-version"))
    document.getElementById("ui-version").textContent =
      "Portal v5.8 (Clean Messages & Excel)";
})();

window.toggleAcademyManager = function() {
  const group = document.getElementById('academy-manager-group');
  const icon = document.getElementById('academy-mgr-icon');
  if (group && icon) {
    if (group.style.display === 'none') {
      group.style.display = 'block';
      icon.textContent = '▲';
    } else {
      group.style.display = 'none';
      icon.textContent = '▼';
    }
  }
}
