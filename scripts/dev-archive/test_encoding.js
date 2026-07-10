const fs = require('fs');
const content = "â‚¹-4200";
const buf = Buffer.from(content, 'latin1');
console.log(buf.toString('utf8'));
