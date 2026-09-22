import fs from 'node:fs';
import path from 'node:path';
const roots = ['packages/client/lib', 'packages/ai/src'];
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const p=path.join(dir,entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(dart|ts|tsx)$/.test(entry.name)) files.push(p);
  }
}
for (const root of roots) walk(root);
const forbidden = [/platform\.ifecai\.com/i, /powered by IFEC/i, /Planning via IFEC/i];
const hits=[];
for (const file of files) {
  const text=fs.readFileSync(file,'utf8');
  for (const rx of forbidden) if (rx.test(text)) hits.push(`${file}: ${rx}`);
}
if (hits.length) { console.error(hits.join('\n')); process.exit(1); }
console.log(`PASS direct-provider surface check (${files.length} source files scanned)`);
