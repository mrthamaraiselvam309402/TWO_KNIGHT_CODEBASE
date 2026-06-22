/**
 * Build script for Chesskidoo Academy
 * Injects environment variables into HTML for Vercel deployment
 */

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(__dirname, '..', 'public', 'index.html');

// Read the HTML file
let html = fs.readFileSync(HTML_PATH, 'utf8');

// Get environment variables (Vercel injects these at build time)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://zznbanjdkwofsvpzybtr.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6bmJhbmpka3dvZnN2cHp5YnRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMDQ5MDEsImV4cCI6MjA5NzY4MDkwMX0.UgT3l4EWhKpsiRXzBSg9NWMXY00iqPk_Q3d-LtNfTXQ';

// Replace placeholders in HTML
html = html.replace(/%VITE_SUPABASE_URL%/g, SUPABASE_URL);
html = html.replace(/%VITE_SUPABASE_ANON_KEY%/g, SUPABASE_ANON_KEY);

// Write the updated HTML
fs.writeFileSync(HTML_PATH, html, 'utf8');

console.log('✓ Build complete - environment variables injected');
console.log('  SUPABASE_URL:', SUPABASE_URL);
console.log('  SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY.substring(0, 20) + '...');
