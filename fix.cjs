const fs = require('fs');
let content = fs.readFileSync('d:/MY/chesskidoo-ai-admin/public/scripts.js', 'utf8');

content = content.replace(/toast\(New/g, "toast('New");
content = content.replace(/toast\(Failed login attempt/g, "toast(Failed login attempt");
content = content.replace(/toast\(Failed login:/g, "toast(Failed login:");
content = content.replace(/toast\(\$\{newDue\}/g, "toast(${newDue}");
content = content.replace(/toast\(\$\{displayName\}/g, "toast(${displayName}");
content = content.replace(/toast\(New Message/g, "toast(New Message");
content = content.replace(/toast\(\$\{newCount\}/g, "toast(${newCount}");
content = content.replace(/toast\(Sent/g, "toast(Sent");

fs.writeFileSync('d:/MY/chesskidoo-ai-admin/public/scripts.js', content);
console.log('Fixed syntax errors');
