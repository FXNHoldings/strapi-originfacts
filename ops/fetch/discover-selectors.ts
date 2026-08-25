#!/usr/bin/env node
/** Propose article selectors from archived HTML. Never edits selectors.json. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CAPTURES = path.join(ROOT, 'data', 'captures');
const BASE = ['main', '[role="main"]', '#main', '#main-content', '.main', '.main-content', '.page-content', '.article-content', '.main-torso', 'article'];
type Score = { selector: string; pages: number; total_pages: number; average_coverage: number; score: number };

function parse(argv: string[]): { carrier?: string; date?: string } {
  const out: { carrier?: string; date?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--carrier') out.carrier = argv[++i];
    else if (argv[i] === '--date') out.date = argv[++i];
  }
  return out;
}

const requested = parse(process.argv.slice(2));
const dates = (await fs.readdir(CAPTURES)).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort().reverse();
const date = requested.date ?? dates[0];
if (!date) throw new Error('No dated capture set found.');
const dateDir = path.join(CAPTURES, date);
const carriers = requested.carrier ? [requested.carrier] : (await fs.readdir(dateDir)).sort();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const proposals: Record<string, { recommended: Score | null; alternatives: Score[]; note?: string }> = {};

try {
  for (const carrier of carriers) {
    const dir = path.join(dateDir, carrier);
    const metaFiles = (await fs.readdir(dir).catch(() => [])).filter((x) => x.endsWith('.meta.json'));
    const pages: Map<string, number>[] = [];
    for (const metaFile of metaFiles) {
      const meta = JSON.parse(await fs.readFile(path.join(dir, metaFile), 'utf8'));
      if (meta.capture_status !== 'ok') continue;
      const html = await fs.readFile(path.join(dir, metaFile.replace('.meta.json', '.html')), 'utf8').catch(() => null);
      if (!html) continue;
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      pages.push(await page.evaluate((base) => {
        const body = Math.max(1, (document.body?.innerText ?? '').trim().length);
        const selectors = new Set(base);
        for (const el of Array.from(document.querySelectorAll('body *'))) {
          const node = el as HTMLElement;
          const chars = (node.innerText ?? '').trim().length;
          if (chars / body < 0.15 || chars / body > 0.99) continue;
          if (node.id && /^[A-Za-z][\w-]*$/.test(node.id)) selectors.add(`#${CSS.escape(node.id)}`);
          for (const cls of Array.from(node.classList).filter((x) => /^[A-Za-z][\w-]*$/.test(x)).slice(0, 3)) selectors.add(`.${CSS.escape(cls)}`);
        }
        const result = new Map<string, number>();
        for (const selector of selectors) {
          try {
            const el = document.querySelector(selector) as HTMLElement | null;
            if (el) result.set(selector, (el.innerText ?? '').trim().length / body);
          } catch { /* invalid dynamic selector */ }
        }
        return [...result];
      }, BASE).then((rows) => new Map(rows)));
    }
    const selectors = new Set(pages.flatMap((p) => [...p.keys()]));
    const scores: Score[] = [];
    for (const selector of selectors) {
      const coverage = pages.map((p) => p.get(selector)).filter((x): x is number => x !== undefined);
      const presence = pages.length ? coverage.length / pages.length : 0;
      const average = coverage.length ? coverage.reduce((a, b) => a + b, 0) / coverage.length : 0;
      // Prefer selectors present everywhere and a substantial but non-whole-page body.
      const fit = Math.max(0, 1 - Math.abs(average - 0.72));
      scores.push({ selector, pages: coverage.length, total_pages: pages.length, average_coverage: Math.round(average * 1000) / 10, score: Math.round((presence * 70 + fit * 30) * 10) / 10 });
    }
    scores.sort((a, b) => b.score - a.score || b.average_coverage - a.average_coverage);
    const safe = scores.filter((x) => x.pages === x.total_pages && x.average_coverage >= 15 && x.average_coverage <= 97);
    proposals[carrier] = { recommended: safe[0] ?? null, alternatives: safe.slice(1, 6), ...(pages.length ? {} : { note: 'No successful captures in this set.' }) };
  }
} finally {
  await browser.close();
}

const dest = path.join(ROOT, 'data', 'proposals', `selectors-${date}.json`);
await fs.mkdir(path.dirname(dest), { recursive: true });
await fs.writeFile(dest, `${JSON.stringify({ generated_at: new Date().toISOString(), capture_date: date, proposals }, null, 2)}\n`);
console.log(`Selector proposals written to ${dest}`);
console.log('selectors.json was not changed; every recommendation requires review.');
