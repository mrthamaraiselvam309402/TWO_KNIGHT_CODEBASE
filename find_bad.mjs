import fs from 'fs';
import path from 'path';

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
const badFiles = [];

files.forEach(f => {
  if (f.endsWith('.js') || f.endsWith('.html') || f.endsWith('.css')) {
    const content = fs.readFileSync(f, 'utf8');
    if (content.includes('â‚¹') || content.includes('ðŸ“¢') || content.includes('â')) {
      badFiles.push(f);
    }
  }
});

console.log('Bad files:', badFiles);
