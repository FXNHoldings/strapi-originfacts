#!/usr/bin/env node
/**
 * Airport data ingest — OurAirports edition.
 *
 * Enriches the Strapi `airports` collection from the OurAirports open dataset
 * (public domain): https://ourairports.com/data/ . Richer than the RapidAPI
 * airport-info source — it adds airport TYPE, ELEVATION, and full RUNWAY data
 * (length, surface, lighting, designations), plus municipality, official site
 * and Wikipedia link. No API key, no rate limits, no cost — one bulk pass.
 *
 * Writes a factual `about` (markdown) with an Overview, a "## Runways" section
 * (left column on the airport page) and a "## Airport information" detail block
 * (right column — Type / Elevation / Runways / Municipality / Website /
 * Wikipedia). Also fills empty identity fields (icao, city, country,
 * countryCode, latitude, longitude). Never overwrites curated values.
 *
 * DRY-RUN by default. Add --write to persist.
 *
 * ── env ──   STRAPI_WRITE_TOKEN (for --write), STRAPI_URL (default cms.fxnstudio.com)
 * ── flags ── --write --limit N --only AAA,BBB --sleep MS --force --all --fresh
 *             --refresh-data   (re-download the CSVs even if cached)
 */
import qs from 'qs';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '.oa-cache');
const CHECKPOINT = join(__dirname, '.ourairports-progress.json');

const AIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const RUNWAYS_URL = 'https://davidmegginson.github.io/ourairports-data/runways.csv';

const STRAPI_URL = (process.env.STRAPI_URL || 'https://cms.fxnstudio.com').replace(/\/$/, '');
const WRITE_TOKEN = process.env.STRAPI_WRITE_TOKEN || '';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const OPTS = {
  write: has('--write'),
  limit: Number(val('--limit', '0')) || 0,
  only: (val('--only', '') || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
  sleep: Number(val('--sleep', '150')) || 150,
  force: has('--force'),
  all: has('--all'),
  fresh: has('--fresh'),
  refreshData: has('--refresh-data'),
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const regionName = (() => {
  let dn;
  try { dn = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { dn = null; }
  return (code) => { try { return dn ? dn.of(code) : null; } catch { return null; } };
})();

/* ── tiny robust CSV parser (handles quoted fields, commas, "" escapes) ── */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

async function loadCsv(url, file) {
  await mkdir(CACHE_DIR, { recursive: true });
  const path = join(CACHE_DIR, file);
  let fresh = false;
  if (!OPTS.refreshData) {
    try { const s = await stat(path); fresh = Date.now() - s.mtimeMs < 7 * 864e5; } catch { /* miss */ }
  }
  if (!fresh) {
    process.stdout.write(`Downloading ${file}… `);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    await writeFile(path, await res.text());
    console.log('done');
  }
  return parseCsv(await readFile(path, 'utf8'));
}

/* ── Strapi ── */
async function strapiGet(path, params) {
  const q = params ? '?' + qs.stringify(params, { encodeValuesOnly: true }) : '';
  const res = await fetch(`${STRAPI_URL}/api/${path}${q}`, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(`Strapi GET ${path} -> ${res.status}`);
  return res.json();
}
async function strapiUpdateAirport(documentId, data) {
  const res = await fetch(`${STRAPI_URL}/api/airports/${documentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WRITE_TOKEN}` },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`Strapi PUT airports/${documentId} -> ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json();
}
async function fetchAllAirports() {
  const fields = ['iata', 'icao', 'name', 'city', 'country', 'countryCode', 'region', 'latitude', 'longitude', 'timezone', 'about'];
  const all = [];
  let page = 1;
  for (;;) {
    const r = await strapiGet('airports', { fields, sort: ['iata:asc'], pagination: { page, pageSize: 100 } });
    all.push(...r.data);
    if (page >= (r.meta?.pagination?.pageCount ?? 1)) break;
    page++;
  }
  return all;
}

/* ── field mapping + about builder ── */
const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const numf = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const ftToM = (ft) => Math.round(ft * 0.3048);

const TYPE_LABEL = {
  large_airport: 'Large airport', medium_airport: 'Medium airport', small_airport: 'Small airport',
  heliport: 'Heliport', seaplane_base: 'Seaplane base', balloonport: 'Balloonport', closed: 'Closed airport',
};
const SURFACE = {
  ASP: 'asphalt', CON: 'concrete', PEM: 'paved', BIT: 'bituminous', GRS: 'grass', GRE: 'gravel',
  GVL: 'gravel', TURF: 'turf', DIRT: 'dirt', WATER: 'water', SNOW: 'snow', SAND: 'sand', COP: 'composite',
};
const surfaceLabel = (s) => {
  if (!s) return null;
  const key = s.toUpperCase().replace(/[^A-Z]/g, '');
  return SURFACE[key] || s.toLowerCase();
};

function runwayLines(runways) {
  return runways
    .filter((r) => r.closed !== '1')
    .map((r) => {
      const desig = [str(r.le_ident), str(r.he_ident)].filter(Boolean).join('/');
      const lenFt = numf(r.length_ft);
      const surf = surfaceLabel(str(r.surface));
      const lit = r.lighted === '1';
      const parts = [];
      if (lenFt) parts.push(`${lenFt.toLocaleString()} ft (${ftToM(lenFt).toLocaleString()} m)`);
      if (surf) parts.push(surf);
      if (lit) parts.push('lighted');
      return `Runway ${desig || '—'}${parts.length ? ' — ' + parts.join(', ') : ''}.`;
    });
}

function buildAbout(oa, runways, existing) {
  const name = str(oa.name) || existing.name;
  const typeLabel = TYPE_LABEL[oa.type] || 'airport';
  const place = [str(oa.municipality), regionName(str(oa.iso_country)) || existing.country].filter(Boolean).join(', ');
  const elevFt = numf(oa.elevation_ft);

  const overview = [
    `${name} is a ${typeLabel.toLowerCase()}${place ? ` serving ${place}` : ''}.`,
    str(oa.icao_code) ? `It carries the IATA code ${existing.iata} and ICAO code ${oa.icao_code}.` : '',
    elevFt != null ? `The airport sits at an elevation of ${elevFt.toLocaleString()} ft (${ftToM(elevFt).toLocaleString()} m).` : '',
  ].filter(Boolean).join(' ');

  const openRunways = runways.filter((r) => r.closed !== '1');
  let md = overview;

  if (openRunways.length) {
    const lengths = openRunways.map((r) => numf(r.length_ft)).filter((n) => n != null);
    const maxFt = lengths.length ? Math.max(...lengths) : null;
    const summary = `${name} has ${openRunways.length} runway${openRunways.length === 1 ? '' : 's'}${maxFt ? `, the longest measuring ${maxFt.toLocaleString()} ft (${ftToM(maxFt).toLocaleString()} m)` : ''}.`;
    md += `\n\n## Runways\n\n${summary}\n\n` + runwayLines(openRunways).join('\n\n');
  }

  const info = [
    typeLabel ? `**Type:** ${typeLabel}` : '',
    elevFt != null ? `**Elevation:** ${elevFt.toLocaleString()} ft (${ftToM(elevFt).toLocaleString()} m)` : '',
    openRunways.length ? `**Runways:** ${openRunways.length}` : '',
    str(oa.municipality) ? `**Municipality:** ${oa.municipality}` : '',
    str(oa.home_link) ? `**Website:** ${oa.home_link}` : '',
    str(oa.wikipedia_link) ? `**Wikipedia:** ${oa.wikipedia_link}` : '',
  ].filter(Boolean);
  if (info.length) md += `\n\n## Airport information\n\n` + info.join('  \n');

  return md;
}

function buildUpdate(airport, oa, runways) {
  const data = {};
  const fillIfEmpty = (k, v) => {
    if (v == null) return;
    const cur = airport[k];
    if (cur == null || (typeof cur === 'string' && !cur.trim())) data[k] = v;
  };
  fillIfEmpty('icao', str(oa.icao_code) || str(oa.gps_code));
  fillIfEmpty('city', str(oa.municipality));
  fillIfEmpty('countryCode', str(oa.iso_country));
  fillIfEmpty('country', regionName(str(oa.iso_country)));
  fillIfEmpty('latitude', numf(oa.latitude_deg));
  fillIfEmpty('longitude', numf(oa.longitude_deg));

  if (OPTS.force || !str(airport.about)) data.about = buildAbout(oa, runways, airport);
  return Object.keys(data).length ? data : null;
}

/* ── checkpoint ── */
async function loadCp() { if (OPTS.fresh) return { processed: {} }; try { return JSON.parse(await readFile(CHECKPOINT, 'utf8')); } catch { return { processed: {} }; } }
async function saveCp(cp) { await writeFile(CHECKPOINT, JSON.stringify(cp, null, 2)); }

function isNeedy(a) {
  if (OPTS.all || OPTS.force) return true;
  return !str(a.about) || !str(a.icao) || a.latitude == null || a.longitude == null;
}

async function main() {
  if (OPTS.write && !WRITE_TOKEN) { console.error('FATAL: --write requires STRAPI_WRITE_TOKEN.'); process.exit(1); }
  console.log(`Mode: ${OPTS.write ? 'WRITE' : 'DRY-RUN'} | strapi: ${STRAPI_URL}`);

  const [airportRows, runwayRows] = await Promise.all([loadCsv(AIRPORTS_URL, 'airports.csv'), loadCsv(RUNWAYS_URL, 'runways.csv')]);
  const oaByIata = new Map();
  for (const r of airportRows) { const ia = (r.iata_code || '').toUpperCase(); if (ia) oaByIata.set(ia, r); }
  const rwByIdent = new Map();
  for (const r of runwayRows) { const id = r.airport_ident; if (!id) continue; (rwByIdent.get(id) || rwByIdent.set(id, []).get(id)).push(r); }
  console.log(`OurAirports: ${oaByIata.size} airports with IATA, ${runwayRows.length} runways.\n`);

  const cp = await loadCp();
  let airports = await fetchAllAirports();
  console.log(`Strapi airports: ${airports.length}`);
  airports = OPTS.only.length ? airports.filter((a) => OPTS.only.includes((a.iata || '').toUpperCase())) : airports.filter(isNeedy);
  if (!OPTS.only.length && !OPTS.force) airports = airports.filter((a) => !cp.processed[a.iata]);
  if (OPTS.limit) airports = airports.slice(0, OPTS.limit);
  console.log(`Candidates this run: ${airports.length}\n`);

  const stats = { updated: 0, wouldUpdate: 0, noMatch: 0, noChange: 0, errors: 0 };
  for (let i = 0; i < airports.length; i++) {
    const a = airports[i];
    const iata = (a.iata || '').toUpperCase();
    const tag = `[${i + 1}/${airports.length}] ${iata}`;
    const oa = oaByIata.get(iata);
    if (!oa) { stats.noMatch++; cp.processed[iata] = { status: 'no_match' }; console.log(`${tag} not in OurAirports`); continue; }
    const runways = rwByIdent.get(oa.ident) || [];
    try {
      const update = buildUpdate(a, oa, runways);
      if (!update) { stats.noChange++; cp.processed[iata] = { status: 'no_change' }; console.log(`${tag} nothing to fill`); }
      else if (OPTS.write) {
        await strapiUpdateAirport(a.documentId, update);
        stats.updated++; cp.processed[iata] = { status: 'updated', fields: Object.keys(update) };
        console.log(`${tag} updated: ${Object.keys(update).join(', ')} (${runways.filter((r)=>r.closed!=='1').length} runways)`);
      } else {
        stats.wouldUpdate++;
        console.log(`${tag} would set: ${Object.keys(update).join(', ')} (${runways.filter((r)=>r.closed!=='1').length} runways)`);
        if (i === 0) console.log('   about preview:\n   ' + (update.about || '').split('\n').join('\n   '));
      }
    } catch (e) { stats.errors++; cp.processed[iata] = { status: 'error' }; console.error(`${tag} ERROR: ${e.message}`); }
    await saveCp(cp);
    if (OPTS.write && i < airports.length - 1) await sleep(OPTS.sleep);
  }
  console.log('\n──────── summary ────────');
  console.log(stats);
  if (!OPTS.write) console.log('DRY-RUN — nothing written. Add --write (+ STRAPI_WRITE_TOKEN) to persist.');
}
main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
