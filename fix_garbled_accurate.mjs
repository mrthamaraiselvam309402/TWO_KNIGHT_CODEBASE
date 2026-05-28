import fs from 'fs';
import path from 'path';
import iconv from 'iconv-lite';

function getCorruptString(correctStr) {
  // Convert correct string to utf-8 bytes
  const buf = Buffer.from(correctStr, 'utf8');
  // Decode those bytes as windows-1252 to get the corrupt string
  return iconv.decode(buf, 'win1252');
}

const symbols = [
  '₹', '🗑️', '•', '💳💸', '💰', '❌', '═', '─', 'ℹ️', '⏰', '✅', '—', '–', '€',
  '📈', '📉', '📊', '💼', '🧑‍🏫', '💡', '👨‍🎓', '🚀', '📅', '💳', '📄', '🖨️', '📋',
  '💬', '🎉', '📢', '📤', 'ðŸ“¢', 'ðŸ–¨ï¸',
  '🇮🇳', '🇺🇸', '🇬🇧', '🇨🇦', '🇦🇺', '🇩🇪', '🇫🇷', '🇯🇵', '🇨🇳', '🇧🇷', '🇲🇽', '🇮🇹', '🇪🇸',
  '🇷🇺', '🇰🇷', '🇸🇬', '🇲🇾', '🇹🇭', '🇮🇩', '🇵🇭', '🇻🇳', '🇦🇪', '🇸🇦', '🇵🇰', '🇧🇩', '🇱🇰',
  '🇿🇦', '🇳🇬', '🇪🇬', '🇳🇱', '🇧🇪', '🇸🇪', '🇳🇴', '🇩🇰', '🇫🇮', '🇵🇱', '🇹🇷', '🇮🇱', '🇦🇷',
  '🇨🇱', '🇨🇴', '🇳🇿', '🇹🇼', '⏱️', '🥇', '🥈', '🥉'
];

const replacements = {};
symbols.forEach(sym => {
  replacements[getCorruptString(sym)] = sym;
});

// Add specific strings the user pasted that might have been double corrupted
replacements['â‚¹'] = '₹';
replacements['ðŸ—‘ï¸'] = '🗑️';
replacements['ðŸ“¢'] = '📢'; // 📢 is megaphone
replacements['ðŸ–¨ï¸'] = '🖨️';

function walk(dir) {
  let files = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const p = path.join(dir, item);
    if (fs.statSync(p).isDirectory()) {
      files = files.concat(walk(p));
    } else {
      files.push(p);
    }
  }
  return files;
}

const files = walk('public');

files.forEach(f => {
  if (f.endsWith('.js') || f.endsWith('.html') || f.endsWith('.css')) {
    let content = fs.readFileSync(f, 'utf8');
    let replacedCount = 0;
    
    for (const [garbled, correct] of Object.entries(replacements)) {
      if (garbled === correct) continue;
      
      // Escape for regex
      const escapedGarbled = garbled.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedGarbled, 'g');
      
      const matches = content.match(regex);
      if (matches) {
        replacedCount += matches.length;
        content = content.replace(regex, correct);
      }
    }
    
    // Also, update cache buster in HTML files
    if (f.endsWith('.html')) {
        const oldVersion = '20260527';
        const newVersion = '20260528';
        if (content.includes(oldVersion)) {
            content = content.replace(new RegExp(oldVersion, 'g'), newVersion);
            replacedCount++;
            console.log(`Updated cache buster in ${f}`);
        }
    }
    
    if (replacedCount > 0) {
      fs.writeFileSync(f, content, 'utf8');
      console.log(`Replaced ${replacedCount} occurrences in ${f}`);
    }
  }
});
