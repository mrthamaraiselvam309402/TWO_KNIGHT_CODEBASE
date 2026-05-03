// Supabase configuration – read from environment (set on Vercel/Netlify)
window.SUPABASE_URL = 'https://vseombfkrvpffnpgbsnk.supabase.co';  // Update after key rotation
window.SUPABASE_ANON_KEY = 'YOUR_NEW_ANON_KEY_HERE';  // Replace after rotation

let supabaseClient = null;

function initSupabase() {
  if (!supabaseClient && window.supabase) {
    supabaseClient = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );
    console.log('Supabase initialized');
  }
  return supabaseClient;
}

function SB() {
  return initSupabase();
}

document.addEventListener('DOMContentLoaded', initSupabase);