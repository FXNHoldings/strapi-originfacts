#!/usr/bin/env node
/**
 * Stage 2 — candidate extraction.
 *
 *   npm run extract -- --carrier ryanair
 *
 * Reads the archive and nothing else. No network, ever: the whole point of
 * separating stage 1 was that extraction can be re-run a hundred times against
 * the same bytes without touching a carrier's servers.
 *
 * It does NOT write fact files. It writes a candidate list — every measurement
 * found in the article body, with the sentence it came from and the page it
 * came from. A person turns candidates into fields.
 *
 * That division is deliberate. A regex can find "3" and "23kg"; it cannot know
 * that Ryanair sells checked allowance as purchasable tiers while Qantas
 * includes it in the fare, and that difference decides which schema field a
 * number belongs to. Every value this pipeline has published without a human
 * deciding that has been wrong — EAQ, 151 countries, a mock baggage table.
 * The extractor's job is to find the evidence and stop.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const CAPTURES = path.resolve(import.meta.dirname, '..', '..', 'data', 'captures');

type Selectors = Record<string, { article: string | null; note?: string }>;

/** One measurement, with enough context for a person to judge it. */
type Candidate = {
  kind: 'dimensions' | 'weight' | 'count' | 'money';
  raw: string;
  /** The sentence it appeared in — the thing that makes it judgeable. */
  sentence: string;
  page_key: string;
  source_url: string;
};

type CandidateFile = {
  carrier_key: string;
  extracted_at: string;
  /** The capture set this was read from, so a re-run can be compared. */
  capture_date: string;
  pages: { page_key: string; source_url: string; content_hash: string; article_chars: number }[];
  candidates: Candidate[];
  /** Pages that had a capture but yielded nothing, and why. */
  skipped: { page_key: string; reason: string }[];
};

const PATTERNS: { kind: Candidate['kind']; re: RegExp }[] = [
  // 40 x 30 x 20 cm  /  55x40x20cm
  { kind: 'dimensions', re: /\b\d{1,3}\s*[x×]\s*\d{1,3}\s*[x×]\s*\d{1,3}\s*(?:cm|mm|in|inches)\b/gi },
  { kind: 'weight', re: /\b\d{1,3}(?:\.\d)?\s*(?:kg|kilograms?|lbs?|pounds?)\b/gi },
  // Counts must be bare integers about things, not the leading digits of a
  // duration. "up to 2.5 hours pre-departure" was yielding "up to 2", and a
  // change-deadline masquerading as a bag count is exactly the kind of wrong
  // number that survives review because it looks plausible.
  {
    kind: 'count',
    re: /\b(?:up to|maximum of|max(?:imum)?|no more than)\s+\d{1,2}\b(?![.,]\d)(?!\s*(?:hours?|hrs?|h\b|minutes?|mins?|days?|weeks?|months?|years?|%|cm|kg|mm))/gi,
  },
  { kind: 'money', re: /(?:[£€$]|EUR|GBP|AUD|USD)\s?\d{1,4}(?:\.\d{2})?\b/gi },
];

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?:])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseArgs(argv: string[]): { carrier?: string; date?: string; report: boolean } {
  const out: { carrier?: string; date?: string; report: boolean } = { report: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--carrier') out.carrier = argv[++i];
    else if (argv[i] === '--date') out.date = argv[++i];
    else if (argv[i] === '--report') out.report = true;
  }
  return out;
}

/**
 * The review view: candidates grouped by page, deduplicated by value, each with
 * the sentence it came from.
 *
 * Promoting a candidate to a field is a judgement about what a reader is
 * asking, and that judgement needs the sentence, not the number. "23kg" alone
 * is unusable; "Passengers can purchase up to 1 checked bags of 23kg" says it
 * is a purchasable tier rather than an included allowance, which is a different
 * schema field entirely.
 */
function printReport(file: CandidateFile): void {
  for (const page of file.pages) {
    const rows = file.candidates.filter((c) => c.page_key === page.page_key);
    if (!rows.length) continue;
    console.log(`\n${page.page_key}  —  ${page.source_url}`);
    console.log('─'.repeat(96));
    const seen = new Set<string>();
    for (const c of rows) {
      const key = `${c.kind}|${c.raw.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(`  [${c.kind.padEnd(10)}] ${c.raw}`);
      console.log(`      "${c.sentence.length > 150 ? `${c.sentence.slice(0, 150)}…` : c.sentence}"`);
    }
  }
  if (file.skipped.length) {
    console.log('\nNot extracted:');
    for (const s of file.skipped) console.log(`  ${s.page_key.padEnd(24)}${s.reason}`);
  }
}

/** Most recent capture folder containing this carrier. */
async function latestCaptureDate(carrier: string): Promise<string | null> {
  const dates = (await fs.readdir(CAPTURES).catch(() => []))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();
  for (const d of dates) {
    if (await fs.stat(path.join(CAPTURES, d, carrier)).then(() => true).catch(() => false)) return d;
  }
  return null;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.carrier) {
    console.error('Usage: npm run extract -- --carrier <carrier_key> [--date YYYY-MM-DD]');
    process.exitCode = 1;
    return;
  }

  const selectors = JSON.parse(
    await fs.readFile(path.resolve(import.meta.dirname, 'selectors.json'), 'utf8'),
  ) as Selectors;
  const selector = selectors[args.carrier]?.article;
  if (!selector) {
    console.error(
      `No article selector for "${args.carrier}" in selectors.json.\n` +
        'Extraction reads the article body only — page chrome on these sites carries dimensions\n' +
        'and weights of its own, and a figure pulled from a country picker is worse than none.\n' +
        `Add one, or note why it cannot be derived yet.`,
    );
    process.exitCode = 1;
    return;
  }

  const date = args.date ?? (await latestCaptureDate(args.carrier));
  if (!date) {
    console.error(`No captures for ${args.carrier}. Run the fetcher, or ingest manual captures, first.`);
    process.exitCode = 1;
    return;
  }

  const dir = path.join(CAPTURES, date, args.carrier);
  const metas = (await fs.readdir(dir)).filter((f) => f.endsWith('.meta.json'));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const out: CandidateFile = {
    carrier_key: args.carrier,
    extracted_at: `${new Date().toISOString().slice(0, 19)}Z`,
    capture_date: date,
    pages: [],
    candidates: [],
    skipped: [],
  };

  try {
    for (const metaFile of metas.sort()) {
      const meta = JSON.parse(await fs.readFile(path.join(dir, metaFile), 'utf8'));
      const pageKey = meta.page_key as string;

      if (!['ok', 'manual'].includes(meta.capture_status)) {
        out.skipped.push({ page_key: pageKey, reason: `capture_status is "${meta.capture_status}"` });
        continue;
      }

      const htmlPath = path.join(dir, `${pageKey}.html`);
      const html = await fs.readFile(htmlPath, 'utf8').catch(() => null);
      if (html === null) {
        out.skipped.push({ page_key: pageKey, reason: 'no archived HTML beside the meta' });
        continue;
      }

      const page = await context.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const article = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? (el as HTMLElement).innerText : null;
      }, selector);
      await page.close();

      // A selector that stops matching is a silent data-loss bug — the page
      // would still parse, just with nothing in it. Say so instead.
      if (article === null) {
        out.skipped.push({ page_key: pageKey, reason: `selector "${selector}" matched nothing` });
        continue;
      }

      const text = article.replace(/\s+/g, ' ').trim();
      out.pages.push({
        page_key: pageKey,
        source_url: meta.url,
        content_hash: meta.content_hash,
        article_chars: text.length,
      });

      const seen = new Set<string>();
      for (const sentence of sentencesOf(text)) {
        for (const { kind, re } of PATTERNS) {
          for (const m of sentence.match(re) ?? []) {
            const key = `${pageKey}|${kind}|${m.toLowerCase()}|${sentence}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.candidates.push({
              kind,
              raw: m.trim(),
              sentence: sentence.length > 400 ? `${sentence.slice(0, 400)}…` : sentence,
              page_key: pageKey,
              source_url: meta.url,
            });
          }
        }
      }
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  const outPath = path.join(dir, 'candidates.json');
  await fs.writeFile(outPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');

  console.log(`${args.carrier} — captures from ${date}\n`);
  for (const p of out.pages) {
    const n = out.candidates.filter((c) => c.page_key === p.page_key).length;
    console.log(`  ${p.page_key.padEnd(24)}${String(p.article_chars).padStart(6)} chars article  ${n} candidate(s)`);
  }
  for (const s of out.skipped) console.log(`  ${s.page_key.padEnd(24)}skipped — ${s.reason}`);

  const byKind = new Map<string, number>();
  for (const c of out.candidates) byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + 1);
  console.log(`\n${out.candidates.length} candidate(s): ${[...byKind].map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`\nWritten to ${outPath}`);
  console.log('Nothing was written to content/airline-facts/ — a person turns candidates into fields.');

  if (args.report) printReport(out);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
