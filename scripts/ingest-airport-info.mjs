#!/usr/bin/env node
/**
 * Airport data ingest — enriches Strapi `airports` from the RapidAPI
 * "airport-info" endpoint so the airport pages (app/airports/[iata]) carry
 * real, page-specific facts and a written `about`. A populated `about` also
 * flips the page past the Phase-1 index quality gate (lib/entity-seo), so
 * previously-thin airports become indexable once enriched.
 *
 * It is DRY-RUN by default (no writes). Add --write to persist to Strapi.
 *
 * ── Required env ────────────────────────────────────────────────────────────
 *   RAPIDAPI_KEY        RapidAPI key for airport-info.p.rapidapi.com
 *   STRAPI_WRITE_TOKEN  Strapi API token with UPDATE perms on Airports
 *                       (only needed with --write)
 * ── Optional env ────────────────────────────────────────────────────────────
 *   STRAPI_URL          default https://cms.fxnstudio.com
 *   RAPIDAPI_HOST       default airport-info.p.rapidapi.com
 * ── Flags ───────────────────────────────────────────────────────────────────
 *   --write             actually PUT updates to Strapi (default: dry-run)
 *   --limit N           process at most N airports this run
 *   --only AAA,BBB      only these IATA codes (comma-separated)
 *   --sleep MS          delay between API calls (default 1500) — respect quota
 *   --force             rewrite `about` even if the airport already has one
 *   --all               process every airport, not just "needy" ones
 *   --fresh             ignore the resume checkpoint and start over
 *
 * The script checkpoints to scripts/.airport-ingest-progress.json after every
 * airport, so it can be re-run to resume (e.g. across daily quota windows).
 * On repeated HTTP 429 it backs off and then stops cleanly, preserving the
 * checkpoint — just run it again later.
 */
import qs from 'qs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHECKPOINT = join(__dirname, '.airport-ingest-progress.json');

const STRAPI_URL = (process.env.STRAPI_URL || 'https://cms.fxnstudio.com').replace(/\/$/, '');
const WRITE_TOKEN = process.env.STRAPI_WRITE_TOKEN || '';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'airport-info.p.rapidapi.com';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const OPTS = {
  write: has('--write'),
  limit: Number(val('--limit', '0')) || 0,
  only: (val('--only', '') || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
  sleep: Number(val('--sleep', '1500')) || 1500,
  force: has('--force'),
  all: has('--all'),
  fresh: has('--fresh'),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Strapi helpers ──────────────────────────────────────────────────────── */

async function strapiGet(path, params) {
  const q = params ? '?' + qs.stringify(params, { encodeValuesOnly: true }) : '';
  const res = await fetch(`${STRAPI_URL}/api/${path}${q}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Strapi GET ${path} -> ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json();
}

async function strapiUpdateAirport(documentId, data) {
  const res = await fetch(`${STRAPI_URL}/api/airports/${documentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WRITE_TOKEN}`,
    },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`Strapi PUT airports/${documentId} -> ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json();
}

async function fetchAllAirports() {
  const fields = [
    'iata', 'icao', 'name', 'city', 'country', 'countryCode',
    'region', 'latitude', 'longitude', 'timezone', 'about',
  ];
  const all = [];
  let page = 1;
  const pageSize = 100;
  for (;;) {
    const r = await strapiGet('airports', {
      fields,
      sort: ['iata:asc'],
      pagination: { page, pageSize },
    });
    all.push(...r.data);
    const pc = r.meta?.pagination?.pageCount ?? 1;
    if (page >= pc) break;
    page++;
  }
  return all;
}

/* ── airport-info API ────────────────────────────────────────────────────── */

async function fetchAirportInfo(iata) {
  const res = await fetch(`https://${RAPIDAPI_HOST}/airport?iata=${encodeURIComponent(iata)}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key': RAPIDAPI_KEY,
    },
  });
  if (res.status === 429) return { rateLimited: true };
  if (res.status === 404) return { notFound: true };
  if (!res.ok) throw new Error(`airport-info ${iata} -> ${res.status}`);
  const j = await res.json();
  // API returns {} or an error object when not found
  if (!j || !j.iata) return { notFound: true };
  return { data: j };
}

/* ── Field mapping + about builder ───────────────────────────────────────── */

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function utcOffset(uct) {
  if (typeof uct !== 'number' || !Number.isFinite(uct)) return null;
  const sign = uct < 0 ? '-' : '+';
  const abs = Math.abs(uct);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${hh}:${mm}`;
}

/** Build a factual, source-grounded `about` (markdown the template parses). */
function buildAbout(api, existing) {
  const name = str(api.name) || existing.name;
  const place = [str(api.city), str(api.state), str(api.country)].filter(Boolean).join(', ');
  const codes = [api.iata && `IATA code **${api.iata}**`, str(api.icao) && `ICAO code **${api.icao}**`]
    .filter(Boolean)
    .join(' and ');
  const coords =
    num(api.latitude) != null && num(api.longitude) != null
      ? `${api.latitude.toFixed(4)}°, ${api.longitude.toFixed(4)}°`
      : null;
  // Prefer an existing IANA timezone (curated, DST-aware) over the API's raw
  // current UTC offset, so the prose matches the facts panel and stays evergreen.
  const tz = str(existing.timezone) || utcOffset(api.uct);

  const overview = [
    `${name} is the airport serving ${place || existing.country || 'its surrounding region'}.`,
    codes ? `It is identified by the ${codes}.` : '',
    coords ? `The airport is located at coordinates ${coords}${tz ? `, in the ${tz} time zone` : ''}.` : (tz ? `It operates in the ${tz} time zone.` : ''),
  ].filter(Boolean).join(' ');

  const contactBits = [
    str(api.country_iso) ? `**Country:** ${api.country} (${api.country_iso})` : (str(api.country) ? `**Country:** ${api.country}` : ''),
    str(api.state) ? `**Region/State:** ${api.state}` : '',
    str(api.postal_code) ? `**Postal area:** ${api.postal_code}` : '',
    str(api.phone) ? `**Phone:** ${api.phone}` : '',
    str(api.website) ? `**Official website:** ${api.website}` : '',
  ].filter(Boolean);

  let md = overview;
  if (contactBits.length) {
    md += `\n\n## Airport information\n\n` + contactBits.join('  \n');
  }
  return md;
}

/**
 * Returns the Strapi update payload — fills only EMPTY identity fields (never
 * overwrites existing curated values like an IANA timezone), and writes a
 * fresh `about` when missing (or --force). Returns null if nothing to update.
 */
function buildUpdate(airport, api) {
  const data = {};
  const fillIfEmpty = (key, value) => {
    if (value == null) return;
    const cur = airport[key];
    const emptyStr = typeof cur === 'string' && !cur.trim();
    if (cur == null || emptyStr) data[key] = value;
  };

  fillIfEmpty('icao', str(api.icao));
  fillIfEmpty('city', str(api.city));
  fillIfEmpty('country', str(api.country));
  fillIfEmpty('countryCode', str(api.country_iso));
  fillIfEmpty('latitude', num(api.latitude));
  fillIfEmpty('longitude', num(api.longitude));
  // Only set timezone if completely missing (existing values are IANA names).
  if (!str(airport.timezone)) {
    const off = utcOffset(api.uct);
    if (off) data.timezone = off;
  }

  const needsAbout = OPTS.force || !str(airport.about);
  if (needsAbout) data.about = buildAbout(api, airport);

  return Object.keys(data).length ? data : null;
}

/* ── Checkpoint ──────────────────────────────────────────────────────────── */

async function loadCheckpoint() {
  if (OPTS.fresh) return { processed: {} };
  try {
    return JSON.parse(await readFile(CHECKPOINT, 'utf8'));
  } catch {
    return { processed: {} };
  }
}
async function saveCheckpoint(cp) {
  await writeFile(CHECKPOINT, JSON.stringify(cp, null, 2));
}

/* ── Main ────────────────────────────────────────────────────────────────── */

function isNeedy(a) {
  if (OPTS.all || OPTS.force) return true;
  const noAbout = !str(a.about);
  const noGeo = num(a.latitude) == null || num(a.longitude) == null;
  const noIcao = !str(a.icao);
  return noAbout || noGeo || noIcao;
}

async function main() {
  if (!RAPIDAPI_KEY) {
    console.error('FATAL: set RAPIDAPI_KEY env (airport-info.p.rapidapi.com key).');
    process.exit(1);
  }
  if (OPTS.write && !WRITE_TOKEN) {
    console.error('FATAL: --write requires STRAPI_WRITE_TOKEN env (Strapi token with Airport update perms).');
    process.exit(1);
  }
  console.log(`Mode: ${OPTS.write ? 'WRITE' : 'DRY-RUN'} | strapi: ${STRAPI_URL} | sleep: ${OPTS.sleep}ms`);

  const cp = await loadCheckpoint();
  let airports = await fetchAllAirports();
  console.log(`Fetched ${airports.length} airports from Strapi.`);

  if (OPTS.only.length) {
    airports = airports.filter((a) => OPTS.only.includes((a.iata || '').toUpperCase()));
  } else {
    airports = airports.filter(isNeedy);
  }
  // Skip already-processed (unless re-targeting with --only/--force/--fresh)
  if (!OPTS.only.length && !OPTS.force) {
    airports = airports.filter((a) => !cp.processed[a.iata]);
  }
  if (OPTS.limit) airports = airports.slice(0, OPTS.limit);

  console.log(`Candidates this run: ${airports.length}\n`);

  const stats = { updated: 0, wouldUpdate: 0, noChange: 0, notFound: 0, errors: 0 };
  let consecutive429 = 0;

  for (let i = 0; i < airports.length; i++) {
    const a = airports[i];
    const iata = (a.iata || '').toUpperCase();
    if (!iata) continue;
    const tag = `[${i + 1}/${airports.length}] ${iata}`;

    try {
      const r = await fetchAirportInfo(iata);

      if (r.rateLimited) {
        consecutive429++;
        const backoff = Math.min(60000, 5000 * consecutive429);
        console.warn(`${tag} 429 rate-limited — backing off ${backoff}ms`);
        await sleep(backoff);
        if (consecutive429 >= 5) {
          console.error('Too many 429s — stopping. Checkpoint saved; re-run later to resume.');
          break;
        }
        i--; // retry same airport
        continue;
      }
      consecutive429 = 0;

      if (r.notFound) {
        stats.notFound++;
        cp.processed[iata] = { status: 'not_found', at: Date.now() };
        console.log(`${tag} not found in airport-info — skipped`);
      } else {
        const update = buildUpdate(a, r.data);
        if (!update) {
          stats.noChange++;
          cp.processed[iata] = { status: 'no_change', at: Date.now() };
          console.log(`${tag} nothing to fill`);
        } else if (OPTS.write) {
          await strapiUpdateAirport(a.documentId, update);
          stats.updated++;
          cp.processed[iata] = { status: 'updated', fields: Object.keys(update), at: Date.now() };
          console.log(`${tag} updated: ${Object.keys(update).join(', ')}`);
        } else {
          stats.wouldUpdate++;
          console.log(`${tag} would set: ${Object.keys(update).join(', ')}`);
          if (i === 0) console.log('   about preview:\n   ' + (update.about || '(unchanged)').split('\n').join('\n   '));
        }
      }
    } catch (e) {
      stats.errors++;
      cp.processed[iata] = { status: 'error', at: Date.now() };
      console.error(`${tag} ERROR: ${e.message}`);
    }

    await saveCheckpoint(cp);
    if (i < airports.length - 1) await sleep(OPTS.sleep);
  }

  console.log('\n──────── summary ────────');
  console.log(stats);
  if (!OPTS.write) console.log('DRY-RUN — no data written. Re-run with --write (and STRAPI_WRITE_TOKEN) to persist.');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
