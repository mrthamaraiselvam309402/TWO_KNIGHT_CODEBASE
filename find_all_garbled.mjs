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
const found = new Set();
const fileMatches = {};

// Regex for typical mojibake of 3-byte and 4-byte UTF-8 sequences interpreted as Windows-1252.
// 'â' is 0xE2 (common for 3-byte characters like currency symbols, some emojis)
// 'ð' is 0xF0 (common for 4-byte emojis)
const badRegex = /(â.{1,3}|ðŸ.{1,4})/g;

files.forEach(f => {
  if (f.endsWith('.js') || f.endsWith('.html') || f.endsWith('.css')) {
    const content = fs.readFileSync(f, 'utf8');
    const matches = content.match(badRegex);
    if (matches) {
      matches.forEach(m => {
        found.add(m);
        if (!fileMatches[f]) fileMatches[f] = new Set();
        fileMatches[f].add(m);
      });
    }
  }
});

console.log('Unique Garbled Strings Found:');
found.forEach(str => {
    // Also output hex so we know exactly what bytes we are dealing with
    console.log(`String: ${str} | Hex: ${Buffer.from(str, 'utf8').toString('hex')}`);
});
console.log('\nFiles containing garbled strings:');
Object.keys(fileMatches).forEach(f => {
    console.log(`- ${f}:`, Array.from(fileMatches[f]));
});
