#!/usr/bin/env node
/** Offline batch extraction. Runs only carriers with configured selectors. */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

function args(argv: string[]): { carriers?: string[]; date?: string } {
  const out: { carriers?: string[]; date?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--carriers') out.carriers = argv[++i].split(',').map((x) => x.trim()).filter(Boolean);
    else if (argv[i] === '--date') out.date = argv[++i];
  }
  return out;
}

async function run(carrier: string, date?: string): Promise<boolean> {
  const cli = path.join(import.meta.dirname, 'node_modules', '.bin', 'tsx');
  const argv = [path.join(import.meta.dirname, 'extract.ts'), '--carrier', carrier];
  if (date) argv.push('--date', date);
  return new Promise((resolve) => {
    const child = spawn(cli, argv, { stdio: 'inherit' });
    child.once('exit', (code) => resolve(code === 0));
    child.once('error', () => resolve(false));
  });
}

const requested = args(process.argv.slice(2));
const selectors = JSON.parse(await fs.readFile(path.join(import.meta.dirname, 'selectors.json'), 'utf8')) as Record<string, { article?: string }>;
const carriers = requested.carriers ?? Object.entries(selectors).filter(([key, value]) => !key.startsWith('_') && value.article).map(([key]) => key).sort();
const failures: string[] = [];
for (const carrier of carriers) {
  console.log(`\n=== ${carrier} ===`);
  if (!selectors[carrier]?.article || !(await run(carrier, requested.date))) failures.push(carrier);
}
console.log(`\nBatch complete: ${carriers.length - failures.length}/${carriers.length} succeeded.`);
if (failures.length) {
  console.error(`Failed: ${failures.join(', ')}`);
  process.exitCode = 1;
}
