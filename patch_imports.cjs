const fs = require('fs');
const path = require('path');

const functionsDir = path.join('supabase', 'functions');
const folders = fs.readdirSync(functionsDir).filter(f => fs.statSync(path.join(functionsDir, f)).isDirectory());

let changedCount = 0;

folders.forEach(folder => {
    const indexPath = path.join(functionsDir, folder, 'index.ts');
    if (!fs.existsSync(indexPath)) return;

    let content = fs.readFileSync(indexPath, 'utf-8');
    let originalContent = content;

    // 1. Remove any dynamic import of createClient
    content = content.replace(/const\s+\{\s*createClient\s*\}\s*=\s*await\s+import\s*\(\s*['"]https:\/\/esm\.sh\/@supabase\/supabase-js@2['"]\s*\);?/g, '');
    
    // 2. Remove any dynamic import of validateAuth
    content = content.replace(/const\s+\{\s*validateAuth\s*\}\s*=\s*await\s+import\s*\(\s*['"]\.\/rate_limit\.js['"]\s*\);?/g, '');

    // 3. Remove existing static imports to avoid duplicates
    content = content.replace(/^import\s+\{\s*checkRateLimit\s*\}\s*from\s*['"]\.\/rate_limit\.js['"];?\r?\n/gm, '');
    content = content.replace(/^import\s+\{\s*createClient\s*\}\s*from\s*['"]https:\/\/esm\.sh\/@supabase\/supabase-js@2['"];?\r?\n/gm, '');
    content = content.replace(/^import\s+\{\s*validateAuth,\s*checkRateLimit\s*\}\s*from\s*['"]\.\/rate_limit\.js['"];?\r?\n/gm, '');
    content = content.replace(/^import\s+\{\s*checkRateLimit,\s*validateAuth\s*\}\s*from\s*['"]\.\/rate_limit\.js['"];?\r?\n/gm, '');

    // 4. Construct new top-level imports
    let importsToAdd = [];
    if (folder !== 'bob-payment-init' && folder !== 'bob-payment-webhook') {
        importsToAdd.push("import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';");
    }
    
    let hasCheckRateLimit = content.includes('checkRateLimit');
    let hasValidateAuth = content.includes('validateAuth') || content.includes('auth = await validateAuth');
    
    if (hasCheckRateLimit && hasValidateAuth) {
        importsToAdd.push("import { checkRateLimit, validateAuth } from './rate_limit.js';");
    } else if (hasCheckRateLimit) {
        importsToAdd.push("import { checkRateLimit } from './rate_limit.js';");
    } else if (hasValidateAuth) {
        importsToAdd.push("import { validateAuth } from './rate_limit.js';");
    }

    if (importsToAdd.length > 0) {
        content = importsToAdd.join('\n') + '\n\n' + content.trim();
    }

    if (content !== originalContent) {
        fs.writeFileSync(indexPath, content);
        changedCount++;
        console.log('Patched', folder);
    }
});

console.log('Total patched:', changedCount);
