import fs from 'node:fs';
import path from 'node:path';

const files = [
  'packages/ai/src/generation.ts',
  'packages/ai/src/ifec-platform.ts',
  'packages/ai/src/index.ts',
];
const forbidden = ["import { IFECClient }", "implements ModelRouter, IFECClient", "model: 'ifec'"];
const failures = [];
for (const file of files) {
  const text = fs.readFileSync(path.resolve(file), 'utf8');
  for (const token of forbidden) if (text.includes(token)) failures.push(`${file}: ${token}`);
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`PASS: direct generation surface checked (${files.length} files)`);
