// Supabase configuration – read from environment (set on Vercel/Netlify)
window.SUPABASE_URL = 'https://zznbanjdkwofsvpzybtr.supabase.co';
// Note: Real Supabase anon keys start with "sb-publishable-" or "sb-secret-"
// For development, we use a permissive validation that accepts any JWT starting with "eyJ"
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6bmJhbmpka3dvZnN2cHp5YnRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMDQ5MDEsImV4cCI6MjA5NzY4MDkwMX0.UgT3l4EWhKpsiRXzBSg9NWMXY00iqPk_Q3d-LtNfTXQ';

// Check if key is expired and warn (but allow app to continue)
const keyExpired = (() => {
  try {
    const payload = window.SUPABASE_ANON_KEY.split('.')[1];
    if (payload) {
      const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return json.exp && json.exp < Date.now() / 1000;
    }
  } catch (e) {}
  return false;
})();
if (keyExpired && window.location.hostname !== 'localhost') {
  console.warn('[Config] Supabase anon key may be expired. API calls may fail.');
}

let supabaseClient = null;

function initSupabase() {
  if (window.supabaseClient) return window.supabaseClient;
  
  if (window.supabase) {
    window.supabaseClient = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );
    console.log('Supabase initialized');
    return window.supabaseClient;
  }
  return null;
}

function SB() {
  return initSupabase();
}

// ─── Graceful "missing table" detection & per-session guard ──────────────
// Optional sync tables (productivity_tasks, scheduled_meetings, productivity_notes,
// tournaments) may not exist on every deployment. When they're absent PostgREST
// returns a 404 (code PGRST205 / 42P01). We cache that per session so we don't
// re-fire the same failing request on every page visit, and callers fall back
// to LocalStorage / bundled data instead.
window.__sbMissingTables = window.__sbMissingTables || {};

window.sbIsTableMissing = function (error) {
  if (!error) return false;
  const code = error.code || '';
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202') return true;
  const msg = (error.message || error.details || '').toLowerCase();
  return msg.includes('does not exist') ||
         msg.includes('could not find the table') ||
         msg.includes('not find the table') ||
         msg.includes('schema cache');
};

// Returns true if a table has already been detected as missing this session.
window.sbTableKnownMissing = function (table) {
  return !!window.__sbMissingTables[table];
};

// Marks a table as missing for the rest of the session.
window.sbMarkTableMissing = function (table) {
  window.__sbMissingTables[table] = true;
};

// ─── Configurable fee-collection payee (used in all reminder messages) ───────
// Stored in localStorage so the admin can change the UPI/phone + name without a
// code change. Defaults preserve the previous hard-coded value.
window.getPaymentPayee = function () {
  try {
    const saved = JSON.parse(localStorage.getItem('twoknights_payment_payee') || 'null');
    if (saved && saved.number) {
      return { number: String(saved.number), name: String(saved.name || '') };
    }
  } catch (e) {}
  return { number: '9025846663', name: 'Ranjith' };
};

window.setPaymentPayee = function (number, name) {
  localStorage.setItem('twoknights_payment_payee', JSON.stringify({
    number: String(number || '').trim(),
    name: String(name || '').trim()
  }));
};

// Convenience string: "9025846663 (Ranjith)" or just the number if no name.
window.getPaymentPayeeText = function () {
  const p = window.getPaymentPayee();
  return p.name ? `${p.number} (${p.name})` : p.number;
};

document.addEventListener('DOMContentLoaded', initSupabase);