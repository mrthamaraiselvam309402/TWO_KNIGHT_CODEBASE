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
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vseombfkrvpffnpgbsnk.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8';

// Replace the APP_CONFIG section - match from comment line
const lines = html.split('\n');
let inConfig = false;
let startIdx = -1;
let endIdx = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('<!-- App Configuration')) {
    // Find the next <script> tag
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].includes('<script>') && lines[j].includes('window.APP_CONFIG')) {
        startIdx = j;
        // Find closing </script>
        for (let k = j; k < lines.length; k++) {
          if (lines[k].includes('</script>')) {
            endIdx = k;
            break;
          }
        }
        break;
      }
    }
    break;
  }
}

if (startIdx !== -1 && endIdx !== -1) {
  const indent = lines[startIdx].match(/^(\s*)/)[1];
  const configScript = `${indent}<script>
${indent}  window.APP_CONFIG = {
${indent}    SUPABASE_URL: '${SUPABASE_URL}',
${indent}    SUPABASE_ANON_KEY: '${SUPABASE_ANON_KEY}'
${indent}  };
${indent}</script>`;
  
  lines.splice(startIdx, endIdx - startIdx + 1, configScript);
  html = lines.join('\n');
}

// Write the updated HTML
fs.writeFileSync(HTML_PATH, html, 'utf8');

console.log('✓ Build complete - environment variables injected');
console.log('  SUPABASE_URL:', SUPABASE_URL);
console.log('  SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY.substring(0, 20) + '...');
