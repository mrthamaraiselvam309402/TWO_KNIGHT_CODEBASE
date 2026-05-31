// Supabase configuration – read from environment (set on Vercel/Netlify)
window.SUPABASE_URL = 'https://vseombfkrvpffnpgbsnk.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8';

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

document.addEventListener('DOMContentLoaded', initSupabase);