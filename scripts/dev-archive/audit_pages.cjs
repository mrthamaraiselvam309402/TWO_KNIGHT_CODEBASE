const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('public/index.html', 'utf8');
const lines = html.split('\n');

// 1. Find all page divs and their content size
const pageRegex = /id="page-([^"]+)"/;
const pages = [];
let currentPage = null;
let startLine = 0;

lines.forEach((line, i) => {
  const m = line.match(pageRegex);
  if (m) {
    if (currentPage) {
      currentPage.endLine = i;
      currentPage.lineCount = i - currentPage.startLine;
      // Check if content is mostly empty (just whitespace and closing divs)
      const content = lines.slice(currentPage.startLine, i).join('\n');
      const stripped = content.replace(/<[^>]*>/g, '').replace(/\s+/g, '').trim();
      currentPage.contentChars = stripped.length;
      pages.push(currentPage);
    }
    currentPage = { id: m[1], startLine: i + 1, endLine: 0, lineCount: 0, contentChars: 0 };
  }
});
if (currentPage) {
  currentPage.endLine = lines.length;
  currentPage.lineCount = lines.length - currentPage.startLine;
  const content = lines.slice(currentPage.startLine, lines.length).join('\n');
  const stripped = content.replace(/<[^>]*>/g, '').replace(/\s+/g, '').trim();
  currentPage.contentChars = stripped.length;
  pages.push(currentPage);
}

console.log('=== PAGE SECTIONS IN index.html ===');
pages.forEach(p => {
  const status = p.lineCount < 5 ? '❌ VERY SMALL' : p.lineCount < 15 ? '⚠️ SMALL' : '✅ OK';
  console.log(`  page-${p.id}: lines ${p.startLine}-${p.endLine} (${p.lineCount} lines, ${p.contentChars} text chars) ${status}`);
});

// 2. Check nav items vs page divs
const navRegex = /id="nav-([^"]+)"/g;
const navIds = [];
let m2;
while ((m2 = navRegex.exec(html)) !== null) {
  navIds.push(m2[1]);
}
const pageIds = pages.map(p => p.id);

console.log('\n=== NAV ITEMS ===');
navIds.forEach(n => {
  const hasPage = pageIds.includes(n);
  console.log(`  nav-${n} -> page-${n}: ${hasPage ? '✅ LINKED' : '❌ NO PAGE FOUND'}`);
});

console.log('\n=== PAGES WITHOUT NAV LINK ===');
pageIds.forEach(p => {
  if (!navIds.includes(p)) {
    console.log(`  page-${p}: ⚠️ No nav-item found (may be OK if accessed differently)`);
  }
});

// 3. Check setPage initializers
const scripts = fs.readFileSync('public/scripts.js', 'utf8');

// Find which pages have render/init calls in setPage
const setPageBlock = scripts.match(/function setPage\(p\)[\s\S]*?window\.setPage = setPage/);
if (setPageBlock) {
  console.log('\n=== PAGE INITIALIZERS IN setPage() ===');
  pageIds.forEach(pid => {
    const patterns = [
      `p === "${pid}"`,
      `p === '${pid}'`,
    ];
    const hasInit = patterns.some(pat => setPageBlock[0].includes(pat));
    const inPageTitles = scripts.includes(`"${pid}"`) && scripts.includes('PAGE_TITLES');
    console.log(`  ${pid}: init=${hasInit ? '✅' : '❌ MISSING'}`);
  });
}

// 4. Check each render function exists
console.log('\n=== RENDER/INIT FUNCTION CHECKS ===');
const renderFunctions = {
  'dash': 'renderDash',
  'stud': 'renderStudents',
  'coach-mgmt': 'renderCoachMgmt',
  'batches': 'renderBatchesGrid',
  'fame': 'renderFame',
  'events': 'renderEvents',
  'bills': 'renderBills',
  'child': 'renderChild',
  'msgs': 'renderMsgs',
  'insights': 'generateAcademyInsights',
  'exp': 'initExpPage',
  'schedules': 'initSchedulePage',
  'chessable': 'renderChessableProfiles',
  'productivity': 'initProductivityPage',
  'access': 'loadAccessControl',
  'homework': 'renderHomeworkPage',
  'ai': 'updateTomKpis',
  'parent-ai': 'setAIModule',
  'attendance': 'renderAttendanceList',
};

const allJsFiles = fs.readdirSync('public/js').filter(f => f.endsWith('.js'));
const allJs = allJsFiles.map(f => fs.readFileSync(path.join('public/js', f), 'utf8')).join('\n') + '\n' + scripts;

Object.entries(renderFunctions).forEach(([page, fn]) => {
  const defined = allJs.includes(`function ${fn}`) || allJs.includes(`window.${fn} =`) || allJs.includes(`window.${fn}=`);
  console.log(`  ${page} -> ${fn}(): ${defined ? '✅ FOUND' : '❌ NOT DEFINED'}`);
});

// 5. Check for pages with empty/placeholder content  
console.log('\n=== PAGES WITH POTENTIALLY EMPTY CONTENT ===');
pages.forEach(p => {
  const content = lines.slice(p.startLine - 1, p.endLine).join('\n');
  // Check if page has a dynamic render target (like an id for content injection)
  const hasRenderTarget = content.match(/id="[^"]*(?:list|grid|body|content|container|cards|table|area)[^"]*"/i);
  const hasStaticContent = p.contentChars > 50;
  if (!hasRenderTarget && !hasStaticContent) {
    console.log(`  page-${p.id}: ❌ NO RENDER TARGET AND NO STATIC CONTENT (lines ${p.startLine}-${p.endLine})`);
  } else if (!hasRenderTarget && hasStaticContent) {
    // OK, has static content
  } else if (hasRenderTarget) {
    // Check if the render target div is empty in HTML (will be filled by JS)
    const targetId = hasRenderTarget[0].match(/id="([^"]*)"/)[1];
    // This is normal - JS fills it
  }
});

// 6. Check script tags reference existing files
console.log('\n=== SCRIPT TAG FILE CHECKS ===');
const scriptTagRegex = /src="(js\/[^"?]+)/g;
let m3;
while ((m3 = scriptTagRegex.exec(html)) !== null) {
  const filePath = path.join('public', m3[1]);
  const exists = fs.existsSync(filePath);
  if (!exists) {
    console.log(`  ❌ MISSING: ${m3[1]}`);
  }
}

const libScriptRegex = /src="(lib\/[^"?]+)/g;
while ((m3 = libScriptRegex.exec(html)) !== null) {
  const filePath = path.join('public', m3[1]);
  const exists = fs.existsSync(filePath);
  if (!exists) {
    console.log(`  ❌ MISSING LIB: ${m3[1]}`);
  }
}
console.log('  (Only missing files shown above)');

// 7. Check PAGE_TITLES coverage
console.log('\n=== PAGE_TITLES COVERAGE ===');
const titleMatch = scripts.match(/PAGE_TITLES\s*=\s*\{([^}]+)\}/);
if (titleMatch) {
  const titledPages = titleMatch[1].match(/"([^"]+)":/g) || [];
  const titledIds = titledPages.map(t => t.replace(/[":]/g, ''));
  pageIds.forEach(pid => {
    if (!titledIds.includes(pid)) {
      console.log(`  ❌ page-${pid}: NO TITLE DEFINED`);
    }
  });
}
console.log('  (Only missing titles shown above)');
