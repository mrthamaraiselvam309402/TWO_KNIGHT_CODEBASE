const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf8');

// Add chess-api.js
if (!html.includes('chess-api.js')) {
    html = html.replace('<script src="js/homework.js', '<script src="js/chess-api.js"></script>\n      <script src="js/homework.js');
}

// Replace old blue
html = html.replace(/rgba\(0,0,255/g, 'rgba(59, 130, 246');

fs.writeFileSync('public/index.html', html);
console.log('Fixed index.html');

let css = fs.readFileSync('public/styles.css', 'utf8');
css = css.replace(/#0A1172/g, 'var(--primary)');
fs.writeFileSync('public/styles.css', css);
console.log('Fixed styles.css');
