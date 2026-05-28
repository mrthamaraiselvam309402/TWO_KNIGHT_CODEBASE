import fs from 'fs';
import path from 'path';
import iconv from 'iconv-lite';

const rawFound = [
  'âäàå', 'âäàą', 'âäůć', 'âăäĺ', 'âãäå', 'âمنه', 'âăäå', 'âäãå', 'âä΄¨', 'â\x98\x83ð',
  'â\x9DŒ', 'â\x8F°', 'â‚½', 'â‚©', 'â‚±', 'â‚«', 'â‚¦', 'â‚º', 'â‚ª', 'â€¦', 
  'ðŸ‘¥', 'ðŸ’¸', 'ðŸ†•', 'ðŸ“¬', 'ðŸŽ“', 'ðŸ›¡ï¸', 'ðŸ“¥', 'ðŸ—“ï¸', 'ðŸ”„', 'ðŸ¤–', 
  'â—\x8F', 'âš ï', 'ðŸ”\x81', 'â\x8F³', 'â‹®', 'ðŸ‘¨â€', 'ðŸ\x8F«', 'ðŸ‘\x81ï¸', 'âœ\x8Fï', 
  'ðŸ“\x8D', 'âœ“', 'ðŸ\x8F†', 'ðŸŒŸ', 'ðŸ‘‘âœ', 'âš¡', 'ðŸ§‘â€', 'ðŸ‘¶', 'â†‘', 'â†“', 
  'ðŸŒ¤ï¸', 'ðŸ”Œ', 'ðŸ“¡', 'ðŸ‘¤', 'ðŸš«', 'âœ¨', 'ðŸ\x8F†ðŸ'
];

const replacements = {};

rawFound.forEach(garbled => {
    // encode to win1252, decode as utf8
    try {
        const decoded = iconv.decode(iconv.encode(garbled, 'win1252'), 'utf8');
        // if it doesn't contain the replacement character '?'
        if (!decoded.includes('') && garbled !== decoded) {
            replacements[garbled] = decoded;
        }
    } catch (e) {
        // ignore
    }
});

// Hardcode some known ones that might not reverse perfectly due to control chars
replacements['â\x9DŒ'] = '❌';
replacements['â\x8F°'] = '⏰';
replacements['ðŸ›¡ï¸'] = '🛡️';
replacements['ðŸ—“ï¸'] = '🗓️';
replacements['âš ï'] = '⚠️';
replacements['ðŸ”\x81'] = '🔄'; // maybe? let's see
replacements['â\x8F³'] = '⏳';
replacements['ðŸ‘¨â€'] = '👨‍';
replacements['ðŸ\x8F«'] = '🏫';
replacements['ðŸ‘\x81ï¸'] = '👁️';
replacements['âœ\x8Fï'] = '✏️';
replacements['ðŸ“\x8D'] = '📍';
replacements['âœ“'] = '✓';
replacements['ðŸ\x8F†'] = '🏆';
replacements['ðŸŒŸ'] = '🌟';
replacements['ðŸ‘‘âœ'] = '👑✓'; // ?
replacements['âš¡'] = '⚡';
replacements['ðŸ§‘â€'] = '🧑‍';
replacements['ðŸ‘¶'] = '🧒';
replacements['â†‘'] = '↑';
replacements['â†“'] = '↓';
replacements['ðŸŒ¤ï¸'] = '🌤️';
replacements['ðŸ”Œ'] = '🔌';
replacements['ðŸ“¡'] = '📡';
replacements['ðŸ‘¤'] = '👤';
replacements['ðŸš«'] = '🚫';
replacements['âœ¨'] = '✨';
replacements['ðŸ“¥'] = '📥';
replacements['ðŸ”„'] = '🔄';
replacements['ðŸ¤–'] = '🤖';
replacements['â—\x8F'] = '●';
replacements['â‹®'] = '⋮';
replacements['ðŸ‘¥'] = '👥';
replacements['ðŸ’¸'] = '💸';
replacements['ðŸ†•'] = '🆕';
replacements['ðŸ“¬'] = '📬';
replacements['ðŸŽ“'] = '🎓';
replacements['â‚½'] = '₽';
replacements['â‚©'] = '₩';
replacements['â‚±'] = '₱';
replacements['â‚«'] = '₫';
replacements['â‚¦'] = '₦';
replacements['â‚º'] = '₺';
replacements['â‚ª'] = '₪';
replacements['â€¦'] = '…';

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

let totalReplaced = 0;

files.forEach(f => {
  if (f.endsWith('.js') || f.endsWith('.html') || f.endsWith('.css')) {
    let content = fs.readFileSync(f, 'utf8');
    let replacedCount = 0;
    
    for (const [garbled, correct] of Object.entries(replacements)) {
      if (garbled === correct) continue;
      
      const escapedGarbled = garbled.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedGarbled, 'g');
      
      const matches = content.match(regex);
      if (matches) {
        replacedCount += matches.length;
        content = content.replace(regex, correct);
      }
    }
    
    if (f.endsWith('.html')) {
        const oldVersion = '20260528';
        const newVersion = '20260529'; // Bump cache buster again!
        if (content.includes(oldVersion)) {
            content = content.replace(new RegExp(oldVersion, 'g'), newVersion);
            replacedCount++;
        }
    }

    if (replacedCount > 0) {
      fs.writeFileSync(f, content, 'utf8');
      console.log(`Replaced ${replacedCount} occurrences in ${f}`);
      totalReplaced += replacedCount;
    }
  }
});

console.log(`Total replaced: ${totalReplaced}`);
