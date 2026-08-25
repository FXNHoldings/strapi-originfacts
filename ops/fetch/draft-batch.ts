#!/usr/bin/env node
/** Generate non-destructive review proposals for multiple carriers. */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const flag = process.argv.indexOf('--carriers');
const selected = flag >= 0 ? process.argv[flag + 1]?.split(',').map((x) => x.trim()).filter(Boolean) : undefined;
const selectors = JSON.parse(await fs.readFile(path.join(import.meta.dirname, 'selectors.json'), 'utf8')) as Record<string, { article?: string }>;
const carriers = selected ?? Object.keys(selectors).filter((x) => !x.startsWith('_')).sort();
const cli = path.join(import.meta.dirname, 'node_modules', '.bin', 'tsx');
const failures: string[] = [];

for (const carrier of carriers) {
  console.log(`\n=== ${carrier} ===`);
  const ok = await new Promise<boolean>((resolve) => {
    const child = spawn(cli, [path.join(import.meta.dirname, 'draft.ts'), '--carrier', carrier], { stdio: 'inherit' });
    child.once('exit', (code) => resolve(code === 0));
    child.once('error', () => resolve(false));
  });
  if (!ok) failures.push(carrier);
}

console.log(`\nProposal batch complete: ${carriers.length - failures.length}/${carriers.length} succeeded.`);
if (failures.length) {
  console.error(`Failed: ${failures.join(', ')}`);
  process.exitCode = 1;
}
