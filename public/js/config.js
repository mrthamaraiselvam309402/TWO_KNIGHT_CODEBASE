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

document.addEventListener('DOMContentLoaded', initSupabase);