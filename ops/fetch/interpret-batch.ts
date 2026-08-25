#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';

const i = process.argv.indexOf('--carriers');
if (i < 0 || !process.argv[i + 1]) throw new Error('Usage: npm run interpret:batch -- --carriers a,b,c');
const carriers = process.argv[i + 1].split(',').map((x) => x.trim()).filter(Boolean);
const cli = path.join(import.meta.dirname, 'node_modules', '.bin', 'tsx');
const failed: string[] = [];
for (const carrier of carriers) {
  const ok = await new Promise<boolean>((resolve) => {
    const child = spawn(cli, [path.join(import.meta.dirname, 'interpret.ts'), '--carrier', carrier], { stdio: 'inherit' });
    child.once('exit', (code) => resolve(code === 0)); child.once('error', () => resolve(false));
  });
  if (!ok) failed.push(carrier);
}
console.log(`Interpretation batch: ${carriers.length - failed.length}/${carriers.length} succeeded.`);
if (failed.length) { console.error(`Failed: ${failed.join(', ')}`); process.exitCode = 1; }
