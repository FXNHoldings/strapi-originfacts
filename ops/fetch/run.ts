#!/usr/bin/env node
/**
 * Stage 1 — archival fetcher.
 *
 *   yarn fetch                        every carrier in carriers.json
 *   yarn fetch --carrier qantas       one carrier
 *   yarn fetch --dry-run              print the plan, fetch nothing
 *
 * Fetches carrier pages with Playwright and archives the raw HTML. It does not
 * parse, extract, or write to content/airline-facts/ — stage 2 does that, from
 * the archive, so carrier sites are hit once and extraction is iterated on
 * offline.
 *
 * Politeness is not configurable: robots.txt is obeyed, requests are serial,
 * and there is a floor of MIN_HOST_DELAY_MS between requests to a host (raised
 * if robots.txt asks for more). There is no proxy support and no bypass of any
 * kind — a page behind a bot wall is recorded and left for manual capture.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Browser, BrowserContext } from 'playwright';
import { openBrowser, loadPage, extractText, readHtmlLang } from './browser.js';
import { checkRobots, robotsCrawlDelayMs } from './robots.js';
import { handleConsent } from './consent.js';
import { classify, detectBlockSignal, detectCurrencies, localeSegmentsChanged, MIN_TEXT_LENGTH } from './classify.js';
import { hashText, utcDateStamp, utcTimestamp, writeCapture, CAPTURES_ROOT } from './archive.js';
import type { Carrier, CaptureMeta } from './types.js';

const MIN_HOST_DELAY_MS = 3_000;
const MAX_ATTEMPTS = 3; // the first try plus two retries
const BACKOFF_MS = [4_000, 8_000];

type Args = { carrier?: string; dryRun: boolean };

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--carrier') args.carrier = argv[++i];
    else if (argv[i].startsWith('--carrier=')) args.carrier = argv[i].split('=')[1];
  }
  return args;
}

const lastRequestAt = new Map<string, number>();

async function waitForHost(url: string): Promise<void> {
  const host = new URL(url).host;
  const floor = Math.max(MIN_HOST_DELAY_MS, await robotsCrawlDelayMs(url));
  const last = lastRequestAt.get(host);
  if (last !== undefined) {
    const wait = floor - (Date.now() - last);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAt.set(host, Date.now());
}

/**
 * Whether a string is a fetchable URL rather than leftover template text.
 *
 * Catches the ellipsis forms an editor or a chat client leaves behind, angle
 * brackets, and documentation hostnames — all of which parse as valid URLs and
 * would otherwise be fetched.
 */
function isRealUrl(raw: string): boolean {
  const url = raw.trim();
  if (/[…<>]|\.\.\./.test(url)) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(parsed.protocol)) return false;
  if (/(^|\.)example\.(com|org|net)$/i.test(parsed.hostname)) return false;
  return true;
}

async function loadCarriers(): Promise<Carrier[]> {
  const file = path.join(import.meta.dirname, 'carriers.json');
  const carriers = JSON.parse(await fs.readFile(file, 'utf8')) as Carrier[];

  // A capture with no asserted market is a data-integrity bug, not a cosmetic
  // one: carriers publish different allowances and currencies per locale, so an
  // unlabelled archive cannot be trusted downstream. Fail the whole run.
  const missing = carriers.filter((c) => !c.locale || !c.locale.trim());
  if (missing.length) {
    throw new Error(
      `carriers.json: no locale set for ${missing.map((c) => c.carrier_key).join(', ')}. ` +
        'Every carrier must assert its intended market.',
    );
  }

  // Template text left in place is not a URL. It reads as filled-in at a glance,
  // and fetching it would send a pointless 404 to the carrier — so it fails
  // loudly here rather than quietly becoming a bad capture.
  const placeholders: string[] = [];
  for (const c of carriers) {
    for (const [key, url] of Object.entries(c.pages)) {
      if (!url || !url.trim()) continue;
      if (!isRealUrl(url)) placeholders.push(`${c.carrier_key}/${key}: ${url}`);
    }
  }
  if (placeholders.length) {
    throw new Error(
      `carriers.json still contains ${placeholders.length} placeholder URL(s):\n  ${placeholders.join('\n  ')}\n\n` +
        'Replace them with the real page URLs, or clear them to "" to skip those pages.',
    );
  }

  return carriers;
}

type Row = CaptureMeta;

async function capturePage(
  context: BrowserContext,
  carrier: Carrier,
  pageKey: string,
  url: string,
  dateStamp: string,
): Promise<Row> {
  const base = {
    carrier_key: carrier.carrier_key,
    page_key: pageKey,
    url,
    locale: carrier.locale,
    consent_action: 'none_found' as const,
    html_lang: null,
    detected_currencies: [] as string[],
    redirected: false,
    attempts: 0,
  };

  const verdict = await checkRobots(url);
  if (verdict !== 'allowed') {
    return writeCapture(
      dateStamp,
      {
        ...base,
        fetched_at: utcTimestamp(),
        http_status: null,
        final_url: null,
        content_hash: null,
        text_length: 0,
        capture_status: verdict === 'denied' ? 'robots_denied' : 'robots_unavailable',
      },
      null,
    );
  }

  let lastError = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await waitForHost(url);
    let page;
    try {
      const loaded = await loadPage(context, url);
      page = loaded.page;
      const response = loaded.response;
      const httpStatus = response?.status() ?? null;

      const textBefore = (await extractText(page)).length;
      const consentAction = await handleConsent(page, textBefore);

      const html = await page.content();
      const text = await extractText(page);
      const title = await page.title().catch(() => '');
      const finalUrl = page.url();

      const blockSignal = detectBlockSignal(html, title, httpStatus);
      const localeDrifted = finalUrl !== url && localeSegmentsChanged(url, finalUrl);
      const status = classify({ blockSignal, httpStatus, textLength: text.length, localeDrifted });

      // Retry only transport-level failures. A block, a short page or a locale
      // redirect are all stable answers — asking again just costs the host.
      const worthRetrying = status === 'error' && attempt < MAX_ATTEMPTS;
      if (worthRetrying) {
        lastError = `HTTP ${httpStatus ?? 'none'}`;
        await page.close();
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1] ?? 8_000));
        continue;
      }

      const meta: CaptureMeta = {
        ...base,
        fetched_at: utcTimestamp(),
        http_status: httpStatus,
        final_url: finalUrl,
        content_hash: hashText(text),
        text_length: text.length,
        capture_status: status,
        consent_action: consentAction,
        html_lang: await readHtmlLang(page),
        detected_currencies: detectCurrencies(text),
        redirected: finalUrl !== url,
        attempts: attempt,
        ...(blockSignal ? { block_signal: blockSignal } : {}),
        ...(status === 'error' ? { error: `HTTP ${httpStatus ?? 'none'}` } : {}),
      };

      await page.close();
      return writeCapture(dateStamp, meta, html);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      await page?.close().catch(() => undefined);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1] ?? 8_000));
        continue;
      }
    }
  }

  return writeCapture(
    dateStamp,
    {
      ...base,
      fetched_at: utcTimestamp(),
      http_status: null,
      final_url: null,
      content_hash: null,
      text_length: 0,
      capture_status: 'error',
      attempts: MAX_ATTEMPTS,
      error: lastError,
    },
    null,
  );
}

/* ---------------------------------------------------------------- *
 * Summary
 * ---------------------------------------------------------------- */

function pad(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n);
}

function printSummary(rows: Row[]): void {
  console.log('\nCapture summary');
  console.log('─'.repeat(96));
  console.log(`${pad('carrier', 20)}${pad('page', 24)}${pad('status', 20)}${'chars'.padStart(8)}`);
  console.log('─'.repeat(96));

  for (const r of rows) {
    console.log(
      `${pad(r.carrier_key, 20)}${pad(r.page_key, 24)}${pad(r.capture_status, 20)}${String(r.text_length).padStart(8)}`,
    );

    // Second line only where there is something to say, so a clean run stays
    // scannable and a problem run explains itself without a second command.
    const detail: string[] = [];
    if (r.block_signal) detail.push(`block=${r.block_signal}`);
    if (r.consent_action !== 'none_found') detail.push(`consent=${r.consent_action}`);
    if (r.html_lang) detail.push(`html_lang=${r.html_lang}`);
    if (r.detected_currencies.length) detail.push(`currencies=${r.detected_currencies.join(',')}`);
    if (r.body_retained_from) detail.push(`kept ok body from ${r.body_retained_from}`);
    if (r.redirected && r.final_url) detail.push(`final=${r.final_url}`);
    if (r.error) detail.push(`error=${r.error}`);
    if (detail.length) console.log(`${' '.repeat(20)}${detail.join('  ')}`);
  }

  console.log('─'.repeat(96));
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.capture_status, (counts.get(r.capture_status) ?? 0) + 1);
  console.log([...counts.entries()].map(([k, v]) => `${k}: ${v}`).join('   '));

  const needsHand = rows.filter((r) => r.capture_status !== 'ok');
  if (needsHand.length) {
    console.log(`\n${needsHand.length} page(s) need manual attention:`);
    for (const r of needsHand) console.log(`  ${r.carrier_key}/${r.page_key} — ${r.capture_status}`);
  }
}

/* ---------------------------------------------------------------- *
 * Main
 * ---------------------------------------------------------------- */

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const all = await loadCarriers();
  const carriers = args.carrier ? all.filter((c) => c.carrier_key === args.carrier) : all;

  if (args.carrier && carriers.length === 0) {
    console.error(`No carrier "${args.carrier}" in carriers.json. Known: ${all.map((c) => c.carrier_key).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const dateStamp = utcDateStamp();
  const planned = carriers.flatMap((c) =>
    Object.entries(c.pages)
      .filter(([, url]) => url && url.trim())
      .map(([pageKey, url]) => ({ carrier: c, pageKey, url })),
  );
  const unset = carriers.flatMap((c) =>
    Object.entries(c.pages).filter(([, url]) => !url || !url.trim()).map(([k]) => `${c.carrier_key}/${k}`),
  );

  if (args.dryRun) {
    console.log(`Dry run — nothing will be fetched. Archive root: ${path.join(CAPTURES_ROOT, dateStamp)}\n`);
    for (const { carrier, pageKey, url } of planned) {
      const verdict = await checkRobots(url);
      console.log(`${pad(carrier.carrier_key, 20)}${pad(pageKey, 24)}${pad(`robots:${verdict}`, 22)}${url}`);
    }
    if (unset.length) console.log(`\n${unset.length} page(s) have no URL set yet:\n  ${unset.join('\n  ')}`);
    console.log(`\n${planned.length} page(s) would be fetched, serially, ≥${MIN_HOST_DELAY_MS / 1000}s apart per host.`);
    return;
  }

  if (planned.length === 0) {
    console.error('Nothing to fetch — every page URL in carriers.json is empty. Fill them in first.');
    process.exitCode = 1;
    return;
  }

  let browser: Browser | undefined;
  const rows: Row[] = [];

  try {
    const opened = await openBrowser();
    browser = opened.browser;
    console.log(`Archiving to ${path.join(CAPTURES_ROOT, dateStamp)}\n`);

    // Strictly serial: one request in flight at a time, across all carriers.
    for (const { carrier, pageKey, url } of planned) {
      process.stdout.write(`  ${carrier.carrier_key}/${pageKey} … `);
      const row = await capturePage(opened.context, carrier, pageKey, url, dateStamp);
      rows.push(row);
      console.log(`${row.capture_status} (${row.text_length} chars)`);
    }
  } finally {
    await browser?.close().catch(() => undefined);
  }

  printSummary(rows);
  if (unset.length) console.log(`\nSkipped ${unset.length} page(s) with no URL set: ${unset.join(', ')}`);
  console.log(`\nThreshold for too_short is ${MIN_TEXT_LENGTH} characters of extracted text.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
