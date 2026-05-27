import fs from 'fs';

let html = fs.readFileSync('public/index.html', 'utf-8');

// Replace standard flex containers that lack wrap
// Example: style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"
html = html.replace(/style="([^"]*display:\s*flex[^"]*justify-content:\s*space-between[^"]*)"/g, (match, p1) => {
    if (p1.includes('flex-wrap') || p1.includes('flex-direction: column')) return match;
    let newStyle = p1.trim();
    if (!newStyle.endsWith(';')) newStyle += ';';
    return `style="${newStyle} flex-wrap: wrap; gap: 15px;"`;
});

fs.writeFileSync('public/index.html', html, 'utf-8');
console.log("Successfully added flex-wrap to space-between containers.");
