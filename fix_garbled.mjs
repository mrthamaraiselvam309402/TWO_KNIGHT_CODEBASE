import fs from 'fs';
import path from 'path';

const files = [
  'public/index.html',
  'public/receipt.html',
  'public/salary_receipt.html',
  'public/styles.css',
  'public/scripts.js'
];

const replacements = {
  'â‚¹': '₹',
  'ðŸ—‘ï¸': '🗑️',
  'â€¢': '•',
  'ðŸ’³ðŸ’¸': '💳💸',
  'ðŸ’°': '💰',
  'â Œ': '❌',
  'â•': '═',
  'â”€': '─',
  'â„¹ï¸': 'ℹ️',
  'â °': '⏰',
  'âœ…': '✅',
  'â€”': '—',
  'â€“': '–',
  'â‚¬': '€',
  'ðŸ“ˆ': '📈',
  'ðŸ“‰': '📉',
  'ðŸ“Š': '📊',
  'ðŸ’¼': '💼',
  'ðŸ§‘â€🏫': '🧑‍🏫',
  'ðŸ’¡': '💡',
  'ðŸ‘¨â€🎓': '👨‍🎓',
  'ðŸš€': '🚀',
  'ðŸ“…': '📅',
  'ðŸ’³': '💳',
  'ðŸ“„': '📄',
  'ðŸ–¨ï¸': '🖨️',
  'ðŸ“‹': '📋',
  'ðŸ’¬': '💬',
  'ðŸŽ‰': '🎉',
  'ðŸ‡®ðŸ‡³': '🇮🇳',
  'ðŸ‡ºðŸ‡¸': '🇺🇸',
  'ðŸ‡¬ðŸ‡§': '🇬🇧',
  'ðŸ‡¨ðŸ‡¦': '🇨🇦',
  'ðŸ‡¦ðŸ‡º': '🇦🇺',
  'ðŸ‡©ðŸ‡ª': '🇩🇪',
  'ðŸ‡«ðŸ‡·': '🇫🇷',
  'ðŸ‡¯ðŸ‡µ': '🇯🇵',
  'ðŸ‡¨ðŸ‡³': '🇨🇳',
  'ðŸ‡§ðŸ‡·': '🇧🇷',
  'ðŸ‡²ðŸ‡½': '🇲🇽',
  'ðŸ‡®ðŸ‡¹': '🇮🇹',
  'ðŸ‡ªðŸ‡¸': '🇪🇸',
  'ðŸ‡·ðŸ‡º': '🇷🇺',
  'ðŸ‡°ðŸ‡·': '🇰🇷',
  'ðŸ‡¸ðŸ‡¬': '🇸🇬',
  'ðŸ‡²ðŸ‡¾': '🇲🇾',
  'ðŸ‡¹ðŸ‡­': '🇹🇭',
  'ðŸ‡®ðŸ‡©': '🇮🇩',
  'ðŸ‡µðŸ‡­': '🇵🇭',
  'ðŸ‡»ðŸ‡³': '🇻🇳',
  'ðŸ‡¦ðŸ‡ª': '🇦🇪',
  'ðŸ‡¸ðŸ‡¦': '🇸🇦',
  'ðŸ‡µðŸ‡°': '🇵🇰',
  'ðŸ‡§ðŸ‡©': '🇧🇩',
  'ðŸ‡±ðŸ‡°': '🇱🇰',
  'ðŸ‡¿ðŸ‡¦': '🇿🇦',
  'ðŸ‡³ðŸ‡¬': '🇳🇬',
  'ðŸ‡ªðŸ‡¬': '🇪🇬',
  'ðŸ‡³ðŸ‡±': '🇳🇱',
  'ðŸ‡§ðŸ‡ª': '🇧🇪',
  'ðŸ‡¸ðŸ‡ª': '🇸🇪',
  'ðŸ‡³ðŸ‡': '🇳🇴',
  'ðŸ‡©ðŸ‡°': '🇩🇰',
  'ðŸ‡«ðŸ‡®': '🇫🇮',
  'ðŸ‡µðŸ‡±': '🇵🇱',
  'ðŸ‡¹ðŸ‡·': '🇹🇷',
  'ðŸ‡®ðŸ‡±': '🇮🇱',
  'ðŸ‡¦ðŸ‡·': '🇦🇷',
  'ðŸ‡¨ðŸ‡±': '🇨🇱',
  'ðŸ‡¨ðŸ‡´': '🇨🇴',
  'ðŸ‡³ðŸ‡¿': '🇳🇿',
  'ðŸ‡¹ðŸ‡¼': '🇹🇼'
};

for (const filePath of files) {
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let replacedCount = 0;

  for (const [garbled, correct] of Object.entries(replacements)) {
    // Escape string for regex
    const escapedGarbled = garbled.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedGarbled, 'g');
    const matches = content.match(regex);
    if (matches) {
      replacedCount += matches.length;
      content = content.replace(regex, correct);
    }
  }

  if (replacedCount > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Replaced ${replacedCount} occurrences in ${filePath}`);
  }
}
